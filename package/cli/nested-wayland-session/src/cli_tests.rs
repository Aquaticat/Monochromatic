//! Parser regressions independent of a running window system.

/// Exercise the production parser and its preserved public configuration.
use super::*;
/// The startup scale shares its value type with the runtime `scale` verb.
use crate::screen_geometry::OutputScale;
/// The notification mode the new option selects.
use crate::notification_mode::NotificationMode;

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

/// Help is a distinct successful-exit request,
///  even without a child command.
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
    assert_eq!(config.scale, OutputScale::ONE);
    // The announced key repeat pair keeps the values earlier versions sent.
    assert_eq!((config.repeat_rate, config.repeat_delay), (25, 200));
}

/// The key repeat pair is configurable and bounded.
#[test]
fn repeat_options_set_and_bound_the_announced_pair() {
    let config = parse_args(&args(&["--repeat-rate", "30", "--repeat-delay=600", "app"])).unwrap();
    assert_eq!((config.repeat_rate, config.repeat_delay), (30, 600));
    let off = parse_args(&args(&["--repeat-rate", "0", "app"])).unwrap();
    assert_eq!(off.repeat_rate, 0);
    for bad in [["--repeat-rate", "1001"], ["--repeat-rate", "-1"], ["--repeat-delay", "10001"], ["--repeat-delay", "soon"]] {
        let mut argv = bad.to_vec();
        argv.push("app");
        assert!(parse_args(&args(&argv)).is_err(), "{bad:?}");
    }
}

/// The startup scale accepts the runtime verb's values in both option spellings.
#[test]
fn scale_option_accepts_integer_and_fractional_values() {
    let fractional = parse_args(&args(&["--scale", "1.25", "app"])).unwrap();
    assert_eq!(fractional.scale.per_120(), 150);
    let joined = parse_args(&args(&["--scale=2", "--size", "800x600", "app"])).unwrap();
    assert_eq!(joined.scale.per_120(), 240);
    // The size stays logical; the scale does not multiply it here.
    assert_eq!((joined.width, joined.height), (800, 600));
    let last = parse_args(&args(&["--scale", "2", "--scale", "1.5", "app"])).unwrap();
    assert_eq!(last.scale.per_120(), 180);
}

/// Invalid startup scales fail before compositor startup and name the option.
#[test]
fn invalid_scales_are_rejected() {
    // The joined spelling hands even "-1" to the value parser instead of clap's flag lookup.
    for value in ["0", "1.333", "3.5", "-1", "NaN", "two", ""] {
        let joined = format!("--scale={value}");
        let error = parse_args(&args(&[joined.as_str(), "app"])).err().expect(value);
        assert!(error.to_string().contains("--scale"), "{value:?}: {error}");
    }
    assert!(parse_args(&args(&["--scale", "-1", "app"])).is_err());
    assert!(parse_args(&args(&["--scale"])).is_err());
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

/// The launcher log flag is off by default and turns on alone, without a color scheme.
#[test]
fn launcher_log_flag_is_off_by_default_and_parses_alone() {
    assert!(!parse_args(&args(&["app"])).unwrap().launcher_log);
    let config = parse_args(&args(&["--launcher-log", "--", "app"])).unwrap();
    assert!(config.launcher_log);
    assert_eq!(config.color_scheme, None);
    assert_eq!(config.child_command, ["app"]);
}

/// The notification mode is `none` by default and takes exactly the three documented values.
#[test]
fn notifications_option_defaults_to_none_and_takes_three_values() {
    assert_eq!(parse_args(&args(&["app"])).unwrap().notifications, NotificationMode::None);
    for (value, mode) in [
        ("none", NotificationMode::None),
        ("freedesktop", NotificationMode::Freedesktop),
        ("kde", NotificationMode::Kde),
    ] {
        let config = parse_args(&args(&["--notifications", value, "--", "app"])).unwrap();
        assert_eq!(config.notifications, mode, "{value}");
        let joined = format!("--notifications={value}");
        assert_eq!(parse_args(&args(&[&joined, "app"])).unwrap().notifications, mode, "{joined}");
    }
    for bad in ["", "plasma", "KDE", "freedesktop,kde"] {
        let error = parse_args(&args(&["--notifications", bad, "app"])).err().expect("expected validation error");
        assert!(error.to_string().contains("--notifications"), "{bad:?}: {error}");
    }
}

/// The accent color is absent by default and takes six hexadecimal digits only.
#[test]
fn accent_color_option_takes_six_hex_digits() {
    assert_eq!(parse_args(&args(&["app"])).unwrap().accent_color, None);
    let config = parse_args(&args(&["--accent-color", "3584e4", "--", "app"])).unwrap();
    assert_eq!(config.accent_color.map(|color| return color.to_string()), Some("3584E4".to_string()));
    assert_eq!(config.color_scheme, None);
    for bad in ["", "#3584E4", "3584E", "3584E4FF", "blue"] {
        let error = parse_args(&args(&["--accent-color", bad, "app"])).err().expect("expected validation error");
        let text = error.to_string();
        assert!(text.contains("--accent-color") && text.contains("RRGGBB"), "{bad:?}: {text}");
    }
}

/// The new options leave the child command alone, like every other parent option.
#[test]
fn new_options_stop_at_the_child_command() {
    let config = parse_args(&args(&["--notifications", "kde", "app", "--notifications", "none"])).unwrap();
    assert_eq!(config.notifications, NotificationMode::Kde);
    assert_eq!(config.child_command, ["app", "--notifications", "none"]);
}
