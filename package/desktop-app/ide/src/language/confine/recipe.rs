//! The bubblewrap command line for one server,
//!  built without touching the system.
//!
//! The shape is the one adopted in `doc/planning/slint-ide-write-confinement.md`
//! ("Recommended launch shape"):
//!  the whole file system read-only,
//!  one private state directory
//! and a private `/tmp` writable,
//!  `/run` hidden,
//!  no network,
//!  and a cleared environment that
//! receives only an allowlist.
//!  The project is then bound again read-only at its own path,
//!  so a
//! project below `/tmp`,
//!  `/run`,
//!  or `/dev` stays visible.

/// How the project is mounted inside.
use super::project::project_binds;
/// The seam's input and output types.
use crate::language::launch::{LaunchRequest, ServerLaunch};
/// What:
///  `Value` is any JSON value;
///  `json!` builds one from literal syntax.
/// Why:
///  Settings overrides are written into the server's JSON settings table.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Value = unknown;
/// ```
use serde_json::{Value, json};
/// What:
///  `BTreeMap` is a key-value table kept sorted by key (sibling:
///  `HashMap`,
///  unordered);
///       `Path`/`PathBuf` are borrowed and owned filesystem paths.
/// Why:
///  A sorted table gives the same argument order on every launch,
///  so tests can compare
///      exact argument lists.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const environment = new Map<string, string>(); // iterated in key order
/// ```
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
};

/// Servers that watch the client's process id and exit inside a process-id namespace,
/// because helix-lsp always sends its own `processId` in `initialize` (measured in the confinement plan).
pub const NO_PID_NAMESPACE: &[&str] = &["typescript-native", "typescript-language-server"];

/// Servers that run cargo,
///  whose target and build directories must move into private state.
pub const CARGO_SERVERS: &[&str] = &["rust-analyzer"];

/// Inherited variables a server receives;
///  every other variable of the application is cleared,
/// so credentials in the application's environment never reach project code.
///  Bubblewrap adds
/// `PWD` itself after clearing (measured).
///  Measured needs:
///  without `PATH` the TypeScript 7
/// launcher's `#!/usr/bin/env node` fails;
///  without `RUSTUP_TOOLCHAIN` the rustup proxy starts the
/// default toolchain's rust-analyzer instead of the one the user selected.
pub const ALLOWED_ENVIRONMENT: &[&str] = &[
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "LC_MESSAGES",
    "TZ",
    "CARGO_HOME",
    "RUSTUP_HOME",
    "RUSTUP_TOOLCHAIN",
];

/// What:
///  The namespace and mount options shared by the launch and the start-time probe.
///       `Vec<String>` is a growable list of owned text values (sibling:
///  `&[&str]`,
///  borrowed).
/// Why:
///  The probe must test exactly the namespaces the server will get.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function isolation(pidNamespace: boolean): string[]
/// ```
pub fn isolation(pid_namespace: bool) -> Vec<String> {
    // `Vec::new()` creates an empty list; `mut` allows pushing to it.
    let mut arguments: Vec<String> = Vec::new();
    for flag in ["--die-with-parent", "--new-session", "--unshare-user"] {
        // `to_string` copies the literal into an owned `String`.
        arguments.push(flag.to_string());
    }
    if pid_namespace {
        arguments.push("--unshare-pid".to_string());
    }
    for flag in [
        "--unshare-ipc",
        "--unshare-uts",
        "--unshare-cgroup",
        "--unshare-net",
        "--ro-bind",
        "/",
        "/",
        "--dev",
        "/dev",
        "--proc",
        "/proc",
        "--tmpfs",
        "/run",
    ] {
        arguments.push(flag.to_string());
    }
    return arguments;
}

/// What:
///  Set one nested member of a JSON object,
///  creating objects on the way.
///  `&mut Value`
///       lends the value for modification;
///  `&[&str]` is a borrowed list of member names.
/// Why:
///  Overrides are merged into a settings table the user of the seam already filled.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function setPath(target: Record<string, unknown>, path: string[], leaf: unknown): void
/// ```
fn set_path(target: &mut Value, path: &[&str], leaf: Value) {
    // `split_first` returns the first name and the rest, or nothing for an empty path.
    let Some((first, rest)) = path.split_first() else {
        *target = leaf;
        return;
    };
    if !target.is_object() {
        *target = json!({});
    }
    // `as_object_mut` borrows the object's member table; `entry(...).or_insert` finds or creates a member.
    if let Some(members) = target.as_object_mut() {
        let child = members.entry((*first).to_string()).or_insert(Value::Null);
        set_path(child, rest, leaf);
    }
}

