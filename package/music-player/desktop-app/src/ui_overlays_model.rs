//! Pure models for the first-run pane and the feedback messages.
//!
//! What: `first_run_view` decides whether the first-run pane replaces the track area and what it says;
//! `feedback_items` turns the visible feedback messages into plain rows.
//! Why: the decisions stay testable without a window, and the window only places the values.

use music_player::feedback::{FeedbackKind, FeedbackQueue};
use music_player::first_run::{ANALYSIS_EXPLANATION, FirstRunState, first_run_copy};

use crate::ui_screen_view::ScreenState;

/// What: `FirstRunView` is the copy and actions of the first-run pane.
/// Why: the pane takes plain strings, and the Rust copy module supplies them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type FirstRunView = { title: string; body: string; primaryLabel: string; secondaryLabels: string[]; explanation: string };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FirstRunView {
    /// Headline of the pane.
    pub title: String,
    /// Explanation of the open source and what the actions do.
    pub body: String,
    /// Label of the filled action, or empty.
    pub primary_label: String,
    /// Labels of the outlined actions, in order.
    pub secondary_labels: Vec<String>,
    /// True-peak explanation, or empty when the copy has none.
    pub explanation: String,
}

/// What: `first_run_view` returns the first-run pane once the library has loaded and holds no tracks.
/// Why: an empty library is the only first-run case on desktop; the pane replaces the track area until a folder has audio.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const firstRunView = (s: ScreenState): FirstRunView | null => s.loaded && s.names.length === 0 ? copy : null;
/// ```
pub fn first_run_view(state: &ScreenState) -> Option<FirstRunView> {
    if !state.loaded || !state.names.is_empty() {
        return None;
    }
    let copy = first_run_copy(FirstRunState::SystemNoAudio, None).ok()?;
    return Some(FirstRunView {
        title: copy.title,
        body: copy.body,
        primary_label: copy.primary_action.unwrap_or("").to_string(),
        secondary_labels: copy.secondary_actions.iter().map(|label| return label.to_string()).collect(),
        explanation: if copy.explains_analysis { ANALYSIS_EXPLANATION.to_string() } else { String::new() },
    });
}

/// What: `FeedbackRow` is one visible feedback message as plain values.
/// Why: the overlay takes an id, text, a kind number and an action label per message.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type FeedbackRow = { id: string; text: string; kind: 0 | 1; actionLabel: string };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeedbackRow {
    /// Stable key the window reports dismiss and action with.
    pub id: String,
    /// Message text.
    pub text: String,
    /// 0 for an error, 1 for an Undo message.
    pub kind: i32,
    /// Action button label, or empty.
    pub action_label: String,
}

/// What: `feedback_rows` lists the visible messages in display order.
/// Why: the queue keeps its own order, and expired messages are already removed by the queue.
pub fn feedback_rows(queue: &FeedbackQueue) -> Vec<FeedbackRow> {
    return queue
        .visible()
        .iter()
        .map(|message| return FeedbackRow {
            id: message.id().to_string(),
            text: message.text().to_string(),
            kind: match message.kind() {
                FeedbackKind::Error => 0,
                FeedbackKind::Undo => 1,
            },
            action_label: message.action_label().unwrap_or("").to_string(),
        })
        .collect();
}

#[cfg(test)]
#[path = "ui_overlays_model_tests.rs"]
mod tests;
