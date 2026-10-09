# Performance

How the reference app (`examples/reference-app`) and the libraries apply Callstack's React Native optimisation guide, and where the device numbers will go.

## Measured numbers

**Not measured yet.** No FPS, TTI or memory figure in this repo comes from a device run. The table below is the slot for them; every cell stays empty until someone runs the procedure further down on that device and commits the output alongside the numbers.

| Device | Build | Cold-start TTI | Map tab FPS (pan, 10 s) | Table tab FPS (immersive, 10 s) | JS heap after 5 tab cycles | Measured on | By |
| --- | --- | --- | --- | --- | --- | --- | --- |
| iPhone (model TBD) | release | not measured | not measured | not measured | not measured | | |
| Pixel (model TBD) | `mobileRelease` | not measured | not measured | not measured | not measured | | |
| Meta Quest 3 | `questRelease` | not measured | n/a (map is a 2D window) | not measured | not measured | | |

Before/after numbers for the changes listed below are not available either: they were made from code review, and the guide's own rule is to measure before claiming a gain.

## Practices applied

Each row names the code that does it.

| Practice (Callstack guide) | Where | What it does |
| --- | --- | --- |
| Atomic state selectors (`js-atomic-state`) | `examples/reference-app/App.tsx` `Tab`, every screen | Each component selects one field from the Zustand store. `Tab` selects `state.mode === mode`, a boolean, so a tab switch re-renders the two tabs whose value changed, not all five |
| No per-render allocation of long-lived objects | `examples/reference-app/src/services.ts` | The agent runtime and both HTTP clients are module-level singletons. The Agent screen used to build a `SpatialAgentRuntime` in `useMemo` on every mount |
| Hoist constant work out of render | `App.tsx` `features` | `listMapboxFeatures()` runs once at module load instead of on every `App` render |
| Stable scene objects | `src/screens/ARScreen.tsx` `initialScene`, `src/screens/TabletopScreen.tsx` `tabletopScene` | Viro scene descriptors are module constants, so a parent re-render never hands the navigator a new `initialScene` |
| Release native resources (`js-memory-leaks`) | `src/mapStore.ts` `detach` | Unmounting the map removes every listener subscription and the point-annotation manager |
| Bounded scene work | `TabletopScreen.tsx` `MAX_ROUTE_DOTS` | The visionOS fallback draws at most 64 spheres for the route, whatever its vertex count |
| Short list, no virtualisation needed (`js-lists-flatlist-flashlist`) | `App.tsx` feature strip, `AgentScreen` results | 9 feature entries (`listMapboxFeatures().length`) and at most 5 search results; a virtualised list would cost more than it saves |
| Off-JS-thread heavy work (`native-threading-model`) | `MapboxAR.decodeTerrainRgbAsync` (`src/native/MapboxAR.nitro.ts`) | Decodes on a C++ worker queue; the sync form refuses inputs over 1 MiB so a stitched region cannot block the JS thread |
| Async native calls (`native-turbo-modules`) | `packages/native-mapbox/src/specs/MapboxMapView.nitro.ts` | Every map method returns a Promise and runs on the UI thread; no sync method hides a thread hop |
| Avoid barrel imports in app code (`bundle-barrel-exports`) | not applied | The app imports from package roots. Tree-shaking those roots has not been measured; see "Not done" |

## Not done

- **React Compiler.** `babel.config.js` has no compiler plugin. The guide adds it after profiling shows cascading re-renders; no profile exists yet.
- **Bundle analysis.** `source-map-explorer` has not been run on a release bundle, so the cost of importing from package roots is unknown.
- **Hermes mmap.** Not applicable on React Native 0.86 (the guide's fix is for 0.78 and earlier).

## How to measure

Run on a release build, cold start only.

1. TTI: add `react-native-performance` marks at process start and at the first `MapScreen` frame with a loaded style (`useMapScreenStore` reaching `ready`). Record 5 cold starts and report the median.
2. FPS: React Native DevTools performance monitor, or `agent-device react-devtools profile start` / `stop` around a 10 second pan on the Map tab and a 10 second session on the Table tab. Report average and 1% low.
3. Re-renders: `agent-device react-devtools profile rerenders --limit 5` while cycling all five tabs.
4. Memory: JS heap snapshot after five cycles through every tab, compared with the first cycle.
5. Quest: same build flavour (`questRelease`), measured with `metavr` / OVR Metrics for frame timing.

Commit the raw output next to the numbers, and fill the table above.
