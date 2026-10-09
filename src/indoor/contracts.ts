import type { NavigationCoordinate, NavigationRoute } from '../navigation/client'

/**
 * One floor of an {@linkcode IndoorVenue}.
 *
 * @see {@linkcode IndoorVenue.levels}
 */
export interface IndoorLevel {
  /** Provider-defined level id, referenced by {@linkcode IndoorAnchor.levelId} and {@linkcode IndoorTransition}. */
  readonly id: string
  /** Display name, such as "Departures" or "L2". */
  readonly name?: string
  /** Floor order within the venue: a higher ordinal is a higher floor. */
  readonly ordinal?: number
  /** Floor elevation in metres. The reference height is up to the provider. */
  readonly altitudeMeters?: number
}

/**
 * A building or campus served by an {@linkcode IndoorProvider}, from
 * {@linkcode IndoorProvider.getVenue}.
 */
export interface IndoorVenue {
  /** Provider-defined venue id. */
  readonly id: string
  /** Display name of the venue. */
  readonly name: string
  /** WGS84 point that represents the venue on an outdoor map. */
  readonly center: NavigationCoordinate
  /** Floors of the venue. */
  readonly levels: readonly IndoorLevel[]
}

/**
 * A named point on one level of a venue: an entrance, gate, room, point of
 * interest or level transition. Routes start and end at anchors.
 *
 * @see {@linkcode IndoorProvider.getAnchors}
 * @see {@linkcode IndoorProvider.route}
 */
export interface IndoorAnchor {
  /** Provider-defined anchor id. */
  readonly id: string
  /** WGS84 position of the anchor. */
  readonly coordinate: NavigationCoordinate
  /** Id of the {@linkcode IndoorLevel} the anchor is on. */
  readonly levelId: string
  /** What the anchor marks. `entrance` anchors are where an {@linkcode IndoorNavigationHandoff} joins an outdoor route. */
  readonly kind?: 'entrance' | 'gate' | 'room' | 'poi' | 'transition'
  /** Provider data passed through unchanged. */
  readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * A connection between two levels on an {@linkcode IndoorRoute}.
 *
 * @see {@linkcode IndoorRoute.transitions}
 */
export interface IndoorTransition {
  /** Provider-defined transition id. */
  readonly id: string
  /** Id of the {@linkcode IndoorLevel} the traveller leaves. */
  readonly fromLevelId: string
  /** Id of the {@linkcode IndoorLevel} the traveller arrives on. */
  readonly toLevelId: string
  /** WGS84 position of the stairs, elevator or other connection. */
  readonly coordinate: NavigationCoordinate
  /** How the traveller changes level. */
  readonly kind: 'stairs' | 'elevator' | 'escalator' | 'ramp' | 'other'
  /** `true` when the transition is step-free; absent when the provider does not know. */
  readonly accessible?: boolean
}

/**
 * A route inside one venue, from {@linkcode IndoorProvider.route}.
 */
export interface IndoorRoute {
  /** Id of the {@linkcode IndoorVenue} the route is in. */
  readonly venueId: string
  /** Route geometry and timing in the Directions route shape, when the provider produces one. */
  readonly route?: NavigationRoute
  /** Anchors along the route, in travel order. */
  readonly anchors: readonly IndoorAnchor[]
  /** Level changes along the route, in travel order. */
  readonly transitions: readonly IndoorTransition[]
}

/**
 * Venue data and indoor routing supplied by the host app. The interface is
 * provider-neutral: any indoor map source that can describe levels, anchors
 * and level transitions can implement it.
 */
export interface IndoorProvider {
  /** Loads a venue by id. Resolves `null` when the provider has no venue with that id. */
  getVenue(id: string): Promise<IndoorVenue | null>
  /** Lists the anchors in a venue, only those on `levelId` when it is given. */
  getAnchors(venueId: string, levelId?: string): Promise<readonly IndoorAnchor[]>
  /** Routes between two anchors in the same venue. */
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
  /** Outdoor Mapbox route that ends at `entrance`. */
  readonly outdoorRoute: NavigationRoute
  /** Building entrance where the outdoor leg ends and the indoor leg starts. */
  readonly entrance: IndoorAnchor
  /** Indoor route from `entrance` to the destination. */
  readonly indoorRoute: IndoorRoute
}
