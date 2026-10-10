'use strict'

const fs = require('node:fs')
const path = require('node:path')

/**
 * Expo config plugin: adds a run-script phase to the iOS app target that
 * copies and signs the dynamic frameworks built by the Mapbox Swift packages.
 *
 * The packages are attached by React Native's `spm_dependency` to the static
 * `NitroMapboxAR` pod target, which links MapboxCommon, MapboxCoreMaps and
 * Turf but cannot embed them. See embed-swift-package-frameworks.sh.
 *
 * The phase lives in the generated Xcode project, so it is written again on
 * every `expo prebuild` (with or without --clean). Running the plugin twice
 * updates the one phase instead of adding a second.
 */

const PHASE_NAME = '[Nitro Mapbox AR] Embed Swift package frameworks'
const STAMP_PATH = '$(DERIVED_FILE_DIR)/nitro-mapbox-ar-embed-frameworks.stamp'
const DEPENDENCY_FILE = '$(DERIVED_FILE_DIR)/nitro-mapbox-ar-embed-frameworks.d'
const INPUT_PATH = '$(TARGET_BUILD_DIR)/$(EXECUTABLE_PATH)'

function readEmbedScript() {
  return fs.readFileSync(path.join(__dirname, 'embed-swift-package-frameworks.sh'), 'utf8')
}

/** Quotes a value the way the `xcode` package stores strings: escaped, in quotes. */
function pbxString(value) {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
  return `"${escaped}"`
}

/**
 * Adds the phase to `targetUuid`, or rewrites it when an earlier prebuild added
 * it. `project` is the `xcode` package's project object (Expo's modResults).
 * Returns the phase uuid.
 */
function ensureEmbedPhase(project, targetUuid, script = readEmbedScript()) {
  const objects = project.hash.project.objects
  const target = objects.PBXNativeTarget[targetUuid]
  if (!target) throw new Error(`[nitro-mapbox-ar] no PBXNativeTarget ${targetUuid}`)
  if (!objects.PBXShellScriptBuildPhase) objects.PBXShellScriptBuildPhase = {}
  const phases = objects.PBXShellScriptBuildPhase
  target.buildPhases = target.buildPhases || []

  let uuid = target.buildPhases
    .map((ref) => ref.value)
    .find((value) => phases[`${value}_comment`] === PHASE_NAME)
  if (!uuid) {
    uuid = project.generateUuid()
    target.buildPhases.push({ value: uuid, comment: PHASE_NAME })
  }

  phases[uuid] = {
    isa: 'PBXShellScriptBuildPhase',
    buildActionMask: 2147483647,
    dependencyFile: pbxString(DEPENDENCY_FILE),
    files: [],
    inputFileListPaths: [],
    inputPaths: [pbxString(INPUT_PATH)],
    name: pbxString(PHASE_NAME),
    outputFileListPaths: [],
    outputPaths: [pbxString(STAMP_PATH)],
    runOnlyForDeploymentPostprocessing: 0,
    shellPath: '/bin/bash',
    shellScript: pbxString(script),
    showEnvVarsInLog: 0,
  }
  phases[`${uuid}_comment`] = PHASE_NAME
  return uuid
}

/**
 * The library declares no dependency on Expo; the plugin uses the app's own
 * copy, resolved from the project root.
 */
function loadConfigPlugins(projectRoot) {
  const paths = [projectRoot, process.cwd(), __dirname].filter(Boolean)
  for (const id of ['expo/config-plugins', '@expo/config-plugins']) {
    try {
      return require(require.resolve(id, { paths }))
    } catch {
      // try the next id
    }
  }
  throw new Error(`[nitro-mapbox-ar] could not resolve expo/config-plugins from ${paths.join(', ')}`)
}

/** @type {import('@expo/config-plugins').ConfigPlugin} */
function withEmbeddedSwiftPackageFrameworks(config) {
  const projectRoot = config._internal && config._internal.projectRoot
  const { withXcodeProject, IOSConfig } = loadConfigPlugins(projectRoot)
  return withXcodeProject(config, (mod) => {
    const { uuid } = IOSConfig.XcodeUtils.getApplicationNativeTarget({
      project: mod.modResults,
      projectName: mod.modRequest.projectName,
    })
    ensureEmbedPhase(mod.modResults, uuid)
    return mod
  })
}

module.exports = withEmbeddedSwiftPackageFrameworks
module.exports.ensureEmbedPhase = ensureEmbedPhase
module.exports.readEmbedScript = readEmbedScript
module.exports.pbxString = pbxString
module.exports.PHASE_NAME = PHASE_NAME
