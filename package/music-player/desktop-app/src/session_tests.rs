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
        page_control_style: PageControlStyle::Md1Tabs,
    };
    let json = serde_json::to_string(&original).unwrap();
    let restored = Session::from_json(&json).unwrap();
    assert_eq!(original, restored);
    assert!(json.contains("\"playback_mode\":\"shuffle_page\""));
    assert!(!json.contains("\"shuffle\""));
    assert!(!json.contains("repeat_track"));
}

/// Empty current input yields first-run defaults.
#[test]
fn empty_json_object_yields_defaults() {
    assert_eq!(Session::from_json("{}").unwrap(), Session::default());
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
        assert_eq!(Session::from_json(&json).unwrap().playback_mode, expected);
    }
}

/// A present current field wins over stale former fields.
#[test]
fn current_playback_mode_wins_over_legacy_fields() {
    let json = r#"{"playback_mode":"shuffle_all","shuffle":"WithinPage","repeat_track":true}"#;
    assert_eq!(
        Session::from_json(json).unwrap().playback_mode,
        PlaybackMode::ShuffleAll,
    );
}

/// Unknown current mode degrades to In order without resurrecting stale values.
#[test]
fn unknown_current_mode_does_not_reuse_legacy_fields() {
    let json = r#"{"playback_mode":"future","shuffle":"All","repeat_track":true}"#;
    assert_eq!(
        Session::from_json(json).unwrap().playback_mode,
        PlaybackMode::InOrder,
    );
}

/// Former track-list files retain unrelated settings while migrating playback.
#[test]
fn old_track_list_format_keeps_settings() {
    let old = r#"{"tracks":["/a.flac"],"current":0,"position_secs":5.0,"volume":0.5,"shuffle":"All","repeat_track":false}"#;
    let parsed = Session::from_json(old).unwrap();
    assert_eq!(parsed.source_root, None);
    assert_eq!(parsed.selected, None);
    assert_eq!(parsed.position_secs, 5.0);
    assert_eq!(parsed.volume, 0.5);
    assert_eq!(parsed.playback_mode, PlaybackMode::ShuffleAll);
}

/// Page-style integer conversion covers every persisted style and its fallback.
#[test]
fn page_control_style_integer_conversion_covers_every_style() {
    assert_eq!(PageControlStyle::default(), PageControlStyle::ChromiumTabs);
    assert_eq!(PageControlStyle::Radio.to_int(), 0);
    assert_eq!(PageControlStyle::Md1Tabs.to_int(), 1);
    assert_eq!(PageControlStyle::RoundedButtons.to_int(), 2);
    assert_eq!(PageControlStyle::SegmentedButtons.to_int(), 3);
    assert_eq!(PageControlStyle::ChromiumTabs.to_int(), 4);
    assert_eq!(PageControlStyle::LedSegmentedButtons.to_int(), 5);
    assert_eq!(PageControlStyle::from_int(0), PageControlStyle::Radio);
    assert_eq!(PageControlStyle::from_int(1), PageControlStyle::Md1Tabs);
    assert_eq!(PageControlStyle::from_int(2), PageControlStyle::RoundedButtons);
    assert_eq!(PageControlStyle::from_int(3), PageControlStyle::SegmentedButtons);
    assert_eq!(PageControlStyle::from_int(4), PageControlStyle::ChromiumTabs);
    assert_eq!(PageControlStyle::from_int(5), PageControlStyle::LedSegmentedButtons);
    assert_eq!(PageControlStyle::from_int(99), PageControlStyle::Radio);
}
