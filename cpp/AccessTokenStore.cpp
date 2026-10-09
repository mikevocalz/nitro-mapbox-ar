#include "AccessTokenStore.hpp"

#include <mutex>
#include <utility>

namespace mapboxar {

namespace {

std::mutex& tokenMutex() {
  static std::mutex mutex;
  return mutex;
}

std::string& tokenValue() {
  static std::string value;
  return value;
}

}  // namespace

void setProcessAccessToken(std::string token) {
  std::lock_guard<std::mutex> lock(tokenMutex());
  tokenValue() = std::move(token);
}

std::string processAccessToken() {
  std::lock_guard<std::mutex> lock(tokenMutex());
  return tokenValue();
}

}  // namespace mapboxar
