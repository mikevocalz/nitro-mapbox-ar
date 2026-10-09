import tgpu, { type TgpuRoot } from 'typegpu'

import {
  getGraphiteWebGPUContext,
  type SharedGraphiteDevice,
} from '../../rendering/graphite'

const roots = new WeakMap<object, TgpuRoot>()

/**
 * Returns the TypeGPU root bound to Skia Graphite's shared WebGPU device.
 *
 * The root is created on first call and cached per device, so every terrain
 * compute pass and buffer lands on the device Skia renders with. Do not
 * destroy the returned root; it lives as long as the device.
 *
 * @throws {Error} When Skia Graphite is unavailable or returns an invalid
 * native WebGPU device.
 */
export function getTerrainGpuRoot(): TgpuRoot {
  const { device } = getGraphiteWebGPUContext()

  let root = roots.get(device as object)
  if (!root) {
    root = tgpu.initFromDevice({ device: device as SharedGraphiteDevice })
    roots.set(device as object, root)
  }

  return root
}
