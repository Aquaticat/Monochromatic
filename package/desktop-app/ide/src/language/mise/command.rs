//! Running mise:
//!  the command line that confines it like a server,
//!  and a run that cannot outlast its time limit.
//!
//! Mise evaluates a trusted project's `[env]` templates on every command,
//!  including `config ls`,
//!  and those templates run shell commands.
//!  So mise never runs on the bare host:
//!  it runs in the sandbox the servers get,
//!  without network,
//!  with the whole file system and the project read-only,
//!  and with a cleared environment.

/// A bounded run, and what it gives back.
pub use super::run::{Completed, run_bounded};
/// The same sandbox recipe,
///  probe,
///  and private state as a server's.
use crate::language::{
    confine::confine_with,
    launch::{LaunchRequest, is_executable, prepare},
};
/// What:
///  `Command` describes a child process;
///  `Stdio` says where its streams go.
/// Why:
///  Mise is started with no input and with both output streams captured.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { spawn } from 'node:child_process';
/// ```
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    process::Command,
    time::Duration,
};

/// Variables that stop mise from changing anything or reaching out,
///  set after the application's environment was cleared.
///  Verified names of mise's settings (`mise settings`):
///  `auto_install`,
///  `exec_auto_install`,
///  `not_found_auto_install`,
///  `task.run_auto_install`,
///  `lockfile`,
///  `offline`,
///  `yes`.
///  A project's own `[settings]` cannot override them: an environment variable wins over a
///  configuration file (measured with `mise settings get`).
pub const SAFE_ENVIRONMENT: &[(&str, &str)] = &[
    ("MISE_AUTO_INSTALL", "false"),
    ("MISE_EXEC_AUTO_INSTALL", "false"),
    ("MISE_NOT_FOUND_AUTO_INSTALL", "false"),
    ("MISE_TASK_RUN_AUTO_INSTALL", "false"),
    ("MISE_LOCKFILE", "false"),
    ("MISE_OFFLINE", "true"),
    ("MISE_YES", "false"),
    ("MISE_COLOR", "0"),
    ("MISE_DISABLE_UPDATE_WARNING", "true"),
    ("NO_COLOR", "1"),
];

/// Variables that tell mise where its own directories are,
///  passed on when the application has them.
///  They name places,
///  never credentials;
///  every other variable of the application is cleared.
pub const LOCATION_VARIABLES: &[&str] = &[
    "MISE_DATA_DIR",
    "MISE_CONFIG_DIR",
    "MISE_STATE_DIR",
    "MISE_GLOBAL_CONFIG_FILE",
    "MISE_SYSTEM_CONFIG_DIR",
    "MISE_SYSTEM_DATA_DIR",
    "MISE_CEILING_PATHS",
    "MISE_ENV",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "XDG_STATE_HOME",
];

/// What:
///  One mise command:
///  its arguments and the directory it runs in.
/// Why:
///  The project is never named in the arguments.
///  A directory name that starts with a dash would be read as an option,
///  so mise learns the directory only as its working directory.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Invocation = { arguments: string[]; directory: string };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Invocation {
    /// Arguments after the program name.
    pub arguments: Vec<String>,
    /// Working directory of the run.
    pub directory: PathBuf,
}

/// Why a run did not produce a result.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type RunFailure = { kind: 'refused'; reason: string } | { kind: 'failed'; reason: string };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RunFailure {
    /// The sandbox cannot be set up,
    ///  so mise is not run;
    ///  every server is refused for the same reason.
    Refused(
        /// What the confinement reported.
        String,
    ),
    /// Mise could not be started,
    ///  or did not finish in time.
    Failed(
        /// What was observed.
        String,
    ),
}

/// What:
///  Find the mise program:
///  `mise` in the application's `PATH`,
///  else `~/.local/bin/mise`,
///  the place mise's installer uses.
///  Only an absolute `PATH` entry counts.
/// Why:
///  The desktop launcher's `PATH` is a snapshot of the login session and may miss either place,
///  and no path of any repository is assumed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function findMise(): string | undefined
/// ```
pub fn find_mise() -> Option<PathBuf> {
    let home = std::env::var_os("HOME").map(PathBuf::from);
    return find_mise_in(std::env::var_os("PATH").as_deref(), home.as_deref());
}

