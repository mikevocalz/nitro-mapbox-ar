import type { getSpatialHostCapabilities } from './getSpatialHostCapabilities'
import type { SpatialHostProbe } from './SpatialHostProbe'

/**
 * What the spatial host running this app can do, read at runtime.
 *
 * Produced by {@linkcode getSpatialHostCapabilities} from a
 * {@linkcode SpatialHostProbe}. No field names a platform: a host that gains
 * a feature later flips a field to `true` without a type change. The local
 * device's platform is not part of this struct; a remote peer's platform
 * lives on `ColocationPeer.platform`.
 */
export interface SpatialHostCapabilities {
  /**
   * The app renders on a head-mounted display, not a handheld screen.
   *
   * @see {@linkcode SpatialHostProbe.isHeadMounted}
   */
  readonly isImmersive: boolean
  /**
   * Earth-anchored (latitude/longitude/altitude) anchors work. `false`
   * whenever {@linkcode SpatialHostCapabilities.hasDeviceLocation} is
   * `false`, so a host without GPS never reaches `getCameraGeospatialPose()`.
   */
  readonly supportsGeospatialAnchors: boolean
  /**
   * Visual positioning can refine the device's geospatial pose. Coverage at
   * a given place is a separate per-location query
   * (`arSceneNavigator.checkVPSAvailability(lat, lng)`), not a capability.
   */
  readonly supportsVps: boolean
  /** Devices can join a shared coordinate frame. */
  readonly supportsColocation: boolean
  /**
   * The host reports a head ray. A handheld camera-forward ray is not gaze.
   *
   * @see {@linkcode SpatialHostProbe.isHeadMounted}
   */
  readonly supportsGaze: boolean
  /** Skia Graphite on a shared Dawn device is built and usable. */
  readonly isGraphiteAvailable: boolean
  /** The host can report its own GPS position and heading. */
  readonly hasDeviceLocation: boolean
  /**
   * The real world is visible behind rendered content: a camera-backed AR
   * session on a handheld, or a headset passthrough layer.
   */
  readonly supportsPassthrough: boolean
  /**
   * The host can open the replicated room-state channel
   * (Viro `ViroReplicationClient`), which runs over a JS WebSocket.
   */
  readonly supportsReplicatedState: boolean
}
