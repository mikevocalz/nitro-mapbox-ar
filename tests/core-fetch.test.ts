import assert from 'node:assert/strict'
import test from 'node:test'

import type { FetchLike } from '../src/navigation/client'
import { MapboxNavigationClient } from '../src/navigation/client'
import { MapboxSearchClient } from '../src/search/client'

const A = { longitude: -73.9857, latitude: 40.7484 }
const B = { longitude: -73.968, latitude: 40.7851 }

/** A transport shaped like Lens Studio's InternetModule.fetch: json() only, no arrayBuffer. */
function recordingFetch(body: unknown, status = 200) {
  const calls: { url: string; argCount: number; init?: unknown }[] = []
  const fetchImpl: FetchLike = async (...args: Parameters<FetchLike>) => {
    calls.push({ url: args[0], argCount: args.length, init: args[1] })
    return { ok: status >= 200 && status < 300, status, json: async () => body }
  }
  return { calls, fetchImpl }
}

test('navigation client uses an injected fetch and passes no init without a signal', async () => {
  const { calls, fetchImpl } = recordingFetch({ code: 'Ok', routes: [] })
  const client = new MapboxNavigationClient({ accessToken: 'pk.test', fetchImpl })
  await client.directions([A, B])
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.argCount, 1)
  assert.match(calls[0]!.url, /^https:\/\/api\.mapbox\.com\/directions\/v5\/mapbox\/driving-traffic\//)
})

test('navigation client forwards a caller signal', async () => {
  const { calls, fetchImpl } = recordingFetch({ code: 'Ok', routes: [] })
  const client = new MapboxNavigationClient({ accessToken: 'pk.test', fetchImpl })
  const controller = new AbortController()
  await client.directions([A, B], { signal: controller.signal })
  assert.deepEqual(calls[0]!.init, { signal: controller.signal })
})

test('directionsWithRequestUrl returns the response and the exact URL fetched', async () => {
  const body = { code: 'Ok', routes: [{ distance: 1, duration: 1, legs: [] }] }
  const { calls, fetchImpl } = recordingFetch(body)
  const client = new MapboxNavigationClient({ accessToken: 'pk.secret', fetchImpl })
  const result = await client.directionsWithRequestUrl([A, B], { profile: 'walking' })
  assert.equal(result.response, body)
  assert.equal(result.requestUrl, calls[0]!.url)
  assert.match(result.requestUrl, /\/walking\/-73\.9857,40\.7484;-73\.968,40\.7851\?/)
  assert.match(result.requestUrl, /access_token=pk\.secret/)
})

test('directionsWithRequestUrl rejects on HTTP and API errors without the URL in the message', async () => {
  const http = new MapboxNavigationClient({ accessToken: 'pk.secret', fetchImpl: recordingFetch({}, 401).fetchImpl })
  await assert.rejects(http.directionsWithRequestUrl([A, B]), (error: Error) => {
    assert.equal(error.message, 'Directions API failed with HTTP 401')
    return true
  })
  const api = new MapboxNavigationClient({
    accessToken: 'pk.secret',
    fetchImpl: recordingFetch({ code: 'NoRoute', message: 'No route found' }).fetchImpl,
  })
  await assert.rejects(api.directionsWithRequestUrl([A, B]), /returned NoRoute: No route found/)
  await assert.rejects(api.directionsWithRequestUrl([A, B]), (error: Error) => !error.message.includes('pk.secret'))
})

test('invalid coordinates still throw synchronously', () => {
  const client = new MapboxNavigationClient({ accessToken: 'pk.test', fetchImpl: recordingFetch({}).fetchImpl })
  assert.throws(() => client.directionsWithRequestUrl([A]), RangeError)
  assert.throws(() => client.directions([A]), RangeError)
})

test('search client uses an injected fetch and passes no init without a signal', async () => {
  const { calls, fetchImpl } = recordingFetch({ type: 'FeatureCollection', features: [] })
  const client = new MapboxSearchClient({ accessToken: 'pk.test', fetchImpl })
  const result = await client.forward('Empire State Building', { limit: 1 })
  assert.deepEqual(result.features, [])
  assert.equal(calls[0]!.argCount, 1)
  assert.match(calls[0]!.url, /search\/searchbox\/v1\/forward\?/)

  const suggest = recordingFetch({ suggestions: [] })
  const suggester = new MapboxSearchClient({ accessToken: 'pk.test', fetchImpl: suggest.fetchImpl })
  const controller = new AbortController()
  await suggester.suggest('coffee', { sessionToken: 's', signal: controller.signal })
  assert.deepEqual(suggest.calls[0]!.init, { signal: controller.signal })
})

test('clients default to globalThis.fetch and fail clearly without one', async () => {
  const original = globalThis.fetch
  const { calls, fetchImpl } = recordingFetch({ type: 'FeatureCollection', features: [] })
  try {
    globalThis.fetch = fetchImpl as typeof fetch
    await new MapboxSearchClient({ accessToken: 'pk.test' }).forward('a')
    assert.equal(calls.length, 1)

    Reflect.deleteProperty(globalThis, 'fetch')
    assert.throws(() => new MapboxNavigationClient({ accessToken: 'pk.test' }), /pass fetchImpl/)
    assert.throws(() => new MapboxSearchClient({ accessToken: 'pk.test' }), /pass fetchImpl/)
  } finally {
    globalThis.fetch = original
  }
})
