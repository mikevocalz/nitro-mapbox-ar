import type { RendererCapabilities } from '../rendering/backend'

interface BrowserGpu {
  requestAdapter(options?: unknown): Promise<unknown>
}

interface BrowserNavigatorLike {
  gpu?: BrowserGpu
}

export function isBrowserWebGPUAvailable(): boolean {
  const navigatorLike = (globalThis as { navigator?: BrowserNavigatorLike }).navigator
  return typeof navigatorLike?.gpu?.requestAdapter === 'function'
}

export function getBrowserRendererCapabilities(): RendererCapabilities {
  return {
    graphite: false,
    webgpu: isBrowserWebGPUAvailable(),
    sharedDawnDevice: false,
    nitro: false,
    jsCpu: true,
  }
}
