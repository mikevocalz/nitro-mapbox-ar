import type { NavigationCoordinate, NavigationRoute } from './client'

export interface NavigationProgressSnapshot {
  readonly location: NavigationCoordinate
  readonly bearing?: number
  readonly speedMetersPerSecond?: number
  readonly distanceRemaining: number
  readonly durationRemaining: number
  readonly fractionTraveled: number
  readonly currentLegIndex: number
  readonly currentStepIndex?: number
  readonly route: NavigationRoute
}

export interface ElectronicHorizonEdge {
  readonly id: string | number
  readonly level: number
  readonly probability: number
  readonly shape?: readonly NavigationCoordinate[]
}

export interface ElectronicHorizonSnapshot {
  readonly edgeId: string | number
  readonly percentAlong: number
  readonly edges: readonly ElectronicHorizonEdge[]
}

export interface NativeNavigationCapabilities {
  readonly activeGuidance: boolean
  readonly rerouting: boolean
  readonly trafficRefresh: boolean
  readonly incidents: boolean
  readonly predictiveCaching: boolean
  readonly offlineRegions: boolean
  readonly electronicHorizon: boolean
}

export interface NativeNavigationProvider {
  readonly capabilities: NativeNavigationCapabilities
  startTripSession(): Promise<void>
  stopTripSession(): Promise<void>
  setRoute(route: NavigationRoute | null): Promise<void>
  getProgress(): Promise<NavigationProgressSnapshot | null>
  getElectronicHorizon(): Promise<ElectronicHorizonSnapshot | null>
}
