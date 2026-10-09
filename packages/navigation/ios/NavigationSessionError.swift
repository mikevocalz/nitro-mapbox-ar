import Foundation

/// A failure surfaced to JS as a rejected promise or through
/// `addOnErrorListener`. `message` becomes the JS `Error.message`.
struct NavigationSessionError: LocalizedError {
  let message: String

  var errorDescription: String? { message }
}
