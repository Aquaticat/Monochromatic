//! Keyboard shortcuts for the player: each key becomes a `ShortcutRequest`, the `keymap` classifier names
//! the action, and the action runs against the window and the engine.
//!
//! What: `request_for` builds the classifier input from the key event and the visible route;
//! `dispatch` runs the named action and reports whether the key was used.
//! Why: D102 keeps the shortcut map in `keymap`; this module only connects it to the window. Text fields keep
//! their own keys because the owner of a search or editor route is not the player.

use music_player::command::{Command, PlaybackMode};
use music_player::engine::Engine;
use music_player::keymap::{KeyboardPlatform, ShortcutAction, ShortcutOwner, ShortcutRequest, shortcut_action};

use crate::ui_screen::{project, read_state, update_state};
use crate::ui_screen_scroll::ScrollRequest;
use crate::ui_screen_view::{Route, ScreenState, selected_page_scope};
use crate::AppWindow;

/// What: `KeyInput` is one key press as the window reports it.
/// Why: the window passes the key name and modifiers as plain values, so the mapping is testable.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type KeyInput = { key: string; ctrl: boolean; meta: boolean; alt: boolean; shift: boolean; repeat: boolean; inPopup: boolean };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct KeyInput {
    /// DOM-style key name, such as `Escape`, `ArrowLeft` or a printable character.
    pub key: String,
    /// Control modifier.
    pub ctrl: bool,
    /// Command (Mac) or Windows key modifier.
    pub meta: bool,
    /// Alt modifier.
    pub alt: bool,
    /// Shift modifier.
    pub shift: bool,
    /// True for an auto-repeat press.
    pub repeat: bool,
    /// True while a popup such as the track menu is open.
    pub in_popup: bool,
}

/// What: `platform` gives the keyboard convention of the running OS.
/// Why: the shortcut map differs between Windows and Linux (Ctrl) and macOS (Command).
pub fn platform() -> KeyboardPlatform {
    return if cfg!(target_os = "macos") {
        KeyboardPlatform::Mac
    } else {
        KeyboardPlatform::WindowsLinux
    };
}

/// What: `owner_for` names the component that owns keys on a route.
/// Why: the player owns shortcut keys; a text page or the editor keeps its own keys (D102).
pub fn owner_for(route: Route) -> ShortcutOwner {
    return match route {
        Route::Player => ShortcutOwner::Player,
        Route::TemplateEditor => ShortcutOwner::Editor,
        Route::Search | Route::Settings => ShortcutOwner::Control,
    };
}

/// What: `request_for` builds the classifier input for one key press on a route.
/// Why: the classifier needs the platform, owner and search state, which come from the window state.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const requestFor = (input: KeyInput, route: Route, platform: Platform): ShortcutRequest => ({ ... });
/// ```
pub fn request_for(input: &KeyInput, route: Route, platform: KeyboardPlatform) -> ShortcutRequest {
    return ShortcutRequest {
        platform,
        key: input.key.clone(),
        ctrl: input.ctrl,
        meta: input.meta,
        alt: input.alt,
        shift: input.shift,
        repeat: input.repeat,
        owner: owner_for(route),
        in_popup: input.in_popup,
        in_search: route == Route::Search,
        composing: false,
    };
}

/// What: `next_mode` gives the playback mode that follows `mode` in the Ctrl+M cycle.
/// Why: D102 cycles the end-of-track mode through the four modes in the segmented control's order.
pub fn next_mode(mode: PlaybackMode) -> PlaybackMode {
    return match mode {
        PlaybackMode::Repeat => PlaybackMode::InOrder,
        PlaybackMode::InOrder => PlaybackMode::ShufflePage,
        PlaybackMode::ShufflePage => PlaybackMode::ShuffleAll,
        PlaybackMode::ShuffleAll => PlaybackMode::Repeat,
    };
}

/// What: `dispatch` classifies one key press and runs its action; returns true when the key was used.
/// Why: a used key stops the window from delivering it to the focused field, and an unused key continues to it.
pub fn dispatch(window: &AppWindow, engine: &Engine, input: &KeyInput) -> bool {
    let route = read_state(|state| return state.route);
    let action = shortcut_action(&request_for(input, route, platform()));
    tracing::debug!(action = action.wire_name(), "shortcut classified");
    return match action {
        ShortcutAction::Toggle => {
            engine.send(Command::TogglePlay);
            true
        }
        ShortcutAction::Previous => {
            engine.send(Command::Prev);
            true
        }
        ShortcutAction::Next => {
            engine.send(Command::Next);
            true
        }
        ShortcutAction::Mode => {
            cycle_mode(engine);
            true
        }
        ShortcutAction::Search => {
            crate::ui_search::open_search_route(window);
            true
        }
        ShortcutAction::Picker => {
            update_state(|state| {
                state.picker_open = !state.picker_open;
            });
            project(window);
            true
        }
        ShortcutAction::Settings => {
            crate::ui_settings::open_settings(window);
            true
        }
        ShortcutAction::Reveal => {
            reveal_playing(window);
            true
        }
        ShortcutAction::Back => {
            crate::ui_search::close_search_route(window);
            true
        }
        ShortcutAction::IgnoreRepeat => true,
        ShortcutAction::Owner | ShortcutAction::ClosePopup | ShortcutAction::Unbound => false,
    };
}

/// What: `cycle_mode` moves the playback mode to the next one and scopes the engine to the selected page.
/// Why: the scope must match the page the user sees before a shuffle or in-order mode starts.
fn cycle_mode(engine: &Engine) {
    let (mode, scope) = read_state(|state: &ScreenState| return (state.mode, selected_page_scope(state)));
    engine.send(Command::SetPageScope(scope));
    engine.send(Command::SetPlaybackMode(next_mode(mode)));
}

/// What: `reveal_playing` moves the list to the folder that holds the playing track, closes the picker and asks
/// the list to scroll so the playing row is at the top.
/// Why: Ctrl+G and a click on the deck's title jump to the playing track; the request makes the list scroll even
/// when the folder and the row did not change.
pub(crate) fn reveal_playing(window: &AppWindow) {
    show_playing_page(ScrollRequest::PlayingRow);
    project(window);
}

/// What: `reveal_playing_folder` moves the list to the folder that holds the playing track, closes the picker and
/// asks the list to scroll so the subfolder header above the playing row is at the top, or the folder start for a
/// track directly in it.
/// Why: a click on the deck's folder name shows the folder; the request makes the list scroll even when the folder
/// and the header did not change.
pub(crate) fn reveal_playing_folder(window: &AppWindow) {
    show_playing_page(ScrollRequest::PlayingFolder);
    project(window);
}

/// What: `show_playing_page` selects the page that holds the playing track, closes the picker, and queues the scroll
/// request for the next projection when a track is playing.
/// Why: both reveal actions show the playing track's folder, so they share this state change; with nothing playing
/// there is no row to reveal, so the list keeps its position.
fn show_playing_page(request: ScrollRequest) {
    update_state(|state| {
        state.picker_open = false;
        if let Some(index) = state.current_index {
            state.scroll_request = Some(request);
            let page = crate::ui_screen_view::page_key_containing(&crate::ui_screen_view::pages(state), index);
            if let Some(page_key) = page {
                state.selected_key = page_key;
            }
        }
    });
}

#[cfg(test)]
#[path = "ui_keys_tests.rs"]
mod tests;
