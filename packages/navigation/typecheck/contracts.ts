// Compile-time checks that the Nitro structs keep the shapes of the core
// navigation contracts. Not shipped (absent from package.json `files`).
import type {
  ElectronicHorizonSnapshot,
  NativeNavigationCapabilities as CoreCapabilities,
  NavigationProgressSnapshot,
} from '../../../src/navigation/contracts'
import type { NavigationManeuver as CoreManeuver } from '../../../src/navigation/route'
import type { ElectronicHorizon } from '../src/types/ElectronicHorizon'
import type { NativeNavigationCapabilities } from '../src/types/NativeNavigationCapabilities'
import type { NavigationManeuver } from '../src/types/NavigationManeuver'
import type { NavigationProgress } from '../src/types/NavigationProgress'

type Assert<T extends true> = T
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assignable<A, B> = [A] extends [B] ? true : false

export type Checks = [
  Assert<Assignable<Omit<NavigationProgress, 'upcomingManeuver'>, Omit<NavigationProgressSnapshot, 'route'>>>,
  Assert<Same<keyof Omit<NavigationProgress, 'upcomingManeuver'>, keyof Omit<NavigationProgressSnapshot, 'route'>>>,
  Assert<Assignable<ElectronicHorizon, ElectronicHorizonSnapshot>>,
  Assert<Same<NativeNavigationCapabilities, CoreCapabilities>>,
  Assert<Same<keyof NavigationManeuver, keyof CoreManeuver>>,
]
