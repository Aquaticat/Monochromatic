//! Playback-mode conversion and displayed-page scope helpers for the generated UI.

/// What:     `PlaybackMode` is the engine's four-state enum.
/// Why:      Slint carries an integer while commands carry the named Rust value.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import type { PlaybackMode } from "./command";
/// ```
use music_player::command::PlaybackMode;

/// What:     `Model` exposes iteration over generated Slint list properties.
/// Why:      Page-scope calculation reads the complete queue model from AppWindow.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import type { Model } from "slint";
/// ```
use slint::Model;

/// What:     Generated window type imported from the binary crate root.
/// Why:      Page-scope calculation reads selected-page source data from the UI.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import type { AppWindow } from "./generated";
/// ```
use crate::AppWindow;

/// Converts a named mode to the stable Slint integer order.
pub(crate) fn playback_mode_to_int(mode: PlaybackMode) -> i32 {
    if mode == PlaybackMode::Repeat {
        return 0;
    }
    if mode == PlaybackMode::InOrder {
        return 1;
    }
    if mode == PlaybackMode::ShufflePage {
        return 2;
    }
    return 3;
}

/// Converts a Slint integer to a mode with In order as the defensive default.
pub(crate) fn int_to_playback_mode(value: i32) -> PlaybackMode {
    if value == 0 {
        return PlaybackMode::Repeat;
    }
    if value == 2 {
        return PlaybackMode::ShufflePage;
    }
    if value == 3 {
        return PlaybackMode::ShuffleAll;
    }
    return PlaybackMode::InOrder;
}

/// Resolves a reconciled page by prior label, falling back to its prior index.
pub(crate) fn kept_page(app: &AppWindow, pages: &[music_player::pagination::Page]) -> i32 {
    let previous_page = app.get_selected_page();
    if previous_page < 0 {
        return previous_page;
    }
    let previous_identity = app.get_selected_page_key();
    return pages
        .iter()
        .position(|page| {
            return music_player::pagination::page_identity(page) == previous_identity.as_str();
        })
        .map_or(previous_page, |page| return page as i32);
}

/// Returns load-order indices belonging to one displayed page.
pub(crate) fn page_scope(app: &AppWindow, page: i32) -> Vec<usize> {
    let names: Vec<String> = app
        .get_queue()
        .iter()
        .map(|name| return name.to_string())
        .collect();
    let pages = music_player::pagination::paginate(&names);
    if page < 0 {
        return Vec::new();
    }
    let Some(selected) = pages.get(page as usize) else {
        return Vec::new();
    };
    return selected.entries.iter().map(|entry| return entry.index).collect();
}
