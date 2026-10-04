//! What: Internal implementation library for the native unified linter.
//! Why: The executable and its verification drivers must exercise the same implementation.
//! This is not a supported public linter API.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Internal implementation entry imported by the executable and tests.
//! ```

/// What: The configuration-value merge module, visible to artifact and fuzz consumers.
/// Why: Verification must exercise the exact implementation rather than a copied model.
/// Its visibility is internal integration plumbing, not a stable user-facing library contract.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as configMerge from './config-merge';
/// ```
#[doc(hidden)]
pub mod config_merge;

/// Internal data-shape checks, including duplicate decoded keys.
mod config_data;
/// Internal typed configuration errors shared by the executable and verification drivers.
#[doc(hidden)]
pub mod config_error;
/// Internal nearest-file and explicit configuration discovery.
#[doc(hidden)]
pub mod config_lookup;
/// Internal compiled file-pattern matching and effective rule settings.
#[doc(hidden)]
pub mod config_match;
/// Internal ordered JSONC configuration parser.
#[doc(hidden)]
pub mod configuration;
/// Internal fixed-registry rule-option validation.
mod configuration_rules;
/// Internal typed JSONL findings shared by rule execution and processor mapping.
#[doc(hidden)]
pub mod diagnostic;
/// Internal all-or-nothing grouped source edits.
#[doc(hidden)]
pub mod edits;
/// Internal code-fence normalization.
#[doc(hidden)]
pub mod markdown_code;
/// Shared Markdown diagnostic construction.
mod markdown_finding;
/// Internal report-only heading checks.
#[doc(hidden)]
pub mod markdown_headings;
/// Internal link normalization checks.
#[doc(hidden)]
pub mod markdown_links;
/// Owned Markdown line and UTF-16 position indexes.
mod markdown_positions;
/// Internal native Markdown/MDX parser interface.
#[doc(hidden)]
pub mod markdown_source;
/// Internal finalization of matched partial rule settings.
mod resolved_rules;
/// Typed Rust rule selection from validated merged JSONC.
#[doc(hidden)]
pub mod rust_rule_settings;
/// Syntax-only Rust execution without initializing a Cargo workspace.
#[doc(hidden)]
pub mod rust_dispatch;
/// Declaration-site checks used by the full semantic explicit-types rule.
#[doc(hidden)]
pub mod rust_explicit_declarations;
/// Generic argument checking by actual declaration identity.
mod rust_explicit_generics;
/// Written inference-hole validation against resolved types.
mod rust_explicit_inference;
/// Full explicit-type policy over a registered semantic parse.
#[doc(hidden)]
pub mod rust_explicit_types;
/// Generic parameter ownership and argument-spelling helpers.
mod rust_generic_arguments;
/// Semantic disambiguation of type-shaped generic constant placeholders.
mod rust_inferred_constants;
/// Internal syntax-only rejection of anonymous Rust functions.
#[doc(hidden)]
pub mod rust_no_anonymous_functions;
/// Internal fixed Rust rule implementations.
#[doc(hidden)]
pub mod rust_rules;
/// Typed semantic workspace and query failures.
#[doc(hidden)]
pub mod rust_semantic_error;
/// Production session for selected-file analysis and exact source overlays.
#[doc(hidden)]
pub mod rust_semantic_session;
/// Internal shared Rust parse and code-line indexing.
#[doc(hidden)]
pub mod rust_source;
/// Read-only compiler and installed rust-src discovery.
#[doc(hidden)]
pub mod rust_toolchain;
/// Internal source-anchored explicit-type findings and semantic coverage errors.
mod rust_type_diagnostic;
/// Fixed Cargo workspace preparation and generated-input error handling.
#[doc(hidden)]
pub mod rust_workspace;

/// Disposable native filesystem helpers used only by tests.
#[cfg(test)]
mod test_fs;

/// Full semantic annotation controls, including source-overlay cache changes.
#[cfg(test)]
mod rust_explicit_types_tests;
/// Disposable Cargo-backed contexts for the semantic rule's conformance suite.
#[cfg(test)]
mod rust_semantic_test_support;

/// Production Cargo discovery, generated-source and failure boundary controls.
#[cfg(test)]
mod rust_workspace_tests;

/// Shared consumer-level regressions for the initial Markdown rule ports.
#[cfg(test)]
mod markdown_basic_tests;
