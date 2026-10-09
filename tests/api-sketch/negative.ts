// Compile-time fixtures: each `@ts-expect-error` line must fail to typecheck.
// If a line starts compiling, tsc reports the unused directive and the gate
// fails.
import type { NavigationProgressSnapshot } from '../../src/navigation/contracts'
import { MapboxAR } from './core/index'
import type { ListenerSubscription } from './core/ListenerSubscription'
import {
  MapboxMaps,
  type CameraAnimationEnd,
  type MapboxMapViewProps,
  type MapboxMapViewRef,
  type MapStyle,
  type RasterDemSource,
} from './maps/index'
import {
  MapboxNavigation,
  type TripProgress,
  type TripSession,
  type TripSessionOptions,
} from './navigation/index'
import type {
  ColocationPeer,
  SpatialHostCapabilities,
} from './reactvision/index'

declare const map: MapboxMapViewRef
declare const style: MapStyle
declare const trip: TripSession
declare const host: SpatialHostCapabilities
declare const rgba: Uint8Array
declare const end: CameraAnimationEnd

/** Invalid uses of the sketched API. Never called. */
export function invalidUses(): void {
  // The access-token helpers are gone; assign the property instead.
  // @ts-expect-error setAccessToken was removed
  MapboxAR.setAccessToken('pk.test')

  // @ts-expect-error assertAccessToken was removed
  MapboxAR.assertAccessToken()

  // @ts-expect-error decodeTerrainRgb takes an ArrayBuffer, not a view
  MapboxAR.decodeTerrainRgb(rgba, 1)

  // @ts-expect-error 'noon' is not a StandardLightPreset
  void style.setStandardConfig({ lightPreset: 'noon' })

  const props: MapboxMapViewProps = {
    styleUri: 'mapbox://styles/mapbox/standard',
    // @ts-expect-error 'robinson' is not a MapProjection
    projection: 'robinson',
  }
  void props

  const tokenProp: MapboxMapViewProps = {
    styleUri: 'mapbox://styles/mapbox/standard',
    // @ts-expect-error the view has no token prop; MapboxAR.accessToken is the source
    accessToken: 'pk.test',
  }
  void tokenProp

  // @ts-expect-error a raster DEM source needs a url
  const dem: RasterDemSource = { id: 'dem' }
  void dem

  // @ts-expect-error sources are added per kind; there is no generic addSource
  void style.addSource({ id: 'dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1' })

  // @ts-expect-error camera commands live on the view, not on MapStyle
  void style.flyTo({ zoom: 3 })

  // @ts-expect-error capabilities are observed state, not settings
  MapboxMaps.capabilities.supportsTerrain = true

  // @ts-expect-error availability is reported by the host
  MapboxMaps.isMapViewAvailable = true

  // @ts-expect-error listeners return a subscription, not a numeric id
  const id: number = map.addOnMapTapListener(() => {})
  void id

  // @ts-expect-error 'cancelled' is not a CameraAnimationEnd
  if (end === 'cancelled') return

  // @ts-expect-error setRoutes is a TripSession method, not on the root
  void MapboxNavigation.setRoutes({ responseJson: '{}', requestUrl: '' })

  // @ts-expect-error stop is a TripSession method, not on the root
  void MapboxNavigation.stop()

  // @ts-expect-error 'gps' is not a TripLocationSource
  const options: TripSessionOptions = { locationSource: 'gps' }
  void options

  // @ts-expect-error the root's capabilities are readonly
  MapboxNavigation.capabilities.activeGuidance = true

  // @ts-expect-error requestUrl is required with the response
  void trip.setRoutes({ responseJson: '{}' })

  // @ts-expect-error host capabilities are readonly
  host.isGraphiteAvailable = true

  // @ts-expect-error graphiteOnVisionOS was retired into isGraphiteAvailable
  void host.graphiteOnVisionOS

  // @ts-expect-error the host's platform is not part of the capability model
  void host.platform

  // @ts-expect-error a peer must report its platform
  const peer: ColocationPeer = { peerId: 'x' }
  void peer

  // @ts-expect-error capabilities moved from the view to the MapboxMaps root
  void map.capabilities
}

/** Shape checks that must compile. Never called. */
export function compatibleShapes(progress: TripProgress): void {
  // TripProgress keeps every NavigationProgressSnapshot field except route.
  const snapshotFields: Omit<NavigationProgressSnapshot, 'route'> = progress
  void snapshotFields

  const subscription: ListenerSubscription = trip.addOnProgressListener(() => {})
  subscription.remove()

  // ColocationPlatform is open (decision 7): a new headset joins without a
  // release.
  const headset: ColocationPeer = { peerId: 'h1', platform: 'hololens' }
  void headset
}
