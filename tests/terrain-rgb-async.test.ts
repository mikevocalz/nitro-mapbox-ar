import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

// Runs tests/terrain-rgb-async.cpp until the root `test:cpp` script compiles
// it directly; then this file can go.
test('decodeTerrainRgbAsync building blocks keep order and input under concurrent calls', () => {
  const root = join(import.meta.dirname, '..')
  const binary = join(mkdtempSync(join(tmpdir(), 'terrain-rgb-async-')), 'terrain-rgb-async')
  execFileSync('c++', [
    '-std=c++20', '-Wall', '-Wextra', '-Werror', '-pthread', '-Icpp',
    'tests/terrain-rgb-async.cpp', 'cpp/SerialWorkQueue.cpp', 'cpp/AccessTokenStore.cpp',
    '-o', binary,
  ], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] })
  const output = execFileSync(binary, { encoding: 'utf8' })
  assert.match(output, /all checks passed/)
})
