#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Read-only view of `MapboxAR.accessToken` for Swift and Objective-C code in
/// other pods (the maps and navigation packages). Swift: `MapboxARAccessToken.current`.
///
/// The value is process-wide and may change at any time from JS; read it at
/// the point of use instead of caching it.
@interface MapboxARAccessToken : NSObject

/// The current token, or an empty string when none is set.
@property (class, nonatomic, readonly, copy) NSString *current;

- (instancetype)init NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END
