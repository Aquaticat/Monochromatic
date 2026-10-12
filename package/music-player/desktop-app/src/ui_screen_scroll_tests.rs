//! Tests for the scroll request rules in `ui_screen_scroll`.

use super::*;
use crate::ui_screen_view::view;
use music_player::template_model::TrackFields;

/// What: `no_supporting_line` is the supporting-line function that never shows text.
fn no_supporting_line(_track: &TrackFields) -> Option<String> {
    return None;
}

/// What: `list_row(kind, supporting, current)` builds one plain list row for the offset cases.
/// Why: only the kind, the second line and the current flag decide a row's height and the playing position.
fn list_row(kind: i32, supporting: &str, current: bool) -> ListRow {
    return ListRow {
        kind,
        title: String::new(),
        supporting: supporting.to_string(),
        current,
        index: -1,
    };
}

/// What: `state_with_queue(names, current)` builds a state over the given queue, with no page selected yet.
/// Why: the scroll cases need only the queue, the playing index and the request fields.
fn state_with_queue(names: &[&str], current: Option<usize>) -> ScreenState {
    return ScreenState {
        names: std::sync::Arc::new(names.iter().map(|name| return name.to_string()).collect()),
        current_index: current,
        ..ScreenState::default()
    };
}

/// What: `project_once` projects the state once and runs the request decision, the way the window's projection does.
/// Why: the request depends on the state the previous projection left behind, so the cases call it in sequence.
fn project_once(state: &mut ScreenState) -> Option<ScrollRequest> {
    let screen = view(state, &no_supporting_line);
    return next_scroll_request(state, &screen);
}

/// What: `live_folder_rows` is a folder with a loose track, a subfolder header and the playing track inside it.
/// Why: the header sits between the two tracks, so the playing row and its folder header have different offsets.
fn live_folder_rows() -> Vec<ListRow> {
    return vec![
        list_row(0, "", false),
        list_row(1, "1 track", false),
        list_row(0, "", true),
    ];
}

#[test]
fn row_offset_px_sums_the_heights_of_the_rows_above_the_index() {
    // Track without a second line is 48, header is 54, track with a second line is 72.
    let rows = [
        list_row(0, "", false),
        list_row(1, "2 tracks", false),
        list_row(0, "4:35", false),
        list_row(0, "", true),
    ];
    assert_eq!(row_offset_px(&rows, 0), 0.0);
    assert_eq!(row_offset_px(&rows, 1), 48.0);
    assert_eq!(row_offset_px(&rows, 2), 102.0);
    assert_eq!(row_offset_px(&rows, 3), 174.0);
    assert_eq!(row_offset_px(&rows, 4), 222.0);
}

#[test]
fn row_offset_px_gives_a_header_its_height_even_without_a_count() {
    let rows = [list_row(1, "", false), list_row(0, "", false)];
    assert_eq!(row_offset_px(&rows, 1), 54.0);
}

#[test]
fn scroll_offset_for_top_is_the_start_of_the_list() {
    assert_eq!(scroll_offset_for(ScrollRequest::Top, &live_folder_rows()), 0.0);
}

#[test]
fn scroll_offset_for_playing_row_is_the_offset_of_the_playing_row() {
    assert_eq!(scroll_offset_for(ScrollRequest::PlayingRow, &live_folder_rows()), 102.0);
}

#[test]
fn scroll_offset_for_playing_folder_is_the_offset_of_the_header_above_the_playing_row() {
    assert_eq!(scroll_offset_for(ScrollRequest::PlayingFolder, &live_folder_rows()), 48.0);
}

#[test]
fn scroll_offset_for_playing_folder_is_the_start_when_the_track_sits_directly_in_the_folder() {
    let rows = [list_row(0, "", true), list_row(1, "1 track", false), list_row(0, "", false)];
    assert_eq!(scroll_offset_for(ScrollRequest::PlayingFolder, &rows), 0.0);
}

#[test]
fn scroll_offset_for_playing_folder_uses_the_nearest_header_above_the_playing_row() {
    let rows = [
        list_row(1, "1 track", false),
        list_row(0, "", false),
        list_row(1, "1 track", false),
        list_row(0, "", true),
    ];
    assert_eq!(scroll_offset_for(ScrollRequest::PlayingFolder, &rows), 102.0);
    assert_eq!(scroll_offset_for(ScrollRequest::PlayingRow, &rows), 156.0);
}

