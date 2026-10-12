//! Tests for the pure keyboard mapping in `ui_keys`.

use super::*;

/// What: `input(key)` builds a plain key press with no modifiers.
fn input(key: &str) -> KeyInput {
    return KeyInput {
        key: key.to_string(),
        ctrl: false,
        meta: false,
        alt: false,
        shift: false,
        repeat: false,
        in_popup: false,
    };
}

#[test]
fn owner_is_the_player_only_on_the_player_route() {
    assert_eq!(owner_for(Route::Player), ShortcutOwner::Player);
    assert_eq!(owner_for(Route::Search), ShortcutOwner::Control);
    assert_eq!(owner_for(Route::Settings), ShortcutOwner::Control);
    assert_eq!(owner_for(Route::TemplateEditor), ShortcutOwner::Editor);
}

#[test]
fn search_route_marks_the_request_as_in_search() {
    let request = request_for(&input("Escape"), Route::Search, KeyboardPlatform::WindowsLinux);
    assert!(request.in_search);
    assert_eq!(shortcut_action(&request), ShortcutAction::Back);
}

#[test]
fn space_toggles_playback_on_the_player_route() {
    let request = request_for(&input(" "), Route::Player, KeyboardPlatform::WindowsLinux);
    assert_eq!(shortcut_action(&request), ShortcutAction::Toggle);
}

#[test]
fn space_is_left_to_the_text_field_on_the_search_route() {
    let request = request_for(&input(" "), Route::Search, KeyboardPlatform::WindowsLinux);
    assert_eq!(shortcut_action(&request), ShortcutAction::Owner);
}

#[test]
fn ctrl_arrows_move_between_tracks_on_windows_and_linux() {
    let mut key = input("ArrowRight");
    key.ctrl = true;
    let request = request_for(&key, Route::Player, KeyboardPlatform::WindowsLinux);
    assert_eq!(shortcut_action(&request), ShortcutAction::Next);
}

#[test]
fn ctrl_f_opens_search_and_ctrl_m_cycles_the_mode() {
    let mut find = input("f");
    find.ctrl = true;
    assert_eq!(shortcut_action(&request_for(&find, Route::Player, KeyboardPlatform::WindowsLinux)), ShortcutAction::Search);
    let mut mode = input("m");
    mode.ctrl = true;
    assert_eq!(shortcut_action(&request_for(&mode, Route::Player, KeyboardPlatform::WindowsLinux)), ShortcutAction::Mode);
}

#[test]
fn repeated_space_is_ignored_after_the_first_press() {
    let mut key = input(" ");
    key.repeat = true;
    let request = request_for(&key, Route::Player, KeyboardPlatform::WindowsLinux);
    assert_eq!(shortcut_action(&request), ShortcutAction::IgnoreRepeat);
}

#[test]
fn next_mode_cycles_through_all_four_modes() {
    let mut mode = PlaybackMode::Repeat;
    let mut seen = Vec::new();
    for _ in 0..4 {
        seen.push(mode);
        mode = next_mode(mode);
    }
    assert_eq!(seen, vec![PlaybackMode::Repeat, PlaybackMode::InOrder, PlaybackMode::ShufflePage, PlaybackMode::ShuffleAll]);
    assert_eq!(mode, PlaybackMode::Repeat);
}
