import type {
  HybridView,
  HybridViewMethods,
  HybridViewProps,
} from 'react-native-nitro-modules'

import type { ListenerSubscription } from '../types/ListenerSubscription'
import type { CameraAnimationEnd } from '../types/CameraAnimationEnd'
import type { CameraAnimationOptions } from '../types/CameraAnimationOptions'
import type { CameraState } from '../types/CameraState'
import type { CameraTarget } from '../types/CameraTarget'
import type { CoordinateBounds } from '../types/CoordinateBounds'
import type { FitBoundsOptions } from '../types/FitBoundsOptions'
import type { LocationPuckBearing } from '../types/LocationPuckBearing'
import type { MapCapabilities } from '../types/MapCapabilities'
import type { MapProjection } from '../types/MapProjection'
import type { MapStyle } from './MapStyle.nitro'
import type { MapTapEvent } from '../types/MapTapEvent'
import type { PointAnnotationManager } from './PointAnnotationManager.nitro'
import type { RenderedFeature } from './RenderedFeature.nitro'
import type { RenderedFeatureQuery } from '../types/RenderedFeatureQuery'

/**
 * React props of the {@linkcode MapboxMapView} host component.
 *
 * The view reads its token from `MapboxAR.accessToken` in
 * `@mikevocalz/nitro-mapbox-ar` when it creates the native map; there is no
 * per-view token.
 */
export interface MapboxMapViewProps extends HybridViewProps {
  /**
   * Style to load on mount and whenever this prop changes. Each load fires
   * {@linkcode MapboxMapViewMethods.addOnStyleLoadedListener}.
   */
  styleUri: string
  /**
   * Camera to jump to on mount and whenever this prop changes. The map does
   * not write back to it; read the live camera with
   * {@linkcode MapboxMapViewMethods.getCameraState}.
   */
  camera?: CameraTarget
  /** Projection. @default the loaded style's projection */
  projection?: MapProjection
  /** Pan, zoom, rotate and pitch gestures. @default true */
  enableGestures?: boolean
  /**
   * Draw the SDK's default 2D puck at the device location.
   *
   * The library never asks for location permission. The app requests it
   * first: on iOS, add `NSLocationWhenInUseUsageDescription` to Info.plist and
   * call `requestWhenInUseAuthorization`; on Android, declare and request
   * `ACCESS_FINE_LOCATION` or `ACCESS_COARSE_LOCATION`. Without permission the
   * puck stays hidden. On iOS the Maps SDK itself prompts once when the
   * Info.plist key exists and the status is not determined.
   *
   * Check {@linkcode MapCapabilities.supportsLocationPuck} before turning it
   * on; on hosts without location hardware the puck never appears.
   *
   * @default false
   */
  showUserLocation?: boolean
  /**
   * What rotates the puck. Has no effect while `showUserLocation` is off.
   * Any value other than `none` also draws the bearing arrow.
   *
   * @default 'none'
   */
  puckBearing?: LocationPuckBearing
}

/**
 * Commands on a mounted {@linkcode MapboxMapView}, reached through
 * `hybridRef`.
 *
 * Methods that touch the map run on the platform UI thread and return
 * promises. Before the native map exists (no token yet, or the SDK is
 * unavailable) they reject with a message naming the cause.
 */
export interface MapboxMapViewMethods extends HybridViewMethods {
  /**
   * Loads a style and resolves with its handle once it has loaded.
   *
   * @param uri `mapbox://styles/...` or `https://` style URI.
   * @throws {Error} Rejects with `Mapbox access token is not set` when
   * `MapboxAR.accessToken` is empty, when the URI is malformed, or
   * when the style fails to load (HTTP status included). Rejects with
   * `Style load superseded` when another load starts first.
   */
  loadStyle(uri: string): Promise<MapStyle>

  /**
   * Creates a marker group on this map.
   *
   * @throws {Error} Rejects before the native map exists.
   */
  createPointAnnotationManager(): Promise<PointAnnotationManager>

  /**
   * Animates along a zoom-out/zoom-in arc to `target`.
   *
   * @throws {Error} Rejects when `target` has a non-finite value, a
   * coordinate outside WGS84 bounds, or a negative `durationMs`.
   */
  flyTo(
    target: CameraTarget,
    options?: CameraAnimationOptions,
  ): Promise<CameraAnimationEnd>

  /**
   * Animates in a straight line to `target`. Same errors as
   * {@linkcode MapboxMapViewMethods.flyTo}.
   */
  easeTo(
    target: CameraTarget,
    options?: CameraAnimationOptions,
  ): Promise<CameraAnimationEnd>

  /**
   * Eases to the camera that shows `bounds` inside the padded viewport.
   *
   * @throws {Error} Rejects when a corner is outside WGS84 bounds or
   * `southwest.latitude > northeast.latitude`.
   */
  fitBounds(
    bounds: CoordinateBounds,
    options?: FitBoundsOptions,
  ): Promise<CameraAnimationEnd>

  /** Reads the camera the map last rendered. */
  getCameraState(): Promise<CameraState>

  /**
   * Calls `listener` after each rendered camera change, including every
   * animation frame. Keep it cheap.
   */
  addOnCameraChangedListener(
    listener: (state: CameraState) => void,
  ): ListenerSubscription

  /**
   * Calls `listener` for taps on the map that no
   * {@linkcode PointAnnotationManager} consumed.
   */
  addOnMapTapListener(
    listener: (event: MapTapEvent) => void,
  ): ListenerSubscription

  /**
   * Calls `listener` with a fresh {@linkcode MapStyle} each time a style
   * finishes loading, whether from `styleUri` or `loadStyle`.
   */
  addOnStyleLoadedListener(
    listener: (style: MapStyle) => void,
  ): ListenerSubscription

  /**
   * Calls `listener` when a style, source, tile, sprite or glyph fails to
   * load, and when the map cannot be created (missing token, SDK unavailable).
   */
  addOnMapLoadingErrorListener(
    listener: (error: Error) => void,
  ): ListenerSubscription

  /**
   * Returns the features drawn in `query.area`, topmost first.
   *
   * @throws {Error} Rejects when the area lies outside the view, the box is
   * inverted, `layerIds` is empty, or a layer id does not exist.
   */
  queryRenderedFeatures(
    query: RenderedFeatureQuery,
  ): Promise<RenderedFeature[]>
}

/**
 * The Nitro spec of the native Mapbox map view. Nitrogen generates
 * `HybridMapboxMapViewSpec` from this name.
 *
 * @see {@linkcode MapboxMapViewProps}
 * @see {@linkcode MapboxMapViewMethods}
 */
export type MapboxMapView = HybridView<MapboxMapViewProps, MapboxMapViewMethods>
