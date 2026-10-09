project(NitroMapboxAR)
cmake_minimum_required(VERSION 3.22.1)

set(PACKAGE_NAME NitroMapboxAR)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

add_library(
  ${PACKAGE_NAME}
  SHARED
  src/main/cpp/cpp-adapter.cpp
  ../cpp/AccessTokenStore.cpp
  ../cpp/HybridMapboxAR.cpp
  ../cpp/SerialWorkQueue.cpp
)

include_directories(
  "../cpp"
  "src/main/cpp"
)

# Generated spec, OnLoad registration, and the fbjni / JSI / NitroModules links.
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NitroMapboxAR+autolinking.cmake)

find_library(LOG_LIB log)

target_link_libraries(
  ${PACKAGE_NAME}
  ${LOG_LIB}
  android
)
