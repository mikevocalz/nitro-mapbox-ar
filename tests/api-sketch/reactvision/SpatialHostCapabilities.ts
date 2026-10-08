import type { getSpatialHostCapabilities } from './getSpatialHostCapabilities'

/**
 * What the spatial host running this app can do, read at runtime. Replaces
 * the platform-derived `ReactVisionRuntimeCapabilities`.
 *
 * Produced by {@linkcode getSpatialHostCapabilities}. Hosts that gain a
 * feature later flip a field to `true` without a type change.
 */
export interface SpatialHostCapabilities {
  /** The app renders in an immersive space or headset, not a phone screen. */
  readonly isImmersive: boolean
  /** Earth-anchored (latitude/longitude/altitude) anchors work. */
  readonly supportsGeospatialAnchors: boolean
  /** Visual positioning can refine the device's geospatial pose. */
  readonly supportsVps: boolean
  /** Devices can join a shared coordinate frame. */
  readonly supportsColocation: boolean
  /** The host reports a gaze or head ray. */
  readonly supportsGaze: boolean
  /** Skia Graphite on a shared Dawn device is built and usable. */
  readonly isGraphiteAvailable: boolean
  /** The host can report its own GPS position and heading. */
  readonly hasDeviceLocation: boolean
}
