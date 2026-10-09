import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { listMapboxFeatures } from '@mikevocalz/nitro-mapbox-ar'
import { isVisionOS } from '@reactvision/react-viro'
import { SpatialSceneProvider } from '@metavr/layout-compat'
import { createWindowScene } from '@metavr/layout-window-compat'

import { copy } from './src/copy'
import { colors, fontSize, MIN_TARGET_DP, radius, spacing } from './src/design/tokens'
import { rendererLabel } from './src/rendererLabel'
import { AgentScreen } from './src/screens/AgentScreen'
import { ARScreen } from './src/screens/ARScreen'
import { MapScreen } from './src/screens/MapScreen'
import { NavigateScreen } from './src/screens/NavigateScreen'
import { TabletopScreen } from './src/screens/TabletopScreen'
import { isMapViewLinked } from './src/spatial/isMapViewLinked'
import { useReferenceStore, type ReferenceMode } from './src/store'

const windowScene = createWindowScene({ fallback: 'inline' })
const mapViewLinked = isMapViewLinked()
const features = listMapboxFeatures()

function Tab({ mode }: { mode: ReferenceMode }) {
  const selected = useReferenceStore((state) => state.mode === mode)
  const setMode = useReferenceStore((state) => state.setMode)
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={() => setMode(mode)}
      style={[styles.tab, selected && styles.tabSelected]}
    >
      <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{copy.tabs[mode]}</Text>
      {/* A shape cue next to the fill, so selection never rests on colour alone. */}
      <View style={[styles.indicator, selected && styles.indicatorSelected]} />
    </Pressable>
  )
}

export default function App() {
  const mode = useReferenceStore((state) => state.mode)

  return (
    <SafeAreaProvider>
      <SpatialSceneProvider initializer={windowScene}>
        <SafeAreaView style={styles.root}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.brand}>
              {copy.brand}
            </Text>
            <Text style={styles.subhead}>{rendererLabel()}</Text>
          </View>
          <View accessibilityRole="tablist" style={styles.tabs}>
            <Tab mode="map" />
            <Tab mode="navigate" />
            {/* visionOS has no ARKit scene: ViroARSceneNavigator renders nothing there. */}
            {!isVisionOS() && <Tab mode="ar" />}
            <Tab mode="tabletop" />
            <Tab mode="agent" />
          </View>
          <View style={styles.content}>
            {mode === 'map' &&
              (mapViewLinked ? (
                <MapScreen />
              ) : (
                <Text style={styles.copy}>{copy.map.unavailable}</Text>
              ))}
            {mode === 'navigate' && <NavigateScreen />}
            {mode === 'ar' && <ARScreen />}
            {mode === 'tabletop' && (
              <TabletopScreen map={mapViewLinked ? <MapScreen /> : undefined} />
            )}
            {mode === 'agent' && <AgentScreen />}
          </View>
          <ScrollView
            horizontal
            accessibilityLabel={copy.features.label}
            style={styles.flags}
            contentContainerStyle={styles.flagsContent}
          >
            {features.map((feature) => (
              <Text key={feature.id} style={styles.flag}>
                {copy.features.item(feature.id, feature.status)}
              </Text>
            ))}
          </ScrollView>
        </SafeAreaView>
      </SpatialSceneProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  brand: { color: colors.textPrimary, fontSize: fontSize.heading, fontWeight: '700' },
  subhead: { color: colors.textMuted, marginTop: spacing.xs },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.sm, gap: 6 },
  tab: {
    flex: 1,
    minHeight: MIN_TARGET_DP,
    justifyContent: 'center',
    paddingTop: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  tabSelected: { backgroundColor: colors.surfaceSelected },
  tabText: { color: colors.textMuted, textAlign: 'center', fontWeight: '600' },
  tabTextSelected: { color: colors.textPrimary, fontWeight: '700' },
  indicator: { height: 3, marginTop: spacing.sm, backgroundColor: 'transparent' },
  indicatorSelected: { backgroundColor: colors.indicator },
  content: { flex: 1, marginTop: spacing.sm },
  copy: { color: colors.textBody, fontSize: fontSize.body, padding: spacing.xl },
  flags: { flexGrow: 0, paddingHorizontal: spacing.sm },
  flagsContent: { alignItems: 'center', paddingVertical: spacing.sm },
  flag: { color: colors.textMuted, marginRight: 14, fontSize: fontSize.caption },
})
