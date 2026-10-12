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

/// What: `KeyContext` is the visible page and whether a template line is being edited.
/// Why: Escape closes Settings only while Settings is the visible page and no template line has the keyboard, so the
/// classifier needs both facts, and they come from the window state.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type KeyContext = { route: Route; editingTemplate: boolean };
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct KeyContext {
    /// Page the window shows over the player.
    pub route: Route,
    /// True while the template editor's text field has keyboard focus.
    pub editing_template: bool,
}

/// What: `settings_closes_on_escape` tells whether Escape closes Settings in this context.
/// Why: D110 closes Settings from the list page and from the wide two-pane page alike, but a key typed into a template
/// line belongs to the line, so Escape there must not discard the page.
pub fn settings_closes_on_escape(context: &KeyContext) -> bool {
    return context.route == Route::Settings && !context.editing_template;
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
/// const requestFor = (input: KeyInput, context: KeyContext, platform: Platform): ShortcutRequest => ({ ... });
/// ```
pub fn request_for(input: &KeyInput, context: &KeyContext, platform: KeyboardPlatform) -> ShortcutRequest {
    let route: Route = context.route;
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
        in_settings: settings_closes_on_escape(context),
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

/// What: `classify` names the action of one key press on the page the window shows now.
/// Why: dispatching and the tests classify through the same call, so a key means one thing wherever it is read.
pub(crate) fn classify(input: &KeyInput) -> (ShortcutAction, KeyContext) {
    let context = read_state(key_context_of);
    let action = shortcut_action(&request_for(input, &context, platform()));
    tracing::debug!(action = action.wire_name(), route = ?context.route, editing_template = context.editing_template, "shortcut classified");
    return (action, context);
}

/// What: `dispatch` classifies one key press and runs its action; returns true when the key was used.
/// Why: a used key stops the window from delivering it to the focused field, and an unused key continues to it.
pub fn dispatch(window: &AppWindow, engine: &Engine, input: &KeyInput) -> bool {
    let (action, context) = classify(input);
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
        page_action => run_page_action(window, page_action, &context),
    };
}

/// What: `run_page_action` runs an action that changes the page or the list and needs no playback engine.
/// Why: these actions act on the window alone, so the tests run them without starting an engine; returns true when the
/// key was used.
pub(crate) fn run_page_action(window: &AppWindow, action: ShortcutAction, context: &KeyContext) -> bool {
    return match action {
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
            go_back(window, context.route);
            true
        }
        ShortcutAction::IgnoreRepeat => true,
        ShortcutAction::Toggle
        | ShortcutAction::Previous
        | ShortcutAction::Next
        | ShortcutAction::Mode
        | ShortcutAction::Owner
        | ShortcutAction::ClosePopup
        | ShortcutAction::Unbound => false,
    };
}

/// What: `key_context_of` reads the visible page and the template field's focus from the screen state.
/// Why: both facts live in the state, and the classifier takes them as one value.
fn key_context_of(state: &ScreenState) -> KeyContext {
    return KeyContext {
        route: state.route,
        editing_template: state.editor.as_ref().is_some_and(|editor| return editor.field_focused()),
    };
}

/// What: `go_back` leaves the page the Back action was classified on: Search or Settings.
/// Why: Escape and Back leave Search straight to the player, and Settings the same way (D110), saving the templates.
fn go_back(window: &AppWindow, route: Route) {
    match route {
        Route::Settings => {
            tracing::info!("Escape closes Settings");
            crate::ui_settings::close_settings(window);
        }
        Route::Search => {
            crate::ui_search::close_search_route(window);
        }
        Route::Player | Route::TemplateEditor => {
            tracing::warn!(?route, "Back was classified on a page that has no Back target");
        }
    }
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
            let page = state.page_key_of_index(index);
            if let Some(page_key) = page {
                state.selected_key = page_key;
            }
        }
    });
}

#[cfg(test)]
#[path = "ui_keys_tests.rs"]
mod tests;
