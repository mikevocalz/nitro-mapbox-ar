// Every call-site example in docs/API_DESIGN.md, verbatim. Each `#region`
// block is copied into the doc by name; edit here, then regenerate the doc.
import { MapboxAR } from './core/index'
import {
  decodeTerrainRgb,
  MapboxNavigationClient,
  MapboxSearchClient,
  NavigationSession,
  selectRendererBackend,
  type FetchLike,
} from './core/core-entry'
import {
  MapboxMaps,
  MapStyles,
  type MapboxMapViewRef,
  type MapStyle,
} from './maps/index'
import { MapboxNavigation, type TripProgress } from './navigation/index'
import {
  canShareColocationFrame,
  getSpatialHostCapabilities,
  type SpatialHostCapabilities,
  type SpatialHostProbe,
} from './reactvision/index'

// Host values the examples assume. Declared, not implemented.
declare const MAPBOX_TOKEN: string
declare const tileRgba: ArrayBuffer
declare const regionRgba: ArrayBuffer
declare const mapRef: { readonly current: MapboxMapViewRef | null }
declare const store: {
  setZoom(zoom: number): void
  setProgress(progress: TripProgress): void
}
declare const viroProbe: SpatialHostProbe
declare const lensFetch: FetchLike
declare function renderFallbackMap(): void
declare function anchorRouteToTable(): void
declare function anchorRouteToGeospatialPose(): void
declare function drawHeights(heights: Float32Array): void

/** Doc example: MapboxAR happy path. */
export async function mapboxArHappyPath(): Promise<void> {
  // #region mapbox-ar-happy
  MapboxAR.accessToken = MAPBOX_TOKEN

  // One 512 x 512 tile: decode on the JS thread.
  const tileHeights = new Float32Array(MapboxAR.decodeTerrainRgb(tileRgba, 1))
  drawHeights(tileHeights)

  // A stitched region: decode off the JS thread.
  const regionHeights = await MapboxAR.decodeTerrainRgbAsync(regionRgba, 1)
  drawHeights(new Float32Array(regionHeights))
  // #endregion
}

/** Doc example: MapboxAR unavailable (no Nitro runtime). */
export function mapboxArUnavailable(): void {
  // #region mapbox-ar-unavailable
  // Web harness or Lens Studio: no Nitro runtime, so no MapboxAR root.
  // The `core` entry decodes in JS with the same contract.
  const heights = new Float32Array(decodeTerrainRgb(tileRgba, 1))
  drawHeights(heights)
  // #endregion
}

/** Doc example: MapboxAR invalid input and cleanup. */
export function mapboxArInvalidInput(): void {
  // #region mapbox-ar-invalid
  const truncated = tileRgba.slice(0, tileRgba.byteLength - 1)
  try {
    MapboxAR.decodeTerrainRgb(truncated, 1)
  } catch (error) {
    // "Terrain-RGB input must contain exactly 4 bytes per pixel"
    console.warn((error as Error).message)
  }

  // Sign-out: clear the token. Native maps and trip sessions created after
  // this reject with "Mapbox access token is not set".
  MapboxAR.accessToken = ''
  // #endregion
}

/** Doc example: MapboxMapView happy path. */
export async function mapViewHappyPath(): Promise<() => void> {
  // #region map-view-happy
  const map = mapRef.current
  if (map === null) throw new Error('MapboxMapView is not mounted')

  const style = await map.loadStyle(MapStyles.standard)
  await style.addRasterDemSource({
    id: 'mapbox-dem',
    url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
  })
  await style.setTerrain({ sourceId: 'mapbox-dem', exaggeration: 1.4 })
  await style.setStandardConfig({ lightPreset: 'dusk', show3dObjects: true })

  const cameraSub = map.addOnCameraChangedListener((state) => {
    store.setZoom(state.zoom)
  })
  const end = await map.flyTo(
    { center: { latitude: 40.7484, longitude: -73.9857 }, zoom: 15, pitchDeg: 60 },
    { durationMs: 2000 },
  )
  if (end === 'interrupted') console.info('user took over the camera')

  return () => cameraSub.remove()
  // #endregion
}

