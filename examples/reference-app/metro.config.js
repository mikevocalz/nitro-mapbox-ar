const { getDefaultConfig } = require('expo/metro-config')

// Expo's default. The file exists so the withViroVisionOS plugin can add the
// visionOS platform resolver before the export line during `expo prebuild`.
const config = getDefaultConfig(__dirname)

module.exports = config;
