#pragma once

#include "HybridMapboxARSpec.hpp"
#include "SerialWorkQueue.hpp"

#include <memory>
#include <string>

namespace margelo::nitro::mapboxar {

// C++ implementation of the `MapboxAR` spec (src/native/MapboxAR.nitro.ts).
// Autolinked by nitro.json; Nitrogen registers it under "MapboxAR".
class HybridMapboxAR final : public HybridMapboxARSpec {
 public:
  HybridMapboxAR();

  std::string getAccessToken() override;
  void setAccessToken(const std::string& accessToken) override;

  std::shared_ptr<ArrayBuffer> decodeTerrainRgb(
      const std::shared_ptr<ArrayBuffer>& rgba,
      double heightModifier) override;

  std::shared_ptr<Promise<std::shared_ptr<ArrayBuffer>>> decodeTerrainRgbAsync(
      const std::shared_ptr<ArrayBuffer>& rgba,
      double heightModifier) override;

 private:
  ::mapboxar::SerialWorkQueue decodeQueue_;
};

}  // namespace margelo::nitro::mapboxar
