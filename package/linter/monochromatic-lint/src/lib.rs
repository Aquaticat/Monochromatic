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
