//! Servers that mise provides.
//!
//! When the opened folder has a mise configuration at or above it,
//! the tools that configuration
//! lists are where the language servers are looked up (before the application's `PATH`),
//! and their
//! directories are on the `PATH` the confined server gets,
//! so a Node launcher finds its `node`.
//! A folder without one keeps the plain `PATH` lookup.
//!
//! Mise is asked once per registry build,
//! never per server,
//! and only for what it resolves:
//! `config ls --json` (twice:
//! from the folder and from `/`,
//! whose difference is the folder's own
//! configuration,
//! whatever the file names) and `bin-paths`.
//! It runs in the servers' sandbox
//! (`command.rs`),
//! with auto install,
//! lockfile writes and the network switched off,
//! with a time
//! limit,
//! on the language thread.
//! It never runs `mise exec` (which would hand the project's whole
//! `[env]`,
//! decrypted secrets included,
//! to every server) and never `mise trust`.

/// The mise command line,
///  the sandbox,
///  and the time-limited run.
pub mod command;
/// What mise prints,
///  read as text.
pub mod parse;
/// A run that cannot outlast its time limit.
mod run;
/// Program lookup and the `PATH` a server gets.
pub mod search;
/// The outcome of asking mise about a project.
pub mod state;

/// What the lookup and the reader need from the outcome.
pub use state::{Failed, MiseState, Provided};

/// The sandbox the run uses.
use crate::language::confine::BUBBLEWRAP;
/// What:
///  `Path` and `PathBuf` are borrowed and owned filesystem paths;
///  `Duration` and `Instant` are a time span and a clock reading.
/// Why:
///  The resolution has one time limit for all its runs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Path = string;
/// ```
use std::{
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

/// Longest time all mise runs of one resolution may take together.
///  Chosen,
///  not measured:
///  the runs took 25 to 600 ms in the measurements of
///  `doc/troubleshooting/mise-servers-for-the-confined-ide.md`.
pub const TIME_LIMIT: Duration = Duration::from_secs(10);

/// Shortest time between two resolutions of the same project.
///  Chosen,
///  not measured:
///  a failed or incomplete resolution is tried again when a file is displayed,
///  but not at every display.
pub const RETRY_AFTER: Duration = Duration::from_secs(2);

/// What:
///  What the policy needs to know about the project.
/// Why:
///  The sandbox binds the project and the private state like it does for a server.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type MiseRequest = { projectRoot: string; projectSpellings: string[]; stateRoot?: string };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MiseRequest {
    /// Canonical project root.
    pub project_root: PathBuf,
    /// Other spellings of the project root that servers are given.
    pub project_spellings: Vec<PathBuf>,
    /// Private application state directory,
    ///  when the application has one.
    pub state_root: Option<PathBuf>,
}

/// What:
///  The function that resolves a project's mise tools,
///  held by the setup.
/// Why:
///  Like the launch policy,
///  one explicit function decides,
///  and the unconfined setup of tests never runs mise.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type MisePolicy = (request: MiseRequest) => MiseState;
/// ```
pub type MisePolicy = fn(&MiseRequest) -> MiseState;

/// How one run is made,
///  so a test can answer without a mise program.
pub type Runner<'a> =
    dyn Fn(&command::Invocation, Duration) -> Result<command::Completed, command::RunFailure> + 'a;

/// What:
///  The policy of the unconfined setup:
///  mise is never run.
/// Why:
///  Tests and guard controls on disposable projects must not depend on the machine's mise.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const resolveDisabled: MisePolicy = () => ({ kind: 'disabled' });
/// ```
pub fn resolve_disabled(_request: &MiseRequest) -> MiseState {
    return MiseState::Disabled;
}

/// What:
///  The production policy:
///  find mise,
/// run it in the sandbox,
/// and read what it says.
/// Why:
///  A missing mise program is not a failure:
///  the folder is then not a mise project as far as the application can tell.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const resolveConfined: MisePolicy = request => resolveWith(request, findMise(), runConfined);
/// ```
pub fn resolve_confined(request: &MiseRequest) -> MiseState {
    let Some(program) = command::find_mise() else {
        tracing::debug!(
            "no mise program on PATH or in ~/.local/bin; servers are looked up on PATH"
        );
        return MiseState::Unused("no mise program was found".to_string());
    };
    let runner = |invocation: &command::Invocation, limit: Duration| {
        return command::run_confined(&program, invocation, request, limit, BUBBLEWRAP);
    };
    return resolve_with(request, &runner);
}

