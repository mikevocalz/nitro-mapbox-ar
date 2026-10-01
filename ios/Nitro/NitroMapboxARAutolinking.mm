#import <Foundation/Foundation.h>

#include "HybridMapboxARCore.hpp"

@interface NitroMapboxARAutolinking : NSObject
@end

@implementation NitroMapboxARAutolinking

+ (void)load {
  mapboxar::registerMapboxARCore();
}

@end
