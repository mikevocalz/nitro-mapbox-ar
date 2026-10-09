// Behaviour test for the pieces behind MapboxAR.decodeTerrainRgbAsync:
// the owned SerialWorkQueue, the Terrain-RGB pixel decoder and validation,
// and the process-wide token store. Builds without Nitro or JSI.
//
//   c++ -std=c++20 -Wall -Wextra -Werror -pthread -Icpp tests/terrain-rgb-async.cpp cpp/SerialWorkQueue.cpp cpp/AccessTokenStore.cpp -o /tmp/terrain-rgb-async
#include "AccessTokenStore.hpp"
#include "SerialWorkQueue.hpp"
#include "TerrainRgbCodec.hpp"

#include <atomic>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <future>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace {

int failures = 0;

void check(bool condition, const char* what) {
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", what);
    ++failures;
  }
}

// One tile whose every pixel encodes the same height, distinct per `id`, so
// a result can be traced back to the input it came from.
std::vector<std::uint8_t> tileFor(int id, std::size_t pixels) {
  std::vector<std::uint8_t> rgba(pixels * 4);
  const auto encoded = static_cast<std::uint32_t>(100000 + id * 37);
  for (std::size_t pixel = 0; pixel < pixels; ++pixel) {
    rgba[pixel * 4 + 0] = static_cast<std::uint8_t>((encoded >> 16) & 0xff);
    rgba[pixel * 4 + 1] = static_cast<std::uint8_t>((encoded >> 8) & 0xff);
    rgba[pixel * 4 + 2] = static_cast<std::uint8_t>(encoded & 0xff);
    rgba[pixel * 4 + 3] = 255;
  }
  return rgba;
}

float expectedHeight(int id, double heightModifier) {
  const auto encoded = static_cast<double>(100000 + id * 37);
  return static_cast<float>((-10000.0 + encoded * 0.1) * heightModifier);
}

struct Completed {
  int submitter;
  int sequence;
};

// Mirrors HybridMapboxAR::decodeTerrainRgbAsync: validate and copy on the
// caller thread, decode on the owned queue, complete exactly once.
std::future<std::vector<std::uint8_t>> decodeAsync(
    mapboxar::SerialWorkQueue& queue,
    const std::vector<std::uint8_t>& rgba,
    double heightModifier,
    std::function<void()> onComplete) {
  auto promise = std::make_shared<std::promise<std::vector<std::uint8_t>>>();
  auto future = promise->get_future();
  try {
    mapboxar::terrain::validateTerrainRgbInput(rgba.size(), heightModifier);
  } catch (...) {
    promise->set_exception(std::current_exception());
    return future;
  }
  queue.submit([promise, input = rgba, heightModifier, onComplete = std::move(onComplete)]() {
    std::vector<std::uint8_t> heights(input.size());
    mapboxar::terrain::decodeTerrainRgbPixels(
        input.data(), input.size(), heightModifier, heights.data());
    onComplete();
    promise->set_value(std::move(heights));
  });
  return future;
}

void concurrentCallsResolveInOrderWithTheirOwnInput() {
  constexpr int kSubmitters = 8;
  constexpr int kCallsPerSubmitter = 25;
  constexpr std::size_t kPixels = 4096;

  mapboxar::SerialWorkQueue queue("terrain-rgb-async-test");
  std::mutex orderMutex;
  std::vector<Completed> completionOrder;
  std::vector<Completed> submitOrder;
  std::atomic<int> running{0};
  std::atomic<int> maxRunning{0};

  std::vector<std::vector<std::future<std::vector<std::uint8_t>>>> futures(kSubmitters);
  std::vector<std::thread> submitters;
  for (int submitter = 0; submitter < kSubmitters; ++submitter) {
    submitters.emplace_back([&, submitter] {
      for (int sequence = 0; sequence < kCallsPerSubmitter; ++sequence) {
        const int id = submitter * kCallsPerSubmitter + sequence;
        const double modifier = 1.0 + submitter * 0.25;
        auto rgba = tileFor(id, kPixels);
        // Record submit order and enqueue under one lock so the recorded
        // order equals queue order.
        std::lock_guard<std::mutex> lock(orderMutex);
        submitOrder.push_back({submitter, sequence});
        futures[submitter].push_back(decodeAsync(queue, rgba, modifier, [&, submitter, sequence] {
          const int now = running.fetch_add(1) + 1;
          int seen = maxRunning.load();
          while (now > seen && !maxRunning.compare_exchange_weak(seen, now)) {
          }
          {
            std::lock_guard<std::mutex> inner(orderMutex);
            completionOrder.push_back({submitter, sequence});
          }
          running.fetch_sub(1);
        }));
        // Callers may reuse their buffer as soon as the call returns.
        std::memset(rgba.data(), 0, rgba.size());
      }
    });
  }
  for (auto& thread : submitters) thread.join();

  for (int submitter = 0; submitter < kSubmitters; ++submitter) {
    for (int sequence = 0; sequence < kCallsPerSubmitter; ++sequence) {
      const int id = submitter * kCallsPerSubmitter + sequence;
      const double modifier = 1.0 + submitter * 0.25;
      const auto heights = futures[submitter][sequence].get();
      check(heights.size() == kPixels * 4, "result has 4 bytes per input pixel");
      bool allMatch = true;
      for (std::size_t pixel = 0; pixel < kPixels; ++pixel) {
        float value = 0;
        std::memcpy(&value, heights.data() + pixel * 4, sizeof(float));
        if (std::fabs(value - expectedHeight(id, modifier)) > 0.01f) allMatch = false;
      }
      check(allMatch, "each result holds the heights of its own input");
    }
  }

  std::lock_guard<std::mutex> lock(orderMutex);
  check(completionOrder.size() == submitOrder.size(), "every call completed once");
  bool fifo = completionOrder.size() == submitOrder.size();
  for (std::size_t index = 0; fifo && index < submitOrder.size(); ++index) {
    fifo = completionOrder[index].submitter == submitOrder[index].submitter &&
           completionOrder[index].sequence == submitOrder[index].sequence;
  }
  check(fifo, "calls complete in the order they were issued");
  check(maxRunning.load() == 1, "decodes never overlap on the owned queue");
}

