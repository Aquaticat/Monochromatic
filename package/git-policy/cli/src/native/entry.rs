//! What: Decide what one `git` invocation of the native wrapper does.
//! Why: The executable stays thin: it gathers process facts, asks this module for an
//!      action, and performs it. The decision itself is testable without replacing
//!      the test process.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const action = planInvocation(args, env, inputs); perform(action);
//! ```

/// Import the sibling modules the decision combines.
use super::child_environment::{
    FORWARD_TARGET_VARIABLE, child_environment_overlay, environment_value,
};
use super::config_file::{LoadedConfig, ignored_legacy_notice, load_repository_config};
use super::config_loading::{ConfigLoading, classify_config_loading};
use super::forwarding::replace_process_with_real_git;
use super::global_arguments::{GlobalLayout, GlobalOutcome, global_layout};
use super::real_git::{ResolutionInputs, process_resolution_inputs, resolve_real_git};
use super::real_git_candidate::same_file;
use super::worktree_identity::{WorktreeIdentity, resolve_worktree_identity, worktree_root};
/// What: `OsString` is owned operating-system text of raw OS bytes (sibling `String`
///       must be UTF-8).
/// Why:  Arguments and environment values are never decoded.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // process.argv and process.env, but byte-preserving.
/// ```
use std::ffi::OsString;
/// The trait that gives output streams `.write_all(..)`.
use std::io::Write;
/// `Path`/`PathBuf` are borrowed/owned filesystem paths of raw OS bytes.
use std::path::{Path, PathBuf};

/// What: Exit code for a wrapper failure that kept Git from running.
///       `i32` is a signed 32-bit integer, the type of process exit codes.
/// Why:  The wrapper's contract reserves 2 for usage, configuration and engine
///       failures, distinct from 1 for policy findings.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const ENGINE_FAILURE_EXIT_CODE = 2;
/// ```
pub const ENGINE_FAILURE_EXIT_CODE: i32 = 2;

/// What: What the executable must do for one invocation.
///       `Vec<(OsString, OsString)>` is an owned list of name/value pairs.
/// Why:  Forwarding replaces the process and cannot be exercised inside a unit test;
///       returning the decision as data lets tests check it directly.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Action = { kind: 'forward'; realGit: string; overlay: [string, string][] }
///   | { kind: 'exit'; code: number; stderr: string };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Action {
    /// Become real Git with the caller's unchanged arguments.
    Forward {
        /// The selected real Git executable.
        real_git: PathBuf,
        /// Variables added to the inherited environment.
        overlay: Vec<(OsString, OsString)>,
    },
    /// Stop without running the caller's command.
    Exit {
        /// Process exit code.
        code: i32,
        /// Complete text for standard error, already line-terminated.
        stderr: String,
    },
}

/// What: Build the stop action for a wrapper failure.
/// Why:  Every failure path prints one line-terminated diagnostic and exits 2.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function failure(message: string): Action;
/// ```
fn failure(message: &str) -> Action {
    return Action::Exit {
        code: ENGINE_FAILURE_EXIT_CODE,
        // `format!` builds the owned, line-terminated text.
        stderr: format!("cli-git: {message}\n"),
    };
}

/// What: Explain that another cli-git wrapper selected this executable as real Git.
/// Why:  Forwarding again would bounce between the two wrappers forever; stopping
///       names both executables so the user can fix PATH.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function forwardedToSelf(ownExecutable: string): Action;
/// ```
fn forwarded_to_self(own_executable: &Path) -> Action {
    return failure(
        format!(
            "another cli-git wrapper selected this cli-git executable ({}) as real Git. \
             Forwarding again would never reach Git. Remove the extra cli-git from PATH or \
             place the real Git executable on PATH.",
            own_executable.display()
        )
        .as_str(),
    );
}

/// What: Load the policy configuration of the repository an invocation selects.
///       `Result<LoadedConfig, Action>` is the settings, or the stop action to perform.
/// Why:  Git itself reports which worktree the caller's global options select;
///       outside a worktree there is no configuration file and defaults apply.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function loadInvocationConfig(realGit, globalPrefix, overlay): LoadedConfig;
/// ```
pub fn load_invocation_config(
    real_git: &Path,
    global_prefix: &[OsString],
    overlay: &[(OsString, OsString)],
) -> Result<LoadedConfig, Action> {
    // What: `match` on the query `Result`: keep the identity or convert the error.
    // Why:  A query that cannot run or cannot be interpreted must stop the command.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let identity; try { identity = resolveWorktreeIdentity(...); } catch (e) { return failure(String(e)); }
    // ```
    let identity: WorktreeIdentity =
        match resolve_worktree_identity(real_git, global_prefix, overlay) {
            Ok(resolved) => resolved,
            // `Err(...)` is the failure variant carrying the stop action.
            Err(error) => return Err(failure(error.to_string().as_str())),
        };
    // `let Some(root) = ... else { ... };` unwraps the worktree top level or exits.
    let Some(root) = worktree_root(&identity) else {
        // `Ok(...)` is the success variant: no worktree means built-in defaults.
        return Ok(LoadedConfig {
            config: super::config_schema::CliGitConfig::unconfigured(),
            source: None,
            ignored_legacy: Vec::<PathBuf>::new(),
        });
    };
    match load_repository_config(root) {
        Ok(loaded) => return Ok(loaded),
        Err(error) => return Err(failure(error.message.as_str())),
    }
}