#[test]
fn scroll_offset_for_playing_folder_ignores_headers_below_the_playing_row() {
    let rows = [
        list_row(1, "1 track", false),
        list_row(0, "", true),
        list_row(1, "1 track", false),
        list_row(0, "", false),
    ];
    assert_eq!(scroll_offset_for(ScrollRequest::PlayingFolder, &rows), 0.0);
}

#[test]
fn scroll_offset_for_playing_row_counts_a_two_line_header_above_it() {
    let rows = [list_row(1, "1 track", false), list_row(0, "3:00", true)];
    assert_eq!(scroll_offset_for(ScrollRequest::PlayingRow, &rows), 54.0);
    assert_eq!(scroll_offset_for(ScrollRequest::PlayingFolder, &rows), 0.0);
}

#[test]
fn scroll_offset_for_playing_requests_is_the_start_when_nothing_plays() {
    let rows = [list_row(0, "", false), list_row(1, "1 track", false), list_row(0, "", false)];
    assert_eq!(scroll_offset_for(ScrollRequest::PlayingRow, &rows), 0.0);
    assert_eq!(scroll_offset_for(ScrollRequest::PlayingFolder, &rows), 0.0);
    assert_eq!(scroll_offset_for(ScrollRequest::Top, &rows), 0.0);
}

#[test]
fn scroll_offset_for_a_playing_track_in_a_subfolder_of_the_real_view() {
    let mut state = state_with_queue(&["Camellia/Live/Ghost.flac", "Camellia/Ghost.flac"], Some(0));
    state.track_name = "Camellia/Live/Ghost.flac".to_string();
    let screen = view(&state, &no_supporting_line);
    assert_eq!(screen.rows[1].kind, 1);
    assert_eq!(scroll_offset_for(ScrollRequest::PlayingRow, &screen.rows), 102.0);
    assert_eq!(scroll_offset_for(ScrollRequest::PlayingFolder, &screen.rows), 48.0);
}

#[test]
fn decide_first_projection_with_rows_reveals_the_playing_row() {
    let request = decide_scroll_request(ScrollInput {
        pending: None,
        previous_page_key: None,
        page_key: "a",
        rows_empty: false,
        playing_row_shown: false,
        startup_done: true,
    });
    assert_eq!(request, Some(ScrollRequest::PlayingRow));
}

#[test]
fn decide_first_projection_without_rows_requests_nothing() {
    let request = decide_scroll_request(ScrollInput {
        pending: None,
        previous_page_key: None,
        page_key: "",
        rows_empty: true,
        playing_row_shown: false,
        startup_done: true,
    });
    assert_eq!(request, None);
}

#[test]
fn decide_same_page_requests_nothing() {
    let request = decide_scroll_request(ScrollInput {
        pending: None,
        previous_page_key: Some("a"),
        page_key: "a",
        rows_empty: false,
        playing_row_shown: false,
        startup_done: true,
    });
    assert_eq!(request, None);
}

#[test]
fn decide_a_different_page_scrolls_to_the_top() {
    let request = decide_scroll_request(ScrollInput {
        pending: None,
        previous_page_key: Some("a"),
        page_key: "b",
        rows_empty: false,
        playing_row_shown: false,
        startup_done: true,
    });
    assert_eq!(request, Some(ScrollRequest::Top));
}

#[test]
fn decide_a_different_page_without_rows_requests_nothing() {
    let request = decide_scroll_request(ScrollInput {
        pending: None,
        previous_page_key: Some("a"),
        page_key: "b",
        rows_empty: true,
        playing_row_shown: false,
        startup_done: true,
    });
    assert_eq!(request, None);
}

#[test]
fn decide_an_explicit_request_wins_over_a_page_change() {
    let request = decide_scroll_request(ScrollInput {
        pending: Some(ScrollRequest::PlayingFolder),
        previous_page_key: Some("a"),
        page_key: "b",
        rows_empty: false,
        playing_row_shown: false,
        startup_done: true,
    });
    assert_eq!(request, Some(ScrollRequest::PlayingFolder));
}

#[test]
fn decide_an_explicit_request_wins_over_the_first_projection() {
    let request = decide_scroll_request(ScrollInput {
        pending: Some(ScrollRequest::Top),
        previous_page_key: None,
        page_key: "a",
        rows_empty: false,
        playing_row_shown: false,
        startup_done: true,
    });
    assert_eq!(request, Some(ScrollRequest::Top));
}

