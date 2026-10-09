import type { MapStyle } from './MapStyle.nitro'

/**
 * Lighting presets of the Mapbox Standard style.
 *
 * @see {@linkcode StandardStyleConfig.lightPreset}
 */
export type StandardLightPreset = 'dawn' | 'day' | 'dusk' | 'night'

/**
 * Configuration of a Mapbox Standard style import. Omitted fields keep their
 * current value.
 *
 * @see {@linkcode MapStyle.setStandardConfig}
 */
export interface StandardStyleConfig {
  /** Id of the Standard import in the loaded style. @default 'basemap' */
  importId?: string
  /** Light preset. */
  lightPreset?: StandardLightPreset
  /** Show 3D buildings and landmarks. */
  show3dObjects?: boolean
  /** Show point-of-interest labels. */
  showPointOfInterestLabels?: boolean
}
