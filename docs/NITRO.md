# Nitro core

`@mikevocalz/nitro-mapbox-ar` has one Nitro root, `MapboxAR`, implemented in
C++ for iOS and Android. Nitrogen 0.37.1 generates its spec and autolinking
from `src/native/MapboxAR.nitro.ts`; the output is committed under
`nitrogen/generated` and checked by `npm run check:nitrogen`.

C++ covers both platforms with one implementation. The terrain math does not
depend on the platform, and large height buffers cross as Nitro `ArrayBuffer`s
instead of through the legacy bridge. GPU buffers stay on the GPU and never
travel through Nitro.

## Files

| File | Role |
| --- | --- |
| `nitro.json` | `cxxNamespace: ["mapboxar"]`, iOS module and Android library `NitroMapboxAR`, autolinks `MapboxAR` to the C++ class `HybridMapboxAR` on both platforms. `ignorePaths` keeps `packages/`, `tests/`, `examples/` and tooling out of the spec scan, because Nitrogen globs `**/*.nitro.ts` from the package root (`nitrogen/lib/nitrogen.js`, `runNitrogen`). |
| `src/native/MapboxAR.nitro.ts` | The spec: `accessToken`, `decodeTerrainRgb`, `decodeTerrainRgbAsync`. |
| `cpp/HybridMapboxAR.{hpp,cpp}` | `margelo::nitro::mapboxar::HybridMapboxAR`, inherits the generated `HybridMapboxARSpec`. |
| `cpp/TerrainRgbCodec.hpp` | Formula, input validation, 1 MiB sync limit, pixel loop. No Nitro dependency. |
| `cpp/SerialWorkQueue.{hpp,cpp}` | The worker thread `decodeTerrainRgbAsync` runs on. |
| `cpp/AccessTokenStore.{hpp,cpp}` | Process-wide token storage. |
| `ios/Nitro/MapboxARAccessToken.{h,mm}` | Objective-C reader of the token for other pods. |
| `android/src/main/java/com/margelo/nitro/mapboxar/MapboxARAccessToken.kt` + `android/src/main/cpp/cpp-adapter.cpp` | Kotlin reader of the token for other modules, over JNI. |

Registration is generated. On iOS, `nitrogen/generated/ios/NitroMapboxARAutolinking.mm`
registers `HybridMapboxAR` in `+load`; the podspec pulls it in through
`add_nitrogen_files`. On Android, `JNI_OnLoad` in `cpp-adapter.cpp` calls the
generated `registerAllNatives()`, and `NitroMapboxARPackage` loads the library
through the generated `NitroMapboxAROnLoad.initializeNative()`. The old
hand-written `loadHybridMethods()`, `registerMapboxARCore()` and the
hand-written `+load` file are gone.

JS gets the root with one line in `src/index.ts`:

```ts
export const MapboxAR = NitroModules.createHybridObject<MapboxARSpec>('MapboxAR')
```

The spec type is imported as `MapboxARSpec` and re-exported as
`export type MapboxAR = MapboxARSpec`. TypeScript 7.0.2 rejects an
`import type { MapboxAR }` beside a local `const MapboxAR` (the conflict noted
in `docs/API_DESIGN.md` section 7).

`src/index.web.ts` never imports Nitro. It exports a JS object with the same
three members from `src/native/MapboxAR.web.ts`, typed by
`src/native/MapboxARWeb.ts`, which has no Nitro type imports either.

## `decodeTerrainRgb` and `decodeTerrainRgbAsync`

Both validate with the same messages (`Terrain-RGB input must contain exactly
4 bytes per pixel`, `heightModifier must be finite`) and write native-endian
Float32 heights, 4 bytes per input pixel.

The sync form throws above 1,048,576 bytes (one 512 x 512 tile); the message
names `decodeTerrainRgbAsync` (decision 2 in `docs/API_DESIGN.md` section 11).
On native the error arrives in JS as `Error`, not `RangeError`. Nitro turns a
C++ exception into `jsi::JSError(runtime, funcName + ": " + e.what())`
(`react-native-nitro-modules/cpp/core/HybridFunction.hpp`, lines 120-124), so
no JS subclass survives the crossing. Code that needs to tell this error apart
should match the message. The web object throws a real `RangeError` with the
same text.

The async form:

1. validates and copies the input on the JS thread. A JS-backed `ArrayBuffer`
   throws from `data()` on any other thread (`JSArrayBuffer::data`,
   `cpp/core/ArrayBuffer.cpp` line 84), so the copy is required, and the
   caller may reuse its buffer as soon as the call returns;
2. returns an already-rejected promise for invalid input, so the failure
   arrives as a rejection;
3. decodes on a `SerialWorkQueue` owned by the `HybridMapboxAR` instance, not
   on Nitro's shared pool (`Promise::async` uses `ThreadPool`). Calls run one
   at a time in call order, and each promise resolves with its own input's
   heights;
