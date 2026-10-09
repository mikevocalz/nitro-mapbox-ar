import {
  MapboxNavigationClient,
  type NavigationProgressSnapshot,
  type NavigationRoute,
} from '@mikevocalz/nitro-mapbox-ar/core'
import { routeToPlaces, userPositionToProgress } from '@mikevocalz/nitro-mapbox-ar-specs'
import { GeoLocationPlace } from 'SpectaclesNavigationKit.lspkg/NavigationDataComponent/GeoLocationPlace'
import { NavigationDataComponent } from 'SpectaclesNavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent'

/**
 * Plans a walking route with the Mapbox Directions API, hands its manoeuvres
 * to Navigation Kit as ordered places, and reports progress along the route
 * every frame.
 */
@component
export class MapboxRouteGuide extends BaseScriptComponent {
  @input internetModule!: InternetModule
  @input navigation!: NavigationDataComponent
  @input placeIcon!: Texture
  @input accessToken!: string
  @input destinationLatitude!: number
  @input destinationLongitude!: number

  private route: NavigationRoute | undefined
  progress: NavigationProgressSnapshot | undefined

  onAwake(): void {
    this.createEvent('OnStartEvent').bind(() => {
      this.start().catch((error: Error) => print(`Route planning failed: ${error.message}`))
    })
    this.createEvent('UpdateEvent').bind(() => {
      if (this.route) {
        this.progress = userPositionToProgress(this.navigation.getUserPosition(), this.route)
      }
    })
  }

  private async start(): Promise<void> {
    const userPosition = this.navigation.getUserPosition()
    const origin = userPosition.getGeoPosition()
    if (!origin) throw new Error('Location services are not available')

    // Lens Studio has no global fetch; requests go through InternetModule.
    const client = new MapboxNavigationClient({
      accessToken: this.accessToken,
      fetchImpl: (url) => this.internetModule.fetch(url),
    })
    const response = await client.directions(
      [
        { longitude: origin.longitude, latitude: origin.latitude },
        { longitude: this.destinationLongitude, latitude: this.destinationLatitude },
      ],
      { profile: 'walking', alternatives: false },
    )
    const route = response.routes[0]
    if (!route) throw new Error('Mapbox returned no route')

    const places = routeToPlaces(route).map((input) => {
      const geoPosition = GeoPosition.create()
      geoPosition.latitude = input.latitude
      geoPosition.longitude = input.longitude
      if (input.altitude !== undefined) geoPosition.altitude = input.altitude
      return new GeoLocationPlace(
        geoPosition,
        input.distanceToVisit,
        input.name,
        this.placeIcon,
        input.description,
        userPosition,
      )
    })
    places.forEach((place) => this.navigation.addPlace(place))
    if (places[0]) this.navigation.navigateToPlace(places[0])
    this.route = route
  }
}
