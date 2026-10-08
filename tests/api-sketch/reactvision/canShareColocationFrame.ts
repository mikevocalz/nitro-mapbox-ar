import type { ColocationPeer } from './ColocationPeer'

/**
 * Whether two {@linkcode ColocationPeer}s can align to one shared frame.
 * Phones align with phones, Quest with Quest, visionOS with visionOS; web
 * peers never align.
 */
export declare function canShareColocationFrame(
  a: ColocationPeer,
  b: ColocationPeer,
): boolean
