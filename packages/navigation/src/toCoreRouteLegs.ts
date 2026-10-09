import type {
  ManeuverModifier,
  ManeuverType,
  RouteLeg as CoreRouteLeg,
} from '@mikevocalz/nitro-mapbox-ar/core'

import type { RerouteEvent } from './types/RerouteEvent'
import type { RouteLeg } from './types/RouteLeg'

const MANEUVER_TYPES: ReadonlySet<string> = new Set<ManeuverType>([
  'depart', 'arrive', 'turn', 'continue', 'new name', 'merge', 'on ramp',
  'off ramp', 'fork', 'end of road', 'use lane', 'roundabout', 'rotary',
  'roundabout turn', 'exit roundabout', 'exit rotary', 'notification',
])

const MANEUVER_MODIFIERS: ReadonlySet<string> = new Set<ManeuverModifier>([
  'uturn', 'sharp right', 'right', 'slight right', 'straight', 'slight left',
  'left', 'sharp left',
])

/**
 * Converts the legs of a {@linkcode RerouteEvent} to the core `RouteLeg`
 * shape. Manoeuvre kinds outside the Directions API vocabulary become
 * `'unknown'` and unknown modifiers are dropped, so a manoeuvre added by a
 * newer SDK cannot break code that switches over the core unions.
 *
 * @see {@linkcode RerouteEvent.legs}
 */
export function toCoreRouteLegs(legs: readonly RouteLeg[]): CoreRouteLeg[] {
  return legs.map((leg) => ({
    distanceM: leg.distanceM,
    durationS: leg.durationS,
    steps: leg.steps.map((step) => {
      const { kind, modifier, ...maneuver } = step.maneuver
      return {
        ...step,
        maneuver: {
          ...maneuver,
          kind: MANEUVER_TYPES.has(kind) ? kind : 'unknown',
          ...(modifier !== undefined && MANEUVER_MODIFIERS.has(modifier)
            ? { modifier: modifier as ManeuverModifier }
            : {}),
        },
      }
    }),
  }))
}
