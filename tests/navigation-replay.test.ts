import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { MapboxNavigationClient, type NavigationRoute } from '../src/navigation/client'
import type { NavigationProgressSnapshot } from '../src/navigation/contracts'
import { NavigationSession } from '../src/navigation/session'

interface ExpectedProgress {
  readonly fractionTraveled: number
  readonly distanceRemaining: number
  readonly durationRemaining: number
  readonly currentLegIndex: number
  readonly currentStepIndex: number
}

interface RecordedDrive {
  readonly tolerance: {
    readonly fractionTraveled: number
    readonly distanceRemainingM: number
    readonly durationRemainingS: number
  }
  readonly route: NavigationRoute
  readonly samples: readonly {
    readonly tSeconds: number
    readonly location: { readonly longitude: number; readonly latitude: number }
    readonly bearing: number
    readonly speedMetersPerSecond: number
    readonly expected: ExpectedProgress
  }[]
}

const drive = JSON.parse(
  readFileSync(new URL('./fixtures/navigation/recorded-drive.json', import.meta.url), 'utf8'),
) as RecordedDrive

/**
 * Compares one progress update with the fixture. The same check applies to
 * native `NavigationProgress` events recorded on a device, which carry the
 * same fields.
 */
function assertWithinTolerance(
  actual: Pick<NavigationProgressSnapshot, keyof ExpectedProgress>,
  expected: ExpectedProgress,
  label: string,
): void {
  const { tolerance } = drive
  const close = (a: number, b: number, limit: number, field: string) =>
    assert.ok(Math.abs(a - b) <= limit, `${label} ${field}: ${a} vs expected ${b} (limit ${limit})`)
  close(actual.fractionTraveled, expected.fractionTraveled, tolerance.fractionTraveled, 'fractionTraveled')
  close(actual.distanceRemaining, expected.distanceRemaining, tolerance.distanceRemainingM, 'distanceRemaining')
  close(actual.durationRemaining, expected.durationRemaining, tolerance.durationRemainingS, 'durationRemaining')
  assert.equal(actual.currentLegIndex, expected.currentLegIndex, `${label} currentLegIndex`)
  assert.equal(actual.currentStepIndex, expected.currentStepIndex, `${label} currentStepIndex`)
}

function sessionPlanning(route: NavigationRoute): NavigationSession {
  const client = new MapboxNavigationClient({
    accessToken: 'pk.test',
    fetchImpl: async () => new Response(JSON.stringify({ code: 'Ok', routes: [route] }), { status: 200 }),
  })
  return new NavigationSession({ client })
}

test('replaying the recorded drive through NavigationSession matches the fixture progress', async () => {
  const session = sessionPlanning(drive.route)
  const planned = await session.planRoute([
    { longitude: -73.986, latitude: 40.748 },
    { longitude: -73.986, latitude: 40.752 },
    { longitude: -73.981, latitude: 40.752 },
  ])
  await session.start(planned.primary)
  assert.equal(await session.progress(), null)

  let previousFraction = -1
  for (const sample of drive.samples) {
    const progress = session.updateLocation({
      location: sample.location,
      bearing: sample.bearing,
      speedMetersPerSecond: sample.speedMetersPerSecond,
    })
    assertWithinTolerance(progress, sample.expected, `t=${sample.tSeconds}s`)
    assert.ok(progress.fractionTraveled >= previousFraction, `t=${sample.tSeconds}s went backwards`)
    previousFraction = progress.fractionTraveled
    assert.deepEqual(progress.location, sample.location)
    assert.equal(progress.bearing, sample.bearing)
    assert.equal(progress.speedMetersPerSecond, sample.speedMetersPerSecond)
    assert.equal(progress.route, planned.primary)
    assert.equal(await session.progress(), progress)
  }

  const last = drive.samples.at(-1)!
  assert.equal(last.expected.fractionTraveled, 1)
  await session.stop()
  assert.equal(await session.progress(), null)
})

test('the tolerance check rejects a progress stream that drifts past it', () => {
  const sample = drive.samples[5]!
  assert.throws(
    () => assertWithinTolerance(
      { ...sample.expected, distanceRemaining: sample.expected.distanceRemaining + drive.tolerance.distanceRemainingM + 1 },
      sample.expected,
      'drifted',
    ),
    /distanceRemaining/,
  )
})

test('updateLocation needs an active route and no native provider', async () => {
  const session = sessionPlanning(drive.route)
  assert.throws(
    () => session.updateLocation({ location: drive.samples[0]!.location }),
    /call start\(route\) before updateLocation/,
  )
})

test('planRoute hands the provider the request URL and route index', async () => {
  const seen: { requestUrl: string; routeIndex: number }[] = []
  const client = new MapboxNavigationClient({
    accessToken: 'pk.test',
    fetchImpl: async () => new Response(
      JSON.stringify({ code: 'Ok', routes: [drive.route, { ...drive.route, duration: 999 }] }),
      { status: 200 },
    ),
  })
  const session = new NavigationSession({
    client,
    nativeProvider: {
      capabilities: {
        activeGuidance: true,
        rerouting: true,
        trafficRefresh: false,
        incidents: false,
        predictiveCaching: false,
        offlineRegions: false,
        electronicHorizon: false,
      },
      async startTripSession() {},
      async stopTripSession() {},
      async setRoute(_route, source) {
        if (source) seen.push({ ...source })
      },
      async getProgress() { return null },
      async getElectronicHorizon() { return null },
    },
  })
  const planned = await session.planRoute([
    { longitude: -73.986, latitude: 40.748 },
    { longitude: -73.981, latitude: 40.752 },
  ])
  await session.start(planned.alternatives[0]!)
  assert.equal(seen.length, 1)
  assert.equal(seen[0]!.routeIndex, 1)
  assert.match(seen[0]!.requestUrl, /^https:\/\/api\.mapbox\.com\/directions\/v5\/mapbox\/driving-traffic\//)
  assert.throws(() => session.updateLocation({ location: drive.samples[0]!.location }), /native provider/)
})
