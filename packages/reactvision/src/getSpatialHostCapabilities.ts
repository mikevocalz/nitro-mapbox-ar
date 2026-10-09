import type { SpatialHostCapabilities } from './SpatialHostCapabilities'
import type { SpatialHostProbe } from './SpatialHostProbe'

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function ask<T>(
  query: keyof SpatialHostProbe,
  run: () => T | Promise<T>,
): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw new Error(
      `SpatialHostProbe.${query}() failed: ${describeError(error)}`,
      { cause: error },
    )
  }
}

/**
 * Reads {@linkcode SpatialHostCapabilities} from the running host.
 *
 * Location is asked first. When the host has no device location, the
 * geospatial query is never sent and both geospatial flags are `false`, so
 * a host without GPS cannot reach `getCameraGeospatialPose()` through a
 * capability that claimed otherwise.
 *
 * @param probe Host queries; see {@linkcode SpatialHostProbe}.
 * @throws {Error} Rejects when a probe query throws or rejects; the message
 * names the query and the original error is the `cause`.
 *
 * @example
 * ```ts
 * const host = await getSpatialHostCapabilities(probe)
 * if (!host.supportsGeospatialAnchors) anchorRouteToTable()
 * ```
 */
export async function getSpatialHostCapabilities(
  probe: SpatialHostProbe,
): Promise<SpatialHostCapabilities> {
  const hasDeviceLocation = await ask('hasDeviceLocation', () =>
    probe.hasDeviceLocation(),
  )

  const [geospatial, arSupported, colocation, graphite] = await Promise.all([
    hasDeviceLocation
      ? ask('isGeospatialModeSupported', () =>
          probe.isGeospatialModeSupported(),
        )
      : Promise.resolve({ supported: false }),
    ask('isARSupported', () => probe.isARSupported()),
    ask('isColocationAvailable', () => probe.isColocationAvailable()),
    ask('isGraphiteAvailable', () => probe.isGraphiteAvailable()),
  ])

  const geospatialSupported = hasDeviceLocation && geospatial.supported

  return {
    isImmersive: probe.isHeadMounted,
    supportsGeospatialAnchors: geospatialSupported,
    supportsVps: geospatialSupported,
    supportsColocation: colocation,
    supportsGaze: probe.isHeadMounted,
    isGraphiteAvailable: graphite,
    hasDeviceLocation,
    supportsPassthrough: probe.hasPassthroughLayer || arSupported,
    supportsReplicatedState: probe.hasWebSocket,
  }
}