4. on destruction, the queue runs every submitted job before joining, so no
   promise is left pending.

## Access token: how Swift and Kotlin read it (decision 1)

`MapboxAR.accessToken` is process-wide. The maps package (and the navigation
package, once it exists) must read it from Swift and Kotlin when they create a
`MapView` or a trip session.

**Mechanism: a C++ token store in this package, exposed to Swift through an
Objective-C class and to Kotlin through a JNI method. Swift and Kotlin never
call the `MapboxAR` HybridObject.**

```
JS  MapboxAR.accessToken = t
      └─ HybridMapboxAR::setAccessToken          cpp/HybridMapboxAR.cpp
           └─ mapboxar::setProcessAccessToken   cpp/AccessTokenStore.cpp (mutex)
Swift  MapboxARAccessToken.current               ios/Nitro/MapboxARAccessToken.mm
Kotlin MapboxARAccessToken.current               .../mapboxar/MapboxARAccessToken.kt
        └─ nativeCurrent() (JNI)                 android/src/main/cpp/cpp-adapter.cpp
           └─ mapboxar::processAccessToken()
```

The consumer then hands the value to the SDK through `MapboxOptions.accessToken`
right before it creates the map, as `HybridMapboxMapView` already does.

Why this and not the alternatives:

- **Swift/Kotlin calling the C++ HybridObject.** Not available in Nitro
  0.37.1. No Swift or Kotlin source under `react-native-nitro-modules/ios` or
  `android/src/main/java` references `HybridObjectRegistry` or
  `createHybridObject`; only C++ (`cpp/registry/HybridObjectRegistry.hpp`) and
  JS can create a registered object. A spec with `ios: 'c++'` gets no Swift
  protocol from Nitrogen (`nitrogen/lib/autolinking/ios/createHybridObjectInitializer.js`
  emits only `HybridObjectRegistry::registerHybridObjectConstructor` for
  `c++`). The build-nitro-modules rule against relying on this direction
  stands.
- **The C++ setter writing `MapboxOptions.accessToken` directly.** It would
  make the core link MapboxCommon. `MapboxOptions.accessToken` is a Swift
  extension property in MapboxCommon 24.3.1
  (`MapboxCommon.xcframework/ios-arm64/.../arm64-apple-ios.swiftinterface`,
  line 12, read from `~/whatsupps/apps/expo/ios/Pods/MapboxCommon`) over
  `MBXMapboxOptions`, with no public C++ entry. Calling it from C++ needs an
  Objective-C++ shim plus a MapboxCommon dependency in a package that has no
  other reason to depend on Mapbox. The Android `com.mapbox.common.MapboxOptions`
  class is not installed locally and was not read.
- **Pull instead of push.** Readers fetch the token when they create a map or
  session, so the core never needs to know which SDKs are loaded, and
  `MapboxAR.accessToken = ''` takes effect for every later map and session.

Threading: the setter runs on any JS runtime thread and the readers on the
platform UI thread, with no shared owner, so the store guards one `std::string`
with a `std::mutex`. Neither function calls out while holding the lock.
`std::atomic<std::shared_ptr>` would avoid the lock, but Apple's libc++ does
not ship it.

Linking the readers from the maps package is Phase 4 work and has not been
done or built:

- iOS: `s.dependency "NitroMapboxAR"` in `NitroMapboxARNativeMap.podspec`,
  then `import NitroMapboxAR` and `MapboxARAccessToken.current`.
  `MapboxARAccessToken.h` is the only hand-written public header; Nitrogen's
  `add_nitrogen_files` also makes the generated `HybridMapboxARSpec.hpp`
  public, so the importing pod needs `SWIFT_OBJC_INTEROP_MODE = objcxx`, which
  Nitrogen already sets for the maps pod.
- Android: `implementation project(":mikevocalz_nitro-mapbox-ar")` (the name
  React Native autolinking assigns), then
  `com.margelo.nitro.mapboxar.MapboxARAccessToken.current`. Its `init` calls
  `NitroMapboxAROnLoad.initializeNative()`, so reading the token loads
  `libNitroMapboxAR.so` if nothing loaded it first.

## Tests

- `tests/terrain-rgb-codec.cpp`: the formula at sea level, a positive height
  and a height modifier (`npm run test:cpp`).
- `tests/terrain-rgb-async.cpp`: 8 threads issue 200 decodes through
  `SerialWorkQueue`; asserts call-order completion, no overlap, each result
  matches its own input, the caller can clear its buffer right after the call,
  invalid input never reaches the queue, the 1 MiB limit names the async
  form, the destructor drains, and the token store is safe across threads.
  `tests/terrain-rgb-async.test.ts` compiles and runs it from `npm test` until
  `test:cpp` builds it directly.
- `tests/web-fallback.test.ts`: the web object's token, formula, size limit
  and async ordering.
