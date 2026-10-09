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

test('the view takes no per-view access token (API_DESIGN decision 1)', () => {
  const config = JSON.parse(read(join(pkg, 'nitrogen/generated/shared/json/MapboxMapViewConfig.json'))) as {
    validAttributes: Record<string, boolean>
  }
  assert.deepEqual(Object.keys(config.validAttributes).sort(), [
    'camera',
    'enableGestures',
    'hybridRef',
    'projection',
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
  assert.match(read(join(pkg, 'NitroMapboxARNativeMap.podspec')), /s\.ios\.dependency "MapboxMaps"/)
})

test('MapStyles holds the SDK 11.32.0 Standard style URIs', async () => {
  const { MapStyles } = await import('../packages/native-mapbox/src/MapStyles')
  // Style/Generated/MapStyle+Standard.swift:154 and MapStyle+StandardSatellite.swift:88 at 11.32.0.
  assert.equal(MapStyles.standard, 'mapbox://styles/mapbox/standard')
  assert.equal(MapStyles.standardSatellite, 'mapbox://styles/mapbox/standard-satellite')
})
