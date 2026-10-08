import type { getSpatialHostCapabilities } from './getSpatialHostCapabilities'

/**
 * The host queries {@linkcode getSpatialHostCapabilities} reads. Viro's
 * `arSceneNavigator` and module exports satisfy it; tests pass a fake.
 */
export interface SpatialHostProbe {
  /** Viro `isQuest`. */
  readonly isQuest: boolean
  /** Viro `isVisionOS`. */
  readonly isVisionOS: boolean
  /** Viro `arSceneNavigator.isGeospatialModeSupported()`. */
  isGeospatialModeSupported(): Promise<{ readonly supported: boolean }>
  /** Viro `isColocationAvailable()`. */
  isColocationAvailable(): Promise<boolean>
  /** Whether Skia Graphite and a shared Dawn device initialised. */
  isGraphiteAvailable(): boolean
}
