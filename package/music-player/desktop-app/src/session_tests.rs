// Session migration and current-wire tests. This file is a child of session.rs.

// Bring parent module declarations into the test module.
use super::*;

/// Current JSON round-trips every field and emits only one playback setting.
#[test]
fn current_json_round_trip_preserves_fields() {
    let original = Session {
        source_root: Some(PathBuf::from("/music/Artist")),
        selected: Some(PathBuf::from("/music/Artist/01.flac")),
        position_secs: 12.5,
        volume: 0.7,
        playback_mode: PlaybackMode::ShufflePage,
        track_rows_template: Some("$mi(title)$".to_string()),
        playing_template: None,
        auto_play_on_select: true,
    };
    let json = serde_json::to_string(&original).expect("current session should serialize");
    let restored = Session::from_json(&json).expect("serialized session should parse");
    assert_eq!(original, restored);
    assert!(json.contains("\"playback_mode\":\"shuffle_page\""));
    assert!(!json.contains("\"shuffle\""));
    assert!(!json.contains("repeat_track"));
}

/// Empty current input yields first-run defaults.
#[test]
fn empty_json_object_yields_defaults() {
    assert_eq!(
        Session::from_json("{}").expect("empty session object should parse"),
        Session::default(),
    );
}

/// Every former shuffle and repeat combination maps according to issue 460.
#[test]
fn every_legacy_combination_migrates() {
    let cases = [
        ("Off", false, PlaybackMode::InOrder),
        ("WithinPage", false, PlaybackMode::ShufflePage),
        ("All", false, PlaybackMode::ShuffleAll),
        ("Off", true, PlaybackMode::Repeat),
        ("WithinPage", true, PlaybackMode::Repeat),
        ("All", true, PlaybackMode::Repeat),
    ];
    for (shuffle, repeat_track, expected) in cases {
        let json = format!(
            "{{\"shuffle\":\"{shuffle}\",\"repeat_track\":{repeat_track}}}"
        );
        assert_eq!(
            Session::from_json(&json)
                .expect("legacy session should parse")
                .playback_mode,
            expected,
        );
    }
}

/// A present current field wins over stale former fields.
#[test]
fn current_playback_mode_wins_over_legacy_fields() {
    let json = r#"{"playback_mode":"shuffle_all","shuffle":"WithinPage","repeat_track":true}"#;
    assert_eq!(
        Session::from_json(json)
            .expect("current session should parse")
            .playback_mode,
        PlaybackMode::ShuffleAll,
    );
}

/// Unknown current mode degrades to In order without resurrecting stale values.
#[test]
fn unknown_current_mode_does_not_reuse_legacy_fields() {
    let json = r#"{"playback_mode":"future","shuffle":"All","repeat_track":true}"#;
    assert_eq!(
        Session::from_json(json)
            .expect("forward-version session should parse")
            .playback_mode,
        PlaybackMode::InOrder,
    );
}

/// Explicit null is a present current field and must not resurrect former state.
#[test]
fn null_current_mode_does_not_reuse_legacy_fields() {
    let json = r#"{"playback_mode":null,"shuffle":"All","repeat_track":true}"#;
    assert_eq!(
        Session::from_json(json)
            .expect("null-mode session should parse")
            .playback_mode,
        PlaybackMode::InOrder,
    );
}

/// Former track-list files retain unrelated settings while migrating playback.
#[test]
fn old_track_list_format_keeps_settings() {
    let old = r#"{"tracks":["/a.flac"],"current":0,"position_secs":5.0,"volume":0.5,"shuffle":"All","repeat_track":false}"#;
    let parsed = Session::from_json(old).expect("former track-list session should parse");
    assert_eq!(parsed.source_root, None);
    assert_eq!(parsed.selected, None);
    assert_eq!(parsed.position_secs, 5.0);
    assert_eq!(parsed.volume, 0.5);
    assert_eq!(parsed.playback_mode, PlaybackMode::ShuffleAll);
}


