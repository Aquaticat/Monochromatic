//! Shared foundation for `monochromatic-rust-linter` and its rule packages.
//!
//! This crate holds everything a rule needs and nothing about how rules are
//! discovered, configured from disk, or printed. A rule package depends on this
//! crate alone, so adding a rule never means depending on the CLI.

// What:     Each `pub mod name;` line compiles the matching `name.rs` file into
//           this crate and re-exposes it to outside consumers. `mod` is what
//           makes a file part of the crate at all; `pub` is what makes it
//           reachable from another crate.
// Why:      Split the foundation into small, separately readable files, each
//           under the repo's 300 code-line cap.
//
// In TS you'd write (pseudocode):
// ```ts
// export * from "./config"; export * from "./context"; /* ...and so on */
// ```
/// Runtime settings shared by lint rules.
pub mod config;
/// Per-file parsed context rules read from.
pub mod context;
/// Severity levels and the finding record rules emit.
pub mod diagnostic;
/// Edits a rule proposes, and the trust level each carries.
pub mod fix;
/// The interface every lint rule implements.
pub mod rule;
/// Source positions and the labelled spans a diagnostic points at.
pub mod span;

// What:     `#[cfg(test)] mod name_tests;` is a conditional-compilation
//           attribute: the module is compiled ONLY during `cargo test` and never
//           reaches a release build. The repo keeps unit tests in sibling
//           `*_tests.rs` files rather than inline `mod tests` blocks, and the
//           linter exempts that filename suffix from its own rules.
// Why:      Test code should not enlarge the shipped library.
//
// In TS you'd write (pseudocode):
// ```ts
// // a separate span.test.ts, picked up only by the test runner
// ```
/// Unit tests for the line-to-span lookup.
#[cfg(test)]
mod context_tests;
/// Unit tests for the finding record.
#[cfg(test)]
mod diagnostic_tests;
/// Unit tests for proposed repairs.
#[cfg(test)]
mod fix_tests;
/// Unit tests for spans and labels.
#[cfg(test)]
mod span_tests;
