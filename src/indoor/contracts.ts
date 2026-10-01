import type { NavigationCoordinate, NavigationRoute } from '../navigation/client'

export interface IndoorLevel {
  readonly id: string
  readonly name?: string
  readonly ordinal?: number
  readonly altitudeMeters?: number
}

export interface IndoorVenue {
  readonly id: string
  readonly name: string
  readonly center: NavigationCoordinate
  readonly levels: readonly IndoorLevel[]
}

export interface IndoorAnchor {
  readonly id: string
  readonly coordinate: NavigationCoordinate
  readonly levelId: string
  readonly kind?: 'entrance' | 'gate' | 'room' | 'poi' | 'transition'
  readonly metadata?: Readonly<Record<string, unknown>>
}

export interface IndoorTransition {
  readonly id: string
  readonly fromLevelId: string
  readonly toLevelId: string
  readonly coordinate: NavigationCoordinate
  readonly kind: 'stairs' | 'elevator' | 'escalator' | 'ramp' | 'other'
  readonly accessible?: boolean
}

export interface IndoorRoute {
  readonly venueId: string
  readonly route?: NavigationRoute
  readonly anchors: readonly IndoorAnchor[]
  readonly transitions: readonly IndoorTransition[]
}

export interface IndoorProvider {
  getVenue(id: string): Promise<IndoorVenue | null>
  getAnchors(venueId: string, levelId?: string): Promise<readonly IndoorAnchor[]>
  route(
    venueId: string,
    from: IndoorAnchor,
    to: IndoorAnchor,
  ): Promise<IndoorRoute>
}

/**
 * Keeps outdoor Mapbox routing and indoor provider routing as separate legs.
 * Host apps can display a clear handoff at the selected building entrance.
 */
export interface IndoorNavigationHandoff {
  readonly outdoorRoute: NavigationRoute
  readonly entrance: IndoorAnchor
  readonly indoorRoute: IndoorRoute
}
