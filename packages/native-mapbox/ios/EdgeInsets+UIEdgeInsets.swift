#if os(iOS)
import NitroModules
import UIKit

extension EdgeInsets {
  /// Builds the Nitro value from UIKit insets.
  init(_ insets: UIEdgeInsets) {
    self.init(
      top: Double(insets.top),
      left: Double(insets.left),
      bottom: Double(insets.bottom),
      right: Double(insets.right)
    )
  }

  /// Returns UIKit insets after checking every side is finite and not negative.
  func validated(_ field: String) throws -> UIEdgeInsets {
    for side in [top, left, bottom, right] where !side.isFinite || side < 0 {
      throw RuntimeError.error(withMessage: "\(field) sides must be finite and >= 0, got \(side)")
    }
    return UIEdgeInsets(top: top, left: left, bottom: bottom, right: right)
  }
}
#endif
