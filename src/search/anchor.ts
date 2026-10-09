import type { SearchFeature } from './client'

/**
 * The WGS84 point to place an AR marker for a search result, from
 * {@linkcode getSpatialSearchAnchor}.
 */
export interface SpatialSearchAnchor {
  /** Degrees east of the prime meridian. */
  readonly longitude: number
  /** Degrees north of the equator. */
  readonly latitude: number
  /**
   * Which point of the feature was used: `entrance` is the routable point
   * named `entrance`, `routable` is the one named `default`, and `feature` is
   * the feature's own geometry.
   */
  readonly source: 'entrance' | 'routable' | 'feature'
  /** The search result the anchor was taken from. */
  readonly feature: SearchFeature
}

function point(value: unknown): readonly [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined
  const longitude = value[0]
  const latitude = value[1]
  if (typeof longitude !== 'number' || typeof latitude !== 'number') return undefined
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return undefined
  return [longitude, latitude]
}

function routablePoints(feature: SearchFeature): readonly Record<string, unknown>[] {
  const properties = feature.properties
  if (!properties) return []

  const coordinates = properties.coordinates
  if (!coordinates || typeof coordinates !== 'object') return []

  const value = (coordinates as Record<string, unknown>).routable_points
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    : []
}

/**
 * Picks the best physical anchor for an AR place/address marker.
 *
 * Geocoding v6 entrance points are preferred over the vehicle-oriented default
 * routable point and over the feature centroid.
 *
 * @returns `undefined` when no routable point and no feature geometry has a
 * finite `[longitude, latitude]` pair.
 */
export function getSpatialSearchAnchor(
  feature: SearchFeature,
): SpatialSearchAnchor | undefined {
  const points = routablePoints(feature)

  for (const target of ['entrance', 'default'] as const) {
    const candidate = points.find((item) => item.name === target)
    const coordinates = point(candidate?.coordinates)
    if (coordinates) {
      return {
        longitude: coordinates[0],
        latitude: coordinates[1],
        source: target === 'entrance' ? 'entrance' : 'routable',
        feature,
      }
    }
  }

  const featurePoint = point(feature.geometry?.coordinates)
  if (!featurePoint) return undefined

  return {
    longitude: featurePoint[0],
    latitude: featurePoint[1],
    source: 'feature',
    feature,
  }
}
