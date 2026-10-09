#pragma once

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <stdexcept>
#include <string>

namespace mapboxar::terrain {

// Largest input `MapboxAR.decodeTerrainRgb` accepts: one 512 x 512 RGBA tile.
inline constexpr std::size_t kMaxSyncTerrainRgbBytes = 1024 * 1024;

// Mapbox Terrain-RGB:
// elevation(m) = -10000 + ((R * 256^2 + G * 256 + B) * 0.1)
inline float decodeTerrainRgb(
    std::uint8_t r,
    std::uint8_t g,
    std::uint8_t b,
    double heightModifier = 1.0) noexcept {
  const auto encoded =
      (static_cast<double>(r) * 65536.0) +
      (static_cast<double>(g) * 256.0) +
      static_cast<double>(b);

  return static_cast<float>(
      (-10000.0 + encoded * 0.1) * heightModifier);
}

// Throws for inputs every decode entry point rejects. Message text is part of
// the public contract (docs/API_DESIGN.md section 2).
inline void validateTerrainRgbInput(std::size_t byteLength, double heightModifier) {
  if (byteLength % 4 != 0) {
    throw std::invalid_argument(
        "Terrain-RGB input must contain exactly 4 bytes per pixel");
  }
  if (!std::isfinite(heightModifier)) {
    throw std::invalid_argument("heightModifier must be finite");
  }
}

// Throws when the input is too large for the synchronous entry point.
inline void validateSyncTerrainRgbSize(std::size_t byteLength) {
  if (byteLength > kMaxSyncTerrainRgbBytes) {
    throw std::length_error(
        "Terrain-RGB input is " + std::to_string(byteLength) +
        " bytes; decodeTerrainRgb accepts at most " +
        std::to_string(kMaxSyncTerrainRgbBytes) +
        " bytes (one 512 x 512 tile). Use decodeTerrainRgbAsync for larger inputs.");
  }
}

// Decodes `byteLength / 4` RGBA pixels into native-endian Float32 heights.
// `output` must hold `byteLength` bytes. The alpha channel is ignored.
inline void decodeTerrainRgbPixels(
    const std::uint8_t* input,
    std::size_t byteLength,
    double heightModifier,
    std::uint8_t* output) noexcept {
  const auto pixelCount = byteLength / 4;
  for (std::size_t pixel = 0; pixel < pixelCount; ++pixel) {
    const auto offset = pixel * 4;
    const float elevation = decodeTerrainRgb(
        input[offset], input[offset + 1], input[offset + 2], heightModifier);
    std::memcpy(output + offset, &elevation, sizeof(float));
  }
}

}  // namespace mapboxar::terrain
