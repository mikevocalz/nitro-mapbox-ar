import type { ColocationPeer, ColocationPlatform } from './ColocationPeer'

/**
 * The frame family a platform aligns within. Viro ships one frame source per
 * family (`cloudAnchorFrameSource` for phones, `metaSpatialAnchorFrameSource`
 * for Quest, `visionOSSharedSpaceFrameSource` for visionOS, all exported from
 * node_modules/@reactvision/react-viro/dist/index.d.ts) and none that bridges
 * two families. A platform this list does not know forms its own family.
 * `undefined` means the platform never aligns.
 */
function frameFamily(platform: ColocationPlatform): string | undefined {
  switch (platform) {
    case 'ios':
    case 'android':
      return 'phone'
    case 'web':
      return undefined
    default:
      return platform
  }
}

function assertPlatform(peer: ColocationPeer, name: 'a' | 'b'): void {
  if (peer.platform.length === 0) {
    throw new TypeError(
      `canShareColocationFrame: peer ${name} ("${peer.peerId}") reported an ` +
        'empty platform; expected a lowercase name such as "ios" or "quest"',
    )
  }
}

/**
 * Whether two {@linkcode ColocationPeer}s can align to one shared frame.
 *
 * Phones align with phones (`ios` with `android`), Quest with Quest,
 * visionOS with visionOS. Web peers never align; they can watch as
 * spectators. A platform not listed here aligns only with peers reporting
 * the same string, so a new headset can pair with itself without a release.
 *
 * @throws {TypeError} When either peer reports an empty platform.
 */
export function canShareColocationFrame(
  a: ColocationPeer,
  b: ColocationPeer,
): boolean {
  assertPlatform(a, 'a')
  assertPlatform(b, 'b')
  const left = frameFamily(a.platform)
  return left !== undefined && left === frameFamily(b.platform)
}
