import assert from 'node:assert/strict'
import test from 'node:test'

import {
  routeGeometryToCoordinates,
  type NavigationRoute,
} from '../src/navigation/client'

const route = (geometry: unknown): NavigationRoute => ({
  distance: 0,
  duration: 0,
  legs: [],
  geometry,
})

test('routeGeometryToCoordinates reads GeoJSON [lng, lat] order', () => {
  // Apollo Theater -> Studio Museum Harlem, as a walking Directions response
  // returns them with geometries=geojson.
  const coordinates = routeGeometryToCoordinates(route({
    type: 'LineString',
    coordinates: [
      [-73.9499948, 40.8100895],
      [-73.947616, 40.8084179],
    ],
  }))

  assert.deepEqual(coordinates, [
    { latitude: 40.8100895, longitude: -73.9499948 },
    { latitude: 40.8084179, longitude: -73.947616 },
  ])
})

test('routeGeometryToCoordinates keeps a third position value as altitude', () => {
  const [first] = routeGeometryToCoordinates(route({
    type: 'LineString',
    coordinates: [[-73.9499948, 40.8100895, 12.5], [-73.947616, 40.8084179]],
  }))
  assert.deepEqual(first, { latitude: 40.8100895, longitude: -73.9499948, altitude: 12.5 })
})

test('routeGeometryToCoordinates rejects encoded polylines', () => {
  assert.throws(
    () => routeGeometryToCoordinates(route('o~nwFzh`bM')),
    /geometries=geojson/,
  )
})

test('routeGeometryToCoordinates rejects missing or malformed geometry', () => {
  assert.throws(() => routeGeometryToCoordinates(route(undefined)), TypeError)
  assert.throws(() => routeGeometryToCoordinates(route({ type: 'Point', coordinates: [0, 0] })), TypeError)
  assert.throws(
    () => routeGeometryToCoordinates(route({ type: 'LineString', coordinates: [[0]] })),
    TypeError,
  )
  assert.throws(
    () => routeGeometryToCoordinates(route({ type: 'LineString', coordinates: [[200, 0], [0, 0]] })),
    RangeError,
  )
})
