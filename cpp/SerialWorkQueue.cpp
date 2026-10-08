#include "SerialWorkQueue.hpp"

#include <utility>

#if defined(__APPLE__) || defined(__ANDROID__) || defined(__linux__)
#include <pthread.h>
#endif

namespace mapboxar {

SerialWorkQueue::SerialWorkQueue(const char* threadName)
    : threadName_(threadName), worker_([this] { run(); }) {}

SerialWorkQueue::~SerialWorkQueue() {
  {
    std::lock_guard<std::mutex> lock(mutex_);
    stopping_ = true;
  }
  wake_.notify_one();
  worker_.join();
}

void SerialWorkQueue::submit(std::function<void()> job) {
  {
    std::lock_guard<std::mutex> lock(mutex_);
    jobs_.push_back(std::move(job));
  }
  wake_.notify_one();
}

void SerialWorkQueue::run() {
#if defined(__APPLE__)
  pthread_setname_np(threadName_);
#elif defined(__ANDROID__) || defined(__linux__)
  pthread_setname_np(pthread_self(), threadName_);
#endif

  while (true) {
    std::function<void()> job;
    {
      std::unique_lock<std::mutex> lock(mutex_);
      wake_.wait(lock, [this] { return stopping_ || !jobs_.empty(); });
      if (jobs_.empty()) {
        return;  // stopping_ and drained
      }
      job = std::move(jobs_.front());
      jobs_.pop_front();
    }
    // Run outside the lock so a job can submit follow-up work.
    job();
  }
}

}  // namespace mapboxar
