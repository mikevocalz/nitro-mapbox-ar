/**
 * Colours, sizes and spacing for the reference app. Every screen reads from
 * here; no screen declares its own hex value.
 *
 * Contrast ratios are WCAG 2.1 relative-luminance ratios, computed against
 * the colour each token sits on (docs/reference-app/A11Y.md lists the pairs).
 */
export const colors = {
  /** App background. */
  background: '#090b10',
  /** Inactive tab, panels. */
  surface: '#171b24',
  /** Selected tab fill. 1.44:1 against `surface`, so never the only cue. */
  surfaceSelected: '#2d3748',
  /** Headings and button text. 19.68:1 on `background`. */
  textPrimary: '#ffffff',
  /** Body copy. 13.77:1 on `background`. */
  textBody: '#d4d8df',
  /** Secondary copy. 9.22:1 on `background`, 8.07:1 on `surface`. */
  textMuted: '#aab2c0',
  /** Error copy. 10.37:1 on `background`. */
  textError: '#fca5a5',
  /** Primary action fill. White text on it is 5.17:1. */
  accent: '#2563eb',
  /** Primary action while disabled. `textOnDisabled` on it is 6.94:1. */
  accentDisabled: '#1e3a8a',
  textOnDisabled: '#c7d2fe',
  /**
   * Selected-tab indicator bar. 6.78:1 on `surface`, 4.72:1 on
   * `surfaceSelected`: passes the 3:1 non-text minimum on both.
   */
  indicator: '#60a5fa',
  /** Text field fill and text. 17.74:1. */
  inputBackground: '#ffffff',
  inputText: '#111827',
  /** Placeholder text. 4.83:1 on `inputBackground`. */
  inputPlaceholder: '#6b7280',
  /** Backing behind text drawn over the map, so imagery never sets contrast. */
  scrim: 'rgba(9, 11, 16, 0.85)',
  /** Viro materials on the tabletop. */
  routeLine: '#38bdf8',
  userMarker: '#f97316',
} as const

/**
 * Smallest touch target. 48 dp meets Android's guideline and the Quest
 * look-and-pinch minimum, and covers Apple's 44 pt.
 */
export const MIN_TARGET_DP = 48

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const

export const radius = {
  control: 10,
  action: 12,
} as const

export const fontSize = {
  caption: 12,
  body: 16,
  heading: 22,
  title: 26,
} as const
