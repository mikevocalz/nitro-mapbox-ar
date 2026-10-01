#include "HybridMapboxARCore.hpp"

#include <NitroModules/HybridObjectRegistry.hpp>

#include <cmath>
#include <cstdint>
#include <cstring>
#include <stdexcept>

namespace mapboxar {

using margelo::nitro::ArrayBuffer;
using margelo::nitro::HybridObject;
using margelo::nitro::HybridObjectRegistry;

HybridMapboxARCore::HybridMapboxARCore() : HybridObject(TAG) {}

void HybridMapboxARCore::setAccessToken(const std::string& accessToken) {
  if (accessToken.empty()) {
    throw std::invalid_argument("Mapbox access token cannot be empty");
  }
  accessToken_ = accessToken;
}

std::string HybridMapboxARCore::getAccessToken() const {
  return accessToken_;
}

bool HybridMapboxARCore::hasAccessToken() const noexcept {
  return !accessToken_.empty();
}

void HybridMapboxARCore::assertAccessToken() const {
  if (accessToken_.empty()) {
    throw std::runtime_error("Mapbox access token has not been configured");
  }
}

std::shared_ptr<ArrayBuffer> HybridMapboxARCore::decodeTerrainRgb(
    const std::shared_ptr<ArrayBuffer>& rgba,
    double heightModifier) const {
  if (rgba == nullptr || rgba->data() == nullptr) {
    throw std::invalid_argument("Terrain-RGB buffer is unavailable");
  }
  if (rgba->size() % 4 != 0) {
    throw std::invalid_argument(
        "Terrain-RGB input must contain exactly 4 bytes per pixel");
  }
  if (!std::isfinite(heightModifier)) {
    throw std::invalid_argument("heightModifier must be finite");
  }

  const auto pixelCount = rgba->size() / 4;
  constexpr size_t kFloatBytes = sizeof(float);
  auto heights = ArrayBuffer::allocate(pixelCount * kFloatBytes);

  const auto* input = rgba->data();
  auto* output = heights->data();

  for (size_t pixel = 0; pixel < pixelCount; ++pixel) {
    const auto offset = pixel * 4;
    const auto r = static_cast<double>(input[offset]);
    const auto g = static_cast<double>(input[offset + 1]);
    const auto b = static_cast<double>(input[offset + 2]);

    // Mapbox Terrain-RGB:
    // height(m) = -10000 + ((R * 256^2 + G * 256 + B) * 0.1)
    const auto encoded = (r * 65536.0) + (g * 256.0) + b;
    const auto elevation =
        static_cast<float>((-10000.0 + encoded * 0.1) * heightModifier);

    std::memcpy(output + pixel * kFloatBytes, &elevation, kFloatBytes);
  }

  return heights;
}

void HybridMapboxARCore::loadHybridMethods() {
  HybridObject::loadHybridMethods();

  registerHybrids(this, [](margelo::nitro::Prototype& prototype) {
    prototype.registerHybridMethod(
        "setAccessToken", &HybridMapboxARCore::setAccessToken);
    prototype.registerHybridMethod(
        "getAccessToken", &HybridMapboxARCore::getAccessToken);
    prototype.registerHybridMethod(
        "hasAccessToken", &HybridMapboxARCore::hasAccessToken);
    prototype.registerHybridMethod(
        "assertAccessToken", &HybridMapboxARCore::assertAccessToken);
    prototype.registerHybridMethod(
        "decodeTerrainRgb", &HybridMapboxARCore::decodeTerrainRgb);
  });
}

void registerMapboxARCore() {
  HybridObjectRegistry::registerHybridObjectConstructor(
      "MapboxARCore",
      []() -> std::shared_ptr<HybridObject> {
        return std::make_shared<HybridMapboxARCore>();
      });
}

}  // namespace mapboxar
