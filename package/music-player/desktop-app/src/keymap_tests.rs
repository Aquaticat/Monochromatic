// What:     Unit tests for `keymap.rs`, pulled in by
//           `#[cfg(test)] #[path = "keymap_tests.rs"] mod tests;` at the bottom of `keymap.rs`.
//           Each row of the Kotlin `KeyboardMapTest` is mirrored with the same input and expected action.
// Why:      Keep the tests beside the code. Each assertion message names the row it mirrors.

// What:     `use super::*;` imports everything from the parent module into the test scope.
// Why:      Tests need the enums, `ShortcutRequest`, `shortcut_action`, and `KeymapError`.
use super::*;

// What:     `fn base_request() -> ShortcutRequest` builds the Windows and Linux Space key with no other state.
// Why:      Each row changes only the fields it names, so one shared starting request keeps rows honest.
//
// In TS you'd write (pseudocode):
// ```ts
// const base = { platform: "windows-linux", key: " ", ctrl: false, ..., owner: "player", ... };
// ```
fn base_request() -> ShortcutRequest {
    return ShortcutRequest {
        platform: KeyboardPlatform::WindowsLinux,
        key: " ".to_owned(),
        ctrl: false,
        meta: false,
        alt: false,
        shift: false,
        repeat: false,
        owner: ShortcutOwner::Player,
        in_popup: false,
        in_search: false,
        in_settings: false,
        composing: false,
    };
}

// What:     `fn assert_action(row, expected, request)` classifies one request and compares the result.
// Why:      One helper keeps each row to a single line, and the row text appears in any failure message.
//
// In TS you'd write (pseudocode):
// ```ts
// function assertAction(row: string, expected: ShortcutAction, request: ShortcutRequest): void {
//   expect(shortcutAction(request), row).toBe(expected);
// }
// ```
fn assert_action(row: &str, expected: ShortcutAction, request: &ShortcutRequest) {
    assert_eq!(shortcut_action(request), expected, "{row}");
}

// What:     `fn assert_rejects_platform(name)` checks that the parser rejects one name with the prototype's message.
// Why:      The prototype throws for unknown platforms, and the enum parser must reject them with the same text.
//
// In TS you'd write (pseudocode):
// ```ts
// function assertRejectsPlatform(name: string): void {
//   expect(() => parsePlatform(name)).toThrow("Unknown keyboard-map platform.");
// }
// ```
fn assert_rejects_platform(name: &str) {
    let error = KeyboardPlatform::from_name(name).expect_err("unknown platform names must be rejected");
    assert_eq!(
        error.to_string(),
        "Unknown keyboard-map platform.",
        "message for platform name '{name}'"
    );
}

// What:     `#[test] fn guard_keeps_surface_keys_unbound()` checks the player-owner guard.
// Why:      A surface key stays unbound, so it cannot change playback.
#[test]
fn guard_keeps_surface_keys_unbound() {
    assert_action(
        "guard 1: surface owner stays unbound",
        ShortcutAction::Unbound,
        &ShortcutRequest { owner: ShortcutOwner::Surface, ..base_request() },
    );
}

// What:     `#[test] fn guard_keeps_composition_keys_with_their_owner()` checks the composition guard.
// Why:      A composing key stays with its owner.
#[test]
fn guard_keeps_composition_keys_with_their_owner() {
    assert_action(
        "guard 2: composing Ctrl+F stays with its owner",
        ShortcutAction::Owner,
        &ShortcutRequest { key: "f".to_owned(), ctrl: true, composing: true, ..base_request() },
    );
}

// What:     `#[test] fn guard_keeps_popup_keys_with_their_owner()` checks the popup guard.
// Why:      A key pressed while a popup is open stays with the popup.
#[test]
fn guard_keeps_popup_keys_with_their_owner() {
    assert_action(
        "guard 3: popup key stays with its owner",
        ShortcutAction::Owner,
        &ShortcutRequest { in_popup: true, ..base_request() },
    );
}

// What:     `#[test] fn common_player_rows_classify_as_expected()` checks toggle, owner, repeat, and unbound arrows.
// Why:      These are the common player and control keys.
#[test]
fn common_player_rows_classify_as_expected() {
    assert_action("row 1: Space toggles", ShortcutAction::Toggle, &base_request());
    assert_action(
        "row 2: editor keeps its key",
        ShortcutAction::Owner,
        &ShortcutRequest { owner: ShortcutOwner::Editor, ..base_request() },
    );
    assert_action(
        "row 3: control keeps its key",
        ShortcutAction::Owner,
        &ShortcutRequest { owner: ShortcutOwner::Control, ..base_request() },
    );
    assert_action(
        "row 4: repeated player key is ignored",
        ShortcutAction::IgnoreRepeat,
        &ShortcutRequest { repeat: true, ..base_request() },
    );
    assert_action(
        "row 11: bare ArrowDown is unbound",
        ShortcutAction::Unbound,
        &ShortcutRequest { key: "ArrowDown".to_owned(), ..base_request() },
    );
}

