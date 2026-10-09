import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Fails when any module reachable from the `./core` entry imports a package.
 * Lens Studio and the web harness load core as plain ESM with no React
 * Native, Nitro, Skia, WebGPU or TypeGPU runtime, and no npm resolution, so
 * core must be self-contained. Walks both the TypeScript source and the built
 * ESM in dist/module (run `npm run build` first).
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeOnly = [
  'react',
  'react-native',
  'react-native-nitro-modules',
  '@shopify/react-native-skia',
  'react-native-webgpu',
  'typegpu',
]

// Static `import`/`export ... from`, side-effect `import '...'`, dynamic `import('...')`, `require('...')`.
const specifierPattern =
  /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|[\s;])import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)|\brequire\(\s*['"]([^'"]+)['"]\s*\)/gm

function resolveSource(from, specifier) {
  const base = join(dirname(from), specifier)
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

function resolveBuilt(from, specifier) {
  const path = join(dirname(from), specifier)
  return existsSync(path) ? path : undefined
}

function walk(entry, resolve) {
  const failures = []
  const seen = new Set()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(specifierPattern)) {
      const specifier = match[1] ?? match[2] ?? match[3] ?? match[4]
      const at = relative(root, file)
      if (!specifier.startsWith('.')) {
        const name = specifier.startsWith('@')
          ? specifier.split('/').slice(0, 2).join('/')
          : specifier.split('/')[0]
        failures.push(
          runtimeOnly.includes(name)
            ? `${at} imports ${specifier}, which core consumers do not have`
            : `${at} imports the package ${specifier}; core must not import packages`,
        )
        continue
      }
      const next = resolve(file, specifier)
      if (next) queue.push(next)
      else failures.push(`${at} imports ${specifier}, which does not resolve`)
    }
  }
  return { failures, count: seen.size }
}

const builtEntry = join(root, 'dist/module/core/index.js')
if (!existsSync(builtEntry)) {
  console.error('[check:core-imports] dist/module/core/index.js is missing; run npm run build')
  process.exit(1)
}

const source = walk(join(root, 'src/core/index.ts'), resolveSource)
const built = walk(builtEntry, resolveBuilt)
const failures = [...source.failures, ...built.failures]
if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(
  `[check:core-imports] ${source.count} source and ${built.count} built modules reachable from ./core import no packages`,
)
