//! What: Internal native cli-git implementation, not yet the production executable.
//! Why: The Rust rewrite preserves Git's own argument, repository and transaction semantics.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Internal modules used by the forthcoming native entry point and consumer verification.
//! ```

/// Lazy configuration loading for known inspection versus mutation/ambiguous commands.
pub mod config_loading;

/// Git 2.56.0 global-argument boundaries over unchanged operating-system strings.
pub mod global_arguments;
