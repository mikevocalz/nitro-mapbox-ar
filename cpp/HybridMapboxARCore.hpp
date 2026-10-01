#pragma once

#include <NitroModules/ArrayBuffer.hpp>
#include <NitroModules/HybridObject.hpp>

#include <memory>
#include <string>

namespace mapboxar {

class HybridMapboxARCore final : public margelo::nitro::HybridObject {
 public:
  HybridMapboxARCore();

  void setAccessToken(const std::string& accessToken);
  std::string getAccessToken() const;
  bool hasAccessToken() const noexcept;
  void assertAccessToken() const;

  std::shared_ptr<margelo::nitro::ArrayBuffer> decodeTerrainRgb(
      const std::shared_ptr<margelo::nitro::ArrayBuffer>& rgba,
      double heightModifier) const;

  void loadHybridMethods() override;

 private:
  static constexpr auto TAG = "MapboxARCore";
  std::string accessToken_;
};

void registerMapboxARCore();

}  // namespace mapboxar
