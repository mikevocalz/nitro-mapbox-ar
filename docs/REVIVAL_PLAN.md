# Revival PR Plan — implemented stack

## Foundation
1 architecture/preservation contract
2 modern TypeScript core
3 Nitro C++ service fallback
4 Skia Graphite + shared WebGPU/Dawn
5 TypeGPU Terrain-RGB compute
6 modern Mapbox raster/data provider
7 encoded tile -> GPU decode
8 correctness tests + CI

## GPU terrain/runtime
9 direct GPU terrain rendering
10 optional native Mapbox Maps v11 HybridView
11 ReactVision geospatial bridge
12 superseded duplicate direct-render PR (closed)
13 slim modern npm surface / legacy isolation
14 GPU satellite imagery
15 seam-safe LOD skirts
16 multi-tile GPU batching
17 bounded GPU tile residency/prefetch
19 movement-aware spatial tile sessions

## Product services
20 Search Box / rich Places / entrance-aware anchors
21 traffic-aware Directions + Map Matching
22 lightweight/native navigation session boundary
23 permissioned spatial agent runtime
24 browser-safe fallbacks beside Nitro
25 Mapbox MCP + repository Agent Skill
26 indoor handoff + advanced navigation / EV hooks
27 XR capability + gaze-aware spatial context
28 stable/preview feature registry
29 reference app, migration docs and final hardening

## Release acceptance
- no legacy bridge in modern core service path
- no bitmap -> OBJ -> filesystem -> Viro roundtrip
- no large GPU terrain readback to JS
- bounded GPU tile residency
- heavy native Mapbox SDKs remain optional
- browser imports do not resolve Nitro/Graphite-native modules
- preview/private-preview features are opt-in
- visionOS Graphite is capability-gated until validated
- Search/Navigation direct fallbacks work without Agent Toolkit
- host CI typechecks core and optional workspaces and runs correctness tests

## Device validation before 1.0
Run the reference app on iOS ARKit, Android ARCore, Quest, Vision Pro and web.
Use `docs/TESTING.md` for Terrain-RGB GPU parity.
