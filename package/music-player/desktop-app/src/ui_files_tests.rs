//! Tests for the pure parts of `ui_files`: the error wording and the Undo capability flag.

use super::*;

#[test]
fn no_parent_error_names_the_path() {
    let message = FileActionError::NoParent(PathBuf::from("/")).to_string();
    assert!(message.contains('/'));
}

#[test]
fn spawn_error_names_the_program_detail() {
    let message = FileActionError::Spawn("xdg-open: not found".to_string()).to_string();
    assert!(message.contains("xdg-open: not found"));
}

#[test]
fn restore_capability_matches_the_trash_crate_platforms() {
    let expected = cfg!(any(
        windows,
        all(unix, not(any(target_os = "macos", target_os = "ios", target_os = "android")))
    ));
    assert_eq!(can_restore_from_trash(), expected);
}
