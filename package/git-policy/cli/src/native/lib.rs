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

/// Differential harness over `git rev-parse --parseopt`; never in the release build.
#[cfg(test)]
mod command_test_parseopt;

/// Table oracle over `--git-completion-helper-all`; never in the release build.
#[cfg(test)]
mod command_test_completion;

/// Facts about the arguments after `git commit`.
pub mod command_commit;

/// The complete Git 2.56.0 option table of `git commit`.
pub mod command_commit_table;

/// The shared result and builder of transforms that add tokens to a command line.
pub mod rule_argument_rewrite;

/// Pure core of the index-against-`HEAD` check.
pub mod rule_commit_index;

/// Pure decision of the commit-only transform.
pub mod rule_commit_only;

/// User-facing diagnostics of the commit-only transform.
pub mod rule_commit_only_message;

/// Pure core of the merge, cherry-pick and revert conclusion check.
pub mod rule_commit_sequencer;

/// The Git 2.56.0 option table of `git push` and its facts.
pub mod command_push;

/// The Git 2.56.0 option table of `git status`, its facts and the advice-key reading.
pub mod command_status;

/// Pure decision of the atomic-push transform.
pub mod rule_atomic_push;

/// Pure decision of the status-hints transform.
pub mod rule_status_hints;
