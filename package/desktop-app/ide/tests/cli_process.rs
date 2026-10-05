//! Real executable help and usage must finish before any project or native display startup.
#![cfg(feature = "gui")]

/// Subprocess outputs verify exit status and streams at the actual CLI boundary.
use std::{
    ffi::OsStr,
    fs,
    path::Path,
    process::{Command, Output},
};

/// Isolate native display endpoints and private state even if startup ordering regresses.
fn invoke(root: &Path, args: &[&OsStr]) -> Output {
    // What: Command builds a child process; env_remove removes inherited host display fallbacks.
    // Why: A CLI regression must not open a window or use the human's display while this test runs.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const child = spawn(executable, args, { cwd: fixture, env: isolatedEnvironment });
    // ```
    let mut command = Command::new(env!("CARGO_BIN_EXE_monochromatic-ide"));
    command.current_dir(root).args(args);
    command.env("SLINT_BACKEND", "winit");
    command.env("WAYLAND_DISPLAY", root.join("absent-wayland.socket"));
    command.env("XDG_RUNTIME_DIR", root);
    command.env("XDG_CONFIG_HOME", root.join("config"));
    command.env("XDG_CACHE_HOME", root.join("cache"));
    command.env("XDG_DATA_HOME", root.join("data"));
    command.env_remove("DISPLAY");
    command.env_remove("WAYLAND_SOCKET");
    return command.output().expect("run native CLI");
}

/// Real help/version print only to stdout, exit zero, and do not create private state or read a missing root.
#[test]
fn executable_help_and_version_exit_without_startup() {
    let fixture = tempfile::tempdir().expect("disposable CLI environment");
    let missing = fixture.path().join("missing-project");
    for flag in ["--help", "--version"] {
        let output = invoke(fixture.path(), &[missing.as_os_str(), OsStr::new(flag)]);
        assert!(output.status.success(), "{flag}: {:?}", output.stderr);
        assert!(!output.stdout.is_empty());
        assert!(output.stderr.is_empty());
        let text = String::from_utf8(output.stdout).expect("UTF-8 CLI output");
        assert!(text.contains("monochromatic-ide"));
        assert!(!text.contains("opened read-only project"));
    }
    assert_eq!(
        fs::read_dir(fixture.path())
            .expect("private directory")
            .count(),
        0
    );
}

/// Bad option grammar has status 2 and stderr, not an attempted native backend connection.
#[test]
fn executable_usage_errors_exit_before_startup() {
    let fixture = tempfile::tempdir().expect("disposable CLI environment");
    for args in [
        vec![],
        vec![OsStr::new("--unknown")],
        vec![OsStr::new("one"), OsStr::new("two")],
    ] {
        let output = invoke(fixture.path(), &args);
        assert_eq!(output.status.code(), Some(2));
        assert!(output.stdout.is_empty());
        let text = String::from_utf8(output.stderr).expect("UTF-8 diagnostic");
        assert!(text.contains("Usage:"));
        assert!(!text.contains("wayland"));
    }
    assert_eq!(
        fs::read_dir(fixture.path())
            .expect("private directory")
            .count(),
        0
    );
}

/// Positive filesystem controls prove valid argument grammar reaches root/source validation before GUI startup.
#[test]
fn invalid_project_and_non_regular_source_have_input_specific_errors() {
    let fixture = tempfile::tempdir().expect("disposable CLI environment");
    let project = fixture.path().join("project");
    let missing = fixture.path().join("missing");
    fs::create_dir(&project).expect("project fixture");
    let absent = invoke(fixture.path(), &[missing.as_os_str()]);
    assert!(!absent.status.success());
    let absent_text = String::from_utf8(absent.stderr).expect("UTF-8 missing-root diagnostic");
    assert!(absent_text.contains("Cannot open project directory"));
    assert!(absent_text.contains(&missing.display().to_string()));
    let directory = invoke(
        fixture.path(),
        &[project.as_os_str(), OsStr::new("--file"), OsStr::new(".")],
    );
    assert!(!directory.status.success());
    let directory_text = String::from_utf8(directory.stderr).expect("UTF-8 source diagnostic");
    assert!(directory_text.contains("not a regular file"));
    assert!(directory_text.contains(&project.display().to_string()));
    assert_eq!(
        fs::read_dir(fixture.path())
            .expect("private directory")
            .count(),
        1
    );
}
