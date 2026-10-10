//! The launch seam:
//!  what the application knows about a server,
//!  and what is actually spawned.
//!
//! Every server definition passes through one `LaunchPolicy` before Helix sees it.
//!  The default
//! policy spawns the resolved server program unchanged.
//!  A confining policy returns a wrapper
//! command instead;
//!  if it cannot,
//!  it returns an error and the server is reported as refused.
//! There is no fallback to an unconfined launch.

/// What:
///  `Value` is any JSON value.
/// Why:
///  A server's settings table travels as JSON and a policy may override entries in it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Value = unknown;
/// ```
use serde_json::Value;
/// What:
///  `HashMap` is a key-value table;
///  `PermissionsExt` adds Unix permission bits to file
///       metadata;
///  `Path` is a borrowed filesystem path and `PathBuf` its owned sibling.
/// Why:
///  Executables are found by walking `PATH` and checking the execute permission.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { accessSync, constants } from 'node:fs';
/// ```
use std::{
    collections::HashMap,
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
};

/// What:
///  Everything the application knows about one server before launch.
///  `String` and
///       `PathBuf` own their data;
///  `Vec<String>` is a growable list;
///  `Option<...>` is "a value,
///       or nothing".
/// Why:
///  A policy needs the real program (already resolved to an absolute path),
///  the project
///      it must not write to,
///  and the private directory it may write to instead.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type LaunchRequest = { server: string; executable: string; args: string[];
///                        environment: Record<string, string>; settings?: unknown;
///                        projectRoot: string; projectSpellings: string[]; stateRoot?: string };
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct LaunchRequest {
    /// Name of the server definition,
    ///  for example `rust-analyzer`.
    pub server: String,
    /// Absolute path of the server's own program.
    pub executable: PathBuf,
    /// The server's own arguments.
    pub args: Vec<String>,
    /// Environment variables the definition adds for the server.
    pub environment: HashMap<String, String>,
    /// The server's settings table,
    ///  sent as initialization options and configuration.
    pub settings: Option<Value>,
    /// Canonical project root.
    pub project_root: PathBuf,
    /// Other spellings of the project root that servers are given,
    ///  such as the one Helix derives
    /// from `PWD` when the project was reached through a symbolic link.
    pub project_spellings: Vec<PathBuf>,
    /// Private application state directory outside the project,
    ///  when the application has one.
    pub state_root: Option<PathBuf>,
}

/// What is actually handed to Helix for one server.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ServerLaunch = { command: string; args: string[]; environment: Record<string, string>;
///                       settings?: unknown; directories: string[]; scratch: string[] };
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct ServerLaunch {
    /// Program to spawn:
    ///  the server itself,
    ///  or a wrapper that runs it.
    pub command: String,
    /// Arguments of that program;
    ///  a wrapper's recipe comes first,
    ///  then the server and its arguments.
    pub args: Vec<String>,
    /// Environment variables added for the spawned program.
    pub environment: HashMap<String, String>,
    /// Settings table after the policy's overrides.
    pub settings: Option<Value>,
    /// Directories that must exist before every launch;
    ///  created by the worker below the private state
    /// root,
    ///  which lies inside the project only when the home folder is opened.
    pub directories: Vec<PathBuf>,
    /// Directories emptied before every launch,
    ///  such as a private temporary directory.
    pub scratch: Vec<PathBuf>,
}

/// What:
///  `fn(...) -> ...` as a type is a plain function pointer:
///  a value that is a function.
///       `Result<ServerLaunch, String>` is either a launch (`Ok`) or a refusal reason (`Err`).
/// Why:
///  One explicit function decides how every server starts,
///  so write confinement can be
///      added without touching the worker.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type LaunchPolicy = (request: LaunchRequest) => ServerLaunch; // throws to refuse
/// ```
pub type LaunchPolicy = fn(&LaunchRequest) -> Result<ServerLaunch, String>;

