import { execFileSync, spawnSync } from 'node:child_process'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Regenerates Nitrogen output for every package that has a nitro.json and
 * fails when the committed nitrogen/generated tree differs from the specs.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const configs = execFileSync('git', ['ls-files', 'nitro.json', '*/nitro.json'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

if (configs.length === 0) throw new Error('No nitro.json found; the Nitrogen gate has nothing to check')

const failures = []
for (const config of configs) {
  const dir = join(root, dirname(config))
  execFileSync('npx', ['--no-install', 'nitrogen'], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] })
  const generated = relative(root, join(dir, 'nitrogen')) || 'nitrogen'

  const changed = spawnSync('git', ['diff', '--quiet', '--', generated], { cwd: root }).status !== 0
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', generated], { cwd: root, encoding: 'utf8' }).trim()
  if (changed || untracked) {
    failures.push(`${generated} does not match its specs. Run nitrogen in ${dirname(config)} and commit the output.`)
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`[check:nitrogen] ${configs.length} Nitrogen package(s) match their committed output`)
