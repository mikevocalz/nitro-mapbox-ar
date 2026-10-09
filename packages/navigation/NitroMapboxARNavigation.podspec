require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
# The Navigation SDK v3 for iOS ships through Swift Package Manager only (no
# podspec in mapbox-navigation-ios), so it is linked with React Native's
# `spm_dependency` helper (react-native/scripts/cocoapods/spm.rb).
# 3.32.0 pins MapboxMaps 11.32.0, the version the maps package uses; 3.27.3
# pins MapboxMaps 11.27.3 and cannot share an app with it.
navigation_version = ENV.fetch("NITRO_MAPBOX_AR_NAVIGATION_VERSION", "3.32.0")

Pod::Spec.new do |s|
  s.name         = "NitroMapboxARNavigation"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/mikevocalz/nitro-mapbox-ar"
  s.license      = package["license"]
  s.authors      = "Nitro Mapbox AR contributors"
  s.platform     = :ios, "14.0"
  s.source       = {
    :git => "https://github.com/mikevocalz/nitro-mapbox-ar.git",
    :tag => "#{s.version}"
  }

  s.source_files = [
    "ios/**/*.swift",
  ]

  load "nitrogen/generated/ios/NitroMapboxARNavigation+autolinking.rb"
  add_nitrogen_files(s)

  spm_dependency(s,
    url: "https://github.com/mapbox/mapbox-navigation-ios.git",
    requirement: { kind: "exactVersion", version: navigation_version },
    products: ["MapboxNavigationCore", "MapboxDirections"]
  )

  s.dependency "NitroMapboxAR"
  s.dependency "NitroModules"
  s.dependency "React-jsi"
  s.dependency "React-callinvoker"

  install_modules_dependencies(s)
end
