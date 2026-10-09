#pragma once

#include <string>

namespace mapboxar {

// Process-wide Mapbox access token behind `MapboxAR.accessToken`.
//
// Written from any JS runtime thread through the HybridObject, read from the
// platform UI thread by the maps and navigation packages through
// `MapboxARAccessToken` (ios/Nitro, android/src/main/java). Those are two
// threads with no common owner, so the value sits behind a mutex. Neither
// function calls out while holding it.
void setProcessAccessToken(std::string token);
std::string processAccessToken();

}  // namespace mapboxar
