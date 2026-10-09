import {
  getBrowserRendererCapabilities,
  selectRendererBackend,
} from '@mikevocalz/nitro-mapbox-ar'

/** Header subtitle on the web build: the backend the browser resolves to. */
export function rendererLabel(): string {
  return `web backend: ${selectRendererBackend('auto', getBrowserRendererCapabilities())}`
}
