#pragma once

#include <condition_variable>
#include <deque>
#include <functional>
#include <mutex>
#include <thread>

namespace mapboxar {

// One owned worker thread that runs jobs in submission order.
//
// `HybridMapboxAR` owns one per instance for `decodeTerrainRgbAsync`, so
// decodes never share Nitro's global thread pool and complete in the order
// JS issued them. The destructor runs every job already submitted, then
// joins, so no submitted job is dropped and no pending promise is leaked.
class SerialWorkQueue final {
 public:
  explicit SerialWorkQueue(const char* threadName);
  ~SerialWorkQueue();

  SerialWorkQueue(const SerialWorkQueue&) = delete;
  SerialWorkQueue& operator=(const SerialWorkQueue&) = delete;

  // Enqueues `job`. Jobs must not throw; report failures through their own
  // completion (a promise) instead.
  void submit(std::function<void()> job);

 private:
  void run();

  std::mutex mutex_;
  std::condition_variable wake_;
  std::deque<std::function<void()>> jobs_;
  bool stopping_ = false;
  const char* threadName_;
  std::thread worker_;
};

}  // namespace mapboxar
