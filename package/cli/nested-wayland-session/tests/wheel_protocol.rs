//! Real-wheel parsing covers boundaries before any synthetic input is emitted.

/// The wire parser is the same interface the Unix control socket consumes.
use nested_wayland_session::protocol::{parse_command, Command};

/// Positive and negative notch counts preserve direction and coordinates.
#[test]
fn wheel_fields_are_explicit() {
    assert_eq!(parse_command("wheel 120.5 300 0 1").unwrap(),
        Command::Wheel { x: 120.5, y: 300.0, horizontal: 0, vertical: 1 });
    assert_eq!(parse_command("wheel 10 20 -2 -3").unwrap(),
        Command::Wheel { x: 10.0, y: 20.0, horizontal: -2, vertical: -3 });
}

/// Malformed commands never reach pointer injection.
#[test]
fn wheel_rejects_missing_extra_and_nonfinite_values() {
    for command in [
        "wheel", "wheel 1 2", "wheel 1 2 0",
        "wheel NaN 2 0 1", "wheel 1 inf 0 1",
        "wheel 1 2 0 0.5", "wheel 1 2 0 2147483647",
        "wheel 1 2 0 1 extra", "wheel 1 2 0 1\nquit",
    ] {
        assert!(parse_command(command).is_err(), "{command}");
    }
}
