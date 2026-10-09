import {
  VRModuleOpenXR,
  isARSupportedOnDevice,
  isColocationAvailable,
  isQuest,
  isVisionOS,
} from '@reactvision/react-viro'

import type { getSpatialHostCapabilities } from './getSpatialHostCapabilities'
import type { SpatialHostProbe } from './SpatialHostProbe'
import type { ReactVisionGeospatialNavigator } from './types'

/**
 * Inputs Viro cannot answer, plus the AR navigator when one is mounted.
 *
 * @see {@linkcode createViroSpatialHostProbe}
 */
export interface ViroSpatialHostProbeOptions {
  /**
   * `arSceneNavigator` from a mounted `ViroARSceneNavigator`. Omit when the
   * host has none (a VR-only scene); geospatial support then reads `false`.
   */
  readonly navigator?: Pick<
    ReactVisionGeospatialNavigator,
    'isGeospatialModeSupported'
  >
  /**
   * Whether the device has GPS and heading. Viro 3.0.3 has no query for
   * location hardware, so the app supplies it from its location module.
   */
  hasDeviceLocation(): Promise<boolean>
  /**
   * Whether Skia Graphite on a shared Dawn device initialised. Pass
   * `isGraphiteWebGPUAvailable` from `@mikevocalz/nitro-mapbox-ar`; Viro
   * does not render through Graphite.
   */
  isGraphiteAvailable(): boolean
}

/**
 * Builds a {@linkcode SpatialHostProbe} from the running Viro host, for
 * {@linkcode getSpatialHostCapabilities}.
 *
 * Viro 3.0.3 symbols read, all under
 * node_modules/@reactvision/react-viro/dist/:
 *
 * - `isHeadMounted`: `isQuest` (components/Utilities/ViroPlatform.d.ts:7)
 *   and `isVisionOS()` (components/VisionOS/ViroVisionOSModule.d.ts:57; the
 *   package root re-exports this function, not the `isVisionOS` constant in
 *   ViroPlatform.d.ts:17). Viro has no gaze query; a head-mounted host is
 *   the one whose camera ray is a head ray.
 * - `hasPassthroughLayer`: `VRModuleOpenXR.setPassthroughEnabled`
 *   (components/Utilities/VRModuleOpenXR.d.ts:34; `VRModuleOpenXR` is
 *   `undefined` off-Quest, :59).
 * - `hasWebSocket`: `ViroReplicationClient` opens "a separate WebSocket,
 *   opened from JS" (components/AR/ViroReplication.d.ts:14, class at :97).
 * - `isARSupported`: `isARSupportedOnDevice(): Promise<ViroARSupportResponse>`
 *   (components/Utilities/ViroUtils.d.ts:95, response at :92).
 * - `isGeospatialModeSupported`: `arSceneNavigator.isGeospatialModeSupported()`
 *   (components/AR/ViroARSceneNavigator.d.ts:780, object at :751; result
 *   `ViroGeospatialSupportResult`, components/Types/ViroEvents.d.ts:653).
 * - `isColocationAvailable`: `isColocationAvailable(): Promise<boolean>`
 *   (components/AR/ViroColocation.d.ts:63).
 */
export function createViroSpatialHostProbe(
  options: ViroSpatialHostProbeOptions,
): SpatialHostProbe {
  const navigator = options.navigator

  return {
    isHeadMounted: isQuest || isVisionOS(),
    hasPassthroughLayer: VRModuleOpenXR?.setPassthroughEnabled !== undefined,
    hasWebSocket: 'WebSocket' in globalThis,
    isARSupported: async () => (await isARSupportedOnDevice()).isARSupported,
    isGeospatialModeSupported: () =>
      navigator === undefined
        ? Promise.resolve({ supported: false })
        : navigator.isGeospatialModeSupported(),
    isColocationAvailable: () => isColocationAvailable(),
    hasDeviceLocation: () => options.hasDeviceLocation(),
    isGraphiteAvailable: () => options.isGraphiteAvailable(),
  }
}
