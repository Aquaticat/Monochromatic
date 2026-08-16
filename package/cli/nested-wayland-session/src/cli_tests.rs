//! Focused tests for nested-session color-scheme CLI option.

use super::*;

/// Converts string literals to parser-owned argument values.
fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}

/// Confirms explicit dark and light values enter validated configuration.
#[test]
fn color_scheme_flag_accepts_supported_values() {
    let dark = parse_args(&args(&["--color-scheme", "dark", "--", "app"])).unwrap();
    let light = parse_args(&args(&["--color-scheme", "light", "--", "app"])).unwrap();
    assert_eq!(dark.color_scheme, Some(ColorSchemePreference::Dark));
    assert_eq!(light.color_scheme, Some(ColorSchemePreference::Light));
}

/// Confirms omitted option leaves hosted child on inherited session bus.
#[test]
fn omitted_color_scheme_keeps_portal_override_absent() {
    let config = parse_args(&args(&["app"])).unwrap();
    assert_eq!(config.color_scheme, None);
}

/// Confirms malformed and missing color-scheme values are rejected plainly.
#[test]
fn color_scheme_flag_rejects_invalid_values() {
    let invalid = parse_args(&args(&["--color-scheme", "system", "--", "app"]));
    let missing = parse_args(&args(&["--color-scheme"]));
    assert!(invalid.is_err());
    assert!(missing.is_err());
}
