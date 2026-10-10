import type { MapStyle } from '../specs/MapStyle.nitro'

/**
 * Lighting presets of the Mapbox Standard style.
 *
 * @see {@linkcode StandardStyleConfig.lightPreset}
 */
export type StandardLightPreset = 'dawn' | 'day' | 'dusk' | 'night'

/**
 * Color themes of the Mapbox Standard style.
 *
 * - `default`: the regular Standard palette.
 * - `faded`: desaturated, lower-contrast colors, so data layers drawn on top
 *   stand out.
 * - `monochrome`: grayscale.
 *
 * @see {@linkcode StandardStyleConfig.theme}
 */
export type StandardTheme = 'default' | 'faded' | 'monochrome'

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
  /** Color theme. */
  theme?: StandardTheme
  /** Show 3D buildings and landmarks. */
  show3dObjects?: boolean
  /** Show point-of-interest labels. */
  showPointOfInterestLabels?: boolean
}
