import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  MapboxNavigationClient,
  MapboxSearchClient,
  NavigationSession,
  SpatialAgentRuntime,
  getBrowserRendererCapabilities,
  listMapboxFeatures,
  selectRendererBackend,
} from '@mikevocalz/nitro-mapbox-ar'
import { MapboxMapView } from '@mikevocalz/nitro-mapbox-ar-maps'
import {
  ViroAmbientLight,
  ViroARScene,
  ViroARSceneNavigator,
  ViroText,
} from '@reactvision/react-viro'

import { useReferenceStore, type ReferenceMode } from './src/store'

const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? ''
const nyc = { latitude: 40.758, longitude: -73.9855 }

const navigationClient = new MapboxNavigationClient({ accessToken: token })
const searchClient = new MapboxSearchClient({ accessToken: token })
const navigation = new NavigationSession({ client: navigationClient })

function Tab({ mode, label }: { mode: ReferenceMode; label: string }) {
  const active = useReferenceStore((state) => state.mode === mode)
  const setMode = useReferenceStore((state) => state.setMode)
  return (
    <Pressable onPress={() => setMode(mode)} style={[styles.tab, active && styles.tabActive]}>
      <Text style={styles.tabText}>{label}</Text>
    </Pressable>
  )
}

function MapMode() {
  return (
    <MapboxMapView
      style={styles.fill}
      accessToken={token}
      styleURI="standard-satellite"
      camera={{ ...nyc, zoom: 14, bearing: 0, pitch: 55 }}
    />
  )
}

function NavigateMode() {
  const [result, setResult] = useState('Plan Times Square → Brooklyn Bridge')
  const [loading, setLoading] = useState(false)

  const plan = async () => {
    setLoading(true)
    try {
      const route = await navigation.planRoute([
        { longitude: -73.9855, latitude: 40.758 },
        { longitude: -73.9969, latitude: 40.7061 },
      ])
      setResult(
        `${(route.primary.distance / 1609.344).toFixed(1)} mi · ${Math.round(route.primary.duration / 60)} min`,
      )
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.center}>
      <Text style={styles.title}>Traffic-aware routing</Text>
      <Pressable style={styles.action} onPress={plan}>
        <Text style={styles.actionText}>{loading ? 'Planning…' : 'Plan route'}</Text>
      </Pressable>
      {loading ? <ActivityIndicator /> : <Text style={styles.copy}>{result}</Text>}
    </View>
  )
}

function ReferenceARScene() {
  return (
    <ViroARScene>
      <ViroAmbientLight color="#ffffff" />
      <ViroText
        text="Nitro Mapbox AR"
        position={[0, 0, -1.5]}
        width={2}
        height={1}
        style={{ fontSize: 28, color: '#ffffff', textAlign: 'center' }}
      />
    </ViroARScene>
  )
}

function ARMode() {
  return <ViroARSceneNavigator style={styles.fill} initialScene={{ scene: ReferenceARScene }} />
}

function AgentMode() {
  const [query, setQuery] = useState('coffee near Times Square')
  const [output, setOutput] = useState('Direct Search fallback is ready.')
  const runtime = useMemo(
    () =>
      new SpatialAgentRuntime({
        search: searchClient,
        navigation,
        policy: { allow: ['search', 'route', 'read-context'] },
        getContext: () => ({
          location: { longitude: nyc.longitude, latitude: nyc.latitude },
        }),
      }),
    [],
  )

  const run = async () => {
    try {
      const result = await runtime.search(query, {
        proximity: { longitude: nyc.longitude, latitude: nyc.latitude },
        limit: 5,
      })
      setOutput(`${result.features.length} results returned`)
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <View style={styles.center}>
      <Text style={styles.title}>Spatial agent</Text>
      <TextInput value={query} onChangeText={setQuery} style={styles.input} />
      <Pressable style={styles.action} onPress={run}>
        <Text style={styles.actionText}>Search through agent runtime</Text>
      </Pressable>
      <Text style={styles.copy}>{output}</Text>
    </View>
  )
}

export default function App() {
  const mode = useReferenceStore((state) => state.mode)
  const browserBackend =
    typeof document === 'undefined'
      ? null
      : selectRendererBackend('auto', getBrowserRendererCapabilities())

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.brand}>Nitro Mapbox AR</Text>
        <Text style={styles.subhead}>
          {browserBackend ? `web backend: ${browserBackend}` : 'Graphite-first native reference'}
        </Text>
      </View>
      <View style={styles.tabs}>
        <Tab mode="map" label="Map" />
        <Tab mode="navigate" label="Navigate" />
        <Tab mode="ar" label="AR" />
        <Tab mode="agent" label="Agent" />
      </View>
      <View style={styles.content}>
        {mode === 'map' && <MapMode />}
        {mode === 'navigate' && <NavigateMode />}
        {mode === 'ar' && <ARMode />}
        {mode === 'agent' && <AgentMode />}
      </View>
      <ScrollView horizontal style={styles.flags}>
        {listMapboxFeatures().map((feature) => (
          <Text key={feature.id} style={styles.flag}>
            {feature.id}: {feature.status}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090b10' },
  fill: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  brand: { color: 'white', fontSize: 22, fontWeight: '700' },
  subhead: { color: '#aab2c0', marginTop: 4 },
  tabs: { flexDirection: 'row', paddingHorizontal: 8, gap: 6 },
  tab: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#171b24' },
  tabActive: { backgroundColor: '#2d3748' },
  tabText: { color: 'white', textAlign: 'center', fontWeight: '600' },
  content: { flex: 1, marginTop: 8 },
  center: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  title: { color: 'white', fontSize: 26, fontWeight: '700' },
  copy: { color: '#d4d8df', fontSize: 16 },
  action: { padding: 14, borderRadius: 12, backgroundColor: '#2563eb' },
  actionText: { color: 'white', textAlign: 'center', fontWeight: '700' },
  input: { backgroundColor: 'white', color: '#111827', borderRadius: 10, padding: 12 },
  flags: { maxHeight: 38, paddingHorizontal: 8 },
  flag: { color: '#9ca3af', marginRight: 14, fontSize: 11 },
})
