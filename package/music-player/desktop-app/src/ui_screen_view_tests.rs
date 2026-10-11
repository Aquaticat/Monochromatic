//! Tests for the pure library projection in `ui_screen_view`.

use super::*;
use music_player::template_model::TrackFields;

/// What: `no_supporting_line` is the supporting-line function that never shows text.
fn no_supporting_line(_track: &TrackFields) -> Option<String> {
    return None;
}

/// What: `state_with(names, current)` builds a state over the given queue names.
fn state_with(names: &[&str], current: Option<usize>) -> ScreenState {
    return ScreenState {
        paths: Vec::new(),
        names: names.iter().map(|name| return name.to_string()).collect(),
        current_index: current,
        ..ScreenState::default()
    };
}

#[test]
fn empty_selected_key_selects_the_first_page() {
    let state = state_with(&["Abba/one.mp3", "Beta/two.mp3"], None);
    let all = pages(&state);
    assert_eq!(selected_page_index(&all, ""), 0);
    assert_eq!(selected_page_index(&all, "no such page"), 0);
}

#[test]
fn selected_page_scope_returns_the_indices_of_the_selected_page() {
    let mut state = state_with(&["Abba/one.mp3", "Beta/two.mp3"], None);
    let all = pages(&state);
    let beta_key = page_identity(&all[1]);
    state.selected_key = beta_key;
    assert_eq!(selected_page_scope(&state), vec![1]);
}

#[test]
fn page_key_containing_finds_the_page_of_a_queue_index() {
    let state = state_with(&["Abba/one.mp3", "Beta/two.mp3"], None);
    let all = pages(&state);
    assert_eq!(page_key_containing(&all, 1), Some(page_identity(&all[1])));
    assert_eq!(page_key_containing(&all, 9), None);
}

#[test]
fn view_marks_the_playing_row_and_scrolls_to_it() {
    let state = state_with(&["Abba/one.mp3", "Abba/two.mp3"], Some(1));
    let mut selected = state.clone();
    selected.selected_key = page_identity(&pages(&state)[0]);
    let view = view(&selected, &no_supporting_line);
    let current_rows: Vec<&ListRow> = view.rows.iter().filter(|row| return row.current).collect();
    assert_eq!(current_rows.len(), 1);
    assert_eq!(current_rows[0].index, 1);
    assert_eq!(view.scroll_row, view.rows.iter().position(|row| return row.current).map_or(-1, |p| return p as i32));
}

#[test]
fn view_deck_title_is_the_playing_track_even_off_the_selected_page() {
    let mut state = state_with(&["Abba/one.mp3", "Beta/two.mp3"], Some(1));
    state.track_name = "Beta/two.mp3".to_string();
    state.selected_key = page_identity(&pages(&state)[0]);
    let view = view(&state, &no_supporting_line);
    assert_eq!(view.deck_title, "two");
    assert_eq!(view.deck_subtitle, "");
    assert_eq!(view.scroll_row, -1);
}

#[test]
fn view_deck_title_is_empty_without_a_playing_track() {
    let state = state_with(&["Abba/one.mp3"], None);
    assert_eq!(view(&state, &no_supporting_line).deck_title, "");
}

#[test]
fn view_folder_title_follows_the_selected_page() {
    let mut state = state_with(&["Abba/one.mp3", "Beta/two.mp3"], None);
    state.selected_key = page_identity(&pages(&state)[1]);
    let view = view(&state, &no_supporting_line);
    assert_eq!(view.folder_title, pages(&state)[1].label);
}

#[test]
fn view_of_an_empty_queue_has_no_rows_and_no_picker_cells() {
    let view = view(&ScreenState::default(), &no_supporting_line);
    assert!(view.rows.is_empty());
    assert!(view.picker.cells.is_empty());
    assert_eq!(view.scroll_row, -1);
}

