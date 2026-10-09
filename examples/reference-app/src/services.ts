import {
  MapboxNavigationClient,
  MapboxSearchClient,
  NavigationSession,
  SpatialAgentRuntime,
} from '@mikevocalz/nitro-mapbox-ar'

export const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? ''

/** Times Square, the centre of every screen in the app. */
export const TIMES_SQUARE = { latitude: 40.758, longitude: -73.9855 }

export const navigationClient = new MapboxNavigationClient({ accessToken: token })
export const searchClient = new MapboxSearchClient({ accessToken: token })
export const navigation = new NavigationSession({ client: navigationClient })

/** The Agent screen's runtime: search and routing only, centred on Times Square. */
export const agentRuntime = new SpatialAgentRuntime({
  search: searchClient,
  navigation,
  policy: { allow: ['search', 'route', 'read-context'] },
  getContext: () => ({
    location: { longitude: TIMES_SQUARE.longitude, latitude: TIMES_SQUARE.latitude },
  }),
})
