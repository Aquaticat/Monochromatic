//! Tests for the pure first-run and feedback models in `ui_overlays_model`.

use super::*;
use music_player::feedback::FeedbackMessage;

#[test]
fn first_run_is_hidden_before_the_library_loads() {
    assert_eq!(first_run_view(&ScreenState::default()), None);
}

#[test]
fn first_run_is_hidden_when_the_library_has_tracks() {
    let state = ScreenState {
        loaded: true,
        names: vec!["Abba/one.mp3".to_string()],
        ..ScreenState::default()
    };
    assert_eq!(first_run_view(&state), None);
}

#[test]
fn first_run_shows_open_folder_and_settings_for_an_empty_loaded_library() {
    let state = ScreenState {
        loaded: true,
        ..ScreenState::default()
    };
    let view = first_run_view(&state).expect("an empty loaded library shows the first-run pane");
    assert_eq!(view.primary_label, "Open a folder");
    assert_eq!(view.secondary_labels, vec!["Settings".to_string()]);
    assert!(!view.title.is_empty());
    assert!(view.explanation.is_empty());
}

#[test]
fn feedback_rows_keep_order_kind_and_action_label() {
    let queue = FeedbackQueue::EMPTY
        .show(
            FeedbackMessage::new("error-1", "Copy failed", FeedbackKind::Error, None).expect("valid message"),
            0,
        )
        .show(
            FeedbackMessage::new("undo-1", "Moved to trash", FeedbackKind::Undo, Some("Undo")).expect("valid message"),
            0,
        );
    let rows = feedback_rows(&queue);
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].id, "undo-1");
    assert_eq!(rows[0].kind, 1);
    assert_eq!(rows[0].action_label, "Undo");
    assert_eq!(rows[1].id, "error-1");
    assert_eq!(rows[1].kind, 0);
    assert_eq!(rows[1].action_label, "");
}