/// What:
///  The default policy:
///  spawn the resolved server program itself,
///  unchanged.
/// Why:
///  It keeps the seam explicit while no confinement is wired in.
///  Servers launched this way
///      can write to the project,
///  so real servers may only be pointed at disposable projects.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const launchDirectly: LaunchPolicy = request =>
///   ({ command: request.executable, args: request.args, environment: request.environment,
///      settings: request.settings, directories: [], scratch: [] });
/// ```
pub fn launch_directly(request: &LaunchRequest) -> Result<ServerLaunch, String> {
    // What: `to_str` returns `Option<&str>`: Helix stores commands as text, so a path that is
    //       not valid Unicode cannot be passed on. `ok_or_else` turns "nothing" into an error.
    // Why: Refusing is safer than spawning a lossily converted, and so different, path.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const command: string = request.executable;
    // ```
    let command = request.executable.to_str().ok_or_else(|| {
        return format!(
            "the path of {} is not valid Unicode: {}",
            request.server,
            request.executable.display()
        );
    })?;
    // `Ok(...)` is the success variant of `Result`; `clone` copies each borrowed part.
    return Ok(ServerLaunch {
        command: command.to_string(),
        args: request.args.clone(),
        environment: request.environment.clone(),
        settings: request.settings.clone(),
        directories: Vec::new(),
        scratch: Vec::new(),
    });
}

/// True for an existing regular file with at least one execute permission bit.
fn is_executable(path: &Path) -> bool {
    // What: `metadata` returns `Result`; `is_ok_and` is true only for success whose value passes
    //       the closure's test. `0o111` is an octal literal: the three execute bits.
    // Why: A directory or a non-executable file of the right name is not a program.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { accessSync(path, constants.X_OK); return statSync(path).isFile(); } catch { return false; }
    // ```
    return std::fs::metadata(path)
        .is_ok_and(|found| return found.is_file() && found.permissions().mode() & 0o111 != 0);
}

/// What:
///  Find the absolute path of a server program,
///  or nothing.
///  A command containing a path
///       separator is taken relative to the project root;
///  a bare name is searched on `PATH`.
/// Why:
///  A wrapper in front of the server would hide a missing server from Helix's own lookup,
///      and a confining wrapper needs an absolute path after its `--`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function resolveExecutable(command: string, root: string): string | undefined
/// ```
pub fn resolve_executable(command: &str, root: &Path) -> Option<PathBuf> {
    if command.contains('/') {
        // `join` keeps an absolute command as it is and puts a relative one under the root.
        let candidate = root.join(command);
        if is_executable(&candidate) {
            // `Some(...)` is the "value present" variant of `Option`.
            return Some(candidate);
        }
        // `None` is the "nothing" variant.
        return None;
    }
    // The trailing `?` returns `None` when `PATH` is unset.
    let search = std::env::var_os("PATH")?;
    for directory in std::env::split_paths(&search) {
        // A relative entry would depend on the working directory; only absolute ones are trusted.
        if !directory.is_absolute() {
            continue;
        }
        let candidate = directory.join(command);
        if is_executable(&candidate) {
            return Some(candidate);
        }
    }
    return None;
}

/// What:
///  Resolve as much of a path as exists.
///  `canonicalize` fails for a missing path,
///  so the
///       nearest existing ancestor is resolved and the missing tail is appended again.
/// Why:
///  A state directory that does not exist yet must still be compared,
///  and bound inside a
///      sandbox,
///  by its real location,
///  even when a variable spells it through a symbolic link.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function resolveExisting(path: string): string
/// ```
pub fn resolve_existing(path: &Path) -> PathBuf {
    // `mut` allows walking up until an existing ancestor is found.
    let mut existing = path;
    let mut tail: Vec<&std::ffi::OsStr> = Vec::new();
    loop {
        // `if let Ok(x) = ...` runs the block only when the call succeeded.
        if let Ok(real) = std::fs::canonicalize(existing) {
            let mut resolved = real;
            // `iter().rev()` walks the collected names from the outermost to the innermost.
            for name in tail.iter().rev() {
                resolved.push(name);
            }
            return resolved;
        }
        match (existing.parent(), existing.file_name()) {
            (Some(parent), Some(name)) => {
                tail.push(name);
                existing = parent;
            }
            // Nothing above exists or the path has no name: keep the path as written.
            _ => return path.to_path_buf(),
        }
    }
}

