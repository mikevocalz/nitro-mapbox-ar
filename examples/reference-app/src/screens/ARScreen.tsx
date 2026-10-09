import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import {
  ViroAmbientLight,
  ViroARScene,
  ViroARSceneNavigator,
  ViroText,
} from '@reactvision/react-viro'

import { copy } from '../copy'
import { StatusText } from '../design/StatusText'
import { colors, spacing } from '../design/tokens'
import { useReferenceStore } from '../store'

function ReferenceARScene() {
  return (
    <ViroARScene>
      <ViroAmbientLight color={colors.textPrimary} />
      <ViroText
        text={copy.ar.sceneText}
        position={[0, 0, -1.5]}
        width={2}
        height={1}
        style={{ fontSize: 28, color: colors.textPrimary, textAlign: 'center' }}
      />
    </ViroARScene>
  )
}

const initialScene = { scene: ReferenceARScene }

/**
 * Camera AR with one floating label. Checks AR support first: on a device
 * without it the navigator would render a black view with no explanation.
 */
export function ARScreen() {
  const support = useReferenceStore((state) => state.arSupport)
  const checkARSupport = useReferenceStore((state) => state.checkARSupport)

  useEffect(() => {
    void checkARSupport()
  }, [checkARSupport])

  switch (support.status) {
    case 'unknown':
    case 'checking':
      return (
        <View style={styles.center}>
          <ActivityIndicator accessibilityLabel={copy.ar.checking} color={colors.textPrimary} />
          <StatusText text={copy.ar.checking} />
        </View>
      )
    case 'unsupported':
      return (
        <View style={styles.center}>
          <StatusText text={copy.ar.unsupported} />
        </View>
      )
    case 'failed':
      return (
        <View style={styles.center}>
          <StatusText text={copy.ar.failed(support.message)} tone="error" />
        </View>
      )
    case 'supported':
      return (
        <View accessible accessibilityLabel={copy.ar.sceneLabel} style={styles.fill}>
          <ViroARSceneNavigator style={styles.fill} initialScene={initialScene} />
        </View>
      )
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg },
})
