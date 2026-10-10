const { getDefaultConfig } = require('expo/metro-config')

// Expo's default. The file exists so the withViroVisionOS plugin can add the
// visionOS platform resolver before the export line during `expo prebuild`.
const config = getDefaultConfig(__dirname)


// viro-visionos — visionOS platform resolver

// Viro loads these through `require()`, and Metro treats anything not in assetExts as source.
// Without this, `<ViroLightingEnvironment source={require('./env.hdr')} />` fails the bundle with
// "Unable to resolve ./env.hdr" before a single frame is drawn — which is a confusing first
// experience for a file that is plainly an asset.
// Without visionos in resolver.platforms, Metro never tries a module's `.native.js` variant on
// this platform, so any package shipping one silently resolves to its **web** build. expo-asset is
// how this surfaces: its web AssetSourceResolver returns an empty uri, and every require()'d image
// reaches the native side with no URL at all.
config.resolver.platforms = [...new Set([...(config.resolver.platforms ?? []), 'visionos'])];

const VIRO_ASSET_EXTS = ['glb', 'gltf', 'hdr', 'obj', 'mtl', 'vrx'];
for (const ext of VIRO_ASSET_EXTS) {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
}

// Prefixed, all of it: this block is appended to a config file that was written without knowing
// about it, and `const path = require('path')` at the top of a Metro config is close to
// universal. A second `const path` in the same scope is a SyntaxError that nothing catches until
// the bundler runs — which no native build does, so it survives every compile and fails on launch.
const viroNodePath = require('path');
const { getPlatformResolver: viroGetPlatformResolver } = require('@callstack/out-of-tree-platforms');
const viroPlatformResolver = viroGetPlatformResolver({
  platformNameMap: { visionos: '@reactvision/react-native-visionos' },
});

// Device builds run their own Metro from the Xcode build phase, which reads this file and
// nothing else — tsconfig `paths` are applied by the Expo dev server, not by that instance.
// A project using the `@/` alias therefore builds in the Simulator and fails on device with
// "Unable to resolve module @/...". Resolving it here covers both.
// The rewrite is a fallback, not the first thing tried. Resolving `@/x` to an absolute path
// takes it out of Metro's ordinary path and an asset reached that way loses the treatment that
// gives it a server location — fonts arrive as bytes CoreText rejects ("CTFontManagerError 104")
// and images as an empty `source.uri`. Where the alias already resolves, which is everywhere the
// Expo dev server applies tsconfig paths, nothing is rewritten at all.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return viroPlatformResolver(context, moduleName, platform);
  } catch (error) {
    if (!moduleName.startsWith('@/')) throw error;
    return viroPlatformResolver(
      context,
      viroNodePath.resolve(__dirname, moduleName.slice(2)),
      platform
    );
  }
};

module.exports = config;