#[test]
fn decide_an_explicit_request_is_kept_even_without_rows() {
    let request = decide_scroll_request(ScrollInput {
        pending: Some(ScrollRequest::PlayingRow),
        previous_page_key: Some("a"),
        page_key: "a",
        rows_empty: true,
        playing_row_shown: false,
        startup_done: true,
    });
    assert_eq!(request, Some(ScrollRequest::PlayingRow));
}

#[test]
fn projection_reveals_the_playing_row_on_the_first_rows() {
    let mut state = state_with_queue(&["Abba/one.mp3", "Abba/two.mp3"], Some(1));
    assert_eq!(project_once(&mut state), Some(ScrollRequest::PlayingRow));
}

#[test]
fn changing_the_playing_track_alone_requests_nothing() {
    let mut state = state_with_queue(&["Abba/one.mp3", "Abba/two.mp3"], Some(1));
    assert_eq!(project_once(&mut state), Some(ScrollRequest::PlayingRow));
    state.current_index = Some(0);
    assert_eq!(project_once(&mut state), None);
    state.current_index = Some(1);
    assert_eq!(project_once(&mut state), None);
}

#[test]
fn changing_the_selected_page_scrolls_to_the_top() {
    let mut state = state_with_queue(&["Abba/one.mp3", "Beta/two.mp3"], None);
    assert_eq!(project_once(&mut state), Some(ScrollRequest::PlayingRow));
    let beta_key = state.current_pages().page(1).map(|page| return page.identity.clone()).unwrap_or_default();
    state.selected_key = beta_key;
    assert_eq!(project_once(&mut state), Some(ScrollRequest::Top));
    assert_eq!(project_once(&mut state), None);
}

#[test]
fn empty_projections_leave_the_first_reveal_for_the_first_rows() {
    let mut state = state_with_queue(&[], None);
    assert_eq!(project_once(&mut state), None);
    state.names = std::sync::Arc::new(vec!["Abba/one.mp3".to_string(), "Abba/two.mp3".to_string()]);
    state.current_index = Some(1);
    assert_eq!(project_once(&mut state), Some(ScrollRequest::PlayingRow));
}

#[test]
fn explicit_request_wins_over_a_page_change_and_is_cleared() {
    let mut state = state_with_queue(&["Abba/one.mp3", "Beta/two.mp3"], None);
    assert_eq!(project_once(&mut state), Some(ScrollRequest::PlayingRow));
    let beta_key = state.current_pages().page(1).map(|page| return page.identity.clone()).unwrap_or_default();
    state.selected_key = beta_key;
    state.scroll_request = Some(ScrollRequest::PlayingFolder);
    assert_eq!(project_once(&mut state), Some(ScrollRequest::PlayingFolder));
    assert_eq!(state.scroll_request, None);
    assert_eq!(project_once(&mut state), None);
}

#[test]
fn explicit_request_is_cleared_when_the_queue_is_empty() {
    let mut state = state_with_queue(&[], None);
    state.scroll_request = Some(ScrollRequest::Top);
    assert_eq!(project_once(&mut state), Some(ScrollRequest::Top));
    assert_eq!(state.scroll_request, None);
}

#[test]
fn a_restored_track_that_arrives_after_the_rows_is_revealed_once() {
    let mut state = state_with_queue(&["Abba/one.mp3", "Abba/two.mp3"], None);
    assert_eq!(project_once(&mut state), Some(ScrollRequest::PlayingRow));
    assert!(!state.startup_reveal_done);
    state.current_index = Some(1);
    assert_eq!(project_once(&mut state), Some(ScrollRequest::PlayingRow));
    assert!(state.startup_reveal_done);
    state.current_index = Some(0);
    assert_eq!(project_once(&mut state), None);
}

#[test]
fn a_track_started_after_the_user_acted_is_not_revealed() {
    let mut state = state_with_queue(&["Abba/one.mp3", "Abba/two.mp3"], None);
    assert_eq!(project_once(&mut state), Some(ScrollRequest::PlayingRow));
    state.startup_reveal_done = true;
    state.current_index = Some(1);
    assert_eq!(project_once(&mut state), None);
}
