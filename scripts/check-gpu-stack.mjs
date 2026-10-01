import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const EXPECTED_WEBGPU_DAWN = 'chrome-m154'
const EXPECTED_SKIA_DAWN = 'dawn-chrome-m154'

function resolvePackageDir(name) {
  return path.dirname(require.resolve(`${name}/package.json`))
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function fail(message) {
  console.error(`\nNitro Mapbox AR GPU stack check failed:\n${message}\n`)
  process.exit(1)
}

let webgpuDir
let skiaDir

try {
  webgpuDir = resolvePackageDir('react-native-webgpu')
  skiaDir = resolvePackageDir('@shopify/react-native-skia')
} catch (error) {
  fail(
    'Graphite mode requires both react-native-webgpu and ' +
      '@shopify/react-native-skia to be installed.\n' +
      String(error),
  )
}

const webgpuPackage = readJson(path.join(webgpuDir, 'package.json'))
if (webgpuPackage.dawn !== EXPECTED_WEBGPU_DAWN) {
  fail(
    `react-native-webgpu ${webgpuPackage.version ?? '(unknown version)'} uses ` +
      `Dawn "${webgpuPackage.dawn ?? '(missing)'}"; this branch expects ` +
      `"${EXPECTED_WEBGPU_DAWN}".`,
  )
}

const graphiteMarker = path.join(skiaDir, 'libs', '.graphite')
if (!fs.existsSync(graphiteMarker)) {
  fail(
    'The installed @shopify/react-native-skia package is not a Graphite build. ' +
      'Stable Ganesh builds can coexist with react-native-webgpu, but they cannot ' +
      'provide Skia.getNativeDevice() or zero-copy Graphite interop.',
  )
}

const dawnMarker = path.join(skiaDir, 'libs', '.dawn-version')
if (!fs.existsSync(dawnMarker)) {
  fail(
    'The Skia Graphite package does not expose libs/.dawn-version. ' +
      'Do not assume binary compatibility; use an m154 Graphite build that ' +
      'declares its shared Dawn release.',
  )
}

const skiaDawn = fs.readFileSync(dawnMarker, 'utf8').trim()
if (skiaDawn !== EXPECTED_SKIA_DAWN) {
  fail(
    `Skia Graphite uses "${skiaDawn}", but this branch expects ` +
      `"${EXPECTED_SKIA_DAWN}".`,
  )
}

console.log(
  [
    'Nitro Mapbox AR GPU stack is compatible.',
    `react-native-webgpu: ${webgpuPackage.version} (${webgpuPackage.dawn})`,
    `Skia Graphite Dawn: ${skiaDawn}`,
  ].join('\n'),
)
