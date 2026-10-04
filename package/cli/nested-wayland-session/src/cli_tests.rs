//! Parser regressions independent of a running window system.

/// Exercise the production parser and its preserved public configuration.
use super::*;

/// Build owned parser arguments from borrowed test literals.
fn args(values: &[&str]) -> Vec<String> {
    // Vec owns the strings so parse_args sees the same input shape as main.
    let mut result = Vec::new();
    for value in values {
        // to_string copies a borrowed literal into owned argument storage.
        result.push(value.to_string());
    }
    return result;
}

/// Extract clap's typed error without requiring Config to implement Debug.
fn error_kind(values: &[&str]) -> clap::error::ErrorKind {
    // What: err extracts failure; expect terminates the test if parsing succeeded.
    // Why: Each caller supplies a deliberate non-success case.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const error = expectThrown(() => parseArgs(values));
    // return expectInstance(error, CliError).kind;
    // ```
    let error = parse_args(&args(values)).err().expect("expected parser error");
    return error.downcast_ref::<clap::Error>().expect("typed clap error").kind();
}

/// Help is a distinct successful-exit request, even without a child command.
#[test]
fn help_is_not_an_application_error() {
    assert_eq!(error_kind(&["--help"]), clap::error::ErrorKind::DisplayHelp);
    assert_eq!(error_kind(&["-h"]), clap::error::ErrorKind::DisplayHelp);
    assert_eq!(error_kind(&["--version"]), clap::error::ErrorKind::DisplayVersion);
    assert_eq!(error_kind(&["--size", "800x600", "--help"]), clap::error::ErrorKind::DisplayHelp);
}

/// Default dimensions and optional values match the former parser.
#[test]
fn defaults_are_preserved() {
    let config = parse_args(&args(&["app"])).unwrap();
    assert_eq!((config.width, config.height), (1280, 720));
    assert_eq!(config.child_command, ["app"]);
    assert_eq!(config.color_scheme, None);
    assert_eq!(config.control_socket, None);
    assert_eq!(config.app_cpu_quota, None);
    assert_eq!(config.app_cpu_weight, None);
    assert!(!config.isolate);
}

/// Parent options retain their accepted values and existing field types.
#[test]
fn all_parent_options_are_preserved() {
    let config = parse_args(&args(&[
        "--socket", "a socket.sock", "--size", "800X600",
        "--color-scheme", "dark", "--isolate",
        "--app-cpu-quota", "200", "--app-cpu-weight", "20",
        "--", "app", "a file.txt"
    ])).unwrap();
    assert_eq!(config.control_socket, Some(PathBuf::from("a socket.sock")));
    assert_eq!((config.width, config.height), (800, 600));
    assert_eq!(config.color_scheme, Some(ColorSchemePreference::Dark));
    assert!(config.isolate);
    assert_eq!(config.app_cpu_quota, Some(200));
    assert_eq!(config.app_cpu_weight, Some(20));
    assert_eq!(config.child_command, ["app", "a file.txt"]);
}

/// Both documented appearance values remain accepted.
#[test]
fn color_scheme_flag_accepts_supported_values() {
    let dark = parse_args(&args(&["--color-scheme", "dark", "--", "app"])).unwrap();
    let light = parse_args(&args(&["--color-scheme", "light", "--", "app"])).unwrap();
    assert_eq!(dark.color_scheme, Some(ColorSchemePreference::Dark));
    assert_eq!(light.color_scheme, Some(ColorSchemePreference::Light));
}

/// Child help and option-looking tokens pass through after the command starts.
#[test]
fn child_options_are_not_parent_options() {
    for prefix in [vec!["app"], vec!["--", "app"]] {
        let mut input = prefix;
        input.extend(["--help", "--size", "999x999", "--", "-h"]);
        let config = parse_args(&args(&input)).unwrap();
        assert_eq!(config.child_command, ["app", "--help", "--size", "999x999", "--", "-h"]);
        assert_eq!((config.width, config.height), (1280, 720));
    }
}

/// An explicit separator permits an executable name beginning with a hyphen.
#[test]
fn separator_protects_child_executable_name() {
    let config = parse_args(&args(&["--", "--odd-command", "--help"])).unwrap();
    assert_eq!(config.child_command, ["--odd-command", "--help"]);
}

/// A typo before the child command must not become an executable name.
#[test]
fn unknown_parent_option_is_rejected() {
    assert_eq!(error_kind(&["--unknown", "app"]), clap::error::ErrorKind::UnknownArgument);
}

/// Repeated parent options keep the former parser's last-value behavior.
#[test]
fn later_parent_values_override_earlier_values() {
    let config = parse_args(&args(&["--size", "800x600", "--size", "900x700", "app"])).unwrap();
    assert_eq!((config.width, config.height), (900, 700));
}

/// Standard joined values preserve spaces and flag-looking path values.
#[test]
fn joined_parent_values_are_supported() {
    let config = parse_args(&args(&["--size=900x700", "--socket=--a socket", "app"])).unwrap();
    assert_eq!((config.width, config.height), (900, 700));
    assert_eq!(config.control_socket, Some(PathBuf::from("--a socket")));
    assert!(parse_args(&args(&["--size=", "app"])).is_err());
}

/// Missing command and option values fail before compositor startup.
#[test]
fn missing_inputs_are_errors() {
    for input in [vec![], vec!["--"], vec!["--socket"], vec!["--size"],
        vec!["--color-scheme"], vec!["--app-cpu-quota"], vec!["--app-cpu-weight"]] {
        assert!(parse_args(&args(&input)).is_err());
    }
}

/// Invalid sizes retain positive signed-dimension validation.
#[test]
fn invalid_sizes_are_rejected() {
    for size in ["0x1", "1x0", "-1x1", "1x-1", "x", "1x2x3", "huge", "2147483648x1"] {
        assert!(parse_args(&args(&["--size", size, "app"])).is_err());
    }
}

/// Invalid color and numeric values fail with the affected option in context.
#[test]
fn invalid_option_values_are_rejected() {
    for input in [
        ["--color-scheme", "system", "app"],
        ["--app-cpu-quota", "not-a-number", "app"],
        ["--app-cpu-weight", "4294967296", "app"],
    ] {
        let error = parse_args(&args(&input)).err().expect("expected validation error");
        assert!(error.to_string().contains(input[0]));
    }
}
