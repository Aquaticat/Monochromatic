//! The window's observable state as one log line, for the end-to-end run.
//!
//! What: `emit` writes one `ui_state` line with the page, the focus zone, the rings, the playback facts and the badges the
//! window shows now.
//! Why: the end-to-end run presses real keys through the nested compositor and needs to read what happened. The release
//! binary has no MCP server, so the state goes to the log, and each line is written where the effect lands: after a key is
//! used, when focus moves, when the badges change, and when the engine reports a position, a track, a mode or play state.

use std::cell::Cell;

use music_player::keymap::FocusZone;
use slint::ComponentHandle;

use crate::ui_screen::read_state;
use crate::{AppWindow, Focus, Keys};

thread_local! {
    /// What: the number of state lines written so far.
    /// Why: a line's sequence number lets a reader tell a new line from one it already read.
    static SEQUENCE: Cell<u64> = const { Cell::new(0) };
}

/// What: `zone_name` names a focus zone for the log.
/// Why: the log is read by people and by the end-to-end run, and names read better than numbers.
fn zone_name(zone: FocusZone) -> &'static str {
    return match zone {
        FocusZone::Surface => "surface",
        FocusZone::FolderList => "folder-list",
        FocusZone::TrackList => "track-list",
        FocusZone::Seek => "seek",
        FocusZone::ModeGroup => "mode-group",
        FocusZone::DeckButton => "deck-button",
        FocusZone::Button => "button",
        FocusZone::TextField => "text-field",
        FocusZone::SettingsList => "settings-list",
    };
}

/// What: `badges_shown` lists the badge texts that are showing, as `name=text` pairs.
/// Why: the end-to-end run checks which badges appear after a hold and which disappear on release.
fn badges_shown(window: &AppWindow) -> Vec<String> {
    let badges = window.global::<Keys>().get_badges();
    let pairs: [(&str, &slint::SharedString); 18] = [
        ("search", &badges.search),
        ("settings", &badges.settings),
        ("open-folder", &badges.open_folder),
        ("folder-trigger", &badges.folder_trigger),
        ("folder-list", &badges.folder_list),
        ("track-list", &badges.track_list),
        ("previous", &badges.previous),
        ("next", &badges.next),
        ("seek-back", &badges.seek_back),
        ("seek-forward", &badges.seek_forward),
        ("mode-repeat", &badges.mode_repeat),
        ("mode-in-order", &badges.mode_in_order),
        ("mode-shuffle-folder", &badges.mode_shuffle_folder),
        ("mode-shuffle-all", &badges.mode_shuffle_all),
        ("mode-cycle", &badges.mode_cycle),
        ("deck-title", &badges.deck_title),
        ("deck-folder", &badges.deck_folder),
        ("editor-reset", &badges.editor_reset),
    ];
    return pairs
        .iter()
        .filter(|(_, text)| return !text.is_empty())
        .map(|(name, text)| return format!("{name}={text}"))
        .collect();
}

/// What: `StateSnapshot` is the window's observable state, serialized as one JSON object.
/// Why: a typed struct keeps the field names in one place and needs no macro that unwraps.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type StateSnapshot = { seq: number; reason: string; route: string; zone: string; /* ... */ };
/// ```
#[derive(serde::Serialize)]
struct StateSnapshot {
    /// Sequence number of this line.
    seq: u64,
    /// Why the line was written: `key`, `focus`, `position` and so on.
    reason: String,
    /// Page the window shows.
    route: String,
    /// Kind of element that holds keyboard focus.
    zone: &'static str,
    /// Name of the element that holds keyboard focus.
    focus: String,
    /// Whether the window is on the unfolded layout.
    unfolded: bool,
    /// Whether the folder picker overlay is open.
    picker_open: bool,
    /// Whether the track menu is open.
    menu_open: bool,
    /// Title of the folder the track list shows.
    folder: String,
    /// Library index of the track row with the keyboard ring.
    ring_track: Option<i32>,
    /// Title of that row.
    ring_track_title: Option<String>,
    /// Name of the folder with the keyboard ring.
    ring_folder: Option<String>,
    /// Highlighted row of the open track menu.
    menu_ring: Option<usize>,
    /// Highlighted result of the Search page.
    search_ring: Option<usize>,
    /// Text of the Search query.
    search_query: String,
    /// Queue index of the playing track.
    current_index: Option<usize>,
    /// Whether audio plays.
    playing: bool,
    /// Playback mode number the window shows.
    mode: i32,
    /// Playback position in seconds.
    position: f64,
    /// Duration of the playing track in seconds.
    duration: f64,
    /// Index of the selected Settings row.
    settings_selected: i32,
    /// Whether the focus ring is turned on.
    ring_visible: bool,
    /// The element a focus request named.
    focus_request: i32,
    /// The badges showing, as `name=text` pairs.
    badges: Vec<String>,
}

/// What: `emit` writes one `ui_state` line with the window's observable state as JSON.
/// Why: see the module description. The line starts with `ui_state ` so a reader can pick it out of the log.
pub(crate) fn emit(window: &AppWindow, reason: &str) {
    let sequence = SEQUENCE.with(|cell| {
        cell.set(cell.get() + 1);
        return cell.get();
    });
    let zone = FocusZone::from_int(window.global::<Focus>().get_zone());
    let badges = badges_shown(window);
    let snapshot = read_state(|state| {
        let ring_title = state
            .ring_track
            .and_then(|ring| return state.shown_rows.iter().find(|row| return row.kind == 0 && row.index == ring))
            .map(|row| return row.title.clone());
        return StateSnapshot {
            seq: sequence,
            reason: reason.to_owned(),
            route: format!("{:?}", state.route),
            zone: zone_name(zone),
            focus: window.global::<Focus>().get_label().to_string(),
            unfolded: window.get_unfolded(),
            picker_open: state.picker_open,
            menu_open: window.get_menu_open(),
            folder: state.shown_folder.clone(),
            ring_track: state.ring_track,
            ring_track_title: ring_title,
            ring_folder: state.ring_folder.clone(),
            menu_ring: state.menu_ring,
            search_ring: state.search_ring,
            search_query: state.search_query.clone(),
            current_index: state.current_index,
            playing: state.playing,
            mode: window.get_playback_mode(),
            position: state.position,
            duration: state.duration,
            settings_selected: window.get_settings_selected(),
            ring_visible: window.global::<Focus>().get_ring_visible(),
            focus_request: window.get_focus_request(),
            badges,
        };
    });
    let line = match serde_json::to_string(&snapshot) {
        Ok(text) => text,
        Err(error) => {
            tracing::warn!(?error, "the window state could not be written as a log line");
            return;
        }
    };
    if reason == "position" {
        // A position report arrives several times a second, so it is logged at debug level.
        tracing::debug!("ui_state {line}");
    } else {
        tracing::info!("ui_state {line}");
    }
}
