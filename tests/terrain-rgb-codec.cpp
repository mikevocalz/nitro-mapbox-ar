#include "TerrainRgbCodec.hpp"

#include <cassert>
#include <cmath>

namespace {

void expectNear(float actual, float expected, float epsilon = 0.0002f) {
  assert(std::fabs(actual - expected) <= epsilon);
}

}  // namespace

int main() {
  using mapboxar::terrain::decodeTerrainRgb;

  expectNear(decodeTerrainRgb(0, 0, 0), -10000.0f);
  expectNear(decodeTerrainRgb(1, 134, 159), -0.1f);
  expectNear(decodeTerrainRgb(1, 134, 160), 0.0f);
  expectNear(decodeTerrainRgb(1, 134, 161), 0.1f);
  expectNear(decodeTerrainRgb(1, 182, 217), 1234.5f);
  expectNear(decodeTerrainRgb(1, 182, 217, 2.0), 2469.0f);
  expectNear(decodeTerrainRgb(255, 255, 255), 1667721.5f, 0.1f);

  return 0;
}