/// What:
///  A message for a run that did not succeed.
/// Why:
///  An empty standard error still needs words.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function failure(what: string, completed: Completed): Failed
/// ```
fn failure(what: &str, completed: &command::Completed) -> Failed {
    let message = parse::message(&completed.stderr);
    if message.is_empty() {
        return Failed {
            message: format!(
                "`mise {what}` ended with {} and printed no message",
                completed.status
            ),
            untrusted: None,
        };
    }
    let untrusted = parse::untrusted_config(&message).map(str::to_string);
    return Failed { message, untrusted };
}

/// What:
///  Ask mise about a project with `runner`,
///  within `TIME_LIMIT`.
///  `&Runner` is a borrowed function that makes one run.
/// Why:
///  The decision logic is the same for the sandboxed run and a test double:
///  the project's configuration is what the folder lists and `/` does not,
///  and the tool directories come from one `bin-paths`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function resolveWith(request: MiseRequest, runner: Runner): MiseState
/// ```
pub fn resolve_with(request: &MiseRequest, runner: &Runner) -> MiseState {
    let started = Instant::now();
    let run = |arguments: &[&str], directory: &Path| -> Result<command::Completed, MiseState> {
        let invocation = command::Invocation {
            arguments: arguments
                .iter()
                .map(|argument| return argument.to_string())
                .collect(),
            directory: directory.to_path_buf(),
        };
        let remaining = TIME_LIMIT.saturating_sub(started.elapsed());
        let what = arguments.join(" ");
        return match runner(&invocation, remaining) {
            Ok(done) if done.success => Ok(done),
            Ok(done) => {
                let failed = failure(&what, &done);
                tracing::warn!(command = %what, status = %done.status, message = %failed.message, "mise could not serve the project");
                Err(MiseState::Failed(failed))
            }
            Err(command::RunFailure::Refused(reason)) => {
                tracing::warn!(%reason, "mise is not run: the sandbox is not available");
                Err(MiseState::Unused(reason))
            }
            Err(command::RunFailure::Failed(reason)) => {
                tracing::warn!(command = %what, %reason, "mise could not serve the project");
                Err(MiseState::Failed(Failed {
                    message: format!("`mise {what}` {reason}"),
                    untrusted: None,
                }))
            }
        };
    };
    let listing = ["config", "ls", "--json"];
    let from_project = match run(&listing, &request.project_root) {
        Ok(done) => done,
        Err(state) => return state,
    };
    let from_everywhere = match run(&listing, Path::new("/")) {
        Ok(done) => done,
        Err(state) => return state,
    };
    let listed = parse::config_paths(&from_project.stdout)
        .and_then(|project| return Ok((project, parse::config_paths(&from_everywhere.stdout)?)));
    let (project, everywhere) = match listed {
        Ok(both) => both,
        Err(reason) => {
            tracing::warn!(%reason, "mise printed a listing that cannot be read");
            return MiseState::Failed(Failed {
                message: reason,
                untrusted: None,
            });
        }
    };
    let configs = parse::project_configs(&project, &everywhere);
    if configs.is_empty() {
        tracing::debug!(root = %request.project_root.display(), "no mise configuration at or above the project; servers are looked up on PATH");
        return MiseState::Unused("the project has no mise configuration".to_string());
    }
    let paths = match run(&["bin-paths"], &request.project_root) {
        Ok(done) => done,
        Err(state) => return state,
    };
    let directories = parse::directories(&paths.stdout);
    let warnings = parse::merge(&[&from_project.stderr, &from_everywhere.stderr, &paths.stderr]);
    tracing::info!(
        configs = configs.len(),
        directories = directories.len(),
        elapsed_ms = started.elapsed().as_millis(),
        "mise provides tool directories for the project"
    );
    return MiseState::Provided(Provided {
        directories,
        configs,
        warnings,
    });
}

/// What:
///  Whether the state should be resolved again now.
///  `age` is the time since the last resolution;
///  `server_missing` says a server of the language being displayed was not found.
/// Why:
///  A failure may have been fixed (the user trusted the file),
///  and a missing server may have been installed.
///  A project mise does not serve stays as it is until the application restarts.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const due = (state: MiseState, ageMs: number, serverMissing: boolean) => ...
/// ```
pub fn due(state: &MiseState, age: Duration, server_missing: bool) -> bool {
    return match state {
        MiseState::Failed(_) => age >= RETRY_AFTER,
        MiseState::Provided(_) => server_missing && age >= RETRY_AFTER,
        MiseState::Disabled | MiseState::Unused(_) => false,
    };
}

/// Resolution against a double that answers like mise,
///  the notice text,
///  and the retry rule.
#[cfg(test)]
#[path = "mise_tests.rs"]
mod tests;
