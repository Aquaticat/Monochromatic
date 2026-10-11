//! Window callbacks for the library screen: each user action becomes engine commands.
//!
//! What: `wire` registers the transport, row, mode, folder picker and open-folder callbacks on `AppWindow`.
//! Why: `main` stays a startup sequence, and the mapping from user action to `Command` lives in one place.

use std::rc::Rc;

use music_player::command::Command;
use music_player::engine::Engine;
use slint::ComponentHandle;

use crate::AppWindow;
use crate::ui_playback::int_to_playback_mode;
use crate::ui_screen::{project, read_state, update_state};
use crate::ui_screen_view::{select_folder_label, selected_page_scope};

/// What: `wire` registers every library-screen callback on the window.
/// Why: the callbacks share the engine handle, so they are registered together after the engine starts.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function wire(app: AppWindow, engine: Engine): void { ... }
/// ```
pub(crate) fn wire(app: &AppWindow, engine: &Rc<Engine>) {
    wire_transport(app, engine);
    wire_library(app, engine);
    crate::ui_search::wire(app, engine);
}

/// What: `wire_transport` registers play, previous, next, seek and mode callbacks.
/// Why: the transport deck and the mode group send these without knowing the engine.
fn wire_transport(app: &AppWindow, engine: &Rc<Engine>) {
    let toggle_engine = engine.clone();
    app.on_toggle_play(move || toggle_engine.send(Command::TogglePlay));
    let prev_engine = engine.clone();
    app.on_prev(move || prev_engine.send(Command::Prev));
    let next_engine = engine.clone();
    app.on_next(move || next_engine.send(Command::Next));
    let seek_engine = engine.clone();
    app.on_seek(move |secs| seek_engine.send(Command::Seek(f64::from(secs))));
    let reveal_weak = app.as_weak();
    app.on_reveal_playing(move || {
        if let Some(window) = reveal_weak.upgrade() {
            crate::ui_keys::reveal_playing(&window);
        }
    });
    let folder_reveal_weak = app.as_weak();
    app.on_reveal_folder(move || {
        if let Some(window) = folder_reveal_weak.upgrade() {
            crate::ui_keys::reveal_playing_folder(&window);
        }
    });
    let mode_engine = engine.clone();
    let mode_weak = app.as_weak();
    app.on_select_mode(move |mode| {
        if mode_weak.upgrade().is_some() {
            let scope = read_state(selected_page_scope);
            mode_engine.send(Command::SetPageScope(scope));
            mode_engine.send(Command::SetPlaybackMode(int_to_playback_mode(mode)));
        }
    });
}

/// What: `wire_library` registers row play, folder picker and open-folder callbacks.
/// Why: these change the selected folder or start a track, and each one ends with a window projection.
fn wire_library(app: &AppWindow, engine: &Rc<Engine>) {
    let row_engine = engine.clone();
    let row_weak = app.as_weak();
    app.on_select_index(move |index| {
        if let Some(window) = row_weak.upgrade() {
            play_row(&row_engine, usize::try_from(index).unwrap_or(usize::MAX));
            project(&window);
        }
    });
    let picker_weak = app.as_weak();
    app.on_toggle_picker(move || {
        if let Some(window) = picker_weak.upgrade() {
            update_state(|state| {
                state.picker_open = !state.picker_open;
            });
            project(&window);
        }
    });
    let folder_engine = engine.clone();
    let folder_weak = app.as_weak();
    app.on_select_folder(move |label| {
        if let Some(window) = folder_weak.upgrade() {
            select_folder(&folder_engine, label.as_str());
            project(&window);
        }
    });
    let open_sender = engine.sender();
    app.on_open_files(move || {
        open_folder_dialog(open_sender.clone());
    });
    crate::ui_overlays::wire(app, engine);
    crate::ui_menu::wire(app, engine);
    crate::ui_settings::wire(app);
    wire_keys(app, engine);
}

/// What: `wire_keys` routes each key press from the window's key scope to the shortcut dispatcher.
/// Why: the window answers true when a shortcut used the key, so the focused field keeps every other key.
fn wire_keys(app: &AppWindow, engine: &Rc<Engine>) {
    let key_weak = app.as_weak();
    let key_engine = engine.clone();
    app.on_key_pressed(move |key, ctrl, meta, alt, shift, repeat, in_popup| {
        let Some(window) = key_weak.upgrade() else {
            return false;
        };
        let input = crate::ui_keys::KeyInput {
            key: key.to_string(),
            ctrl,
            meta,
            alt,
            shift,
            repeat,
            in_popup,
        };
        return crate::ui_keys::dispatch(&window, &key_engine, &input);
    });
}

/// What: `open_folder_dialog` asks for a folder on a worker thread and opens it without autoplay.
/// Why: the native dialog blocks, so it runs off the event-loop thread; the engine receives the chosen root.
pub(crate) fn open_folder_dialog(sender: music_player::engine::CommandSender) {
    std::thread::spawn(move || {
        if let Some(dir) = rfd::FileDialog::new().pick_folder() {
            sender.send(Command::OpenRoot {
                root: dir,
                select: None,
                play: false,
            });
        }
    });
}


/// What: `play_row` plays a track row: the playing row toggles play and pause, another row loads and plays.
/// Why: a click on an unselected row starts it, matching the Android track list; `SelectIndex` loads paused,
/// so `Play` follows it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const playRow = (index: number) => current === index ? toggle() : (select(index), play());
/// ```
pub(crate) fn play_row(engine: &Engine, index: usize) {
    let current = read_state(|state| return state.current_index);
    if current == Some(index) {
        engine.send(Command::TogglePlay);
        return;
    }
    engine.send(Command::SelectIndex(index));
    engine.send(Command::Play);
}

/// What: `select_folder` selects the folder named `label`, closes the picker, and scopes the engine to it.
/// Why: the selection and the engine scope come from the same state write.
fn select_folder(engine: &Engine, label: &str) {
    let mut chosen_scope: Option<Vec<usize>> = None;
    update_state(|state| {
        chosen_scope = select_folder_label(state, label);
    });
    if let Some(scope) = chosen_scope {
        engine.send(Command::SetPageScope(scope));
    }
}
