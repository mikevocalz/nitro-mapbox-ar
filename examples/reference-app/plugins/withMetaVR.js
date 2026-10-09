const fs = require('fs')
const path = require('path')
const {
  withAppBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins')

const { addMetavrxBom, mobileFlavorManifest } = require('./metaVR')

/**
 * Meta VR wiring that `expo prebuild --clean` would otherwise lose:
 *
 * - the MetaVRX BOM in android/app/build.gradle, for the
 *   @metavr/layout-compat and @metavr/layout-window-compat AARs;
 * - android/app/src/mobile/AndroidManifest.xml, which removes the Quest-only
 *   entries Viro writes into the main manifest from the `mobile` flavor that
 *   expo-horizon-core adds.
 *
 * List it after expo-horizon-core and @reactvision/react-viro in app.json.
 *
 * @type {import('@expo/config-plugins').ConfigPlugin}
 */
const withMetaVR = (config) => {
  config = withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error(
        `withMetaVR: expected a Groovy android/app/build.gradle, got ${mod.modResults.language}`,
      )
    }
    mod.modResults.contents = addMetavrxBom(mod.modResults.contents)
    return mod
  })

  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const dir = path.join(
        mod.modRequest.platformProjectRoot,
        'app',
        'src',
        'mobile',
      )
      await fs.promises.mkdir(dir, { recursive: true })
      await fs.promises.writeFile(
        path.join(dir, 'AndroidManifest.xml'),
        mobileFlavorManifest(),
      )
      return mod
    },
  ])
}

module.exports = withMetaVR