/// What: Decide the action for one invocation from injected process facts.
///       `&[OsString]` borrows the arguments after the program name.
/// Why:  Order matters. The recursion check runs before anything else. Commands that
///       need no policy configuration are forwarded without reading it. Every other
///       command validates configuration and then stops, because policy execution
///       is not implemented yet and forwarding it unguarded would silently drop
///       enforcement.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function planInvocation(args: string[], environment: [string, string][], inputs: ResolutionInputs): Action;
/// ```
pub fn plan_invocation(
    arguments: &[OsString],
    environment: &[(OsString, OsString)],
    inputs: &ResolutionInputs,
) -> Action {
    // `if let Some(target) = ... && cond` runs only when a forwarding wrapper left its
    // marker and that marker names this executable.
    if let Some(target) = environment_value(environment, FORWARD_TARGET_VARIABLE)
        && same_file(Path::new(&target), inputs.own_executable.as_path())
    {
        return forwarded_to_self(inputs.own_executable.as_path());
    }
    let real_git: PathBuf = match resolve_real_git(inputs) {
        Ok(found) => found,
        Err(error) => return failure(error.to_string().as_str()),
    };
    let overlay: Vec<(OsString, OsString)> =
        child_environment_overlay(environment, real_git.as_path());
    let layout: GlobalLayout = global_layout(arguments);
    // Without a subcommand Git only prints its usage; there is nothing for policy to guard.
    if layout.outcome == GlobalOutcome::NoCommand
        || classify_config_loading(arguments) == ConfigLoading::Skip
    {
        return Action::Forward { real_git, overlay };
    }
    // `&arguments[..n]` borrows the first `n` arguments: the caller's global options.
    let loaded: LoadedConfig = match load_invocation_config(
        real_git.as_path(),
        &arguments[..layout.prefix_len],
        overlay.as_slice(),
    ) {
        Ok(config) => config,
        Err(action) => return action,
    };
    // `String::new()` is empty owned text; `mut` allows appending.
    let mut stderr: String = String::new();
    if let Some(source) = &loaded.source {
        for legacy in &loaded.ignored_legacy {
            stderr.push_str(
                format!(
                    "cli-git: {}\n",
                    ignored_legacy_notice(legacy.as_path(), source.as_path())
                )
                .as_str(),
            );
        }
    }
    stderr.push_str(
        format!(
            "cli-git: policy execution is not implemented in this native development \
             executable, so git {} was not run. Repository-changing commands still require \
             the installed cli-git.\n",
            arguments[layout.prefix_len].to_string_lossy()
        )
        .as_str(),
    );
    return Action::Exit {
        code: ENGINE_FAILURE_EXIT_CODE,
        stderr,
    };
}

/// What: Run one invocation with the real process facts and return its exit code.
///       Returns only when Git was not started; a forwarded command never returns.
/// Why:  This is everything the executable's `main` does; keeping it in the library
///       lets the same code be measured by tests and mutation runs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function runProcess(args: string[], environment: [string, string][]): number;
/// ```
pub fn run_process(arguments: &[OsString], environment: &[(OsString, OsString)]) -> i32 {
    let action: Action = match process_resolution_inputs(environment) {
        Ok(inputs) => plan_invocation(arguments, environment, &inputs),
        Err(error) => failure(
            format!(
                "cannot determine this executable or the current directory, so real Git \
                 cannot be selected safely: {error}"
            )
            .as_str(),
        ),
    };
    // `match` picks by variant and binds the fields each one carries.
    match action {
        Action::Forward { real_git, overlay } => {
            let error: std::io::Error =
                replace_process_with_real_git(real_git.as_path(), arguments, overlay.as_slice());
            write_stderr(
                format!("cli-git: cannot start {}: {error}\n", real_git.display()).as_str(),
            );
            return ENGINE_FAILURE_EXIT_CODE;
        }
        Action::Exit { code, stderr } => {
            write_stderr(stderr.as_str());
            return code;
        }
    }
}

/// What: Write text to standard error, ignoring a closed stream.
/// Why:  The exit code already carries the result; a reader that went away must not
///       turn a diagnostic into a panic.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function writeStderr(text: string): void { try { process.stderr.write(text); } catch {} }
/// ```
fn write_stderr(text: &str) {
    // What: `let _ = ...` deliberately discards the write's `Result`.
    // Why:  There is nowhere left to report a failure to write a diagnostic.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { process.stderr.write(text); } catch { /* reader closed */ }
    // ```
    let _ = std::io::stderr().write_all(text.as_bytes());
}

/// Decision controls stay out of the release executable.
#[cfg(test)]
#[path = "entry_tests.rs"]
mod tests;
