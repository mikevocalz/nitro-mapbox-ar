import type { ColocationPeer } from './ColocationPeer'

/**
 * Whether two {@linkcode ColocationPeer}s can align to one shared frame.
 * Phones align with phones, Quest with Quest, visionOS with visionOS; web
 * peers never align. A platform the function does not know aligns only with
 * peers reporting the same string.
 *
 * @throws {TypeError} When either peer reports an empty platform.
 */
export declare function canShareColocationFrame(
  a: ColocationPeer,
  b: ColocationPeer,
): boolean
