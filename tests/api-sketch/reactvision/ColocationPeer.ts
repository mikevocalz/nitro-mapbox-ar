import type { canShareColocationFrame } from './canShareColocationFrame'

/**
 * The platform a colocation peer reports. Kept as a literal because a peer
 * can run a different platform from the local device.
 *
 * @see {@linkcode ColocationPeer.platform}
 */
export type ColocationPlatform =
  | 'ios'
  | 'android'
  | 'quest'
  | 'visionos'
  | 'web'

/**
 * A device in, or asking to join, a shared coordinate frame.
 *
 * @see {@linkcode canShareColocationFrame}
 */
export interface ColocationPeer {
  /** Peer id from the colocation service. */
  readonly peerId: string
  /** Platform the peer reported. */
  readonly platform: ColocationPlatform
}
