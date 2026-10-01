# Nitro Mapbox AR reference app

This replaces the 2018 `RNMapboxARDemo` as the modernization testbed.

## Why Expo 57

The current ReactVision adapter targets React Native 0.86. Expo SDK 57 is the
stable Expo release on RN 0.86. SDK 58 beta is RN 0.88, so the reference app
does not jump to it until the ReactVision peer range is validated there.

## Modes

- **Map** — optional Nitro HybridView backed by Mapbox Maps SDK v11.
- **Navigate** — traffic-aware Directions API route planning.
- **AR** — ReactVision/Viro scene entry.
- **Agent** — permissioned SpatialAgentRuntime using direct Mapbox Search.

## Run

1. Copy `.env.example` to `.env.local` and add a public Mapbox token.
2. `npm install`
3. `npx expo prebuild`
4. `npm run ios` or `npm run android`

Use a development/native build. Expo Go cannot load Nitro native modules.
