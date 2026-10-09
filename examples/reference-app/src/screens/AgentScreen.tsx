import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native'

import { copy } from '../copy'
import { ActionButton } from '../design/ActionButton'
import { StatusText } from '../design/StatusText'
import { colors, fontSize, MIN_TARGET_DP, radius, spacing } from '../design/tokens'
import { useReferenceStore, type AgentSearchState } from '../store'

function describeSearch(search: AgentSearchState): string {
  switch (search.status) {
    case 'idle':
      return copy.agent.idle
    case 'loading':
      return copy.agent.searchingLabel
    case 'ready':
      return search.places.length === 0
        ? copy.agent.noResults
        : copy.agent.resultCount(search.places.length)
    case 'failed':
      return copy.agent.failed(search.message)
  }
}

/** Forward search through the policy-checked agent runtime. */
export function AgentScreen() {
  const query = useReferenceStore((state) => state.agentQuery)
  const setQuery = useReferenceStore((state) => state.setAgentQuery)
  const search = useReferenceStore((state) => state.agentSearch)
  const runSearch = useReferenceStore((state) => state.runAgentSearch)
  const loading = search.status === 'loading'
  const empty = query.trim().length === 0

  return (
    <View style={styles.center}>
      <Text accessibilityRole="header" style={styles.title}>
        {copy.agent.title}
      </Text>
      <Text nativeID="agent-query-label" style={styles.label}>
        {copy.agent.queryLabel}
      </Text>
      <TextInput
        accessibilityLabel={copy.agent.queryLabel}
        accessibilityLabelledBy="agent-query-label"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => void runSearch()}
        placeholder={copy.agent.queryPlaceholder}
        placeholderTextColor={colors.inputPlaceholder}
        returnKeyType="search"
        style={styles.input}
      />
      <ActionButton
        label={copy.agent.search}
        busyLabel={copy.agent.searching}
        busyAccessibilityLabel={copy.agent.searchingLabel}
        busy={loading}
        disabled={empty}
        onPress={() => void runSearch()}
      />
      {empty && search.status === 'idle' ? (
        <Text style={styles.hint}>{copy.agent.emptyQuery}</Text>
      ) : null}
      {loading ? (
        <ActivityIndicator accessibilityLabel={copy.agent.searchingLabel} color={colors.textPrimary} />
      ) : (
        <StatusText
          text={describeSearch(search)}
          tone={search.status === 'failed' ? 'error' : 'neutral'}
        />
      )}
      {search.status === 'ready' && search.places.length > 0 ? (
        <View accessibilityRole="list" style={styles.results}>
          {search.places.map((place) => (
            <View key={place.id} style={styles.result}>
              <Text style={styles.placeName}>{place.name || copy.agent.unnamedPlace}</Text>
              {place.address === undefined ? null : (
                <Text style={styles.placeAddress}>{place.address}</Text>
              )}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.md },
  title: { color: colors.textPrimary, fontSize: fontSize.title, fontWeight: '700' },
  label: { color: colors.textBody, fontSize: fontSize.body, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: fontSize.body },
  input: {
    minHeight: MIN_TARGET_DP,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.body,
  },
  results: { gap: spacing.sm },
  result: { paddingVertical: spacing.xs },
  placeName: { color: colors.textPrimary, fontSize: fontSize.body, fontWeight: '600' },
  placeAddress: { color: colors.textMuted, fontSize: fontSize.caption },
})
