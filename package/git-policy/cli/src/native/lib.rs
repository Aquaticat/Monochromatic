//! What: Internal native cli-git implementation, not yet the production executable.
//! Why: The Rust rewrite preserves Git's own argument, repository and transaction semantics.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Internal modules used by the forthcoming native entry point and consumer verification.
//! ```

/// The decision one invocation ends in: become Git, or print and exit.
pub mod action;

/// Variables added to every real-Git child: lock PID injection and the forward-target marker.
pub mod child_environment;

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

/// The `rulesFile` option: a repository-relative name that stays inside the repository.
pub mod config_rules_file;

/// Typed settings and their defaults.
pub mod config_schema;

/// Key-naming typed readers over parsed JSONC values.
mod config_values;

/// JSONL event rendering for wrapper-made diagnostics.
pub mod diagnostics;

/// Worktree target classification for worktree-enforcing policies.
pub mod effective_target;

/// The per-invocation decision the thin executable performs.
pub mod entry;

/// Spellings of the wrapper-only escape hatches shared by several modules.
pub mod escape_hatch;

/// Starting real Git with unchanged arguments, streams and exit status.
pub mod forwarding;

/// Captured read-only real-Git queries over raw bytes.
pub mod git_metadata;

/// Git 2.56.0 global-argument boundaries over unchanged operating-system strings.
pub mod global_arguments;

/// Configuration of the repository one invocation selects.
pub mod invocation_config;

/// The `git cli-git` decision: help, retired commands, and direct `check`/`fix`.
pub mod management;

/// The `git cli-git` argument grammar.
pub mod management_arguments;

/// The fixed registry of shipped policies.
pub mod policy_registry;

/// PATH resolution of the real Git executable.
pub mod real_git;

/// Wrapper self-exclusion for one PATH candidate.
pub mod real_git_candidate;

/// Disposable fixtures shared by unit tests; never part of the release executable.
#[cfg(test)]
mod test_support;

/// Repository and worktree identity as reported by real Git.
pub mod worktree_identity;

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

/// The Git 2.56.0 option table of `git add` and its bulk-staging facts.
pub mod command_add;

/// The Git 2.56.0 option table of `git clean` and its deletion facts.
pub mod command_clean;

/// The Git 2.56.0 option table of `git reset` and its mode.
pub mod command_reset;

/// `git stash` subcommand dispatch and wrapper-flag positions.
pub mod command_stash;

/// The Git 2.56.0 option tables of every `git stash` subcommand.
pub mod command_stash_table;

/// Branch-creation facts of `git branch`, `git checkout` and `git switch`.
pub mod command_branch_create;

/// Which action a tokenized `git branch` region selects.
mod command_branch_mode;

/// The complete Git 2.56.0 option table of `git branch`.
pub mod command_branch_table;

/// Explicit creation and the remote-guess candidate of `git checkout` and `git switch`.
mod command_branch_target;

/// The complete Git 2.56.0 option tables of `git checkout` and `git switch`.
pub mod command_checkout_table;

/// The Git 2.56.0 option groups of `git config`.
pub mod command_config_table;

/// The form and file scope of a `git config` region.
pub mod command_config;

/// Pure decision of the require-root policy.
pub mod rule_require_root;

/// Whether a `git worktree` invocation creates or moves a worktree.
pub mod command_worktree;

/// Wrapper-only control spellings, their meanings, and removal before the subcommand.
pub mod wrapper_controls;

/// Removal of every wrapper control from one invocation, by position.
pub mod wrapper_invocation;

/// Lifecycle triggers and the trigger set of every shipped policy.
pub mod policy_trigger;

/// Policy events and their JSON Lines rendering.
pub mod policy_events;

/// Ordered policy execution for one lifecycle point.
pub mod policy_engine;

/// The bounded loop that repeats a pass after corrections changed candidate content.
pub mod policy_convergence;

/// The one query for repository identity, top level and the path below it.
pub mod repository_location;

/// Lazily fetched repository facts behind one interface, with the real-Git provider.
pub mod repository_facts;

/// Pure decision of the linked-worktree-only policy.
pub mod rule_linked_worktree;

/// Pure decision of the branch-worktree-only policy and its one-query remote guess.
pub mod rule_branch_worktree;

