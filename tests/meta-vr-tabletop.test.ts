import assert from 'node:assert/strict'
import test from 'node:test'

import { createReactVisionSpatialBridge } from '../packages/reactvision/src/bridge'
import { projectRouteToEnu } from '../packages/reactvision/src/enu'
import { getSpatialHostCapabilities } from '../packages/reactvision/src/getSpatialHostCapabilities'
import type { SpatialHostProbe } from '../packages/reactvision/src/SpatialHostProbe'
import type { ReactVisionGeospatialNavigator } from '../packages/reactvision/src/types'
import {
  METAVRX_BOM,
  QUEST_ONLY_FEATURES,
  QUEST_ONLY_PERMISSIONS,
  addMetavrxBom,
  mobileFlavorManifest,
} from '../examples/reference-app/plugins/metaVR.js'
import { fitRouteToTable } from '../examples/reference-app/src/spatial/fitRouteToTable'
import { resolveRoutePlacement } from '../examples/reference-app/src/spatial/resolveRoutePlacement'

const POSE = {
  latitude: 40.758,
  longitude: -73.9855,
  altitude: 12,
  heading: 0,
  quaternion: [0, 0, 0, 1] as [number, number, number, number],
  horizontalAccuracy: 1,
  verticalAccuracy: 1,
  headingAccuracy: 1,
  orientationYawAccuracy: 1,
}

function recordingNavigator(calls: string[]): ReactVisionGeospatialNavigator {
  const record = <T>(name: string, value: T): T => {
    calls.push(name)
    return value
  }
  return {
    isGeospatialModeSupported: async () =>
      record('isGeospatialModeSupported', { supported: true }),
    isLocationAccuracyReduced: async () =>
      record('isLocationAccuracyReduced', { reduced: false }),
    setGeospatialModeEnabled: () => {
      record('setGeospatialModeEnabled', undefined)
    },
    getEarthTrackingState: async () =>
      record('getEarthTrackingState', { state: 'Enabled' }),
    getCameraGeospatialPose: async () =>
      record('getCameraGeospatialPose', { success: true, pose: POSE }),
    checkVPSAvailability: async () =>
      record('checkVPSAvailability', { availability: 'Available' as const }),
    createGeospatialAnchor: async () =>
      record('createGeospatialAnchor', { success: false }),
    createTerrainAnchor: async () =>
      record('createTerrainAnchor', { success: false }),
    createRooftopAnchor: async () =>
      record('createRooftopAnchor', { success: false }),
    removeGeospatialAnchor: () => {
      record('removeGeospatialAnchor', undefined)
    },
  }
}

function probeFor(
  navigator: ReactVisionGeospatialNavigator,
  host: { readonly deviceLocation: boolean; readonly headMounted: boolean },
): SpatialHostProbe {
  return {
    isHeadMounted: host.headMounted,
    hasPassthroughLayer: host.headMounted,
    hasWebSocket: true,
    isARSupported: async () => true,
    isGeospatialModeSupported: () => navigator.isGeospatialModeSupported(),
    isColocationAvailable: async () => true,
    hasDeviceLocation: async () => host.deviceLocation,
    isGraphiteAvailable: () => false,
  }
}

test('Meta Quest host: no call path reaches getCameraGeospatialPose()', async () => {
  const calls: string[] = []
  const navigator = recordingNavigator(calls)

  const host = await getSpatialHostCapabilities(
    probeFor(navigator, { deviceLocation: false, headMounted: true }),
  )
  const placement = await resolveRoutePlacement(
    host,
    createReactVisionSpatialBridge(navigator),
  )

  assert.equal(host.hasDeviceLocation, false)
  assert.equal(host.supportsGeospatialAnchors, false)
  assert.deepEqual(placement, { kind: 'tabletop' })
  assert.deepEqual(calls, [])
})

test('a host claiming geospatial without location still never reads the pose', async () => {
  const calls: string[] = []
  const navigator = recordingNavigator(calls)
  const handBuilt = {
    isImmersive: true,
    supportsGeospatialAnchors: true,
    supportsVps: true,
    supportsColocation: false,
    supportsGaze: true,
    isGraphiteAvailable: false,
    hasDeviceLocation: false,
    supportsPassthrough: true,
    supportsReplicatedState: false,
  }

  const placement = await resolveRoutePlacement(
    handBuilt,
    createReactVisionSpatialBridge(navigator),
  )

  assert.deepEqual(placement, { kind: 'tabletop' })
  assert.deepEqual(calls, [])
})