// What:     `#[test] fn windows_linux_rows_classify_as_expected()` checks the Windows and Linux shortcuts.
// Why:      Search, picker, Settings, previous and next, reveal, and mode each have one chord on this map.
#[test]
fn windows_linux_rows_classify_as_expected() {
    assert_action(
        "row 5: Ctrl+F opens Search",
        ShortcutAction::Search,
        &ShortcutRequest { key: "f".to_owned(), ctrl: true, ..base_request() },
    );
    assert_action(
        "row 6: Ctrl+O opens picker",
        ShortcutAction::Picker,
        &ShortcutRequest { key: "o".to_owned(), ctrl: true, ..base_request() },
    );
    assert_action(
        "row 7: Ctrl+Alt+S opens Settings",
        ShortcutAction::Settings,
        &ShortcutRequest { key: "s".to_owned(), ctrl: true, alt: true, ..base_request() },
    );
    assert_action(
        "row 8: Ctrl+ArrowLeft goes to previous",
        ShortcutAction::Previous,
        &ShortcutRequest { key: "ArrowLeft".to_owned(), ctrl: true, ..base_request() },
    );
    assert_action(
        "row 9: Ctrl+ArrowRight goes to next",
        ShortcutAction::Next,
        &ShortcutRequest { key: "ArrowRight".to_owned(), ctrl: true, ..base_request() },
    );
    assert_action(
        "row 10: editor keeps Ctrl+ArrowLeft",
        ShortcutAction::Owner,
        &ShortcutRequest {
            key: "ArrowLeft".to_owned(),
            ctrl: true,
            owner: ShortcutOwner::Editor,
            ..base_request()
        },
    );
    assert_action(
        "row 22: Ctrl+G reveals current track",
        ShortcutAction::Reveal,
        &ShortcutRequest { key: "g".to_owned(), ctrl: true, ..base_request() },
    );
    assert_action(
        "row 23: Ctrl+M cycles mode",
        ShortcutAction::Mode,
        &ShortcutRequest { key: "m".to_owned(), ctrl: true, ..base_request() },
    );
}

// What:     `#[test] fn mac_rows_classify_as_expected()` checks the macOS shortcuts.
// Why:      Command replaces Control on this map, and Control plus arrows is unbound.
#[test]
fn mac_rows_classify_as_expected() {
    let mac = KeyboardPlatform::Mac;
    assert_action(
        "row 12: mac Control+ArrowRight is unbound",
        ShortcutAction::Unbound,
        &ShortcutRequest { platform: mac, key: "ArrowRight".to_owned(), ctrl: true, ..base_request() },
    );
    assert_action(
        "row 13: mac Command+F opens Search",
        ShortcutAction::Search,
        &ShortcutRequest { platform: mac, key: "f".to_owned(), meta: true, ..base_request() },
    );
    assert_action(
        "row 14: mac Command+O opens picker",
        ShortcutAction::Picker,
        &ShortcutRequest { platform: mac, key: "o".to_owned(), meta: true, ..base_request() },
    );
    assert_action(
        "row 15: mac Command+Comma opens Settings",
        ShortcutAction::Settings,
        &ShortcutRequest { platform: mac, key: ",".to_owned(), meta: true, ..base_request() },
    );
    assert_action(
        "row 16: mac Command+L reveals current track",
        ShortcutAction::Reveal,
        &ShortcutRequest { platform: mac, key: "l".to_owned(), meta: true, ..base_request() },
    );
    assert_action(
        "row 17: mac Command+Shift+[ goes to previous",
        ShortcutAction::Previous,
        &ShortcutRequest { platform: mac, key: "[".to_owned(), meta: true, shift: true, ..base_request() },
    );
    assert_action(
        "row 18: mac Command+Shift+] goes to next",
        ShortcutAction::Next,
        &ShortcutRequest { platform: mac, key: "]".to_owned(), meta: true, shift: true, ..base_request() },
    );
    assert_action(
        "row 24: mac Command+M is unbound",
        ShortcutAction::Unbound,
        &ShortcutRequest { platform: mac, key: "m".to_owned(), meta: true, ..base_request() },
    );
}

