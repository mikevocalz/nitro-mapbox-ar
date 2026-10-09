import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { callback } from 'react-native-nitro-modules'
import { MapboxAR } from '@mikevocalz/nitro-mapbox-ar'
import { MapboxMaps, MapboxMapView } from '@mikevocalz/nitro-mapbox-ar-maps'

import { MAP_STYLE_URI, TIMES_SQUARE, useMapScreenStore } from '../mapStore'
import { token } from '../services'

// The map reads the process-wide token when it creates its native view.
MapboxAR.accessToken = token

/** Mapbox Standard Satellite over Times Square with 3D terrain and one marker. */
export function MapScreen() {
  const status = useMapScreenStore((state) => state.map)
  const lastTap = useMapScreenStore((state) => state.lastTap)
  const attach = useMapScreenStore((state) => state.attach)
  const detach = useMapScreenStore((state) => state.detach)

  useEffect(() => detach, [detach])

  if (!MapboxMaps.isMapViewAvailable) {
    // visionOS: the maps pod builds without the Mapbox Maps SDK.
    return (
      <View style={styles.center}>
        <Text style={styles.copy}>Mapbox Maps is not available on this device.</Text>
      </View>
    )
  }

  if (token === '') {
    return (
      <View style={styles.center}>
        <Text style={styles.copy}>Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to show the map.</Text>
      </View>
    )
  }

  return (
    <View style={styles.fill}>
      <MapboxMapView
        style={styles.fill}
        styleUri={MAP_STYLE_URI}
        camera={{ center: TIMES_SQUARE, zoom: 14, bearingDeg: 0, pitchDeg: 55 }}
        projection="globe"
        hybridRef={callback(attach)}
      />
      <Text style={styles.status}>
        {status.status === 'failed'
          ? status.message
          : lastTap === undefined
            ? status.status
            : `${lastTap.coordinate.latitude.toFixed(5)}, ${lastTap.coordinate.longitude.toFixed(5)}`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, padding: 24, justifyContent: 'center' },
  copy: { color: '#d4d8df', fontSize: 16 },
  status: { position: 'absolute', left: 12, bottom: 12, color: 'white', fontSize: 12 },
})
