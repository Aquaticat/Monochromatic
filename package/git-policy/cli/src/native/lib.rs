//! What: Internal native cli-git implementation, not yet the production executable.
//! Why: The Rust rewrite preserves Git's own argument, repository and transaction semantics.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Internal modules used by the forthcoming native entry point and consumer verification.
//! ```

/// The one failure type for rejected configuration content or files.
pub mod config_error;

/// Repository-root discovery and bounded reading of `cli-git.config.jsonc`.
pub mod config_file;

/// Lazy configuration loading for known inspection versus mutation/ambiguous commands.
pub mod config_loading;

/// Whole-document JSONC validation into typed settings.
pub mod config_parse;

/// Validation of the `policies` section and per-policy options.
mod config_policies;

/// Typed settings and their defaults.
pub mod config_schema;

/// Key-naming typed readers over parsed JSONC values.
mod config_values;

/// Git 2.56.0 global-argument boundaries over unchanged operating-system strings.
pub mod global_arguments;

/// The fixed registry of shipped policies.
pub mod policy_registry;
