import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/index.web.ts', import.meta.url), 'utf8')

const forbidden = [
  './rendering/graphite',
  './terrain/cache/',
  './terrain/gpu/',
  '@shopify/react-native-skia',
  'react-native-nitro-modules',
  'react-native-webgpu',
]

for (const value of forbidden) {
  if (source.includes(value)) {
    throw new Error(`browser entrypoint imports native/GPU-only surface: ${value}`)
  }
}

for (const required of [
  './native/MapboxARCore.web',
  './search/client',
  './navigation/client',
  './agent/runtime',
]) {
  if (!source.includes(required)) {
    throw new Error(`browser entrypoint is missing fallback surface: ${required}`)
  }
}

console.log('browser package surface is isolated from native-only imports')
