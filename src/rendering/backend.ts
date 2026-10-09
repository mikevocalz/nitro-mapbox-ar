import type { RendererPreference } from '../types'

/**
 * The renderer {@linkcode selectRendererBackend} resolved to.
 *
 * - `'graphite-webgpu'`: Skia Graphite and WebGPU on one Dawn device.
 * - `'webgpu'`: WebGPU without Skia interop.
 * - `'nitro-cpu'`: the Nitro C++ CPU path.
 * - `'js-cpu'`: the JavaScript CPU Terrain-RGB path.
 */
export type RendererBackend =
  | 'graphite-webgpu'
  | 'webgpu'
  | 'nitro-cpu'
  | 'js-cpu'

/**
 * What the current runtime supports, as input to
 * {@linkcode selectRendererBackend}.
 */
export interface RendererCapabilities {
  /** Skia Graphite is linked. */
  graphite: boolean
  /** WebGPU is available. */
  webgpu: boolean
  /** Skia Graphite and WebGPU share one Dawn device. */
  sharedDawnDevice: boolean
  /** The Nitro C++ CPU path is available. */
  nitro: boolean
  /**
   * The JavaScript CPU path is available.
   *
   * @default false
   */
  jsCpu?: boolean
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

/**
 * Resolves a renderer preference against the runtime's capabilities.
 *
 * `'auto'` takes the first available backend in this order: Graphite + WebGPU
 * (needs `graphite`, `webgpu` and `sharedDawnDevice`), WebGPU, Nitro CPU, JS
 * CPU. `'cpu'` prefers Nitro CPU over JS CPU. Any other preference must be
 * available as asked.
 *
 * @throws {Error} When the requested backend is unavailable, or `'auto'` finds
 * no backend.
 */
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

    case 'cpu':
      assertBackendAvailable(
        capabilities.nitro || capabilities.jsCpu === true,
        preference,
        'No CPU fallback is available',
      )
      return capabilities.nitro ? 'nitro-cpu' : 'js-cpu'

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
      if (capabilities.jsCpu) {
        return 'js-cpu'
      }
      throw new Error('No supported Nitro Mapbox AR renderer backend is available')
  }
}