/// What:
///  The settings a server gets inside the sandbox.
///  `Option<Value>` is "settings,
///  or none".
/// Why:
///  Without network,
///  automatic type acquisition can only fail;
///  switching it off keeps the
///      TypeScript servers from starting `npm` at all (measured in the confinement plan).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function confinedSettings(server: string, settings?: unknown): unknown
/// ```
pub fn confined_settings(server: &str, settings: Option<&Value>) -> Option<Value> {
    // `cloned()` copies the borrowed settings into an owned value, when there are any.
    let mut result = settings.cloned();
    if server == "typescript-native" {
        // `get_or_insert_with` fills an absent value with an empty object first.
        let table = result.get_or_insert_with(|| return json!({}));
        let off = ["tsserver", "automaticTypeAcquisition", "enabled"];
        set_path(table, &["typescript", off[0], off[1], off[2]], json!(false));
        set_path(table, &["js/ts", off[0], off[1], off[2]], json!(false));
    }
    if server == "typescript-language-server" {
        let table = result.get_or_insert_with(|| return json!({}));
        set_path(table, &["disableAutomaticTypingAcquisition"], json!(true));
    }
    return result;
}

/// What:
///  Build the complete launch for one server.
///  `inherited` holds the application's values
///       of the allowlisted variables,
///  as `(name, value)` pairs.
/// Why:
///  Kept free of system access so the exact command line can be tested anywhere.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function recipe(request: LaunchRequest, state: string, bubblewrap: string, inherited: [string, string][]): ServerLaunch
/// ```
pub fn recipe(
    request: &LaunchRequest,
    state: &Path,
    bubblewrap: &str,
    inherited: &[(String, String)],
) -> Result<ServerLaunch, String> {
    let server = request.server.as_str();
    // What: `to_str` returns `Option<&str>`; `ok_or_else` turns "nothing" into the error text.
    // Why: Helix stores arguments as text, so a path that is not valid Unicode cannot be passed on.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const executable: string = request.executable;
    // ```
    let executable = request.executable.to_str().ok_or_else(|| {
        return format!(
            "the path of {server} is not valid Unicode: {}",
            request.executable.display()
        );
    })?;
    let state_text = state.to_str().ok_or_else(|| {
        return format!(
            "the private state directory {} is not valid Unicode",
            state.display()
        );
    })?;
    let mut environment: BTreeMap<String, String> = BTreeMap::new();
    for (name, value) in inherited {
        environment.insert(name.clone(), value.clone());
    }
    // The server definition's own variables override inherited ones.
    for (name, value) in &request.environment {
        environment.insert(name.clone(), value.clone());
    }
    // Redirects into private state override both.
    environment.insert("XDG_CACHE_HOME".to_string(), format!("{state_text}/cache"));
    environment.insert(
        "npm_config_cache".to_string(),
        format!("{state_text}/npm-cache"),
    );
    // `PathBuf::from` and `join` build owned paths below the state directory.
    let mut directories: Vec<PathBuf> = vec![
        state.to_path_buf(),
        state.join("cache"),
        state.join("npm-cache"),
    ];
    if CARGO_SERVERS.contains(&server) {
        environment.insert(
            "CARGO_TARGET_DIR".to_string(),
            format!("{state_text}/target"),
        );
        environment.insert(
            "CARGO_BUILD_BUILD_DIR".to_string(),
            format!("{state_text}/build"),
        );
        directories.push(state.join("target"));
        directories.push(state.join("build"));
    }
    let mut args = isolation(!NO_PID_NAMESPACE.contains(&server));
    // A later mount covers an earlier one, so the order is deliberate:
    // - the writable binds come after the read-only root bind;
    // - the project binds come after the `/tmp` and `/run` replacements, so a project below them
    //   stays visible;
    // - the state bind comes last, after the read-only project bind, so a state directory inside the
    //   project (the home folder opened as the project holds `~/.cache`) stays writable while the
    //   rest of the project stays read-only.
    args.push("--bind".to_string());
    args.push(format!("{state_text}/tmp"));
    args.push("/tmp".to_string());
    args.extend(project_binds(
        &request.project_root,
        &request.project_spellings,
    )?);
    args.push("--bind".to_string());
    args.push(state_text.to_string());
    args.push(state_text.to_string());
    args.push("--clearenv".to_string());
    for (name, value) in environment {
        args.push("--setenv".to_string());
        args.push(name);
        args.push(value);
    }
    args.push("--".to_string());
    args.push(executable.to_string());
    // `extend` appends copies of the server's own arguments after its program.
    args.extend(request.args.iter().cloned());
    // `Ok(...)` is the success variant of `Result`.
    return Ok(ServerLaunch {
        command: bubblewrap.to_string(),
        args,
        // Variables for the server travel as `--setenv`; anything here would only reach bubblewrap.
        environment: std::collections::HashMap::new(),
        settings: confined_settings(server, request.settings.as_ref()),
        directories,
        scratch: vec![state.join("tmp")],
    });
}
