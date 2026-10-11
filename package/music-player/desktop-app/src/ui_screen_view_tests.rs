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
