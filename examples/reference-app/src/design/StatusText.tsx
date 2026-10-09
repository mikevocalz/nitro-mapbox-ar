import { useEffect } from 'react'
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
} from 'react-native'

import { colors, fontSize } from './tokens'

export interface StatusTextProps {
  readonly text: string
  /** Error copy gets the error colour and an assertive announcement. */
  readonly tone?: 'neutral' | 'error'
  readonly style?: StyleProp<TextStyle>
}

/**
 * A status line that screen readers announce when it changes (WCAG 4.1.3).
 * Android reads the live region; iOS has no live regions on `Text`, so the
 * change is announced explicitly.
 */
export function StatusText({ text, tone = 'neutral', style }: StatusTextProps) {
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(text)
    }
  }, [text])

  return (
    <Text
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      style={[styles.text, style, tone === 'error' && styles.error]}
    >
      {text}
    </Text>
  )
}

const styles = StyleSheet.create({
  text: { color: colors.textBody, fontSize: fontSize.body },
  error: { color: colors.textError },
})
