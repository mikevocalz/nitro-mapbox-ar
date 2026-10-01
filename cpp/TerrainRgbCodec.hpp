#pragma once

#include <cstdint>

namespace mapboxar::terrain {

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

}  // namespace mapboxar::terrain
