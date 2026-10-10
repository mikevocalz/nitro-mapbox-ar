import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const pkg = join(import.meta.dirname, '..', 'packages', 'native-mapbox')
const iosDir = join(pkg, 'ios')
const androidDir = join(pkg, 'android/src/main/java/com/margelo/nitro/mapboxar/nativemap')
const inventory = readFileSync(join(import.meta.dirname, '..', 'docs', 'MAPS_SDK_INVENTORY.md'), 'utf8')

const read = (path: string) => readFileSync(path, 'utf8')

/** Method names declared in a `.nitro.ts` interface body, in source order. */
function specMethods(file: string, interfaceName: string): string[] {
  const source = read(join(pkg, 'src/specs', file))
  const start = source.indexOf(`export interface ${interfaceName}`)
  assert.notEqual(start, -1, `${interfaceName} not found in ${file}`)
  const body = source.slice(source.indexOf('{', start), source.indexOf('\n}', start))
  return [...body.matchAll(/^ {2}(\w+)\(/gm)].map((match) => match[1] as string)
}

const nativeSources = (dir: string, extension: string) =>
  readdirSync(dir)
    .filter((name) => name.endsWith(extension))
    .map((name) => read(join(dir, name)))
    .join('\n')

const specs = [
  { file: 'MapboxMapView.nitro.ts', iface: 'MapboxMapViewMethods', swift: 'HybridMapboxMapView.swift', kotlin: 'HybridMapboxMapView.kt' },
  { file: 'MapStyle.nitro.ts', iface: 'MapStyle', swift: 'HybridMapStyle.swift', kotlin: 'HybridMapStyle.kt' },
  { file: 'PointAnnotationManager.nitro.ts', iface: 'PointAnnotationManager', swift: 'HybridPointAnnotationManager.swift', kotlin: 'HybridPointAnnotationManager.kt' },
  { file: 'RenderedFeature.nitro.ts', iface: 'RenderedFeature', swift: 'HybridRenderedFeature.swift', kotlin: 'HybridRenderedFeature.kt' },
]

test('every spec method has a Swift and a Kotlin implementation and an inventory row', () => {
  for (const spec of specs) {
    const methods = specMethods(spec.file, spec.iface)
    assert.ok(methods.length > 0, `no methods parsed from ${spec.iface}`)
    const swift = read(join(iosDir, spec.swift))
    const kotlin = read(join(androidDir, spec.kotlin))
    for (const method of methods) {
      assert.match(swift, new RegExp(`func ${method}\\(`), `${spec.swift} lacks ${method}`)
      assert.match(kotlin, new RegExp(`override fun ${method}\\(`), `${spec.kotlin} lacks ${method}`)
      assert.match(inventory, new RegExp(`\`${method}\``), `MAPS_SDK_INVENTORY.md has no row for ${method}`)
    }
  }
})

/** Field names declared in an interface body, in source order. */
function interfaceFields(path: string, interfaceName: string): string[] {
  const source = read(path)
  const start = source.indexOf(`export interface ${interfaceName}`)
  assert.notEqual(start, -1, `${interfaceName} not found in ${path}`)
  const body = source.slice(source.indexOf('{', start), source.indexOf('\n}', start))
  return [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((match) => match[1] as string)
}

/** String members of an exported literal union type alias. */
function unionMembers(path: string, typeName: string): string[] {
  const match = read(path).match(new RegExp(`export type ${typeName} = ([^\\n]+)`))
  assert.ok(match, `${typeName} not found in ${path}`)
  return [...(match[1] as string).matchAll(/'([^']+)'/g)].map((member) => member[1] as string)
}

test('every view prop is stored by both natives and has an inventory row', () => {
  const props = interfaceFields(join(pkg, 'src/specs/MapboxMapView.nitro.ts'), 'MapboxMapViewProps')
  assert.ok(props.includes('showUserLocation') && props.includes('puckBearing'), `props parsed: ${props.join(', ')}`)
  const swift = read(join(iosDir, 'HybridMapboxMapView.swift'))
  const kotlin = read(join(androidDir, 'HybridMapboxMapView.kt'))
  for (const prop of props) {
    // Both the SDK branch and the visionOS fallback must declare it.
    assert.equal(swift.match(new RegExp(`\\bvar ${prop}\\b`, 'g'))?.length, 2, `HybridMapboxMapView.swift declares ${prop} twice`)
    assert.match(kotlin, new RegExp(`override var ${prop}\\b`), `HybridMapboxMapView.kt lacks ${prop}`)
    assert.match(inventory, new RegExp(`\`${prop}\``), `MAPS_SDK_INVENTORY.md has no row for ${prop}`)
  }
})

test('the location puck maps every bearing and the library never requests location permission', () => {
  assert.deepEqual(unionMembers(join(pkg, 'src/types/LocationPuckBearing.ts'), 'LocationPuckBearing'), ['heading', 'course', 'none'])
  const swift = read(join(iosDir, 'LocationOptions+LocationPuckBearing.swift'))
  assert.match(swift, /case \.heading: bearing = \.heading/)
  assert.match(swift, /case \.course: bearing = \.course/)
  assert.match(swift, /case \.none: bearing = nil/)
  assert.match(swift, /puckType: showUserLocation \? \.puck2D\(\.makeDefault\(showBearing: bearing != nil\)\) : nil/)
  const kotlin = read(join(androidDir, 'LocationPuckBearing+toPuckBearing.kt'))
  assert.match(kotlin, /LocationPuckBearing\.HEADING -> PuckBearing\.HEADING/)
  assert.match(kotlin, /LocationPuckBearing\.COURSE -> PuckBearing\.COURSE/)
  assert.match(kotlin, /LocationPuckBearing\.NONE -> null/)
  const view = read(join(androidDir, 'HybridMapboxMapView.kt'))
  assert.match(view, /enabled = visible/)
  assert.match(view, /locationPuck = createDefault2DPuck\(bearing != null\)/)
  assert.match(view, /puckBearingEnabled = bearing != null/)
  const natives = nativeSources(iosDir, '.swift') + nativeSources(androidDir, '.kt')
  assert.doesNotMatch(natives, /request(WhenInUse|Always)Authorization|requestPermissions|ActivityCompat|ACCESS_(FINE|COARSE)_LOCATION/)
})

test('every Standard config field reaches the import config in both natives', () => {
  const typesFile = join(pkg, 'src/types/StandardStyleConfig.ts')
  const keys = interfaceFields(typesFile, 'StandardStyleConfig').filter((field) => field !== 'importId')
  assert.deepEqual(keys, ['lightPreset', 'theme', 'show3dObjects', 'showPointOfInterestLabels'])
  // StandardTheme in Style/Generated/MapStyle+Standard.swift:158-172 at 11.32.0, minus `custom`.
  assert.deepEqual(unionMembers(typesFile, 'StandardTheme'), ['default', 'faded', 'monochrome'])
  const swift = read(join(iosDir, 'MapboxMap+Style.swift'))
  const kotlin = read(join(androidDir, 'MapboxMap+Style.kt'))
  for (const key of keys) {
    assert.match(swift, new RegExp(`configs\\["${key}"\\] = `), `MapboxMap+Style.swift does not set ${key}`)
    assert.match(kotlin, new RegExp(`properties\\["${key}"\\] = `), `MapboxMap+Style.kt does not set ${key}`)
  }
})

test('style images load off the main thread and validate before the SDK call', () => {
  const swiftStyle = read(join(iosDir, 'HybridMapStyle.swift'))
  assert.match(swiftStyle, /MainThreadPromise\.run\(after: \{ image\.loadImage/)
  assert.match(swiftStyle, /guard scale\.isFinite, scale > 0/)
  const swiftLoader = read(join(iosDir, 'StyleImageSource+UIImage.swift'))
  assert.match(swiftLoader, /Set exactly one of image\.uri and image\.base64/)
  assert.match(swiftLoader, /case "file":[\s\S]*DispatchQueue\.global/)
  assert.match(swiftLoader, /case "http", "https":[\s\S]*URLSession\.shared\.dataTask/)
  const kotlinStyle = read(join(androidDir, 'HybridMapStyle.kt'))
  assert.match(kotlinStyle, /load = \{ image\.decodeBitmap\(\) \}/)
  assert.match(kotlinStyle, /scale\.isFinite\(\) && scale > 0/)
  const kotlinLoader = read(join(androidDir, 'StyleImageSource+decodeBitmap.kt'))
  assert.match(kotlinLoader, /Set exactly one of image\.uri and image\.base64/)
  assert.match(kotlinLoader, /check\(status in 200\.\.299\)/)
  assert.match(read(join(androidDir, 'MainThreadPromise.kt')), /worker\.execute \{[\s\S]*main\.post/)
})

test('the view takes no per-view access token (API_DESIGN decision 1)', () => {
  const config = JSON.parse(read(join(pkg, 'nitrogen/generated/shared/json/MapboxMapViewConfig.json'))) as {
    validAttributes: Record<string, boolean>
  }
  assert.deepEqual(Object.keys(config.validAttributes).sort(), [
    'camera',
    'enableGestures',
    'hybridRef',
    'projection',
    'puckBearing',
    'showUserLocation',
    'styleUri',
  ])
  assert.match(read(join(iosDir, 'MapHost.swift')), /MapboxARAccessToken\.current/)
  assert.match(read(join(androidDir, 'MapHost.kt')), /MapboxARAccessToken\.current/)
})

test('only the root and the view are autolinked', () => {
  const nitro = JSON.parse(read(join(pkg, 'nitro.json'))) as {
    autolinking: Record<string, { ios: { implementationClassName: string }; android: { implementationClassName: string } }>
  }
  assert.deepEqual(Object.keys(nitro.autolinking).sort(), ['MapboxMapView', 'MapboxMaps'])
  for (const [name, entry] of Object.entries(nitro.autolinking)) {
    assert.equal(entry.ios.implementationClassName, `Hybrid${name}`)
    assert.equal(entry.android.implementationClassName, `Hybrid${name}`)
    assert.match(nativeSources(iosDir, '.swift'), new RegExp(`final class Hybrid${name}:`))
    assert.match(nativeSources(androidDir, '.kt'), new RegExp(`class Hybrid${name}\\b`))
  }
})

test('visionOS builds without MapboxMaps: SDK imports are iOS-only and both roots have a fallback', () => {
  for (const name of readdirSync(iosDir).filter((file) => file.endsWith('.swift'))) {
    const source = read(join(iosDir, name))
    const lines = source.split('\n')
    lines.forEach((line, index) => {
      if (!/^import Mapbox(Maps|CoreMaps)$/.test(line)) return
      const guard = lines.slice(0, index).reverse().find((previous) => previous.startsWith('#if') || previous.startsWith('#endif'))
      assert.equal(guard, '#if os(iOS)', `${name}:${index + 1} imports ${line.slice(7)} outside #if os(iOS)`)
    })
  }
  for (const name of ['HybridMapboxMaps.swift', 'HybridMapboxMapView.swift']) {
    const source = read(join(iosDir, name))
    assert.match(source, /#else\n[\s\S]*final class Hybrid/, `${name} has no non-iOS branch`)
  }
  assert.match(read(join(iosDir, 'HybridMapboxMaps.swift')), /#else[\s\S]*let isMapViewAvailable = false/)
  // MapboxMaps comes from SPM so it can share one package with the navigation
  // package's MapboxNavigationCore; a CocoaPod copy redefines the module.
  const podspec = read(join(pkg, 'NitroMapboxARNativeMap.podspec'))
  assert.doesNotMatch(podspec, /s\.(ios\.)?dependency "MapboxMaps"/)
  assert.match(podspec, /url: "https:\/\/github\.com\/mapbox\/mapbox-maps-ios\.git"/)
})

test('MapStyles holds the SDK 11.32.0 Standard style URIs', async () => {
  const { MapStyles } = await import('../packages/native-mapbox/src/MapStyles')
  // Style/Generated/MapStyle+Standard.swift:154 and MapStyle+StandardSatellite.swift:88 at 11.32.0.
  assert.equal(MapStyles.standard, 'mapbox://styles/mapbox/standard')
  assert.equal(MapStyles.standardSatellite, 'mapbox://styles/mapbox/standard-satellite')
})
