//! Controls for diagnostic line formatting.

use super::*;

/// A diagnostic is one line, whatever its message holds.
#[test]
fn a_diagnostic_is_one_line() {
    assert_eq!(
        diagnostic_line("debug", "recovery", "owner 7 alive"),
        "cli-git debug [recovery] owner 7 alive\n"
    );
    assert_eq!(
        diagnostic_line("warn", "capture", "a\nb\r\nc"),
        "cli-git warn [capture] a b  c\n"
    );
}

/// Only the exact values switch the levels.
#[test]
fn the_switches_need_exact_values() {
    assert!(is_true(std::ffi::OsString::from("true")));
    assert!(!is_true(std::ffi::OsString::from("TRUE")));
    assert!(!is_true(std::ffi::OsString::from("1")));
    assert!(is_false(std::ffi::OsString::from("false")));
    assert!(!is_false(std::ffi::OsString::from("0")));
}
