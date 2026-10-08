import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../', import.meta.url)

test('the ./navigation subpath points at the Directions client', () => {
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
  assert.equal(pkg.exports['./navigation'].default, './src/navigation/client.ts')
})

// Apps that only need Directions (Quest tabletop AR) import this subpath to
// avoid the root entry, which loads Skia, WebGPU and the Nitro core.
test('the Directions client imports nothing', () => {
  const source = readFileSync(new URL('src/navigation/client.ts', root), 'utf8')
  assert.doesNotMatch(source, /^\s*import\s/m)
  assert.doesNotMatch(source, /\brequire\(/)
})
