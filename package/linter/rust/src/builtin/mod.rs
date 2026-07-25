//! Re-exports the rules this binary composes, from their own package.
//!
//! The rule sources used to live here. They moved to
//! `package/rust-linter-plugin/builtin`, which depends on the core crate and on
//! nothing else from the linter, so a rule package can be written without
//! depending on the binary that runs it. Their imports did not change when they
//! moved, because that package re-exports core's modules under the same paths.

// What:     `pub use dependency::module;` re-exports a MODULE from a dependency
//           under this crate's own root.
// Why:      `crate::builtin::pattern_rule::PatternRule` keeps resolving for the
//           run loop, which is the only consumer left here.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as patternRule from "@monochromatic-dev/rust-linter-plugin-builtin/pattern-rule";
// ```
/// Re-exports the declarative pattern rule driver.
pub use monochromatic_rust_linter_plugin_builtin::pattern_rule;

/// Re-exports the max-lines rule.
pub use monochromatic_rust_linter_plugin_builtin::max_lines;

/// Re-exports the require-rustdoc rule.
pub use monochromatic_rust_linter_plugin_builtin::require_rustdoc;
