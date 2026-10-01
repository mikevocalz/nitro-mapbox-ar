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

  # Only the revived Nitro core is compiled. The historical Obj-C bridge remains
  # in ios/RNMapboxAR until its migration PR removes it.
  s.source_files = [
    "cpp/**/*.{h,hpp,c,cc,cpp}",
    "ios/Nitro/**/*.{h,hpp,m,mm,c,cc,cpp}"
  ]

  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "DEFINES_MODULE" => "YES"
  }

  s.dependency "NitroModules"
  s.dependency "React-jsi"
  s.dependency "React-callinvoker"

  install_modules_dependencies(s)
end
