//! The rules `monochromatic-rust-linter` ships with.
//!
//! This package depends on `monochromatic-rust-linter-core` and on the pattern
//! matcher, and on nothing else from the linter. That is the whole point of the
//! split: a rule package is written against the `Rule` trait alone, so anyone
//! can write one without depending on the binary that runs it.

/// The per-file code-line budget.
pub mod max_lines;
/// The rule that runs declarative pattern rules from configuration.
pub mod pattern_rule;
/// The rustdoc-on-every-item requirement.
pub mod require_rustdoc;

/// Unit tests for the max-lines rule.
#[cfg(test)]
mod max_lines_tests;
/// Unit tests for the require-rustdoc rule.
#[cfg(test)]
mod require_rustdoc_tests;

// What:     `pub const PLUGIN: &str = "builtin";`. The plugin name the two
//           compiled-in rules report under.
// Why:      A finding's code is `plugin(rule)`, so this is the first half of
//           `builtin(max-lines)`. Naming it once means the `plugins` config key
//           and the rules themselves cannot disagree about it.
/// Plugin name the rules in this package report under.
pub const PLUGIN: &str = "builtin";

// What:     Six `pub use` lines re-exporting core's modules under this crate's
//           own paths.
// Why:      The rule sources moved here from the CLI crate, where they reached
//           these as `crate::config`, `crate::context` and so on. Re-exporting
//           under the same names means the move changed no rule's imports, which
//           is what makes "it loads unchanged" a checkable claim rather than a
//           hopeful one.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as config from "@monochromatic-dev/rust-linter-core/config";
// ```
/// Re-exports the shared configuration, context and diagnostic modules.
pub use monochromatic_rust_linter_core::{
    config, context, diagnostic, directive, fix, format, rule, severity, span, toml,
};

/// Imports the rule trait objects the registry hands back.
use monochromatic_rust_linter_core::rule::Rule;

// What:     `pub fn rules() -> Vec<Box<dyn Rule>>`. This package's own registry.
// Why:      A rule package answers for its own rules rather than the binary
//           enumerating them, so adding a rule here needs no change in the CLI.
//
// In TS you'd write (pseudocode):
// ```ts
// export function rules(): Rule[] { return [new MaxLines(), new RequireRustdoc()]; }
// ```
/// Build the rules this package provides.
pub fn rules() -> Vec<Box<dyn Rule>> {
    return vec![
        Box::new(crate::max_lines::MaxLines) as Box<dyn Rule>,
        Box::new(crate::require_rustdoc::RequireRustdoc),
    ];
}
