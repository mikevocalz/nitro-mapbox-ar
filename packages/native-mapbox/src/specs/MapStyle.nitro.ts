import type { HybridObject } from 'react-native-nitro-modules'

import type { MapCapabilities } from '../types/MapCapabilities'
import type { MapboxMapViewMethods } from './MapboxMapView.nitro'
import type { PointAnnotation } from '../types/PointAnnotation'
import type { StyleImageOptions } from '../types/StyleImageOptions'
import type { StyleImageSource } from '../types/StyleImageSource'
import type { StandardStyleConfig } from '../types/StandardStyleConfig'
import type { StyleLayer } from '../types/StyleLayer'
import type { GeoJsonSource } from '../types/GeoJsonSource'
import type { RasterDemSource } from '../types/RasterDemSource'
import type { VectorSource } from '../types/VectorSource'
import type { TerrainOptions } from '../types/TerrainOptions'

/**
 * A loaded style on one map view. Each successful style load produces a new
 * `MapStyle`; the previous one becomes stale and every method on it rejects
 * with `This MapStyle was replaced`.
 *
 * Obtain one from {@linkcode MapboxMapViewMethods.loadStyle} or
 * {@linkcode MapboxMapViewMethods.addOnStyleLoadedListener}. Sources, layers,
 * images and terrain added here are dropped when the style is replaced;
 * re-add them from the style-loaded listener.
 *
 * All mutations run on the platform UI thread, so they are async.
 */
export interface MapStyle
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** URI the style was loaded from. */
  readonly uri: string

  /**
   * Adds a GeoJSON source.
   *
   * @throws {Error} Rejects when a source with the same `id` exists, `data`
   * does not parse as GeoJSON, or the style is stale.
   */
  addGeoJsonSource(source: GeoJsonSource): Promise<void>

  /**
   * Replaces the data of an existing GeoJSON source, for example a route
   * line that changed after a reroute.
   *
   * @throws {Error} Rejects when no GeoJSON source has that id or `data`
   * does not parse.
   */
  setGeoJsonSourceData(sourceId: string, data: string): Promise<void>

  /**
   * Adds a raster DEM source for {@linkcode MapStyle.setTerrain}.
   *
   * @throws {Error} Rejects when a source with the same `id` exists or the
   * style is stale.
   */
  addRasterDemSource(source: RasterDemSource): Promise<void>

  /**
   * Adds a vector tile source.
   *
   * @throws {Error} Rejects when a source with the same `id` exists or the
   * style is stale.
   */
  addVectorSource(source: VectorSource): Promise<void>

  /**
   * Removes a source.
   *
   * @throws {Error} Rejects when no source has that id, or a layer still uses
   * it (the message names the layer).
   */
  removeSource(sourceId: string): Promise<void>

  /**
   * Adds a layer.
   *
   * @param belowLayerId Insert below this layer. Omit to add on top.
   * @throws {Error} Rejects when the id is taken, `sourceId` names no source,
   * `belowLayerId` names no layer, or a paint/layout property is invalid (the
   * message names the property).
   */
  addLayer(layer: StyleLayer, belowLayerId?: string): Promise<void>

  /**
   * Removes a layer.
   *
   * @throws {Error} Rejects when no layer has that id.
   */
  removeLayer(layerId: string): Promise<void>

  /**
   * Decodes an image and adds it to the style under `id`, so
   * {@linkcode PointAnnotation.iconImageId} and a symbol layer's
   * `icon-image` can name it. An image with the same id, including one
   * that came with the style, is replaced.
   *
   * Reading and decoding happen off the UI thread; only the final add runs
   * on it. Like sources and layers, the image is dropped when the style is
   * replaced.
   *
   * @throws {Error} Rejects when `image` sets both or neither of `uri` and
   * `base64`, the URI scheme is not `file`, `http` or `https`, the download
   * fails or returns a non-2xx status, the bytes do not decode as an image,
   * `options.scale` is not greater than 0, or the style is stale.
   */
  addStyleImage(
    id: string,
    image: StyleImageSource,
    options?: StyleImageOptions,
  ): Promise<void>

  /**
   * Removes an image from the style.
   *
   * @throws {Error} Rejects when no image has that id.
   */
  removeStyleImage(id: string): Promise<void>

  /**
   * Enables 3D terrain from a raster DEM source.
   *
   * @throws {Error} Rejects when `sourceId` names no raster DEM source,
   * `exaggeration` is outside 0 to 1000, or
   * {@linkcode MapCapabilities.supportsTerrain} is `false`.
   */
  setTerrain(terrain: TerrainOptions): Promise<void>

  /** Turns terrain off. No-op when terrain is off. */
  clearTerrain(): Promise<void>

  /**
   * Sets configuration on a Mapbox Standard import.
   *
   * @throws {Error} Rejects when the style has no import with that id; the
   * message suggests loading `MapStyles.standard`.
   */
  setStandardConfig(config: StandardStyleConfig): Promise<void>
}
