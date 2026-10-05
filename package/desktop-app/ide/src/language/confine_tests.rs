//! The confined launch's exact command lines, settings overrides, state naming, and refusals.

use super::recipe::{confined_settings, recipe};
use super::{confine_with, state_directory};
use crate::language::launch::LaunchRequest;
use serde_json::json;
use std::{collections::HashMap, path::Path, path::PathBuf};

fn request(server: &str, environment: &[(&str, &str)]) -> LaunchRequest {
    let mut variables = HashMap::new();
    for (name, value) in environment {
        variables.insert(name.to_string(), value.to_string());
    }
    return LaunchRequest {
        server: server.to_string(),
        executable: PathBuf::from("/opt/servers/bin/server"),
        args: vec!["--stdio".to_string()],
        environment: variables,
        settings: Some(json!({ "kept": true })),
        project_root: PathBuf::from("/work/project"),
        state_root: Some(PathBuf::from("/state")),
    };
}

fn strings(parts: &[&str]) -> Vec<String> {
    return parts.iter().map(|part| return part.to_string()).collect();
}

#[test]
fn rust_analyzer_gets_the_adopted_recipe_with_cargo_redirects() {
    let inherited = vec![
        ("HOME".to_string(), "/home/someone".to_string()),
        ("PATH".to_string(), "/usr/bin".to_string()),
    ];
    let state = Path::new("/state/project-0/rust-analyzer");
    let launch = recipe(
        &request("rust-analyzer", &[]),
        state,
        "/usr/bin/bwrap",
        &inherited,
    )
    .expect("recipe");
    assert_eq!(launch.command, "/usr/bin/bwrap");
    let expected = strings(&[
        "--die-with-parent",
        "--new-session",
        "--unshare-user",
        "--unshare-pid",
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
        "--bind",
        "/state/project-0/rust-analyzer/tmp",
        "/tmp",
        "--bind",
        "/state/project-0/rust-analyzer",
        "/state/project-0/rust-analyzer",
        "--clearenv",
        "--setenv",
        "CARGO_BUILD_BUILD_DIR",
        "/state/project-0/rust-analyzer/build",
        "--setenv",
        "CARGO_TARGET_DIR",
        "/state/project-0/rust-analyzer/target",
        "--setenv",
        "HOME",
        "/home/someone",
        "--setenv",
        "PATH",
        "/usr/bin",
        "--setenv",
        "XDG_CACHE_HOME",
        "/state/project-0/rust-analyzer/cache",
        "--setenv",
        "npm_config_cache",
        "/state/project-0/rust-analyzer/npm-cache",
        "--",
        "/opt/servers/bin/server",
        "--stdio",
    ]);
    assert_eq!(
        launch.args, expected,
        "the rust-analyzer command line differs from the adopted shape"
    );
    assert!(
        launch.environment.is_empty(),
        "variables must travel through --setenv after --clearenv"
    );
    assert_eq!(launch.settings, Some(json!({ "kept": true })));
    assert_eq!(
        launch.directories,
        vec![
            state.to_path_buf(),
            state.join("cache"),
            state.join("npm-cache"),
            state.join("target"),
            state.join("build"),
        ]
    );
    assert_eq!(launch.scratch, vec![state.join("tmp")]);
}

#[test]
fn typescript_server_runs_without_a_pid_namespace_and_without_type_acquisition() {
    let state = Path::new("/state/project-0/typescript-native");
    let launch = recipe(
        &request("typescript-native", &[]),
        state,
        "/usr/bin/bwrap",
        &[],
    )
    .expect("recipe");
    assert!(
        !launch.args.contains(&"--unshare-pid".to_string()),
        "the TypeScript server would exit inside a process-id namespace"
    );
    assert!(launch.args.contains(&"--unshare-net".to_string()));
    assert!(!launch.args.contains(&"CARGO_TARGET_DIR".to_string()));
    assert_eq!(
        launch.settings,
        Some(json!({
            "kept": true,
            "typescript": { "tsserver": { "automaticTypeAcquisition": { "enabled": false } } },
            "js/ts": { "tsserver": { "automaticTypeAcquisition": { "enabled": false } } },
        }))
    );
    assert_eq!(launch.directories.len(), 3);
}

