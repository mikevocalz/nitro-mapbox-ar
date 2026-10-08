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
  s.platform     = :ios, "14.0"
  s.source       = {
    :git => "https://github.com/mikevocalz/nitro-mapbox-ar.git",
    :tag => "#{s.version}"
  }

  s.source_files = [
    "ios/**/*.{swift,h,m,mm}",
  ]

  load "nitrogen/generated/ios/NitroMapboxARNativeMap+autolinking.rb"
  add_nitrogen_files(s)

  s.dependency "MapboxMaps", mapbox_version
  s.dependency "NitroModules"
  s.dependency "React-jsi"
  s.dependency "React-callinvoker"

  install_modules_dependencies(s)
end
