//! The sandbox request's contents
//!  and the program lookup.

use super::{Invocation, LOCATION_VARIABLES, SAFE_ENVIRONMENT, find_mise_in, launch_request};
use crate::language::{confine::recipe::recipe, mise::MiseRequest};
use std::{
    ffi::OsString,
    fs,
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
};

fn project(root: &str) -> MiseRequest {
    return MiseRequest {
        project_root: PathBuf::from(root),
        project_spellings: Vec::new(),
        state_root: Some(PathBuf::from("/state")),
    };
}

fn listing(directory: &str) -> Invocation {
    return Invocation {
        arguments: ["config", "ls", "--json"].map(str::to_string).to_vec(),
        directory: PathBuf::from(directory),
    };
}

/// The exact arguments bubblewrap gets for a mise command.
fn arguments(root: &str, locations: &[(String, String)]) -> Vec<String> {
    let request = launch_request(
        Path::new("/home/someone/.local/bin/mise"),
        &listing(root),
        &project(root),
        locations,
    );
    let inherited = vec![("HOME".to_string(), "/home/someone".to_string())];
    return recipe(
        &request,
        Path::new("/state/p-0/mise"),
        "/usr/bin/bwrap",
        &inherited,
    )
    .expect("recipe")
    .args;
}

/// The index of the first `--` argument,
///  which ends the sandbox options.
fn separator(args: &[String]) -> usize {
    for (index, argument) in args.iter().enumerate() {
        if argument == "--" {
            return index;
        }
    }
    panic!("separator");
}

/// The index where the arguments `wanted` first appear in a row.
fn position(args: &[String], wanted: &[&str]) -> Option<usize> {
    for (index, window) in args.windows(wanted.len()).enumerate() {
        let mut same = true;
        for (argument, expected) in window.iter().zip(wanted.iter()) {
            if argument != expected {
                same = false;
                break;
            }
        }
        if same {
            return Some(index);
        }
    }
    return None;
}

fn setenv(arguments: &[String], name: &str) -> Option<String> {
    for window in arguments.windows(3) {
        if window[0] == "--setenv" && window[1] == name {
            return Some(window[2].clone());
        }
    }
    return None;
}

#[test]
fn every_variable_that_stops_mise_from_changing_or_reaching_anything_is_set() {
    let args = arguments("/work/project", &[]);
    for (name, value) in [
        ("MISE_AUTO_INSTALL", "false"),
        ("MISE_EXEC_AUTO_INSTALL", "false"),
        ("MISE_NOT_FOUND_AUTO_INSTALL", "false"),
        ("MISE_TASK_RUN_AUTO_INSTALL", "false"),
        ("MISE_LOCKFILE", "false"),
        ("MISE_OFFLINE", "true"),
        ("MISE_YES", "false"),
    ] {
        assert_eq!(
            setenv(&args, name).as_deref(),
            Some(value),
            "{name} is not set to {value}"
        );
    }
    // Every entry of the constant is set as well, not only the ones named above.
    for (name, value) in SAFE_ENVIRONMENT {
        assert_eq!(setenv(&args, name).as_deref(), Some(*value), "{name}");
    }
}

#[test]
fn mise_runs_in_the_servers_sandbox_without_network_and_with_a_cleared_environment() {
    let args = arguments("/work/project", &[]);
    for flag in [
        "--unshare-net",
        "--unshare-pid",
        "--unshare-user",
        "--die-with-parent",
        "--clearenv",
    ] {
        assert!(
            args.iter().any(|argument| return argument == flag),
            "{flag} is missing from {args:?}"
        );
    }
    assert!(
        position(&args, &["--ro-bind", "/", "/"]).is_some(),
        "{args:?}"
    );
    assert!(
        position(&args, &["--ro-bind", "/work/project", "/work/project"]).is_some(),
        "the project is not bound read-only in {args:?}"
    );
    // Nothing but the private state and the private /tmp is writable.
    let mut writable: Vec<&[String]> = Vec::new();
    for window in args.windows(3) {
        if window[0] == "--bind" {
            writable.push(window);
        }
    }
    assert_eq!(writable.len(), 2, "{writable:?}");
    assert!(
        writable
            .iter()
            .all(|window| return window[1].starts_with("/state/")),
        "{writable:?}"
    );
    let after = separator(&args);
    assert_eq!(
        args[after + 1..],
        ["/home/someone/.local/bin/mise", "config", "ls", "--json"].map(str::to_string)
    );
}

