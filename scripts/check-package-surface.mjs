import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const packed = JSON.parse(
  execFileSync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  ),
)

const report = packed[0]
if (!report || !Array.isArray(report.files)) {
  throw new Error('npm pack did not return a file manifest')
}

const paths = report.files.map((entry) => entry.path)

const required = [
  'package.json',
  'src/index.ts',
  'src/index.web.ts',
  'src/native/MapboxAR.web.ts',
  'src/native/MapboxAR.nitro.ts',
  'skills/nitro-mapbox-ar/SKILL.md',
  'cpp/HybridMapboxAR.cpp',
  'nitro.json',
  'nitrogen/generated/shared/c++/HybridMapboxARSpec.hpp',
  'nitrogen/generated/ios/NitroMapboxAR+autolinking.rb',
  'nitrogen/generated/android/NitroMapboxAR+autolinking.cmake',
  'android/build.gradle',
  'android/CMakeLists.txt',
  'NitroMapboxAR.podspec',
  'ios/Nitro/MapboxARAccessToken.mm',
  'react-native.config.js',
  'app.plugin.js',
  'plugin/withEmbeddedSwiftPackageFrameworks.js',
  'plugin/embed-swift-package-frameworks.sh',
]

for (const path of required) {
  if (!paths.includes(path)) {
    throw new Error(`published package is missing required file: ${path}`)
  }
}

const forbiddenPrefixes = [
  'javascript/',
  'RNMapboxARDemo/',
  'ios/RNMapboxAR/',
  'ios/RNMapboxAR.xcodeproj/',
  'android/rctmapboxar/',
]

for (const path of paths) {
  const forbidden = forbiddenPrefixes.find((prefix) => path.startsWith(prefix))
  if (forbidden) {
    throw new Error(`legacy payload leaked into npm package: ${path}`)
  }
}

const legacyRuntimeDependencies = [
  '@mapbox/sphericalmercator',
  '@mapbox/tile-cover',
  '@turf/bbox',
  '@turf/bbox-polygon',
  '@turf/helpers',
  '@turf/midpoint',
]

for (const name of legacyRuntimeDependencies) {
  if (packageJson.dependencies?.[name]) {
    throw new Error(`legacy runtime dependency is still hard-required: ${name}`)
  }
}

console.log(
  JSON.stringify(
    {
      name: report.name,
      version: report.version,
      fileCount: paths.length,
      packageSize: report.size,
      unpackedSize: report.unpackedSize,
    },
    null,
    2,
  ),
)
