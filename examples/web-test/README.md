# PR #29 web test

A browser-only harness for the Nitro Mapbox AR web entrypoint.

It intentionally does **not** install or import React Native, Nitro Modules,
Skia, ReactVision/Viro, or the native Mapbox SDK packages.

## What it tests

- package `browser` conditional export
- Mapbox GL JS visual map
- Search Box forward search
- traffic-aware Directions API route geometry
- browser WebGPU capability detection
- automatic renderer selection
- typed-JavaScript Terrain-RGB CPU fallback
- stable/preview feature registry

## Run

```bash
cd examples/web-test
npm install
cp .env.example .env.local
npm run dev
```

Then open the Vite URL and use a public Mapbox access token.

## CI

PR #29 builds this app with `npm run build`. The build is token-free; live
Mapbox calls are exercised manually with a public token.
