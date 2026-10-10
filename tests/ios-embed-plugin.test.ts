import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)
const root = join(import.meta.dirname, '..')
const plugin = require(join(root, 'app.plugin.js')) as {
  ensureEmbedPhase: (project: FakeProject, targetUuid: string, script?: string) => string
  readEmbedScript: () => string
  pbxString: (value: string) => string
  PHASE_NAME: string
}

interface FakePhase {
  shellScript: string
  inputPaths: string[]
  outputPaths: string[]
  dependencyFile: string
}

interface FakeProject {
  hash: {
    project: {
      objects: {
        PBXNativeTarget: Record<string, { buildPhases: { value: string; comment: string }[] }>
        PBXShellScriptBuildPhase: Record<string, FakePhase | string>
      }
    }
  }
  generateUuid: () => string
}

function fakeProject(): FakeProject {
  let next = 0
  return {
    hash: {
      project: {
        objects: {
          PBXNativeTarget: { APP: { buildPhases: [{ value: 'SOURCES', comment: 'Sources' }] } },
          PBXShellScriptBuildPhase: {},
        },
      },
    },
    generateUuid: () => `UUID${next++}`,
  }
}

test('adds one embed phase to the app target and rewrites it on a second prebuild', () => {
  const project = fakeProject()
  const first = plugin.ensureEmbedPhase(project, 'APP', 'echo one')
  const second = plugin.ensureEmbedPhase(project, 'APP', 'echo "two"\nexit 0')
  assert.equal(first, second)

  const target = project.hash.project.objects.PBXNativeTarget.APP
  assert.deepEqual(target.buildPhases.map((phase) => phase.value), ['SOURCES', first])

  const phase = project.hash.project.objects.PBXShellScriptBuildPhase[first] as FakePhase
  assert.equal(phase.shellScript, '"echo \\"two\\"\\nexit 0"')
  assert.deepEqual(phase.inputPaths, ['"$(TARGET_BUILD_DIR)/$(EXECUTABLE_PATH)"'])
  assert.deepEqual(phase.outputPaths, ['"$(DERIVED_FILE_DIR)/nitro-mapbox-ar-embed-frameworks.stamp"'])
  assert.equal(phase.dependencyFile, '"$(DERIVED_FILE_DIR)/nitro-mapbox-ar-embed-frameworks.d"')
  assert.equal(project.hash.project.objects.PBXShellScriptBuildPhase[`${first}_comment`], plugin.PHASE_NAME)
})

test('pbx strings escape backslashes, quotes, newlines and tabs', () => {
  assert.equal(plugin.pbxString('a\\b "c"\n\td'), '"a\\\\b \\"c\\"\\n\\td"')
})

test('embed script parses, never names a Mapbox framework, and skips visionOS', () => {
  const script = plugin.readEmbedScript()
  execFileSync('bash', ['-n'], { input: script })
  const code = script.split('\n').filter((line) => !line.trimStart().startsWith('#')).join('\n')
  assert.doesNotMatch(code, /MapboxCommon|MapboxCoreMaps|Turf/)
  assert.match(code, /xros \| xrsimulator\)\s+exit 0/)
  assert.match(code, /dynamically linked shared library/)
})
