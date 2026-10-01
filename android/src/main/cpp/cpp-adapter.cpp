#include <fbjni/fbjni.h>
#include <jni.h>

#include "HybridMapboxARCore.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    mapboxar::registerMapboxARCore();
  });
}
