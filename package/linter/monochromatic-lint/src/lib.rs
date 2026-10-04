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
/// Internal ordered JSONC configuration parser.
#[doc(hidden)]
pub mod configuration;
/// Internal fixed-registry rule-option validation.
mod configuration_rules;
