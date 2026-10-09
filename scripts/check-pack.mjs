import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Runs `npm pack --dry-run` for the root package and every workspace and fails
 * when a tarball is missing its entry points, README, LICENSE file, or committed
 * Nitrogen output, or would ship tests, local env files or build caches.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const rootManifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const dirs = ['.', ...execFileSync('git', ['ls-files', 'packages/*/package.json'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .map((file) => dirname(file))]

const failures = []
for (const dir of dirs) {
  const cwd = join(root, dir)
  const manifest = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  // Nitrogen can log to stdout ahead of npm's JSON on CI, so parse from the first line that opens the array.
  const [report] = JSON.parse(out.slice(out.search(/^\[/m)))
  const paths = new Set(report.files.map((entry) => entry.path))
  const fail = (message) => failures.push(`${manifest.name}: ${message}`)

  if (!manifest.name.startsWith('@mikevocalz/')) fail('name is not under the @mikevocalz scope')
  if (manifest.license !== rootManifest.license) fail(`license is ${manifest.license}, expected ${rootManifest.license}`)
  for (const field of ['main', 'source', 'types']) {
    if (manifest[field] && !paths.has(manifest[field])) fail(`${field} (${manifest[field]}) is not in the tarball`)
  }
  if (![...paths].some((path) => /^readme\.md$/i.test(path))) fail('README.md is not in the tarball')
  if (!paths.has('LICENSE')) fail('LICENSE is not in the tarball')
  if (existsSync(join(cwd, 'nitro.json')) && ![...paths].some((path) => path.startsWith('nitrogen/generated/'))) {
    fail('nitrogen/generated is not in the tarball; consumers cannot build the native code without it')
  }
  for (const path of paths) {
    if (/^tests?\//.test(path) || /(^|\/)\.env(\.|$)/.test(path)) fail(`ships ${path}`)
    // Gradle and Xcode caches are git-ignored but a `files` allowlist does not
    // apply .gitignore, so a publish from a dev machine would ship them.
    if (/(^|\/)(\.gradle|\.cxx|build|DerivedData|xcuserdata)\//.test(path)) fail(`ships local build output ${path}`)
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`[check:pack] ${dirs.length} package tarballs have their entry points, README and generated code`)
