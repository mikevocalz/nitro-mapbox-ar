import {
  MapboxNavigationClient,
  MapboxSearchClient,
  NavigationSession,
} from '@mikevocalz/nitro-mapbox-ar'

export const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? ''

export const navigationClient = new MapboxNavigationClient({ accessToken: token })
export const searchClient = new MapboxSearchClient({ accessToken: token })
export const navigation = new NavigationSession({ client: navigationClient })
