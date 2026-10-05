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

/// Git 2.56.0 `parse-options` tokenization of one command's argument region.
pub mod command_options;

/// Long-option matching: exact names, unique abbreviations and `no-` negation.
mod command_options_long;

/// Final-state and position questions over a tokenized region.
pub mod command_options_query;

/// Short-option clusters and their attached or following values.
mod command_options_short;

/// The shared decision of which bytes are an option's value.
mod command_options_value;

/// Real-Git fixtures and table oracles for command tests; never in the release build.
#[cfg(test)]
mod command_test_support;