test('a host with location and geospatial anchors reads the pose once', async () => {
  const calls: string[] = []
  const navigator = recordingNavigator(calls)

  const host = await getSpatialHostCapabilities(
    probeFor(navigator, { deviceLocation: true, headMounted: false }),
  )
  const placement = await resolveRoutePlacement(
    host,
    createReactVisionSpatialBridge(navigator),
  )

  assert.equal(placement.kind, 'geospatial')
  assert.equal(
    calls.filter((name) => name === 'getCameraGeospatialPose').length,
    1,
  )
})

test('no AR navigator mounted (a VR scene) means tabletop', async () => {
  const calls: string[] = []
  const host = await getSpatialHostCapabilities(
    probeFor(recordingNavigator(calls), { deviceLocation: true, headMounted: false }),
  )
  calls.length = 0

  assert.deepEqual(await resolveRoutePlacement(host, undefined), {
    kind: 'tabletop',
  })
  assert.deepEqual(calls, [])
})

test('fitRouteToTable scales the widest extent to the table radius', () => {
  const origin = {
    frame: { kind: 'route-start' as const, routeId: 'r' },
    latitude: 40.758,
    longitude: -73.9855,
    altitude: 0,
  }
  const points = projectRouteToEnu(origin, [
    { latitude: 40.758, longitude: -73.9855 },
    { latitude: 40.7061, longitude: -73.9969 },
  ])
  const fit = fitRouteToTable(points, 0.35)

  const placed = points.map(([x, y, z]) => [
    x * fit.scale + fit.offset[0],
    y * fit.scale + fit.offset[1],
    z * fit.scale + fit.offset[2],
  ])
  const radii = placed.map(([x, , z]) => Math.hypot(x!, z!))
  assert.ok(Math.abs(Math.max(...radii) - 0.35) < 1e-9)
  // The lowest point rests on the table. Earth curvature puts the far end
  // ~2.6 m below the start's tangent plane, under 1 mm once scaled.
  const heights = placed.map(([, y]) => y!)
  assert.ok(Math.abs(Math.min(...heights)) < 1e-12)
  assert.ok(Math.max(...heights) < 1e-3)
  // About 5.8 km of trip on a 0.7 m table.
  assert.ok(fit.scale > 1e-4 && fit.scale < 2e-4)
})

test('fitRouteToTable rejects empty routes and bad radii', () => {
  assert.throws(() => fitRouteToTable([], 0.35), RangeError)
  assert.throws(() => fitRouteToTable([[0, 0, 0]], 0), RangeError)
  assert.throws(() => fitRouteToTable([[Number.NaN, 0, 0]], 0.35), RangeError)
  assert.deepEqual(fitRouteToTable([[2, 1, 3]], 0.35).scale, 1)
})

const EXPO_APP_GRADLE = `apply plugin: "com.android.application"

android {
    namespace "com.example"
}

dependencies {
    implementation("com.facebook.react:react-android")
}
`

test('withMetaVR adds the MetaVRX BOM once', () => {
  const once = addMetavrxBom(EXPO_APP_GRADLE)
  assert.match(
    once,
    /dependencies \{\n {4}implementation platform\("com\.meta\.metavrx:metavrx-bom:1\.2026\.0\.0"\)\n/,
  )
  assert.equal(addMetavrxBom(once), once)
  assert.equal(once.split(METAVRX_BOM).length, 2)
  assert.throws(
    () => addMetavrxBom('android {}\n'),
    /no top-level `dependencies \{` block/,
  )
})

test('the mobile flavor manifest removes every Quest-only entry Viro adds', () => {
  const xml = mobileFlavorManifest()
  for (const name of [...QUEST_ONLY_FEATURES, ...QUEST_ONLY_PERMISSIONS]) {
    assert.ok(
      xml.includes(`android:name="${name}" tools:node="remove"`),
      `${name} is not removed`,
    )
  }
  assert.ok(xml.includes('<activity android:name=".VRActivity" tools:node="remove" />'))
  assert.ok(
    xml.includes('<meta-data android:name="com.oculus.supportedDevices" tools:node="remove" />'),
  )
  assert.ok(xml.includes('xmlns:tools="http://schemas.android.com/tools"'))
})