#[test]
fn select_folder_label_selects_the_page_closes_the_picker_and_returns_its_scope() {
    let mut state = state_with(&["Abba/one.mp3", "Beta/two.mp3"], None);
    state.picker_open = true;
    let label = pages(&state)[1].label.clone();
    let scope = select_folder_label(&mut state, &label);
    assert_eq!(scope, Some(vec![1]));
    assert!(!state.picker_open);
    assert_eq!(state.selected_key, page_identity(&pages(&state)[1]));
}

#[test]
fn select_folder_label_with_unknown_label_changes_nothing() {
    let mut state = state_with(&["Abba/one.mp3"], None);
    state.picker_open = true;
    let before = state.clone();
    assert_eq!(select_folder_label(&mut state, "Missing"), None);
    assert_eq!(state, before);
}

#[test]
fn library_heading_names_the_opened_folder() {
    let mut state = state_with(&[], None);
    state.source_root_name = Some("Albums".to_string());
    assert_eq!(state.library_heading(), "Albums");
}

#[test]
fn library_heading_falls_back_to_folders_without_an_opened_folder() {
    let mut state = state_with(&[], None);
    assert_eq!(state.library_heading(), "Folders");
    state.source_root_name = Some("  ".to_string());
    assert_eq!(state.library_heading(), "Folders");
}

/// What: `playing_state` builds a state whose playing track is the first queue entry in a subfolder.
/// Why: the deck folder and the folder scroll row both read the playing track's directory.
fn playing_state() -> ScreenState {
    let mut state = state_with(&["Camellia/Live/Ghost.flac", "Camellia/Ghost.flac"], Some(0));
    state.track_name = "Camellia/Live/Ghost.flac".to_string();
    return state;
}

#[test]
fn view_fills_deck_folder_with_the_playing_tracks_folder() {
    let view = view(&playing_state(), &no_supporting_line);
    assert_eq!(view.deck_folder, "Live");
    assert_eq!(view.folder_scroll_row, 1);
    assert_eq!(view.scroll_row, 2);
}

#[test]
fn view_deck_folder_is_empty_without_a_playing_track() {
    let state = state_with(&["Abba/one.mp3"], None);
    let view = view(&state, &no_supporting_line);
    assert_eq!(view.deck_folder, "");
    assert_eq!(view.folder_scroll_row, -1);
}

#[test]
fn view_deck_folder_of_a_root_track_is_its_page_label() {
    let mut state = state_with(&["Loose.flac"], Some(0));
    state.track_name = "Loose.flac".to_string();
    assert_eq!(view(&state, &no_supporting_line).deck_folder, "L");
}

/// What: `list_row(kind, current)` builds one plain list row for the folder scroll cases.
/// Why: only the kind and the current flag decide the folder scroll position.
fn list_row(kind: i32, current: bool) -> ListRow {
    return ListRow {
        kind,
        title: String::new(),
        supporting: String::new(),
        current,
        index: -1,
    };
}

#[test]
fn folder_scroll_row_is_minus_one_when_nothing_plays() {
    let rows = vec![list_row(0, false), list_row(1, false)];
    assert_eq!(folder_scroll_row_for(&rows), -1);
}

#[test]
fn folder_scroll_row_is_zero_for_a_track_directly_in_the_folder() {
    let rows = vec![list_row(0, true), list_row(1, false), list_row(0, false)];
    assert_eq!(folder_scroll_row_for(&rows), 0);
}

#[test]
fn folder_scroll_row_is_the_nearest_header_above_the_playing_row() {
    let rows = vec![
        list_row(0, false),
        list_row(1, false),
        list_row(0, false),
        list_row(1, false),
        list_row(0, true),
    ];
    assert_eq!(folder_scroll_row_for(&rows), 3);
}

#[test]
fn folder_scroll_row_ignores_headers_below_the_playing_row() {
    let rows = vec![list_row(0, false), list_row(1, false), list_row(0, true), list_row(1, false)];
    assert_eq!(folder_scroll_row_for(&rows), 1);
}
