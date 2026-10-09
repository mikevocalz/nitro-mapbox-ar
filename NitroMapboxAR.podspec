require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NitroMapboxAR"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/mikevocalz/nitro-mapbox-ar"
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => min_ios_version_supported, :visionos => 1.0 }
  s.source       = {
    :git => "https://github.com/mikevocalz/nitro-mapbox-ar.git",
    :tag => "#{s.version}"
  }

  # The C++ core plus the Objective-C token reader. Nitrogen adds the generated
  # spec and the autolinking +load registration below.
  s.source_files = [
    "cpp/**/*.{h,hpp,c,cc,cpp}",
    "ios/Nitro/**/*.{h,m,mm}"
  ]
  # MapboxARAccessToken.h is the one header other pods (maps, navigation) import.
  s.public_header_files = [
    "ios/Nitro/MapboxARAccessToken.h"
  ]

  load "nitrogen/generated/ios/NitroMapboxAR+autolinking.rb"
  add_nitrogen_files(s)

  s.dependency "React-jsi"
  s.dependency "React-callinvoker"

  install_modules_dependencies(s)
end
