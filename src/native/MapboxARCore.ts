import {
  NitroModules,
  type HybridObject,
} from 'react-native-nitro-modules'

import type { MapboxARCore } from './MapboxARCore.types'

type NativeMapboxARCore = MapboxARCore &
  HybridObject<{ ios: 'c++'; android: 'c++' }>

let instance: NativeMapboxARCore | undefined

export type { MapboxARCore } from './MapboxARCore.types'

export function getMapboxARCore(): MapboxARCore {
  if (instance === undefined) {
    instance = NitroModules.createHybridObject<NativeMapboxARCore>('MapboxARCore')
  }
  return instance
}
