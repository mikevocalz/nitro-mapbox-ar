import tgpu, { type TgpuRoot } from 'typegpu'

import {
  getGraphiteWebGPUContext,
  type SharedGraphiteDevice,
} from '../../rendering/graphite'

const roots = new WeakMap<object, TgpuRoot>()

export function getTerrainGpuRoot(): TgpuRoot {
  const { device } = getGraphiteWebGPUContext()

  let root = roots.get(device as object)
  if (!root) {
    root = tgpu.initFromDevice({ device: device as SharedGraphiteDevice })
    roots.set(device as object, root)
  }

  return root
}