#[test]
fn definition_variables_pass_through_and_redirects_win() {
    let inherited = vec![("HOME".to_string(), "/home/someone".to_string())];
    let wanted = request(
        "scripted-ls",
        &[
            ("IDE_SCRIPTED_AUDIT", "1"),
            ("XDG_CACHE_HOME", "/elsewhere"),
            ("HOME", "/override"),
        ],
    );
    let launch = recipe(
        &wanted,
        Path::new("/s/p/scripted-ls"),
        "/usr/bin/bwrap",
        &inherited,
    )
    .expect("recipe");
    let text = launch.args.join(" ");
    assert!(text.contains("--setenv IDE_SCRIPTED_AUDIT 1"), "{text}");
    assert!(text.contains("--setenv HOME /override"), "{text}");
    assert!(
        text.contains("--setenv XDG_CACHE_HOME /s/p/scripted-ls/cache"),
        "{text}"
    );
    assert!(
        !text.contains("/elsewhere"),
        "a definition redirected the cache out of private state"
    );
    assert!(text.contains("--unshare-pid"));
}

#[test]
fn typescript_language_server_disables_typing_acquisition() {
    assert_eq!(
        confined_settings("typescript-language-server", None),
        Some(json!({ "disableAutomaticTypingAcquisition": true }))
    );
    assert_eq!(confined_settings("rust-analyzer", None), None);
}

#[test]
fn state_directory_is_per_project_and_per_server() {
    let root = Path::new("/state");
    let first = state_directory(root, Path::new("/a/project"), "rust-analyzer");
    let second = state_directory(root, Path::new("/b/project"), "rust-analyzer");
    assert_ne!(
        first, second,
        "two projects with one name shared private state"
    );
    assert_eq!(
        first.file_name().and_then(|name| return name.to_str()),
        Some("rust-analyzer")
    );
    assert_eq!(
        first,
        state_directory(root, Path::new("/a/project"), "rust-analyzer")
    );
    let parent = first.parent().expect("project component");
    let name = parent
        .file_name()
        .and_then(|text| return text.to_str())
        .expect("text");
    assert!(
        name.starts_with("project-") && name.len() == "project-".len() + 16,
        "{name}"
    );
    let odd = state_directory(root, Path::new("/x/we ird:..name"), "../escape");
    assert!(odd.starts_with(root));
    assert_eq!(
        odd.file_name().and_then(|text| return text.to_str()),
        Some(".._escape")
    );
    assert_eq!(
        odd.components().count(),
        4,
        "a server name escaped its state directory: {odd:?}"
    );
}

#[test]
fn missing_bubblewrap_refuses_with_the_remedy() {
    let reason = confine_with(&request("rust-analyzer", &[]), "/nonexistent/bwrap")
        .expect_err("a launch without bubblewrap was accepted");
    assert!(
        reason.contains("/nonexistent/bwrap is not installed"),
        "{reason}"
    );
    assert!(reason.contains("Install bubblewrap"), "{reason}");
}

#[test]
fn project_or_state_where_the_sandbox_replaces_the_directory_refuses() {
    let mut under_tmp = request("rust-analyzer", &[]);
    under_tmp.project_root = PathBuf::from("/tmp/project");
    let reason = confine_with(&under_tmp, "/nonexistent/bwrap")
        .expect_err("a project below /tmp was accepted");
    assert!(reason.contains("is below /tmp"), "{reason}");
    assert!(reason.contains("Open the project from"), "{reason}");
    let mut beside = request("rust-analyzer", &[]);
    beside.project_root = PathBuf::from("/tmpfoo/project");
    let other = confine_with(&beside, "/nonexistent/bwrap").expect_err("bubblewrap is missing");
    assert!(
        other.contains("is not installed"),
        "a sibling of /tmp was taken for /tmp: {other}"
    );
    let mut state_in_run = request("rust-analyzer", &[]);
    state_in_run.state_root = Some(PathBuf::from("/run/user/1000/cache"));
    let refused = confine_with(&state_in_run, "/bin/sh")
        .expect_err("a state directory below /run was accepted");
    assert!(refused.contains("is below /run"), "{refused}");
}

#[test]
fn missing_state_root_refuses_before_anything_runs() {
    let mut without_state = request("rust-analyzer", &[]);
    without_state.state_root = None;
    // `/bin/sh` exists everywhere; the state check comes before any bubblewrap run.
    let reason =
        confine_with(&without_state, "/bin/sh").expect_err("a launch without state was accepted");
    assert!(reason.contains("no private state directory"), "{reason}");
}