/// A session file written before the page style was removed still loads, and the key is not written again (VD7).
#[test]
fn the_removed_page_control_style_key_is_ignored_on_read_and_absent_from_new_writes() {
    let old = r#"{"source_root":"/music","volume":0.5,"playback_mode":"in_order","page_control_style":"Md1Tabs"}"#;
    let loaded = Session::from_json(old).expect("a file with the old key still parses");
    assert_eq!(loaded.source_root, Some(PathBuf::from("/music")));
    assert!((loaded.volume - 0.5).abs() < f32::EPSILON);
    let written = serde_json::to_string(&loaded).expect("the session serializes");
    assert!(!written.contains("page_control_style"), "new writes drop the key: {written}");
    let unknown_style = Session::from_json(r#"{"page_control_style":7,"volume":0.25}"#).expect("any value of the old key is ignored");
    assert!((unknown_style.volume - 0.25).abs() < f32::EPSILON);
}

/// A directory of its own for one test, so no test touches the user's session file. nextest runs each test in its own
/// process, and the name carries the test and the clock besides.
fn scratch_file(test: &str) -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("the clock is after the epoch")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("mp_session_{test}_{nanos}"));
    std::fs::create_dir_all(&dir).expect("the scratch directory is created");
    return dir.join("session.json");
}

/// Auto-play on select is off for a first run and for an empty object (D129).
#[test]
fn auto_play_on_select_is_off_by_default() {
    assert!(!Session::default().auto_play_on_select);
    assert!(!Session::from_json("{}").expect("empty object parses").auto_play_on_select);
}

/// A file written before the setting existed reads off and keeps its other values.
#[test]
fn a_file_without_the_field_reads_off_and_still_loads() {
    let old = r#"{"source_root":"/music","volume":0.5,"playback_mode":"shuffle_all","track_rows_template":"$mi(title)$"}"#;
    let loaded = Session::from_json(old).expect("a file without the field parses");
    assert!(!loaded.auto_play_on_select);
    assert_eq!(loaded.source_root, Some(PathBuf::from("/music")));
    assert_eq!(loaded.playback_mode, PlaybackMode::ShuffleAll);
    assert_eq!(loaded.track_rows_template.as_deref(), Some("$mi(title)$"));
}

/// The field is written and read back, in the current JSON and through a real file.
#[test]
fn auto_play_on_select_round_trips_through_json_and_a_file() {
    let on = Session { auto_play_on_select: true, ..Session::default() };
    let json = serde_json::to_string(&on).expect("the session serializes");
    assert!(json.contains("\"auto_play_on_select\":true"), "{json}");
    assert!(Session::from_json(&json).expect("it parses").auto_play_on_select);

    let path = scratch_file("round_trip");
    assert!(!Session::load_at(&path).auto_play_on_select, "no file reads off");
    Session::save_auto_play_on_select_at(&path, true).expect("the setting is saved");
    assert!(Session::load_at(&path).auto_play_on_select, "the saved on reads on");
    Session::save_auto_play_on_select_at(&path, false).expect("the setting is saved again");
    assert!(!Session::load_at(&path).auto_play_on_select, "the saved off reads off");
}

/// Saving the setting leaves the playback fields and the templates of an existing file as they were.
#[test]
fn saving_the_setting_keeps_the_rest_of_an_existing_file() {
    let path = scratch_file("keeps_rest");
    std::fs::write(
        &path,
        r#"{"source_root":"/music","selected":"/music/a.flac","position_secs":9.5,"volume":0.25,"playback_mode":"repeat","track_rows_template":"$mi(title)$","playing_template":"$mi(track)$"}"#,
    )
    .expect("the old file is written");
    Session::save_auto_play_on_select_at(&path, true).expect("the setting is saved");
    let after = Session::load_at(&path);
    assert!(after.auto_play_on_select);
    assert_eq!(after.source_root, Some(PathBuf::from("/music")));
    assert_eq!(after.selected, Some(PathBuf::from("/music/a.flac")));
    assert!((after.position_secs - 9.5).abs() < f64::EPSILON);
    assert!((after.volume - 0.25).abs() < f32::EPSILON);
    assert_eq!(after.playback_mode, PlaybackMode::Repeat);
    assert_eq!(after.track_rows_template.as_deref(), Some("$mi(title)$"));
    assert_eq!(after.playing_template.as_deref(), Some("$mi(track)$"));
}

/// A legacy file that still needs the playback migration keeps working with the new field present or absent.
#[test]
fn the_migration_rewrite_keeps_the_setting() {
    let path = scratch_file("migration");
    std::fs::write(&path, r#"{"shuffle":"All","repeat_track":false,"auto_play_on_select":true}"#)
        .expect("the legacy file is written");
    let loaded = Session::load_at(&path);
    assert_eq!(loaded.playback_mode, PlaybackMode::ShuffleAll);
    assert!(loaded.auto_play_on_select);
    let rewritten = Session::load_at(&path);
    assert!(rewritten.auto_play_on_select, "the rewrite did not drop the setting");
    assert!(std::fs::read_to_string(&path).expect("the file exists").contains("\"playback_mode\""));
}
