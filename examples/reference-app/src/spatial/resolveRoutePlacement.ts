import type {
  ReactVisionSpatialBridge,
  SpatialHostCapabilities,
  ViroGeospatialPose,
} from '@mikevocalz/nitro-mapbox-ar-reactvision'

/**
 * Where the tabletop route gets its "you are here" marker from.
 *
 * - `tabletop`: the route sits on the table with no user position. Meta Quest
 *   lands here: it has no GPS, so `hasDeviceLocation` and
 *   `supportsGeospatialAnchors` are `false`.
 * - `geospatial`: the host has a geospatial camera pose, so the user's
 *   position is drawn on the miniature route.
 */
export type RoutePlacement =
  | { readonly kind: 'tabletop' }
  | { readonly kind: 'geospatial'; readonly pose: ViroGeospatialPose }

/**
 * Picks the route placement from the host's capabilities.
 *
 * The bridge is touched only when the host reports device location and
 * geospatial anchors and an AR navigator is mounted. Every other host,
 * including Meta Quest and a VR-only scene, gets `tabletop` without any call
 * into the bridge, so `getCameraGeospatialPose()` is unreachable there.
 *
 * @param host From `getSpatialHostCapabilities`.
 * @param bridge From `createReactVisionSpatialBridge(arSceneNavigator)`;
 * `undefined` when no AR navigator is mounted.
 * @throws {Error} When geospatial tracking is enabled but the pose read
 * fails; the bridge's message names the reason.
 */
export async function resolveRoutePlacement(
  host: SpatialHostCapabilities,
  bridge:
    | Pick<ReactVisionSpatialBridge, 'enableGeospatial' | 'getCameraPose'>
    | undefined,
): Promise<RoutePlacement> {
  if (!host.hasDeviceLocation || !host.supportsGeospatialAnchors) {
    return { kind: 'tabletop' }
  }
  if (bridge === undefined) {
    return { kind: 'tabletop' }
  }
  const enabled = await bridge.enableGeospatial()
  if (enabled.kind !== 'enabled') {
    return { kind: 'tabletop' }
  }
  return { kind: 'geospatial', pose: await bridge.getCameraPose() }
}
