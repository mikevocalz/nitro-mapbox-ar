#include <fbjni/fbjni.h>
#include <jni.h>

#include "AccessTokenStore.hpp"
#include "NitroMapboxAROnLoad.hpp"

// Backs com.margelo.nitro.mapboxar.MapboxARAccessToken.nativeCurrent().
extern "C" JNIEXPORT jstring JNICALL
Java_com_margelo_nitro_mapboxar_MapboxARAccessToken_nativeCurrent(JNIEnv*, jclass) {
  return facebook::jni::make_jstring(mapboxar::processAccessToken()).release();
}

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::mapboxar::registerAllNatives();
  });
}
