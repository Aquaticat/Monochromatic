//! Window binding for the track menu: opens it for a row, and runs the chosen action.
//!
//! What: `wire` registers the menu request and selection callbacks; `run_action` performs one action.
//! Why: the menu's actions map onto engine commands, platform file actions, and feedback messages in one place.

use std::path::Path;
use std::rc::Rc;

use music_player::command::Command;
use music_player::engine::Engine;
use music_player::track_entries::track_title_for;
use music_player::track_menu::{TrackMenuAction, track_menu_actions_for};
use slint::ComponentHandle;

use crate::ui_files::{can_restore_from_trash, copy_text, move_to_trash, show_in_file_manager};
use crate::ui_menu_model::{human_size, menu_items};
use crate::ui_overlays::{show_error, show_file_error, show_notice, show_trash_notice, show_undo};
use crate::ui_screen::{model_of, read_state, update_state};
use crate::ui_screen_view::selected_page_scope;
use crate::{AppWindow, TrackMenuItem};

/// What: `wire` registers the track menu callbacks on the window.
/// Why: the list reports a menu request for a row, and the menu reports the chosen row.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function wireMenu(app: AppWindow, engine: Engine): void { ... };
/// ```
pub(crate) fn wire(app: &AppWindow, engine: &Rc<Engine>) {
    wire_request(app);
    let select_weak = app.as_weak();
    let select_engine = engine.clone();
    app.on_menu_select(move |position| {
        if let Some(window) = select_weak.upgrade() {
            let chosen = usize::try_from(position).ok().and_then(|at| return track_menu_actions_for().get(at).copied());
            if let Some(action) = chosen {
                run_action(&window, &select_engine, action);
            }
        }
    });
}

/// What: `wire_request` registers the menu request and dismiss callbacks, which need no engine.
/// Why: the window tests open the menu from the keyboard and need the same request path without an engine.
pub(crate) fn wire_request(app: &AppWindow) {
    let request_weak = app.as_weak();
    app.on_menu_request(move |index| {
        if let Some(window) = request_weak.upgrade() {
            fill_menu(&window, usize::try_from(index).ok());
        }
    });
    app.on_menu_dismiss(|| {
        tracing::debug!("track menu dismissed without an action");
        update_state(|state| {
            state.menu_ring = None;
        });
    });
}

/// What: `fill_menu` writes the title and rows of the menu for the library row `index`.
/// Why: the details row shows the file size, which is read from disk when the menu opens.
fn fill_menu(window: &AppWindow, index: Option<usize>) {
    update_state(|state| {
        state.menu_index = index;
        // A menu the keyboard asked for opens with its first row highlighted; a pointer menu has no highlight until a
        // key moves it.
        state.menu_ring = if state.menu_by_key { Some(0) } else { None };
        state.menu_by_key = false;
    });
    window.set_menu_ring(read_state(|state| return state.menu_ring).and_then(|row| return i32::try_from(row).ok()).unwrap_or(-1));
    let target = read_state(|state| return state.menu_target());
    let Some((_index, name, path)) = target else {
        return;
    };
    let size = std::fs::metadata(&path).ok().map(|meta| return human_size(meta.len()));
    let rows: Vec<TrackMenuItem> = menu_items(size.as_deref(), crate::ui_keys::platform())
        .into_iter()
        .map(|row| return TrackMenuItem {
            label: row.label.as_str().into(),
            icon: row.icon,
            destructive: row.destructive,
            divider_before: row.divider_before,
            value: row.value.as_str().into(),
            shortcut: row.shortcut.as_str().into(),
        })
        .collect();
    window.set_menu_title(track_title_for(&name).as_str().into());
    window.set_menu_items(model_of(rows));
    tracing::debug!("track menu filled");
}

/// What: `run_action` performs one menu action on the track the menu was opened for.
/// Why: the target is read from the state at selection time, so the action uses the row the user saw.
pub(crate) fn run_action(window: &AppWindow, engine: &Engine, action: TrackMenuAction) {
    let target = read_state(|state| return state.menu_target());
    let Some((index, name, path)) = target else {
        show_error(window, "The track is no longer in the library.");
        return;
    };
    match action {
        TrackMenuAction::Play => crate::ui_wire::play_row(engine, index),
        TrackMenuAction::ShuffleFromHere => shuffle_from_here(engine, index),
        TrackMenuAction::Details => show_details(window, &name, &path),
        TrackMenuAction::ReanalyseTruePeak => engine.send(Command::ReanalyseTrack(path)),
        TrackMenuAction::ShowInFileManager => {
            if let Err(error) = show_in_file_manager(&path) {
                show_file_error(window, &error);
            }
        }
        TrackMenuAction::CopyFilename => {
            let file_name = file_name_of(&name);
            if let Err(error) = copy_text(&file_name) {
                show_error(window, &error.to_string());
            }
        }
        TrackMenuAction::MoveToTrash => move_track_to_trash(window, &name, &path),
    }
}

/// What: `show_details` shows the file name, size and folder of a track as a notice.
/// Why: File details has no page of its own; the menu row shows the size inline, and the keyboard shortcut (Alt+Enter)
/// shows the same facts with the folder as a message, so the shortcut has a visible effect.
fn show_details(window: &AppWindow, name: &str, path: &Path) {
    let size = std::fs::metadata(path).ok().map(|meta| return human_size(meta.len()));
    let folder = path.parent().map_or_else(String::new, |parent| return parent.display().to_string());
    let message = format!("{} \u{b7} {} \u{b7} {}", file_name_of(name), size.unwrap_or_else(|| return "size unknown".to_owned()), folder);
    tracing::info!(%message, "file details shown");
    show_notice(window, &message);
}

/// What: `move_track_to_trash` moves the file to the trash and offers Undo where the platform can restore it.
/// Why: D8 deletes immediately; Undo restores from the OS trash, and macOS offers no Undo because the trash crate cannot restore there.
fn move_track_to_trash(window: &AppWindow, name: &str, path: &Path) {
    match move_to_trash(path) {
        Ok(()) => {
            let message = format!("Moved {} to the trash", file_name_of(name));
            if can_restore_from_trash() {
                show_undo(window, &message, path.to_path_buf());
            } else {
                show_trash_notice(window, &message);
            }
        }
        Err(error) => show_file_error(window, &error),
    }
}

/// What: `shuffle_from_here` shuffles the selected page and starts the track at `index`.
/// Why: Android's shuffle-from-here sets the page scope, then the shuffle mode, then plays the index (D7).
fn shuffle_from_here(engine: &Engine, index: usize) {
    let scope = read_state(selected_page_scope);
    engine.send(Command::SetPageScope(scope));
    engine.send(Command::SetPlaybackMode(music_player::command::PlaybackMode::ShufflePage));
    engine.send(Command::SelectIndex(index));
    engine.send(Command::Play);
}

/// What: `file_name_of` drops the folders from a display path, keeping the file name with its extension.
/// Why: Copy filename copies the file name, not the folder path.
fn file_name_of(display_path: &str) -> String {
    return display_path
        .rsplit_once('/')
        .map_or(display_path, |(_, file_name)| return file_name)
        .to_string();
}
