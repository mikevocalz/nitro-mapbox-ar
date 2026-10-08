# Skills

Apply each by name. When a skill is not installed as a slash command, apply its discipline from the linked source and still produce the named artifact; never claim a skill ran when it did not.

Margelo react-native-skills — https://github.com/margelo/react-native-skills/tree/main/skills
- api-design → docs/API_DESIGN.md: user-facing TypeScript sketched before any implementation, 2–3 realistic call sites per API incl. error + cleanup paths, a rule-by-rule checklist against the skill, freshness check against current package metadata
- build-nitro-modules → root nitro.json, one .nitro.ts per primary HybridObject, named types in their own .ts files, nitrogen/generated committed for every package
- cpp → cpp/**, swift → packages/*/ios/**, kotlin → packages/*/android/**: one top-level type per file, Type+operation extension files, factories are orchestration only, Promise.async/parallel over manual promises, memorySize on resource owners, prepareForRecycle on views
Callstack react-native-best-practices — https://github.com/callstackincubator/agent-skills → docs/PERFORMANCE.md with measured before/after FPS and TTI for the reference app on iPhone, Pixel and Quest 3
WorldFlowAI/everything-claude-code — https://github.com/WorldFlowAI/everything-claude-code → subagent orchestration, verification loops, plan-then-execute
petergyang/no-ai-slop — https://github.com/petergyang/no-ai-slop → final pass on every file, doc and commit message
meta-quest/agentic-tools — https://github.com/meta-quest/agentic-tools → Meta VR CLI (`metavr`) for Quest logcat/screenshots and store-readiness checks
Design sequence for the reference app (Map, Navigate, AR, Agent screens; the Quest SpatialWindow; the visionOS window), one full pass per screen, in this order:
- user-research → docs/design/research.md (who navigates in AR, on which device, with which location source)
- design-system → examples/reference-app/src/design/tokens.ts + component inventory
- Mobbin, per screen → 3 reference flows cited by URL in docs/design/references.md
- ux-copy → examples/reference-app/src/copy.ts (every user-facing string; nothing inline)
- accessibility-review → docs/design/a11y.md: WCAG 2.1 AA; Look-and-Pinch targets ≥ 48dp on Quest
- design-critique → docs/design/critique.md with each finding resolved or explicitly deferred
- design-handoff → docs/design/handoff.md: layout, tokens, states, per-platform breakpoints
- frontend-design → the screens
- code-review → every PR before merge
