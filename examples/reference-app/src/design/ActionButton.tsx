import { Pressable, StyleSheet, Text } from 'react-native'

import { colors, fontSize, MIN_TARGET_DP, radius, spacing } from './tokens'

export interface ActionButtonProps {
  readonly label: string
  readonly onPress: () => void
  /** Shown instead of `label` while `busy`. */
  readonly busyLabel?: string
  /** Announced by screen readers while `busy`, when it differs from the visible text. */
  readonly busyAccessibilityLabel?: string
  readonly busy?: boolean
  readonly disabled?: boolean
}

/** The one primary action style in the app. Disabled while busy, so a second tap cannot start a duplicate request. */
export function ActionButton({
  label,
  onPress,
  busyLabel,
  busyAccessibilityLabel,
  busy = false,
  disabled = false,
}: ActionButtonProps) {
  const inactive = busy || disabled
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={busy ? (busyAccessibilityLabel ?? busyLabel ?? label) : label}
      accessibilityState={{ busy, disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={[styles.action, inactive && styles.actionInactive]}
    >
      <Text style={[styles.text, inactive && styles.textInactive]}>
        {busy ? (busyLabel ?? label) : label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  action: {
    minHeight: MIN_TARGET_DP,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.action,
    backgroundColor: colors.accent,
  },
  actionInactive: { backgroundColor: colors.accentDisabled },
  text: {
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: fontSize.body,
  },
  textInactive: { color: colors.textOnDisabled },
})