void invalidInputRejectsWithoutReachingTheQueue() {
  mapboxar::SerialWorkQueue queue("terrain-rgb-async-invalid");
  std::atomic<int> ran{0};

  auto truncated = decodeAsync(queue, std::vector<std::uint8_t>(7), 1.0, [&] { ran++; });
  try {
    (void)truncated.get();
    check(false, "truncated input rejects");
  } catch (const std::invalid_argument& error) {
    check(std::string(error.what()) == "Terrain-RGB input must contain exactly 4 bytes per pixel",
          "truncated input names the 4-bytes-per-pixel rule");
  }

  auto infinite = decodeAsync(queue, std::vector<std::uint8_t>(8), INFINITY, [&] { ran++; });
  try {
    (void)infinite.get();
    check(false, "non-finite heightModifier rejects");
  } catch (const std::invalid_argument& error) {
    check(std::string(error.what()) == "heightModifier must be finite",
          "non-finite heightModifier names the parameter");
  }
  check(ran.load() == 0, "rejected calls never reach the worker");
}

void syncLimitNamesTheAsyncForm() {
  bool threw = false;
  try {
    mapboxar::terrain::validateSyncTerrainRgbSize(mapboxar::terrain::kMaxSyncTerrainRgbBytes);
  } catch (...) {
    threw = true;
  }
  check(!threw, "exactly 1 MiB (one 512 x 512 tile) is accepted synchronously");

  try {
    mapboxar::terrain::validateSyncTerrainRgbSize(mapboxar::terrain::kMaxSyncTerrainRgbBytes + 4);
    check(false, "input above 1 MiB throws");
  } catch (const std::length_error& error) {
    check(std::string(error.what()).find("decodeTerrainRgbAsync") != std::string::npos,
          "the size error names decodeTerrainRgbAsync");
  }
}

void destructorDrainsSubmittedJobs() {
  std::atomic<int> ran{0};
  {
    mapboxar::SerialWorkQueue queue("terrain-rgb-async-drain");
    for (int index = 0; index < 50; ++index) queue.submit([&] { ran++; });
  }
  check(ran.load() == 50, "destroying the queue runs every submitted job");
}

void tokenIsProcessWideAndReadableFromOtherThreads() {
  mapboxar::setProcessAccessToken("pk.first");
  std::string seen;
  std::thread reader([&] { seen = mapboxar::processAccessToken(); });
  reader.join();
  check(seen == "pk.first", "a token set on one thread is read on another");

  mapboxar::setProcessAccessToken("");
  check(mapboxar::processAccessToken().empty(), "assigning '' clears the token");

  std::vector<std::thread> threads;
  for (int index = 0; index < 8; ++index) {
    threads.emplace_back([index] {
      for (int round = 0; round < 1000; ++round) {
        mapboxar::setProcessAccessToken("pk." + std::to_string(index));
        const auto value = mapboxar::processAccessToken();
        if (value.rfind("pk.", 0) != 0) std::abort();  // torn read
      }
    });
  }
  for (auto& thread : threads) thread.join();
}

}  // namespace

int main() {
  concurrentCallsResolveInOrderWithTheirOwnInput();
  invalidInputRejectsWithoutReachingTheQueue();
  syncLimitNamesTheAsyncForm();
  destructorDrainsSubmittedJobs();
  tokenIsProcessWideAndReadableFromOtherThreads();
  if (failures > 0) {
    std::fprintf(stderr, "%d check(s) failed\n", failures);
    return 1;
  }
  std::puts("terrain-rgb-async: all checks passed");
  return 0;
}
