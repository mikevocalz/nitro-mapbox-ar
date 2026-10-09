import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { copy } from '../copy'
import { ActionButton } from '../design/ActionButton'
import { StatusText } from '../design/StatusText'
import { colors, fontSize, spacing } from '../design/tokens'
import { useReferenceStore, type RoutePlanState } from '../store'

function describePlan(plan: RoutePlanState): string {
  switch (plan.status) {
    case 'idle':
      return copy.navigate.idle
    case 'loading':
      return copy.navigate.planningLabel
    case 'ready':
      return copy.navigate.result(plan.miles, plan.minutes)
    case 'failed':
      return copy.navigate.failed(plan.message)
  }
}

/** Plans Times Square to Brooklyn Bridge with the JS routing client. */
export function NavigateScreen() {
  const plan = useReferenceStore((state) => state.routePlan)
  const planRoute = useReferenceStore((state) => state.planRoute)
  const loading = plan.status === 'loading'

  return (
    <View style={styles.center}>
      <Text accessibilityRole="header" style={styles.title}>
        {copy.navigate.title}
      </Text>
      <Text style={styles.trip}>{copy.navigate.trip}</Text>
      <ActionButton
        label={copy.navigate.plan}
        busyLabel={copy.navigate.planning}
        busyAccessibilityLabel={copy.navigate.planningLabel}
        busy={loading}
        onPress={() => void planRoute()}
      />
      {loading ? (
        <ActivityIndicator
          accessibilityLabel={copy.navigate.planningLabel}
          color={colors.textPrimary}
        />
      ) : (
        <StatusText
          text={describePlan(plan)}
          tone={plan.status === 'failed' ? 'error' : 'neutral'}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg },
  title: { color: colors.textPrimary, fontSize: fontSize.title, fontWeight: '700' },
  trip: { color: colors.textMuted, fontSize: fontSize.body },
})
