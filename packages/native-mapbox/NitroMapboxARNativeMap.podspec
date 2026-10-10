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
  # "Redefinition of module 'MapboxMaps'".
  #
  # The products are attached to the NitroMapboxAR pod target, not this one.
  # With static pod libraries Xcode copies a package's object files into every
  # pod library that lists one of its products, so a maps pod and a navigation
  # pod that each listed theirs produced two copies of MapboxMaps.o and
  # thousands of duplicate symbols at app link. NitroMapboxAR is a dependency
  # of both pods, so it builds (and builds the packages) first, and its static
  # library is the only one that carries the Mapbox objects. This pod compiles
  # against the package modules through the search paths below.
  spm_dependency(Struct.new(:name).new("NitroMapboxAR"),
    url: "https://github.com/mapbox/mapbox-maps-ios.git",
    requirement: { kind: "exactVersion", version: mapbox_version },
    products: ["MapboxMaps"]
  )
  spm_products_dir = "${SYMROOT}/${CONFIGURATION}${EFFECTIVE_PLATFORM_NAME}"
  s.pod_target_xcconfig = (s.attributes_hash["pod_target_xcconfig"] || {}).merge({
    "SWIFT_INCLUDE_PATHS" => "$(inherited) #{spm_products_dir}",
    "FRAMEWORK_SEARCH_PATHS" => "$(inherited) #{spm_products_dir} #{spm_products_dir}/PackageFrameworks",
  })
  # MapboxARAccessToken: the process-wide token set through MapboxAR.accessToken.
  s.dependency "NitroMapboxAR"
  s.dependency "NitroModules"
  s.dependency "React-jsi"
  s.dependency "React-callinvoker"

  install_modules_dependencies(s)
end
