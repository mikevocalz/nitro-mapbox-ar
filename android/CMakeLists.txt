project(NitroMapboxAR)
cmake_minimum_required(VERSION 3.22.1)

set(PACKAGE_NAME NitroMapboxAR)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

add_library(
  ${PACKAGE_NAME}
  SHARED
  src/main/cpp/cpp-adapter.cpp
  ../cpp/HybridMapboxARCore.cpp
)

include_directories(
  "../cpp"
  "src/main/cpp"
)

find_library(LOG_LIB log)
find_package(fbjni REQUIRED)
find_package(ReactAndroid REQUIRED)
find_package(react-native-nitro-modules REQUIRED)

target_link_libraries(
  ${PACKAGE_NAME}
  ${LOG_LIB}
  android
  fbjni::fbjni
  ReactAndroid::jsi
  react-native-nitro-modules::NitroModules
)

if(ReactAndroid_VERSION_MINOR GREATER_EQUAL 76)
  target_link_libraries(${PACKAGE_NAME} ReactAndroid::reactnative)
else()
  target_link_libraries(${PACKAGE_NAME} ReactAndroid::react_nativemodule_core)
endif()