/// Pure decision of the add-explicit policy.
pub mod rule_add_explicit;

/// The shipped policies as checks over rule cores and repository facts.
pub mod policy_checks;

/// What a lifecycle offers content policies, and its candidates once prepared.
pub mod policy_content;

/// The built-in final-newline policy: canonical final LF, preserved paths, findings.
pub mod policy_final_newline;

/// The optional root-context policy: no top-level `CONTEXT.md` enters the index.
pub mod policy_root_context;

/// The optional forbidden-strings policy over the linked scanner, with redacted findings.
pub mod policy_forbidden_strings;

/// The executable's panic hook: where an internal error happened, never its message.
pub mod panic_notice;

/// Installing a direct fix's corrections into the worktree, all or none.
pub mod direct_fix_install;

/// The direct fix: converge corrections in memory, then install them.
pub mod direct_fix;

/// The fixed argument transforms of a forwarded command, in order.
pub mod policy_transforms;

/// One complete pass: built-in policies, fixed transforms, optional policies.
pub mod policy_pass;

/// The names of the commands built into Git 2.56.0.
pub mod git_builtins;

/// The work of the installed cli-git that is not ported, and the refusal notice.
pub mod unported;

/// Durable commit-transaction and worktree-copy state left in a repository.
pub mod pending_state;

/// Which commands need unported work: commits, worktree copies, aliases and leases.
pub mod refusal_frontier;

/// The lifecycle of one wrapped Git command, from refusals to forwarding.
pub mod wrapped_command;

/// A scripted repository-facts provider for unit tests; never in the release build.
#[cfg(test)]
mod policy_test_support;

/// The one failure type of the candidate layer and its closed list of causes.
pub mod candidate_error;

/// Validated Git object names and the file modes a candidate can carry.
pub mod candidate_object;

/// Pure framing of one `git cat-file --batch` reply.
pub mod candidate_batch;

/// Pure parsing of raw NUL-delimited changed-path records.
pub mod candidate_record;

/// The long-lived object reader that answers every blob read of an invocation.
pub mod candidate_reader;

/// Immutable candidate versions: identity, pathname, mode, change and object per path.
pub mod candidate_version;

/// Per-invocation listing, lazy bytes and invalidation of candidate versions.
pub mod candidate_store;

/// Pure parsing of `git ls-files --stage` records and the delta between two index states.
pub mod candidate_stage;

/// A private, timestamp-preserving copy of the real index, removed when dropped.
pub mod candidate_private_index;

/// What `git add` would stage, and the worktree files a direct command selects.
pub mod candidate_prediction;

/// The linked forbidden-strings scanner: one load per invocation, typed redacted findings.
pub mod scanner_adapter;

/// Rules-file precedence and which candidates the scanner is given.
pub mod scanner_selection;

/// One scan pass over a candidate version's exact bytes.
pub mod scanner_run;

/// Which engine failure code each candidate and scanner failure carries.
pub mod scanner_failure_code;

/// Process isolation and rule fixtures for scanner controls; never in the release build.
#[cfg(test)]
mod scanner_test_support;

/// Private, crash-safe file primitives shared by every durable record.
pub mod private_storage;

/// Compact JSON records read and written with the incumbent's `JSON` semantics.
pub mod json_record;

/// Random identifiers in the layout of the incumbent's `randomUUID`.
pub mod random_id;

/// Text operations with the exact semantics of JavaScript's built-ins.
pub mod js_text;

/// Process-birth identities in the incumbent's exact spelling.
pub mod process_identity;

/// The owner record inside every owner-lock directory.
pub mod owner_lock_record;

/// Rename-published owner locks with dead-owner retirement and an unbounded wait.
pub mod owner_lock;

/// Line-oriented debug and warning diagnostics on standard error.
pub mod diagnostic_log;

/// The fail-closed failure of reading or recovering durable transaction state.
pub mod recovery_error;

/// The owner record of one commit-transaction directory and its liveness rule.
pub mod transaction_owner;

/// The per-worktree registry of commit-transaction directories.
pub mod transaction_registry;

/// The schema-version-2 journal records of one commit transaction and their filenames.
pub mod transaction_journal;

/// The exact encoding of every journal record.
pub mod transaction_journal_encode;

/// Strict parsers of every journal record.
pub mod transaction_journal_parse;