/// What:
///  Check that a directory a policy wants written does not contain the project.
///       `Result<(), String>` is success without a value,
///  or the reason for refusal.
/// Why:
///  A state directory that contains (or is) the project would make the project writable
///      through it (measured in `doc/planning/slint-ide-write-confinement.md`).
///  A state directory
///      strictly inside the project is allowed:
///  it is the application's own cache,
///  which lies inside
///      the project when the home folder is opened (`~/.cache/monochromatic-ide`),
///  and the sandbox
///      binds it writable after the read-only project bind,
///  so only that directory is writable.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function checkStateDirectory(directory: string, projectRoot: string): void // throws to refuse
/// ```
pub fn check_state_directory(directory: &Path, project_root: &Path) -> Result<(), String> {
    if !directory.is_absolute() {
        // `Err(...)` is the failure variant of `Result`.
        return Err(format!(
            "private state directory {} is not an absolute path",
            directory.display()
        ));
    }
    let state = resolve_existing(directory);
    let project = resolve_existing(project_root);
    if state != project && state.starts_with(&project) {
        tracing::debug!(state = %state.display(), project = %project.display(), "private state directory lies inside the project; it is bound writable after the read-only project");
    }
    // Equal paths also start with each other, so the project itself is refused here too.
    if project.starts_with(&state) {
        return Err(format!(
            "private state directory {} contains the project {}",
            state.display(),
            project.display()
        ));
    }
    // `Ok(())` reports success without a value.
    return Ok(());
}

/// What:
///  Check that a directory lies strictly below the private state root.
/// Why:
///  Scratch directories are emptied,
///  so a policy mistake must never reach beyond the one
///      directory the application owns.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function checkBelowState(directory: string, stateRoot: string): void // throws to refuse
/// ```
fn check_below_state(directory: &Path, state_root: &Path) -> Result<(), String> {
    let resolved = resolve_existing(directory);
    let state = resolve_existing(state_root);
    if resolved == state || !resolved.starts_with(&state) {
        return Err(format!(
            "{} is not below the private state directory {}",
            resolved.display(),
            state.display()
        ));
    }
    return Ok(());
}

/// What:
///  Create a launch's directories and empty its scratch directories.
///  `Option<&Path>` is
///       "a borrowed path,
///  or nothing":
///  the application's private state root.
/// Why:
///  A wrapper refuses to start when its bind sources are missing,
///  and a private temporary
///      directory must not carry files from an earlier session.
///  Every directory must be below
///      the state root,
///  and the state root must not contain the project;
///  anything else is refused.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function prepare(launch: ServerLaunch, projectRoot: string, stateRoot?: string): void // throws to refuse
/// ```
pub fn prepare(
    launch: &ServerLaunch,
    project_root: &Path,
    state_root: Option<&Path>,
) -> Result<(), String> {
    if launch.directories.is_empty() && launch.scratch.is_empty() {
        return Ok(());
    }
    // `let Some(x) = option else { ... }` binds the inner value or leaves the function.
    let Some(state) = state_root else {
        return Err(
            "the launch needs private directories, but no private state directory is configured"
                .to_string(),
        );
    };
    check_state_directory(state, project_root)?;
    for directory in &launch.directories {
        check_below_state(directory, state)?;
        // What: `map_err` converts the I/O error into the text reason this function returns;
        //       the trailing `?` returns that reason to the caller on failure.
        // Why: The reason is shown as the server's refused state.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // mkdirSync(directory, { recursive: true });
        // ```
        std::fs::create_dir_all(directory).map_err(|error| {
            return format!(
                "cannot create {}: {error}. The server is not started without its private state directory. Make that path creatable as a directory (free space, write permission, no file in its place), then restart the application",
                directory.display()
            );
        })?;
    }
    for directory in &launch.scratch {
        check_below_state(directory, state)?;
        if directory.exists() {
            std::fs::remove_dir_all(directory).map_err(|error| {
                return format!("cannot empty {}: {error}", directory.display());
            })?;
        }
        std::fs::create_dir_all(directory).map_err(|error| {
            return format!("cannot create {}: {error}", directory.display());
        })?;
    }
    return Ok(());
}

/// Executable lookup,
///  the default policy,
///  and state-directory containment,
///  on disposable directories.
#[cfg(test)]
#[path = "launch_tests.rs"]
mod tests;