/** Doc example: MapboxMapView unavailable capability. */
export async function mapViewUnavailable(): Promise<void> {
  // #region map-view-unavailable
  if (!MapboxMaps.isMapViewAvailable) {
    // For example visionOS without a Maps SDK slice: do not mount the view.
    renderFallbackMap()
    return
  }

  const map = mapRef.current
  if (map === null) return
  const style: MapStyle = await map.loadStyle(MapStyles.standard)
  if (MapboxMaps.capabilities.supportsTerrain) {
    await style.addRasterDemSource({
      id: 'mapbox-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
    })
    await style.setTerrain({ sourceId: 'mapbox-dem' })
  }
  // Without terrain support the map stays flat; setTerrain would reject.
  // #endregion
}

/** Doc example: MapboxMapView invalid input and cleanup. */
export async function mapViewInvalidInput(): Promise<void> {
  // #region map-view-invalid
  const map = mapRef.current
  if (map === null) return

  const markers = await map.createPointAnnotationManager()
  const tapSub = markers.addOnAnnotationTapListener((id) => console.info(id))
  const errorSub = map.addOnMapLoadingErrorListener((error) => {
    console.warn(error.message)
  })
  try {
    await markers.setAnnotations([
      { id: 'a', coordinate: { latitude: 40.75, longitude: -73.99 } },
      { id: 'a', coordinate: { latitude: 40.76, longitude: -73.98 } },
    ])
  } catch (error) {
    // Rejects: duplicate annotation id "a".
    console.warn((error as Error).message)
  } finally {
    tapSub.remove()
    errorSub.remove()
    await markers.removeFromMap()
  }
  // #endregion
}

/** Doc example: TripSession happy path. */
export async function tripSessionHappyPath(): Promise<() => Promise<void>> {
  // #region trip-session-happy
  const requestUrl =
    'https://api.mapbox.com/directions/v5/mapbox/driving-traffic/' +
    '-73.9857,40.7484;-73.9680,40.7851' +
    `?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`
  const response = await fetch(requestUrl)
  const responseJson = await response.text()

  const trip = await MapboxNavigation.createTripSession({
    enableElectronicHorizon: true,
  })
  const progressSub = trip.addOnProgressListener((progress) => {
    store.setProgress(progress)
  })
  const rerouteSub = trip.addOnRerouteListener((event) => {
    console.info(`rerouted: ${event.legs.length} legs`)
  })
  await trip.setRoutes({ responseJson, requestUrl })
  const horizon = await trip.getElectronicHorizon()
  if (horizon !== undefined) console.info(horizon.edges.length)

  return async () => {
    progressSub.remove()
    rerouteSub.remove()
    await trip.stop()
  }
  // #endregion
}

/** Doc example: TripSession unavailable capability. */
export async function tripSessionUnavailable(): Promise<void> {
  // #region trip-session-unavailable
  if (!MapboxNavigation.capabilities.activeGuidance) {
    // No native guidance on this host: plan with the JS session instead.
    const session = new NavigationSession({
      client: new MapboxNavigationClient({ accessToken: MAPBOX_TOKEN }),
    })
    const planned = await session.planRoute([
      { longitude: -73.9857, latitude: 40.7484 },
      { longitude: -73.968, latitude: 40.7851 },
    ])
    await session.start(planned.primary)
    return
  }
  // #endregion
}

/** Doc example: TripSession invalid input and cleanup. */
export async function tripSessionInvalidInput(
  responseJson: string,
  requestUrl: string,
): Promise<void> {
  // #region trip-session-invalid
  const trip = await MapboxNavigation.createTripSession({
    locationSource: 'replay-primary-route',
  })
  const errorSub = trip.addOnErrorListener((error) => console.warn(error.message))
  try {
    await trip.setRoutes({ responseJson, requestUrl, primaryRouteIndex: 7 })
  } catch (error) {
    // Rejects: primaryRouteIndex 7 is out of range.
    console.warn((error as Error).message)
  } finally {
    errorSub.remove()
    await trip.stop()
  }
  // #endregion
}

