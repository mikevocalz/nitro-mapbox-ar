import type { createViroSpatialHostProbe } from './createViroSpatialHostProbe'
import type { getSpatialHostCapabilities } from './getSpatialHostCapabilities'

/**
 * The host queries {@linkcode getSpatialHostCapabilities} reads.
 *
 * {@linkcode createViroSpatialHostProbe} builds one from the running Viro
 * host; tests pass a fake. Every member is a fact about the running host,
 * never a platform name.
 */
export interface SpatialHostProbe {
  /** The display is head-mounted (a headset), not a handheld screen. */
  readonly isHeadMounted: boolean
  /** A headset passthrough layer can be switched on. */
  readonly hasPassthroughLayer: boolean
  /** A JS `WebSocket` constructor exists in this runtime. */
  readonly hasWebSocket: boolean
  /** Camera-backed AR tracking works on this device. */
  isARSupported(): Promise<boolean>
  /** Geospatial (Earth-anchored) tracking works on this device. */
  isGeospatialModeSupported(): Promise<{ readonly supported: boolean }>
  /** The colocation transport is linked and usable. */
  isColocationAvailable(): Promise<boolean>
  /** The device has a GPS position and heading to report. */
  hasDeviceLocation(): Promise<boolean>
  /** Skia Graphite and a shared Dawn device initialised. */
  isGraphiteAvailable(): boolean
}
