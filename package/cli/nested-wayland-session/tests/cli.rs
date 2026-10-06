//! Verify the real executable's help and usage behavior without any display.

/// What:
///  Command launches the compiled fixture and Output owns its exit/stdio.
/// Why:
///  Parser-only tests cannot prove main treats help as a successful exit.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { spawnSync } from 'node:child_process';
/// ```
use std::process::{Command, Output};

/// Invoke the built consumer artifact with display discovery unavailable.
fn execute(arguments: &[&str]) -> Output {
    // What: Cargo supplies this binary path at compile time for integration tests.
    // Why: Test the artifact being built, not an older installed copy.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const command = new Process(builtBinary);
    // ```
    let mut command = Command::new(env!("CARGO_BIN_EXE_monochromatic-nested-wayland-session"));
    command.args(arguments);
    command.env_remove("WAYLAND_DISPLAY");
    command.env_remove("DISPLAY");
    command.env_remove("XDG_RUNTIME_DIR");
    command.env_remove("DBUS_SESSION_BUS_ADDRESS");
    // output captures both streams; expect only handles failure to launch the test artifact.
    return command.output().expect("launch compiled CLI");
}

/// Both help spellings succeed without a display and write only to stdout.
#[test]
fn help_exits_successfully_without_startup() {
    for option in ["--help", "-h"] {
        let output = execute(&[option]);
        assert!(output.status.success());
        // UTF-8 conversion is expected for clap-generated help text.
        let text = String::from_utf8(output.stdout).expect("UTF-8 help");
        assert!(text.contains("Usage:"));
        assert!(text.contains("--socket"));
        assert!(text.contains("--color-scheme"));
        assert!(text.contains("COMMAND"));
        assert!(output.stderr.is_empty());
    }
}

/// Version reporting also bypasses native startup.
#[test]
fn version_exits_successfully_without_startup() {
    let output = execute(&["--version"]);
    assert!(output.status.success());
    let text = String::from_utf8(output.stdout).expect("UTF-8 version");
    assert!(text.contains("monochromatic-nested-wayland-session"));
    assert!(output.stderr.is_empty());
}

/// Usage errors use clap's exit 2,
///  not a later missing-Wayland error.
#[test]
fn usage_errors_are_reported_before_startup() {
    for input in [vec![], vec!["--unknown"], vec!["--socket"],
        vec!["--size", "0x1", "app"]] {
        let output = execute(&input);
        assert_eq!(output.status.code(), Some(2));
        assert!(output.stdout.is_empty());
        let text = String::from_utf8(output.stderr).expect("UTF-8 error");
        // clap's missing-value form gives --help guidance without repeating usage.
        assert!(text.contains("--help"), "{input:?}: {text}");
        if input.is_empty() || input[0] == "--unknown" {
            assert!(text.contains("Usage:"), "{input:?}: {text}");
        }
        if !input.is_empty() {
            assert!(text.contains(input[0]), "{input:?}: {text}");
        }
        assert!(!text.contains("WAYLAND_DISPLAY"));
        assert!(!text.contains("XDG_RUNTIME_DIR"));
    }
}
