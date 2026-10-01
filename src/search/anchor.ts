import type { SearchFeature } from './client'

export interface SpatialSearchAnchor {
  readonly longitude: number
  readonly latitude: number
  readonly source: 'entrance' | 'routable' | 'feature'
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
