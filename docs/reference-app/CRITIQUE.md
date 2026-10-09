# Reference app design critique

Who it is for: developers evaluating `@mikevocalz/nitro-mapbox-ar` on a phone, Meta Quest or Apple Vision Pro. Each tab shows one package working: Map (maps), Navigate (JS routing), AR (Viro camera AR), Table (ReactVision tabletop route), Agent (agent runtime search). Stage: reference build, so the bar is "a developer can tell what happened and why" more than polish.

Reviewed from source at `c7e6ba7` against the ten usability heuristics and the design-critique framework. Fixes landed in `323d1d4`. Accessibility findings are in [A11Y.md](A11Y.md) and not repeated here.

**Verdict:** several issues to address, all fixed in code.

## Overall impression

The tab bar and dark palette read clearly, and the Map and Table screens already modelled loading and failure as states in a store. Navigate and Agent did not: they kept request state in `useState`, showed jargon, and gave no sign of progress or failure beyond a changed string.

## Findings

| # | Screen, file:line (`c7e6ba7`) | Heuristic | Finding | Severity | Resolution |
| --- | --- | --- | --- | --- | --- |
| 1 | Navigate, `App.tsx:49-50` | H4 consistency (repo rule) | `NavigateMode` held `result` and `loading` in `useState`; the repo bans bare `useState` in the reference app | Moderate | Fixed `323d1d4`: `routePlan` state and `planRoute()` in `src/store.ts`; screen in `src/screens/NavigateScreen.tsx` |
| 2 | Agent, `App.tsx:100-113` | H4 | `AgentMode` held `query` and `output` in `useState` and built its runtime in `useMemo` per mount | Moderate | Fixed `323d1d4`: `agentQuery`, `agentSearch`, `runAgentSearch()` in the store; the runtime is one module-level instance in `src/services.ts` |
| 3 | Navigate, `App.tsx:72` | H5 error prevention | Tapping "Plan route" while planning started a second request; the later one could overwrite the earlier | Moderate | Fixed `323d1d4`: button disabled while busy; `planRoute()` returns early while `loading` |
| 4 | Agent, `App.tsx:115-125` | H1 visibility | No loading state; the old message stayed until the request settled | Moderate | Fixed `323d1d4`: busy button label, spinner, "Searching…" |
| 5 | Agent, `App.tsx:121` | H6 recognition, H1 | "5 results returned" with no results shown | Critical | Fixed `323d1d4`: names and addresses listed; "No places matched. Try a broader search." when empty |
| 6 | Agent, `App.tsx:101`, `:132` | H2 real-world language | "Direct Search fallback is ready." and "Search through agent runtime" describe internals | Moderate | Fixed `323d1d4`: title "Place search", button "Search places", idle text "Results near Times Square appear here." |
| 7 | Agent, `App.tsx:130` | H5 | An empty query could be submitted | Minor | Fixed `323d1d4`: button disabled for an empty or blank query, with a hint; the store ignores a blank query too |
| 8 | Navigate, `App.tsx:49`, `:63` | H9 error recovery | Errors printed as bare exception text in the success style | Moderate | Fixed `323d1d4`: "Route failed: <message>. Check the token and try again." in the error tone |
| 9 | Navigate, `App.tsx:49` | H6 | The trip was only named inside the initial result string, which the first result replaced | Minor | Fixed `323d1d4`: the trip stays on screen as its own line; the result adds "with current traffic" |
| 10 | Map, `MapScreen.tsx:49-53` | H2, H1 | Status showed raw state names (`loading`, `ready`) | Moderate | Fixed `323d1d4`: "Loading map…" with a spinner, "Tap the map to read a coordinate.", "Map failed to load: …" |
| 11 | AR, `App.tsx:95-97` | H1, H9 | No support check; an unsupported device showed a black view | Critical | Fixed `323d1d4`: `ARScreen` checks support first and points to the Table tab when AR is unavailable |
| 12 | All, `App.tsx:144` | H4 platform standards | `SafeAreaView` from `react-native` is deprecated in 0.86.3 and ignores Android insets | Moderate | Fixed `d9ff13c`: `SafeAreaProvider` at the root and `SafeAreaView` from `react-native-safe-area-context` 5.7.0 (the SDK 57 pin). The iOS simulator and Android `mobileDebug` builds compile with it; insets have not been checked on a Pixel or Quest |
| 13 | All, `App.tsx:183-202`, `MapScreen.tsx:59-64`, `TabletopScreen.tsx:258-267` | H4 consistency | Hex colours, sizes and copy repeated per file (`#d4d8df` in three files, two copies of the action button style) | Moderate | Fixed `323d1d4`: `src/design/tokens.ts`, `src/copy.ts`, `ActionButton`, `StatusText` |
| 14 | Table, `TabletopScreen.tsx:238-242` | H1 | Route and host failures used the muted secondary style | Minor | Fixed `323d1d4`: `StatusText` with the error tone |
| 15 | Header, `App.tsx:171-177` | H8 minimalism | The feature-flag strip is developer data on a user surface | Minor | Kept on purpose: the reference app exists to show library state. It now has an accessible name ("Library feature status") and no longer clips at large text |

## Visual hierarchy

- **What draws the eye first:** the brand line, then the tab bar. Correct for a reference app: it names the product and the five demos.
- **Reading flow:** header, tabs, screen title, the one primary action, status. Each screen has one primary action.
- **Emphasis:** before the fix the selected tab was nearly invisible (finding A11Y 2). It now carries a bar, bold weight and primary text colour.

## What works

- Map and Table already modelled each request as a discriminated union (`idle | loading | ready | failed`) in Zustand; Navigate and Agent now follow the same shape.
- Hosts without a capability get a sentence instead of an empty view: no map on visionOS, no device location on Quest.

## Open items

Item 12 is the only finding not fixed in code, and it is deferred, not open: it needs a native dependency and a device run.
