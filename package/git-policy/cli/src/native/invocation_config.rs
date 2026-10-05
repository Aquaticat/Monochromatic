//! What: Load the policy configuration of the repository one invocation selects.
//! Why: Both wrapped Git commands and `git cli-git check`/`fix` need the same answer:
//!      which worktree do the caller's global options select, and what does its
//!      `cli-git.config.jsonc` say.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const loaded = await loadInvocationConfig(gitPath, globalArgs, overlay);
//! ```

/// Import the sibling modules this lookup combines.
use super::config_error::ConfigError;
use super::config_file::{LoadedConfig, ignored_legacy_notice, load_repository_config};
use super::config_schema::CliGitConfig;
use super::diagnostics::{
    EngineFailureCode, LEGACY_CONFIG_IGNORED_CODE, render_configuration_warning,
    render_engine_failure,
};
use super::worktree_identity::{WorktreeIdentity, resolve_worktree_identity, worktree_root};
/// What: `OsString` is owned operating-system text of raw OS bytes (sibling `String`
///       must be UTF-8).
/// Why:  The caller's global options are replayed to Git unchanged.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // string[] argv, but byte-preserving.
/// ```
use std::ffi::OsString;
/// `Path`/`PathBuf` are borrowed/owned filesystem paths of raw OS bytes.
use std::path::{Path, PathBuf};

/// What: Why configuration could not be loaded for an invocation.
///       `#[derive(...)]` generates cloning, debug printing and `==`.
/// Why:  A rejected configuration is reported as a `config-invalid` event on the
///       caller's event stream; a repository that could not be inspected is a wrapper
///       failure reported in prose. Callers need to tell them apart.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type InvocationConfigError = { kind: 'configuration'; error: ConfigError } | { kind: 'repository'; message: string };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum InvocationConfigError {
    /// The configuration file, or a legacy file needing migration, was rejected.
    Configuration(ConfigError),
    /// Real Git could not be asked, or its answer could not be interpreted.
    Repository(String),
}

/// What: Load the configuration for the worktree the global options select.
///       `&[OsString]` borrows the arguments before the subcommand;
///       `Result<LoadedConfig, InvocationConfigError>` is the settings or the typed failure.
/// Why:  Git itself reports which worktree applies. Outside a worktree (no repository,
///       a bare repository, the inside of `.git`) there is no configuration file and
///       the defaults apply.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function loadInvocationConfig(realGit, globalPrefix, overlay): Promise<LoadedConfig>;
/// ```
pub fn load_invocation_config(
    real_git: &Path,
    global_prefix: &[OsString],
    overlay: &[(OsString, OsString)],
) -> Result<LoadedConfig, InvocationConfigError> {
    // What: `match` on the query `Result`: keep the identity or convert the error.
    //       `Err(...)` is the failure variant returned to the caller.
    // Why:  A query that cannot run or cannot be interpreted must stop the command.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let identity; try { identity = await resolveWorktreeIdentity(...); } catch (e) { throw repositoryError(e); }
    // ```
    let identity: WorktreeIdentity =
        match resolve_worktree_identity(real_git, global_prefix, overlay) {
            Ok(resolved) => resolved,
            Err(error) => return Err(InvocationConfigError::Repository(error.to_string())),
        };
    // `let Some(root) = ... else { ... };` unwraps the worktree top level or exits.
    let Some(root) = worktree_root(&identity) else {
        // `Ok(...)` is the success variant: no worktree means the defaults.
        return Ok(LoadedConfig {
            config: CliGitConfig::defaults(),
            // `None` records that no file was read.
            source: None,
            // `Vec::new()` is the empty owned list.
            ignored_legacy: Vec::<PathBuf>::new(),
        });
    };
    match load_repository_config(root) {
        Ok(loaded) => return Ok(loaded),
        Err(error) => return Err(InvocationConfigError::Configuration(error)),
    }
}

/// What: Render the `config-invalid` event for a rejected configuration.
///       `String` is the owned, line-terminated JSON line.
/// Why:  Configuration failures are machine-readable events with exit status 2, on
///       standard error for wrapped commands and standard output for direct commands.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function configInvalidEvent(error: ConfigError): string;
/// ```
pub fn config_invalid_event(error: &ConfigError) -> String {
    return render_engine_failure(0, EngineFailureCode::ConfigInvalid, error.message.as_str());
}

/// What: Render one warning event per legacy file left beside the JSONC file.
/// Why:  The stale executable configuration is reported on every configuration load,
///       never ignored silently; events are numbered from zero in file order.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function legacyWarningEvents(loaded: LoadedConfig): string;
/// ```
pub fn legacy_warning_events(loaded: &LoadedConfig) -> String {
    // `String::new()` is empty owned text; `mut` allows appending.
    let mut events: String = String::new();
    // `if let Some(source) = &loaded.source` borrows the JSONC path when a file was read.
    if let Some(source) = &loaded.source {
        // `.iter().enumerate()` yields `(index, item)` pairs; `usize` is the index type.
        for (index, legacy) in loaded.ignored_legacy.iter().enumerate() {
            events.push_str(
                render_configuration_warning(
                    // `as u64` widens the index to the event number type.
                    index as u64,
                    LEGACY_CONFIG_IGNORED_CODE,
                    ignored_legacy_notice(legacy.as_path(), source.as_path()).as_str(),
                    // `.to_string_lossy()` renders the path as text, replacing undecodable bytes.
                    legacy.to_string_lossy().as_ref(),
                )
                .as_str(),
            );
        }
    }
    return events;
}

/// Disposable-repository controls stay out of the release executable.
#[cfg(test)]
#[path = "invocation_config_tests.rs"]
mod tests;
