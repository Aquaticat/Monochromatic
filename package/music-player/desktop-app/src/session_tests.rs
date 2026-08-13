// What:     Unit tests for `session.rs`, pulled in by
//           `#[cfg(test)] #[path = "session_tests.rs"] mod tests;` at the bottom of
//           `session.rs`. Compiles only under `cargo nextest run` / `cargo test`;
//           reaches the module items via `use super::*` because this file is the
//           `tests` CHILD of session.
// Why:      Keep the tests beside the code without inflating `session.rs` or its
//           max-lines budget (sibling `*_tests.rs` files are exempt from the linter).

// What:     `use super::*;` bring the module's items into the test scope.
// Why:      Tests need `Session`, `ShuffleMode`, `PathBuf`.
use super::*;

// What:     `#[test] fn json_round_trip_preserves_fields()`. Serialize a fully-populated
//           session and parse it back.
// Why:      Every field (source root, selection, settings) must survive the wire form.
#[test]
fn json_round_trip_preserves_fields() {
    // What:     build a non-default session literal with a root and a selection.
    // Why:      Exercise serialization of every field.
    let original = Session {
        source_root: Some(PathBuf::from("/music/Artist")),
        selected: Some(PathBuf::from("/music/Artist/01.flac")),
        position_secs: 12.5,
        volume: 0.7,
        shuffle: ShuffleMode::WithinPage,
        repeat_track: true,
        page_control_style: PageControlStyle::Md1Tabs,
    };
    // What:     `serde_json::to_string(&original).unwrap()` serializes to JSON; `.unwrap()`
    //           panics on error (fine in a test).
    // Why:      Produce the wire form.
    let json = serde_json::to_string(&original).unwrap();
    // What:     `serde_json::from_str::<Session>(&json).unwrap()` parses it back.
    // Why:      Round-trip the value.
    let back = serde_json::from_str::<Session>(&json).unwrap();
    // What:     `assert_eq!(original, back)` via the derived `PartialEq`.
    // Why:      No field is lost or altered by the round-trip.
    assert_eq!(original, back);
}

// What:     `#[test] fn none_root_and_selection_round_trip()`. A default session (no root,
//           nothing cued) must serialize and parse back unchanged.
// Why:      The first-run / nothing-loaded state is the common case and must round-trip.
#[test]
fn none_root_and_selection_round_trip() {
    // What:     `Session::default()` the empty starting state.
    // Why:      Exercise the `None` source root and selection.
    let original = Session::default();
    // What:     serialize then parse back.
    // Why:      Confirm `None` fields survive.
    let back = serde_json::from_str::<Session>(&serde_json::to_string(&original).unwrap()).unwrap();
    // What:     equal to the original, with both optionals `None`.
    // Why:      No drift on the empty state.
    assert_eq!(back, original);
    assert_eq!(back.source_root, None);
    assert_eq!(back.selected, None);
}

// What:     `#[test] fn empty_json_object_yields_defaults()`. Parsing `{}` must produce the
//           default session.
// Why:      `#[serde(default)]` fills every missing field, so a truncated/empty file is
//           tolerated rather than failing the restore.
#[test]
fn empty_json_object_yields_defaults() {
    // What:     parse an empty JSON object.
    // Why:      Every field is absent, so all default.
    let parsed = serde_json::from_str::<Session>("{}").unwrap();
    // What:     equals the default session.
    // Why:      Confirms the `#[serde(default)]` fallback.
    assert_eq!(parsed, Session::default());
}

// What:     `#[test] fn old_track_list_format_degrades_to_no_root_but_keeps_settings()`.
//           A session written by the pre-source-root build carried `tracks`/`current`.
// Why:      Those obsolete fields must be ignored, the absent `source_root`/`selected`
//           default to `None` (so launch falls through to the music directory), and the
//           saved settings must still be read.
#[test]
fn old_track_list_format_degrades_to_no_root_but_keeps_settings() {
    // What:     a hand-written old-format JSON (shuffle omitted so the test does not depend
    //           on the enum's serialized spelling; it defaults to `Off`).
    // Why:      Reproduce a session file from the previous schema.
    let old = r#"{"tracks":["/a.flac","/b.opus"],"current":1,"position_secs":5.0,"volume":0.5,"repeat_track":true}"#;
    // What:     parse it as the new `Session`.
    // Why:      Confirm graceful degradation.
    let parsed = serde_json::from_str::<Session>(old).unwrap();
    // What:     no usable root and no selection survive the old format.
    // Why:      The obsolete `tracks`/`current` cannot become a root; launch must fall back.
    assert_eq!(parsed.source_root, None);
    assert_eq!(parsed.selected, None);
    // What:     the saved settings are still read.
    // Why:      Volume/position/repeat persistence must not regress for old files.
    assert_eq!(parsed.position_secs, 5.0);
    assert_eq!(parsed.volume, 0.5);
    assert!(parsed.repeat_track);
    // What:     omitted shuffle defaults to `Off`.
    // Why:      Confirms missing fields fall back rather than failing the parse.
    assert_eq!(parsed.shuffle, ShuffleMode::Off);
    // Missing page-control preferences from older sessions default to radio controls.
    assert_eq!(parsed.page_control_style, PageControlStyle::Radio);
}


// What:     `#[test] fn page_control_style_integer_conversion_covers_every_style()`.
//           Exercise all named styles plus an invalid Slint integer.
// Why:      The UI boundary must preserve every settings choice and make radio controls
//           the safe default for stale or invalid values.
#[test]
fn page_control_style_integer_conversion_covers_every_style() {
    assert_eq!(PageControlStyle::Radio.to_int(), 0);
    assert_eq!(PageControlStyle::Md1Tabs.to_int(), 1);
    assert_eq!(PageControlStyle::RoundedButtons.to_int(), 2);
    assert_eq!(PageControlStyle::SegmentedButtons.to_int(), 3);
    assert_eq!(PageControlStyle::ChromiumTabs.to_int(), 4);
    assert_eq!(PageControlStyle::from_int(0), PageControlStyle::Radio);
    assert_eq!(PageControlStyle::from_int(1), PageControlStyle::Md1Tabs);
    assert_eq!(PageControlStyle::from_int(2), PageControlStyle::RoundedButtons);
    assert_eq!(PageControlStyle::from_int(3), PageControlStyle::SegmentedButtons);
    assert_eq!(PageControlStyle::from_int(4), PageControlStyle::ChromiumTabs);
    assert_eq!(PageControlStyle::from_int(99), PageControlStyle::Radio);
}
