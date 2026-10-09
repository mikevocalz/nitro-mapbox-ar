#include "HybridMapboxAR.hpp"

#include "AccessTokenStore.hpp"
#include "TerrainRgbCodec.hpp"

#include <exception>
#include <stdexcept>
#include <utility>

namespace margelo::nitro::mapboxar {

namespace terrain = ::mapboxar::terrain;

namespace {

// JS-backed buffers expose data() only on the JS thread, and return nullptr
// once the JS buffer is collected (NitroModules ArrayBuffer.hpp, JSArrayBuffer).
const std::uint8_t* requireBytes(const std::shared_ptr<ArrayBuffer>& rgba) {
  if (rgba == nullptr || (rgba->size() > 0 && rgba->data() == nullptr)) {
    throw std::invalid_argument("Terrain-RGB buffer is unavailable");
  }
  return rgba->data();
}

}  // namespace

HybridMapboxAR::HybridMapboxAR()
    : HybridObject(TAG), decodeQueue_("MapboxAR.decode") {}

std::string HybridMapboxAR::getAccessToken() {
  return ::mapboxar::processAccessToken();
}

void HybridMapboxAR::setAccessToken(const std::string& accessToken) {
  ::mapboxar::setProcessAccessToken(accessToken);
}

std::shared_ptr<ArrayBuffer> HybridMapboxAR::decodeTerrainRgb(
    const std::shared_ptr<ArrayBuffer>& rgba,
    double heightModifier) {
  const auto* input = requireBytes(rgba);
  const auto byteLength = rgba->size();
  terrain::validateTerrainRgbInput(byteLength, heightModifier);
  terrain::validateSyncTerrainRgbSize(byteLength);

  auto heights = ArrayBuffer::allocate(byteLength);
  terrain::decodeTerrainRgbPixels(input, byteLength, heightModifier, heights->data());
  return heights;
}

std::shared_ptr<Promise<std::shared_ptr<ArrayBuffer>>>
HybridMapboxAR::decodeTerrainRgbAsync(
    const std::shared_ptr<ArrayBuffer>& rgba,
    double heightModifier) {
  using HeightsPromise = Promise<std::shared_ptr<ArrayBuffer>>;

  std::shared_ptr<ArrayBuffer> input;
  try {
    const auto* bytes = requireBytes(rgba);
    const auto byteLength = rgba->size();
    terrain::validateTerrainRgbInput(byteLength, heightModifier);
    // Copy on the JS thread: the worker cannot read a JS-backed buffer.
    input = byteLength == 0 ? ArrayBuffer::allocate(0)
                            : ArrayBuffer::copy(bytes, byteLength);
  } catch (...) {
    return HeightsPromise::rejected(std::current_exception());
  }

  // A manual promise is needed because the work runs on this object's own
  // queue, not Nitro's shared pool (Promise::async). The job resolves or
  // rejects it exactly once.
  auto promise = HeightsPromise::create();
  decodeQueue_.submit([promise, input = std::move(input), heightModifier]() {
    try {
      const auto byteLength = input->size();
      auto heights = ArrayBuffer::allocate(byteLength);
      terrain::decodeTerrainRgbPixels(
          input->data(), byteLength, heightModifier, heights->data());
      promise->resolve(std::move(heights));
    } catch (...) {
      promise->reject(std::current_exception());
    }
  });
  return promise;
}

}  // namespace margelo::nitro::mapboxar
