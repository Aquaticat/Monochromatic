//! Wires the page-control style preference between Slint and the saved desktop session.

/// What:     `use crate::AppWindow` imports the generated Slint window type from the
///           binary crate root.
/// Why:      The bridge reads and registers properties on that window.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { AppWindow } from './main';
/// ```
use crate::AppWindow;

/// What:     `use music_player::session::{PageControlStyle, Session}` imports the named
///           preference variants and persisted session record.
/// Why:      The bridge converts Slint integers and saves each selection.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { PageControlStyle, Session } from 'music-player/session';
/// ```
use music_player::session::{PageControlStyle, Session};

/// What:     `apply` restores the selected page-control style, then registers the
///           callback that persists later settings-page selections.
/// Why:      Keep UI-only preference wiring outside playback code and under the Rust
///           source-line budget.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function apply(app: AppWindow): void { ... }
/// ```
pub(crate) fn apply(app: &AppWindow) {
    // Load and display the saved preference. Missing and older sessions default to radio.
    app.set_page_control_style(Session::load().page_control_style.to_int());
    // Persist only the page-control field while retaining the latest playback session.
    app.on_set_page_control_style(move |style| {
        let mut session = Session::load();
        session.page_control_style = PageControlStyle::from_int(style);
        if let Err(error) = session.save() {
            tracing::warn!(%error, "page-control style save failed");
        }
    });
}
