#import "MapboxARAccessToken.h"

#include "AccessTokenStore.hpp"

#include <string>

@implementation MapboxARAccessToken

+ (NSString *)current {
  const std::string token = mapboxar::processAccessToken();
  NSString *value = [[NSString alloc] initWithBytes:token.data()
                                             length:token.size()
                                           encoding:NSUTF8StringEncoding];
  return value ?: @"";
}

@end