/** Doc example: SpatialHostCapabilities happy path. */
export async function spatialHappyPath(): Promise<void> {
  // #region spatial-happy
  const host = await getSpatialHostCapabilities(viroProbe)
  const backend = selectRendererBackend('auto', {
    graphite: host.isGraphiteAvailable,
    webgpu: true,
    sharedDawnDevice: host.isGraphiteAvailable,
    nitro: true,
  })
  // visionOS reports isGraphiteAvailable: false, so 'auto' lands on 'webgpu'.
  console.info(backend)
  // #endregion
}

/** Doc example: SpatialHostCapabilities unavailable capability. */
export async function spatialUnavailable(): Promise<void> {
  // #region spatial-unavailable
  const host = await getSpatialHostCapabilities(viroProbe)
  if (!host.hasDeviceLocation || !host.supportsGeospatialAnchors) {
    // Meta Quest: no GPS. Anchor the route to a table, never to
    // getCameraGeospatialPose().
    anchorRouteToTable()
    return
  }
  anchorRouteToGeospatialPose()
  // #endregion
}

/** Doc example: SpatialHostCapabilities invalid input and cleanup. */
export async function spatialInvalidInput(): Promise<SpatialHostCapabilities> {
  // #region spatial-invalid
  const phone = { peerId: 'p1', platform: 'ios' } as const
  const browser = { peerId: 'w1', platform: 'web' } as const
  if (!canShareColocationFrame(phone, browser)) {
    console.info('web peers join as spectators, not in the shared frame')
  }

  try {
    return await getSpatialHostCapabilities(viroProbe)
  } catch (error) {
    // A probe query rejected; the message names it. Report nothing as
    // available rather than guessing from the platform.
    console.warn((error as Error).message)
    return {
      isImmersive: false,
      supportsGeospatialAnchors: false,
      supportsVps: false,
      supportsColocation: false,
      supportsGaze: false,
      isGraphiteAvailable: false,
      hasDeviceLocation: false,
      supportsPassthrough: false,
      supportsReplicatedState: false,
    }
  }
  // #endregion
}

/** Doc example: core entry happy path. */
export async function coreHappyPath(): Promise<void> {
  // #region core-happy
  // Web harness: global fetch exists, so fetchImpl is optional.
  const search = new MapboxSearchClient({ accessToken: MAPBOX_TOKEN })
  const places = await search.forward('Empire State Building', { limit: 1 })
  console.info(places.features.length)
  // #endregion
}

/** Doc example: core entry unavailable capability. */
export async function coreUnavailable(): Promise<void> {
  // #region core-unavailable
  // Lens Studio: no global fetch. Pass the host's transport.
  const navigation = new MapboxNavigationClient({
    accessToken: MAPBOX_TOKEN,
    fetchImpl: lensFetch,
  })
  const response = await navigation.directions([
    { longitude: -73.9857, latitude: 40.7484 },
    { longitude: -73.968, latitude: 40.7851 },
  ])
  console.info(response.routes.length)
  // #endregion
}

/** Doc example: core entry invalid input and cleanup. */
export async function coreInvalidInput(): Promise<void> {
  // #region core-invalid
  const navigation = new MapboxNavigationClient({
    accessToken: MAPBOX_TOKEN,
    fetchImpl: lensFetch,
  })
  const controller = new AbortController()
  try {
    // Throws RangeError: at least two coordinates are required.
    await navigation.directions([{ longitude: 0, latitude: 0 }], {
      signal: controller.signal,
    })
  } catch (error) {
    console.warn((error as Error).message)
  } finally {
    controller.abort()
  }
  // #endregion
}
