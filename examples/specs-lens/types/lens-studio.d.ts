// Stand-in for the typings Lens Studio and Spectacles Navigation Kit ship
// inside a real project. Only the members MapboxRouteGuide.ts uses are
// declared, with the signatures from these pages:
// https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.GeoPosition.html
// https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.InternetModule.html
// https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.Response.html
// https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-navigation-kit/component-list
// https://github.com/specs-devs/packages/tree/df8820c0c4970f052e545b8da1dd288c2516d912/SpecsNavigationKit/Assets/SpecsNavigationKit.lspkg/NavigationDataComponent

declare function component<T>(target: T): T
declare function input(target: object, key: string): void

declare class BaseScriptComponent {
  createEvent(type: 'OnStartEvent' | 'UpdateEvent'): { bind(callback: () => void): void }
}

declare class Texture {}

declare class GeoPosition {
  static create(): GeoPosition
  latitude: number
  longitude: number
  altitude: number
}

declare class Response {
  readonly ok: boolean
  readonly status: number
  json(): Promise<any>
}

declare class InternetModule {
  fetch(request: string, options?: any): Promise<Response>
}

declare module 'SpectaclesNavigationKit.lspkg/NavigationDataComponent/UserPosition' {
  export interface UserPosition {
    getGeoPosition(): GeoPosition | null
    getBearing(): number
  }
}

declare module 'SpectaclesNavigationKit.lspkg/NavigationDataComponent/Place' {
  export abstract class Place {}
}

declare module 'SpectaclesNavigationKit.lspkg/NavigationDataComponent/GeoLocationPlace' {
  import type { Place } from 'SpectaclesNavigationKit.lspkg/NavigationDataComponent/Place'
  import type { UserPosition } from 'SpectaclesNavigationKit.lspkg/NavigationDataComponent/UserPosition'
  export class GeoLocationPlace extends Place {
    constructor(
      geoPosition: GeoPosition,
      distanceToVisit: number,
      name: string,
      icon: Texture,
      description: string,
      userPosition: UserPosition,
    )
  }
}

declare module 'SpectaclesNavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent' {
  import type { Place } from 'SpectaclesNavigationKit.lspkg/NavigationDataComponent/Place'
  import type { UserPosition } from 'SpectaclesNavigationKit.lspkg/NavigationDataComponent/UserPosition'
  export class NavigationDataComponent extends BaseScriptComponent {
    addPlace(place: Place): void
    navigateToPlace(place: Place): void
    getUserPosition(): UserPosition
    readonly places: Place[]
  }
}

declare function print(message: string): void
