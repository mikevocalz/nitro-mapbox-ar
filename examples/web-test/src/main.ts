import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import './style.css'

import {
  MapboxNavigationClient,
  MapboxSearchClient,
  getBrowserRendererCapabilities,
  getMapboxARCore,
  listMapboxFeatures,
  selectRendererBackend,
} from '@mapbox/react-native-mapbox-ar'

const $ = <T extends HTMLElement>(id: string) => {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element #${id}`)
  return element as T
}

const tokenInput = $<HTMLInputElement>('token')
const runtimeBadge = $('runtime-badge')
const diagnostics = $('diagnostics')
const searchOutput = $('search-output')
const routeOutput = $('route-output')
const mapStatus = $('map-status')
const searchQuery = $<HTMLInputElement>('search-query')

const envToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined
tokenInput.value = envToken ?? sessionStorage.getItem('mapbox-token') ?? ''

let map: mapboxgl.Map | undefined
let searchMarkers: mapboxgl.Marker[] = []

function currentToken(): string {
  const value = tokenInput.value.trim()
  if (!value) throw new Error('Add a public Mapbox access token first.')
  sessionStorage.setItem('mapbox-token', value)
  return value
}

function addDiagnostic(label: string, value: string): void {
  const row = document.createElement('div')
  row.className = 'diag'
  const left = document.createElement('span')
  const right = document.createElement('span')
  left.textContent = label
  right.textContent = value
  row.append(left, right)
  diagnostics.append(row)
}

async function probeRuntime(): Promise<void> {
  const capabilities = getBrowserRendererCapabilities()
  const backend = selectRendererBackend('auto', capabilities)
  runtimeBadge.textContent = `browser backend: ${backend}`

  addDiagnostic('Browser WebGPU', capabilities.webgpu ? 'available' : 'unavailable')
  addDiagnostic('Nitro runtime', capabilities.nitro ? 'loaded' : 'not loaded')
  addDiagnostic('JS CPU fallback', capabilities.jsCpu ? 'ready' : 'missing')
  addDiagnostic('Selected backend', backend)

  const core = getMapboxARCore()
  const rgb = new Uint8Array([
    1, 134, 160, 255,
    1, 182, 217, 255,
  ])
  const heights = new Float32Array(core.decodeTerrainRgb(rgb.buffer, 1))
  addDiagnostic(
    'Terrain-RGB parity sample',
    `${heights[0].toFixed(1)}m / ${heights[1].toFixed(1)}m`,
  )

  const previewCount = listMapboxFeatures().filter(
    (feature) => feature.status !== 'stable',
  ).length
  addDiagnostic('Capability registry', `${previewCount} gated features`)

  if (capabilities.webgpu) {
    try {
      const adapter = await navigator.gpu?.requestAdapter()
      addDiagnostic('WebGPU adapter', adapter ? 'adapter acquired' : 'not acquired')
    } catch (error) {
      addDiagnostic('WebGPU adapter', error instanceof Error ? error.message : String(error))
    }
  }
}

function startMap(): void {
  const token = currentToken()
  mapboxgl.accessToken = token

  if (map) {
    map.remove()
  }

  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/standard-satellite',
    center: [-73.9855, 40.758],
    zoom: 13.5,
    pitch: 55,
    bearing: -18,
    antialias: true,
  })

  map.addControl(new mapboxgl.NavigationControl(), 'top-right')
  map.on('load', () => {
    mapStatus.textContent = 'Mapbox GL JS loaded. Browser package remains Nitro-free.'
  })
  map.on('error', (event) => {
    mapStatus.textContent = event.error?.message ?? 'Mapbox map error.'
  })
}

async function runSearch(): Promise<void> {
  try {
    const token = currentToken()
    const center = map?.getCenter() ?? { lng: -73.9855, lat: 40.758 }
    const client = new MapboxSearchClient({ accessToken: token })
    const result = await client.forward(searchQuery.value, {
      proximity: {
        longitude: center.lng,
        latitude: center.lat,
      },
      limit: 5,
    })

    for (const marker of searchMarkers) marker.remove()
    searchMarkers = []

    const names: string[] = []
    for (const feature of result.features) {
      const coordinates = feature.geometry?.coordinates
      if (
        Array.isArray(coordinates) &&
        typeof coordinates[0] === 'number' &&
        typeof coordinates[1] === 'number'
      ) {
        const marker = new mapboxgl.Marker({ color: '#4f86ff' })
          .setLngLat([coordinates[0], coordinates[1]])
          .addTo(map!)
        searchMarkers.push(marker)
      }
      const properties = feature.properties ?? {}
      names.push(String(properties.name ?? properties.full_address ?? feature.id ?? 'result'))
    }

    searchOutput.textContent =
      names.length > 0 ? names.map((name, index) => `${index + 1}. ${name}`).join('\n') : 'No results.'
  } catch (error) {
    searchOutput.textContent = error instanceof Error ? error.message : String(error)
  }
}

async function runRoute(): Promise<void> {
  try {
    const token = currentToken()
    const client = new MapboxNavigationClient({ accessToken: token })
    const response = await client.directions([
      { longitude: -73.9855, latitude: 40.758 },
      { longitude: -73.9969, latitude: 40.7061 },
    ])

    const route = response.routes[0]
    if (!route) throw new Error('No route returned.')

    routeOutput.textContent =
      `${(route.distance / 1609.344).toFixed(1)} mi · ${Math.round(route.duration / 60)} min`

    const geometry = route.geometry as
      | { type?: string; coordinates?: [number, number][] }
      | undefined

    if (!map || !geometry?.coordinates?.length) return

    const geojson = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: geometry.coordinates,
      },
    }

    const source = map.getSource('route') as mapboxgl.GeoJSONSource | undefined
    if (source) {
      source.setData(geojson)
    } else {
      map.addSource('route', { type: 'geojson', data: geojson })
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#4f86ff', 'line-width': 7, 'line-opacity': 0.9 },
      })
    }

    const bounds = geometry.coordinates.reduce(
      (value, coordinate) => value.extend(coordinate),
      new mapboxgl.LngLatBounds(geometry.coordinates[0], geometry.coordinates[0]),
    )
    map.fitBounds(bounds, { padding: 70, duration: 900 })
  } catch (error) {
    routeOutput.textContent = error instanceof Error ? error.message : String(error)
  }
}

$('start-map').addEventListener('click', () => {
  try {
    startMap()
  } catch (error) {
    mapStatus.textContent = error instanceof Error ? error.message : String(error)
  }
})
$('run-search').addEventListener('click', () => void runSearch())
$('run-route').addEventListener('click', () => void runRoute())

void probeRuntime()
if (tokenInput.value.trim()) startMap()