/// What:
///  `find_mise` with the application's `PATH` and home directory given.
///  `Option<&OsStr>` is a `PATH` value that may be unset.
/// Why:
///  A test passes its own, so the answer does not depend on the machine.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function findMiseIn(path: string | undefined, home: string | undefined): string | undefined
/// ```
pub fn find_mise_in(path: Option<&std::ffi::OsStr>, home: Option<&Path>) -> Option<PathBuf> {
    for directory in path.map(std::env::split_paths).into_iter().flatten() {
        // A relative entry would depend on the working directory; only absolute ones are trusted.
        let candidate = directory.join("mise");
        if directory.is_absolute() && is_executable(&candidate) {
            return Some(candidate);
        }
    }
    let installed = home
        .filter(|found| return found.is_absolute())?
        .join(".local/bin/mise");
    return is_executable(&installed).then_some(installed);
}

/// What:
///  The sandbox request for one mise command.
///  `locations` holds the mise location variables the application has,
///  as `(name, value)` pairs.
/// Why:
///  The request carries only what mise needs:
///  its program,
///  the safety variables,
///  its own directories,
///  and the project to read.
///  Directories the sandbox replaced with its own (below `/tmp`,
///  `/run`,
///  `/dev`) are bound again read-only,
///  so a mise installed there still works.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function request(program: string, invocation: Invocation, project: ProjectView, locations: [string, string][]): LaunchRequest
/// ```
pub fn launch_request(
    program: &Path,
    invocation: &Invocation,
    project: &super::MiseRequest,
    locations: &[(String, String)],
) -> LaunchRequest {
    let mut environment: HashMap<String, String> = HashMap::new();
    let mut read_only_binds: Vec<PathBuf> = Vec::new();
    for (name, value) in SAFE_ENVIRONMENT {
        environment.insert(name.to_string(), value.to_string());
    }
    for (name, value) in locations {
        environment.insert(name.clone(), value.clone());
        for part in std::env::split_paths(value) {
            if part.is_absolute() && part.exists() {
                read_only_binds.push(part);
            }
        }
    }
    return LaunchRequest {
        server: "mise".to_string(),
        executable: program.to_path_buf(),
        args: invocation.arguments.clone(),
        environment,
        settings: None,
        project_root: project.project_root.clone(),
        project_spellings: project.project_spellings.clone(),
        read_only_binds,
        state_root: project.state_root.clone(),
    };
}

/// What:
///  The mise location variables of this process.
/// Why:
///  Read once per resolution,
///  so a test can pass its own pairs to `launch_request`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const locations = () => LOCATION_VARIABLES.flatMap(name => (env[name] ? [[name, env[name]]] : []));
/// ```
pub fn locations_from_environment() -> Vec<(String, String)> {
    let mut found = Vec::new();
    for name in LOCATION_VARIABLES {
        if let Ok(value) = std::env::var(name) {
            found.push((name.to_string(), value));
        }
    }
    return found;
}

/// What:
///  Run a mise command in the servers' sandbox,
///  with the program found on the host.
///  `bubblewrap` is the bubblewrap program.
/// Why:
///  The confinement is the one function every server goes through,
///  so mise cannot get a weaker sandbox than a server.
///  A refusal is reported apart from a failed run.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function runConfined(program: string, invocation: Invocation, project: ProjectView, limitMs: number): Completed // throws RunFailure
/// ```
pub fn run_confined(
    program: &Path,
    invocation: &Invocation,
    project: &super::MiseRequest,
    limit: Duration,
    bubblewrap: &str,
) -> Result<Completed, RunFailure> {
    let request = launch_request(program, invocation, project, &locations_from_environment());
    let launch = confine_with(&request, bubblewrap).map_err(RunFailure::Refused)?;
    prepare(
        &launch,
        &project.project_root,
        project.state_root.as_deref(),
    )
    .map_err(RunFailure::Refused)?;
    let mut command = Command::new(&launch.command);
    command
        .args(&launch.args)
        .env_clear()
        .current_dir(&invocation.directory);
    tracing::debug!(arguments = ?invocation.arguments, directory = %invocation.directory.display(), "running mise in the sandbox");
    return run_bounded(command, limit).map_err(RunFailure::Failed);
}

/// The sandbox request's contents
///  and the program lookup.
#[cfg(test)]
#[path = "command_tests.rs"]
mod tests;
