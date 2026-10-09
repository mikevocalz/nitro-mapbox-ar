import {
  MapboxMaps,
  MapStyles,
  type ListenerSubscription,
  type MapboxMapViewRef,
  type MapStyle,
  type MapTapEvent,
  type PointAnnotationManager,
} from '@mikevocalz/nitro-mapbox-ar-maps'
import { create } from 'zustand'

export type MapScreenStatus =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly styleUri: string }
  | { readonly status: 'failed'; readonly message: string }

interface MapScreenState {
  map: MapScreenStatus
  lastTap: MapTapEvent | undefined
  /** Wires listeners, terrain and the marker onto a mounted map. */
  attach(ref: MapboxMapViewRef): void
  /** Removes everything `attach` added. Safe to call twice. */
  detach(): void
}

export const MAP_STYLE_URI = MapStyles.standardSatellite
export const TIMES_SQUARE = { latitude: 40.758, longitude: -73.9855 }

let subscriptions: ListenerSubscription[] = []
let markers: PointAnnotationManager | undefined

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function decorate(style: MapStyle): Promise<void> {
  if (!MapboxMaps.capabilities.supportsTerrain) {
    return
  }
  await style.addRasterDemSource({
    id: 'mapbox-dem',
    url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
    tileSizePx: 512,
  })
  await style.setTerrain({ sourceId: 'mapbox-dem', exaggeration: 1.4 })
}

export const useMapScreenStore = create<MapScreenState>((set, get) => ({
  map: { status: 'loading' },
  lastTap: undefined,

  attach: (ref) => {
    get().detach()
    subscriptions = [
      // Sources and terrain belong to one style; re-add them on every load.
      ref.addOnStyleLoadedListener((style) => {
        decorate(style).then(
          () => set({ map: { status: 'ready', styleUri: style.uri } }),
          (error: unknown) => set({ map: { status: 'failed', message: describeError(error) } }),
        )
      }),
      ref.addOnMapLoadingErrorListener((error) => {
        set({ map: { status: 'failed', message: error.message } })
      }),
      ref.addOnMapTapListener((event) => set({ lastTap: event })),
    ]
    // The manager survives style reloads (docs/MAPS_SDK_INVENTORY.md).
    ref
      .createPointAnnotationManager()
      .then(async (manager) => {
        markers = manager
        await manager.setAnnotations([
          { id: 'times-square', coordinate: TIMES_SQUARE, text: 'Times Square' },
        ])
      })
      .catch((error: unknown) => set({ map: { status: 'failed', message: describeError(error) } }))
  },

  detach: () => {
    subscriptions.forEach((subscription) => subscription.remove())
    subscriptions = []
    const manager = markers
    markers = undefined
    if (manager !== undefined) {
      manager.removeFromMap().catch((error: unknown) => console.warn(describeError(error)))
    }
    set({ map: { status: 'loading' }, lastTap: undefined })
  },
}))