// What:     `#[test] fn popup_search_and_unbound_rows_classify_as_expected()` checks popup, Search, and unbound rows.
// Why:      Mixed-modifier letter combinations must stay unbound, and Escape has popup and Search meanings.
#[test]
fn popup_search_and_unbound_rows_classify_as_expected() {
    assert_action(
        "row 19: Escape closes popup",
        ShortcutAction::ClosePopup,
        &ShortcutRequest { key: "Escape".to_owned(), in_popup: true, ..base_request() },
    );
    assert_action(
        "row 20: Ctrl+F in popup stays with the popup",
        ShortcutAction::Owner,
        &ShortcutRequest { key: "f".to_owned(), ctrl: true, in_popup: true, ..base_request() },
    );
    assert_action(
        "row 21: Escape in Search from an editor returns back",
        ShortcutAction::Back,
        &ShortcutRequest {
            key: "Escape".to_owned(),
            owner: ShortcutOwner::Editor,
            in_search: true,
            ..base_request()
        },
    );
    assert_action(
        "row 25: Ctrl+Command+F is unbound",
        ShortcutAction::Unbound,
        &ShortcutRequest { key: "f".to_owned(), ctrl: true, meta: true, ..base_request() },
    );
    assert_action(
        "row 26: Ctrl+Shift+F is unbound",
        ShortcutAction::Unbound,
        &ShortcutRequest { key: "f".to_owned(), ctrl: true, shift: true, ..base_request() },
    );
}

// What:     `#[test] fn parses_stored_platform_names_to_their_maps()` checks the two stored names.
// Why:      The prototype's platform names must parse to the matching enum entries.
#[test]
fn parses_stored_platform_names_to_their_maps() {
    assert_eq!(
        KeyboardPlatform::from_name("windows-linux"),
        Ok(KeyboardPlatform::WindowsLinux),
        "platform name windows-linux"
    );
    assert_eq!(KeyboardPlatform::from_name("mac"), Ok(KeyboardPlatform::Mac), "platform name mac");
}

// What:     `#[test] fn rejects_unknown_platform_names_with_the_prototype_message()` checks rejection.
// Why:      Unknown, differently cased, and empty platform names must all fail with the prototype's message.
#[test]
fn rejects_unknown_platform_names_with_the_prototype_message() {
    assert_rejects_platform("unknown");
    assert_rejects_platform("Mac");
    assert_rejects_platform("");
}

// What:     `#[test] fn wire_names_match_the_prototype_spelling()` checks the action text.
// Why:      Extra coverage for `wire_name`, which no Kotlin test reaches directly.
#[test]
fn wire_names_match_the_prototype_spelling() {
    assert_eq!(ShortcutAction::IgnoreRepeat.wire_name(), "ignore-repeat");
    assert_eq!(ShortcutAction::ClosePopup.wire_name(), "close-popup");
    assert_eq!(ShortcutAction::Toggle.wire_name(), "toggle");
    assert_eq!(KeyboardPlatform::Mac.stored_name(), "mac");
}

// What:     `#[test] fn escape_closes_settings_only_while_settings_is_visible_and_no_line_is_edited()`
//           checks the Settings meaning of Escape (D110).
// Why:      Escape leaves the Settings page from either form, but never while a template line is being edited, and a
//           popup still takes Escape first.
#[test]
fn escape_closes_settings_only_while_settings_is_visible_and_no_line_is_edited() {
    let escape = || return "Escape".to_owned();
    assert_action(
        "settings: Escape on the visible Settings page goes back",
        ShortcutAction::Back,
        &ShortcutRequest { key: escape(), owner: ShortcutOwner::Control, in_settings: true, ..base_request() },
    );
    assert_action(
        "settings: Escape while a template line is edited stays with the field",
        ShortcutAction::Owner,
        &ShortcutRequest { key: escape(), owner: ShortcutOwner::Editor, in_settings: false, ..base_request() },
    );
    assert_action(
        "settings: Escape in an open popup closes the popup first",
        ShortcutAction::ClosePopup,
        &ShortcutRequest { key: escape(), owner: ShortcutOwner::Control, in_settings: true, in_popup: true, ..base_request() },
    );
    assert_action(
        "settings: another key on the Settings page stays with the page",
        ShortcutAction::Owner,
        &ShortcutRequest { key: "ArrowDown".to_owned(), owner: ShortcutOwner::Control, in_settings: true, ..base_request() },
    );
}
