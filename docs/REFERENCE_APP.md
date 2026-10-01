# Reference app and release hardening

The modern demo lives in `examples/reference-app`.

It intentionally uses Expo SDK 57 / React Native 0.86 because that matches the
current ReactVision adapter peer range. Expo SDK 58 beta uses React Native 0.88
and should be validated separately before this testbed moves.

Modes: Map, Navigate, AR, Agent.

Release candidates require green host CI, device Terrain-RGB parity, package
surface isolation, browser import isolation, native Mapbox link smoke test,
ReactVision AR smoke test and leak-free renderer teardown/re-entry.
