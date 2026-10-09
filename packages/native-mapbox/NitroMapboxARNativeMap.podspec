require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
mapbox_version = ENV.fetch("NITRO_MAPBOX_AR_MAPBOX_VERSION", "11.32.0")

Pod::Spec.new do |s|
  s.name         = "NitroMapboxARNativeMap"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/mikevocalz/nitro-mapbox-ar"
  s.license      = package["license"]
  s.authors      = "Nitro Mapbox AR contributors"
  # The Swift sources import MapboxMaps only under #if os(iOS). On visionOS the
  # pod builds the other branches of HybridMapboxMaps and HybridMapboxMapView,
  # which report isMapViewAvailable = false.
  s.platforms    = { :ios => "14.0", :visionos => "1.0" }
  s.source       = {
    :git => "https://github.com/mikevocalz/nitro-mapbox-ar.git",
    :tag => "#{s.version}"
  }

  s.source_files = [
    "ios/**/*.{swift,h,m,mm}",
  ]

  load "nitrogen/generated/ios/NitroMapboxARNativeMap+autolinking.rb"
  add_nitrogen_files(s)

  # MapboxMaps comes from Swift Package Manager, not its CocoaPod. The
  # navigation package links MapboxNavigationCore through SPM, which depends on
  # this same package URL; a CocoaPod copy next to it fails the app build with
  # "Redefinition of module 'MapboxMaps'". React Native's spm_dependency
  # registers each package URL once, so both pods share one MapboxMaps.
  spm_dependency(s,
    url: "https://github.com/mapbox/mapbox-maps-ios.git",
    requirement: { kind: "exactVersion", version: mapbox_version },
    products: ["MapboxMaps"]
  )
  # MapboxARAccessToken: the process-wide token set through MapboxAR.accessToken.
  s.dependency "NitroMapboxAR"
  s.dependency "NitroModules"
  s.dependency "React-jsi"
  s.dependency "React-callinvoker"

  install_modules_dependencies(s)
end
