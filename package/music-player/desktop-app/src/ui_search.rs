//! Window binding for the Search route: opens and closes it, reprojects its rows on each query edit,
//! and activates a result.
//!
//! What: `wire` registers the Search callbacks; `project_search` pushes the Search view model.
//! Why: D64 (Back exits), D66 (a new visit starts empty), D72 (a folder result opens without autoplay)
//! and D74 (a track result returns to the player) are applied here.

use std::rc::Rc;

use music_player::command::Command;
use music_player::engine::Engine;
use music_player::track::Track;
use slint::ComponentHandle;

use crate::ui_screen::{model_of, project, read_state, update_state};
use crate::ui_screen_view::{Route, ScreenState, select_folder_label};
use crate::ui_search_model::{SearchRowView, SearchView, search_view};
use crate::{AppWindow, SearchRow, SearchSegment};

/// What: `wire` registers the Search callbacks on the window.
/// Why: the Search page reports open, close, query edits and result activation through these.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function wireSearch(app: AppWindow, engine: Engine): void { ... };
/// ```
pub(crate) fn wire(app: &AppWindow, engine: &Rc<Engine>) {
    let open_weak = app.as_weak();
    app.on_open_search(move || {
        if let Some(window) = open_weak.upgrade() {
            open_search_route(&window);
        }
    });
    let close_weak = app.as_weak();
    app.on_close_search(move || {
        if let Some(window) = close_weak.upgrade() {
            close_search_route(&window);
        }
    });
    let edit_weak = app.as_weak();
    app.on_search_query_edited(move |query| {
        if let Some(window) = edit_weak.upgrade() {
            update_state(|state| {
                state.search_query = query.to_string();
            });
            project_search(&window);
        }
    });
    let clear_weak = app.as_weak();
    app.on_search_clear(move || {
        if let Some(window) = clear_weak.upgrade() {
            update_state(|state| {
                state.search_query = String::new();
            });
            project_search(&window);
        }
    });
    let open_engine = engine.clone();
    let result_weak = app.as_weak();
    app.on_search_open(move |position| {
        if let Some(window) = result_weak.upgrade() {
            activate_result(&window, &open_engine, usize::try_from(position).unwrap_or(usize::MAX));
        }
    });
}

/// What: `open_search_route` opens Search with an empty query (D66) and focuses its field (D63).
/// Why: the keyboard shortcut and the cover button both open the same visit.
pub(crate) fn open_search_route(window: &AppWindow) {
    update_state(|state| {
        state.route = Route::Search;
        state.search_query = String::new();
    });
    show_route(window);
}

/// What: `close_search_route` returns to the player (D64 Back exits Search directly).
/// Why: Back and Escape leave Search through the same route change.
pub(crate) fn close_search_route(window: &AppWindow) {
    update_state(|state| {
        state.route = Route::Player;
    });
    show_route(window);
}

/// What: `show_route` pushes the route and the Search view model to the window.
/// Why: the route decides which page is drawn, and the Search rows are only needed while it is open.
fn show_route(window: &AppWindow) {
    project(window);
    project_search(window);
}

/// What: `project_search` pushes the Search rows, status block and query to the window.
/// Why: every query edit recomputes the rows from the current library.
pub(crate) fn project_search(window: &AppWindow) {
    let view: SearchView = read_state(|state| return search_view(&state.search_query, &library_tracks(state), state.current_index, state.playing));
    window.set_search_query(read_state(|state| return state.search_query.as_str().into()));
    window.set_search_rows(model_of(view.rows.iter().map(search_row).collect()));
    window.set_search_status_title(view.status_title.as_str().into());
    window.set_search_status_detail(view.status_detail.as_str().into());
    window.set_route(read_state(|state| return state.route.to_int()));
}

/// What: `library_tracks` lists the queue as tracks for the search, using the display names.
/// Why: the search matches display paths, and the queue names are those paths.
fn library_tracks(state: &ScreenState) -> Vec<Track> {
    return state
        .names
        .iter()
        .map(|name| return Track {
            uri: String::new(),
            display_path: name.clone(),
        })
        .collect();
}

/// What: `search_row` converts one plain Search row into the window's `SearchRow`.
/// Why: the window struct carries Slint segment lists, which the pure model does not.
fn search_row(row: &SearchRowView) -> SearchRow {
    return SearchRow {
        kind: row.kind,
        title_segments: model_of(row.title.iter().map(search_segment).collect()),
        parent_segments: model_of(row.parent.iter().map(search_segment).collect()),
        has_parent: row.has_parent,
        current: row.current,
        playing: row.playing,
        index: row.index,
    };
}

/// What: `search_segment` converts one emphasis piece into the window's `SearchSegment`.
fn search_segment(piece: &crate::ui_search_model::Segment) -> SearchSegment {
    return SearchSegment {
        text: piece.text.as_str().into(),
        emphasized: piece.emphasized,
    };
}

/// What: `activate_result` opens a folder result without autoplay (D72) or plays a track result and returns to the player (D73, D74).
/// Why: the result list is recomputed from the current query, so the position still names the same result.
fn activate_result(window: &AppWindow, engine: &Engine, position: usize) {
    let result = read_state(|state| {
        return search_view(&state.search_query, &library_tracks(state), state.current_index, state.playing)
            .results
            .get(position)
            .cloned();
    });
    let Some(found) = result else {
        return;
    };
    match found.index_in_library {
        Some(index) if found.kind == music_player::search_results::SearchResultKind::Track => {
            crate::ui_wire::play_row(engine, index);
            update_state(|state| {
                state.route = Route::Player;
            });
        }
        _ => {
            let mut chosen: Option<Vec<usize>> = None;
            update_state(|state| {
                chosen = select_folder_label(state, &found.name);
                state.route = Route::Player;
            });
            if let Some(scope) = chosen {
                engine.send(Command::SetPageScope(scope));
            }
        }
    }
    show_route(window);
}
