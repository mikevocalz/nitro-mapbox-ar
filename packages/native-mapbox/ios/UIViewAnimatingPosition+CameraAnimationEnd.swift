#if os(iOS)
import NitroModules
import UIKit

extension CameraAnimationEnd {
  /// `.end` means the camera reached its target; any other position means a
  /// gesture or another camera command stopped the animation first.
  ///
  /// SDK: `typealias AnimationCompletion = (UIViewAnimatingPosition) -> Void`
  /// (`Camera/AnimationCompletion.swift:4`).
  init(_ position: UIViewAnimatingPosition) {
    self = position == .end ? .finished : .interrupted
  }
}
#endif