#[test]
fn the_project_is_never_an_argument_of_mise_so_a_dashed_name_cannot_become_an_option() {
    for root in [
        "/work/-rf",
        "/work/--cd=/etc",
        "/work/a b/'c'/\"d\"",
        "/work/new\nline",
    ] {
        let args = arguments(root, &[]);
        let after = separator(&args);
        assert_eq!(
            args[after + 1..],
            ["/home/someone/.local/bin/mise", "config", "ls", "--json"].map(str::to_string),
            "mise got more than its command for {root}"
        );
        // The root appears only as a bind source and destination, each its own argument.
        assert_eq!(
            args.iter()
                .filter(|argument| return argument.as_str() == root)
                .count(),
            2,
            "{args:?}"
        );
    }
}

#[test]
fn location_variables_reach_mise_and_nothing_else_of_the_application_does() {
    let locations = vec![
        ("MISE_DATA_DIR".to_string(), "/custom/mise data".to_string()),
        ("XDG_CONFIG_HOME".to_string(), "/custom/config".to_string()),
    ];
    let args = arguments("/work/project", &locations);
    assert_eq!(
        setenv(&args, "MISE_DATA_DIR").as_deref(),
        Some("/custom/mise data")
    );
    assert_eq!(
        setenv(&args, "XDG_CONFIG_HOME").as_deref(),
        Some("/custom/config")
    );
    // A credential-like variable is not on the list of locations.
    assert!(
        LOCATION_VARIABLES
            .iter()
            .all(|name| return !name.contains("TOKEN") && !name.contains("KEY"))
    );
    assert!(setenv(&args, "MISE_GITHUB_TOKEN").is_none());
}

#[test]
fn a_location_variable_below_a_replaced_directory_is_shown_again_read_only() {
    let root = tempfile::tempdir().expect("directory");
    let data = root.path().join("data");
    fs::create_dir_all(&data).expect("directory");
    let request = launch_request(
        Path::new("/bin/mise"),
        &listing("/work/project"),
        &project("/work/project"),
        &[(
            "MISE_DATA_DIR".to_string(),
            data.to_str().expect("Unicode").to_string(),
        )],
    );
    assert_eq!(request.read_only_binds, [data]);
    let none = launch_request(
        Path::new("/bin/mise"),
        &listing("/work/project"),
        &project("/work/project"),
        &[],
    );
    assert!(none.read_only_binds.is_empty());
}

fn program(path: &Path, mode: u32) {
    fs::create_dir_all(path.parent().expect("parent")).expect("directory");
    fs::write(path, "#!/bin/sh\n").expect("program");
    fs::set_permissions(path, fs::Permissions::from_mode(mode)).expect("mode");
}

#[test]
fn mise_is_found_on_path_first_then_in_the_installers_directory() {
    let root = tempfile::tempdir().expect("directory");
    let on_path = root.path().join("path/bin");
    program(&on_path.join("mise"), 0o755);
    let home = root.path().join("home");
    program(&home.join(".local/bin/mise"), 0o755);
    let path = OsString::from(format!("relative/bin:{}", on_path.display()));
    assert_eq!(
        find_mise_in(Some(&path), Some(&home)),
        Some(on_path.join("mise"))
    );
    assert_eq!(
        find_mise_in(None, Some(&home)),
        Some(home.join(".local/bin/mise"))
    );
    assert_eq!(
        find_mise_in(Some(&OsString::from("/nowhere")), Some(&home)),
        Some(home.join(".local/bin/mise"))
    );
}

#[test]
fn mise_is_not_found_without_an_executable_or_an_absolute_home() {
    let root = tempfile::tempdir().expect("directory");
    let home = root.path().join("home");
    program(&home.join(".local/bin/mise"), 0o644);
    assert_eq!(find_mise_in(None, Some(&home)), None);
    assert_eq!(find_mise_in(None, Some(Path::new("relative/home"))), None);
    assert_eq!(find_mise_in(None, None), None);
    // A relative PATH entry would depend on the working directory.
    program(&root.path().join("relative/mise"), 0o755);
    assert_eq!(find_mise_in(Some(&OsString::from("relative")), None), None);
}
