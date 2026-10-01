import type { RendererPreference } from '../types'

export type RendererBackend =
  | 'graphite-webgpu'
  | 'webgpu'
  | 'nitro-cpu'

export interface RendererCapabilities {
  graphite: boolean
  webgpu: boolean
  sharedDawnDevice: boolean
  nitro: boolean
}

function assertBackendAvailable(
  available: boolean,
  preference: RendererPreference,
  reason: string,
): void {
  if (!available) {
    throw new Error(
      `Renderer "${preference}" is unavailable: ${reason}`,
    )
  }
}

export function selectRendererBackend(
  preference: RendererPreference,
  capabilities: RendererCapabilities,
): RendererBackend {
  const graphiteWebGPU =
    capabilities.graphite &&
    capabilities.webgpu &&
    capabilities.sharedDawnDevice

  switch (preference) {
    case 'graphite':
      assertBackendAvailable(
        graphiteWebGPU,
        preference,
        'Skia Graphite, WebGPU, and a shared Dawn device are required',
      )
      return 'graphite-webgpu'

    case 'webgpu':
      assertBackendAvailable(
        capabilities.webgpu,
        preference,
        'WebGPU is not available',
      )
      return 'webgpu'

    case 'nitro':
      assertBackendAvailable(
        capabilities.nitro,
        preference,
        'Nitro CPU fallback is not available',
      )
      return 'nitro-cpu'

    case 'auto':
      if (graphiteWebGPU) {
        return 'graphite-webgpu'
      }
      if (capabilities.webgpu) {
        return 'webgpu'
      }
      if (capabilities.nitro) {
        return 'nitro-cpu'
      }
      throw new Error('No supported Nitro Mapbox AR renderer backend is available')
  }
}
