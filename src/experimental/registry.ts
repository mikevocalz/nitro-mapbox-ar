/**
 * Release maturity of a registry feature. `'host-validation'` means the
 * consuming app must validate a compatible build before enabling it.
 *
 * @see {@linkcode MapboxFeatureDescriptor.status}
 */
export type MapboxFeatureStatus =
  | 'stable'
  | 'public-preview'
  | 'public-beta'
  | 'private-preview'
  | 'host-validation'

/**
 * Id of a Mapbox or renderer feature in the registry.
 *
 * @see {@linkcode getMapboxFeature}
 */
export type MapboxFeatureId =
  | 'standard-indoor'
  | 'standard-hd-roads'
  | 'android-vulkan'
  | 'navigation-ux-framework'
  | 'electronic-horizon'
  | 'optimization-v2'
  | 'ev-routing'
  | 'agent-toolkit'
  | 'graphite-visionos'

/**
 * Maturity and platform facts for one feature, as
 * {@linkcode listMapboxFeatures} and {@linkcode getMapboxFeature} return them.
 */
export interface MapboxFeatureDescriptor {
  /** Feature id. */
  readonly id: MapboxFeatureId
  /** Release maturity. */
  readonly status: MapboxFeatureStatus
  /** Where the feature runs: `'android'`, `'ios'`, `'web'`, `'visionos'`, or `'service'` for a web API. */
  readonly platform: readonly string[]
  /** Earliest SDK, style or framework version that has the feature, when one applies. */
  readonly minimumVersion?: string
  /** Whether the feature is on without opting in. `false` for every current entry. */
  readonly defaultEnabled: boolean
  /** How to enable the feature and what limits it has. */
  readonly notes: string
}

const FEATURES: readonly MapboxFeatureDescriptor[] = [
  {
    id: 'standard-indoor',
    status: 'stable',
    platform: ['android', 'ios', 'web'],
    minimumVersion: 'Mapbox Standard 2026-04',
    defaultEnabled: false,
    notes: 'Indoor maps for supported airports; enable through showIndoor.',
  },
  {
    id: 'standard-hd-roads',
    status: 'stable',
    platform: ['android', 'ios', 'web'],
    minimumVersion: 'Mapbox Standard 2026-09',
    defaultEnabled: false,
    notes: 'Lane-level road markings and 3D road infrastructure; enable through showHdRoads.',
  },
  {
    id: 'android-vulkan',
    status: 'public-preview',
    platform: ['android'],
    minimumVersion: 'Maps SDK 11.24.1',
    defaultEnabled: false,
    notes: 'Separate Vulkan core artifact; arm64-v8a only and no automatic OpenGL fallback.',
  },
  {
    id: 'navigation-ux-framework',
    status: 'public-preview',
    platform: ['android'],
    minimumVersion: 'UX Framework 1.31.0',
    defaultEnabled: false,
    notes: 'Pre-built Android navigation experience; keep outside the lightweight core.',
  },
  {
    id: 'electronic-horizon',
    status: 'public-beta',
    platform: ['android', 'ios'],
    defaultEnabled: false,
    notes: 'Expose through NativeNavigationProvider only when the host has enabled it.',
  },
  {
    id: 'optimization-v2',
    status: 'public-beta',
    platform: ['service'],
    defaultEnabled: false,
    notes: 'Async vehicle-routing-problem API; access and schemas may change.',
  },
  {
    id: 'ev-routing',
    status: 'private-preview',
    platform: ['service'],
    defaultEnabled: false,
    notes: 'Directions engine=electric flow; requires product access.',
  },
  {
    id: 'agent-toolkit',
    status: 'public-preview',
    platform: ['android', 'ios', 'web'],
    defaultEnabled: false,
    notes: 'Optional provider bridge; direct Search/Navigation remains the fallback.',
  },
  {
    id: 'graphite-visionos',
    status: 'host-validation',
    platform: ['visionos'],
    defaultEnabled: false,
    notes: 'Only enable after validating a compatible Graphite build in the consuming app.',
  },
]

/** Every feature in the registry. */
export function listMapboxFeatures(): readonly MapboxFeatureDescriptor[] {
  return FEATURES
}

/**
 * Looks up one feature by id.
 *
 * @throws {Error} When the id is not in the registry.
 */
export function getMapboxFeature(
  id: MapboxFeatureId,
): MapboxFeatureDescriptor {
  const value = FEATURES.find((feature) => feature.id === id)
  if (!value) {
    throw new Error(`Unknown Mapbox feature: ${id}`)
  }
  return value
}

/** The features a caller opted into, as {@linkcode createFeatureSet} returns them. */
export interface EnabledFeatureSet {
  /** Ids of the enabled features. */
  readonly enabled: ReadonlySet<MapboxFeatureId>
}

/**
 * Enables the requested features. Every requested id is enabled, previews
 * included, since requesting one is the explicit opt-in; nothing outside
 * `requested` is enabled.
 *
 * @throws {Error} When an id is not in the registry.
 */
export function createFeatureSet(
  requested: readonly MapboxFeatureId[],
): EnabledFeatureSet {
  const enabled = new Set<MapboxFeatureId>()

  for (const id of requested) {
    const descriptor = getMapboxFeature(id)
    if (descriptor.defaultEnabled || descriptor.status === 'stable') {
      enabled.add(id)
      continue
    }

    // Preview/host-validation features are allowed only when the caller
    // explicitly requested them, which this function represents.
    enabled.add(id)
  }

  return { enabled }
}
