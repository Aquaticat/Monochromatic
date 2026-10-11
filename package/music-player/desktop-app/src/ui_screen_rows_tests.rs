//! Tests for the pure row and picker conversions in `ui_screen_rows`.

use super::*;
use music_player::folder_rail::rail_for;
use music_player::track_entries::TrackRowModel;

/// What: `track(index, title, current)` builds a track entry for the row tests.
fn track(index: usize, title: &str, current: bool) -> TrackListEntry {
    return TrackListEntry::RowEntry(TrackRowModel {
        index_in_library: index,
        title: title.to_string(),
        supporting_line: Some(format!("line {index}")),
        is_current: current,
    });
}

#[test]
fn track_rows_keep_index_title_supporting_line_and_current_flag() {
    let rows = list_rows(&[track(4, "Ghost", true)]);
    assert_eq!(
        rows,
        vec![ListRow {
            kind: 0,
            title: "Ghost".to_string(),
            supporting: "line 4".to_string(),
            current: true,
            index: 4,
        }]
    );
}

#[test]
fn track_without_supporting_line_has_empty_second_line() {
    let entry = TrackListEntry::RowEntry(TrackRowModel {
        index_in_library: 0,
        title: "Bare".to_string(),
        supporting_line: None,
        is_current: false,
    });
    assert_eq!(list_rows(&[entry])[0].supporting, "");
}

#[test]
fn header_row_has_kind_one_count_text_and_no_index() {
    let rows = list_rows(&[TrackListEntry::HeaderEntry {
        name: "Live".to_string(),
        track_count: 3,
    }]);
    assert_eq!(rows[0].kind, 1);
    assert_eq!(rows[0].title, "Live");
    assert_eq!(rows[0].supporting, "3 tracks");
    assert_eq!(rows[0].index, -1);
    assert!(!rows[0].current);
}

#[test]
fn track_count_text_uses_singular_only_for_one() {
    assert_eq!(track_count_text(0), "0 tracks");
    assert_eq!(track_count_text(1), "1 track");
    assert_eq!(track_count_text(2), "2 tracks");
}

#[test]
fn current_row_position_counts_headers_and_returns_minus_one_without_current() {
    let rows = list_rows(&[
        TrackListEntry::HeaderEntry {
            name: "Live".to_string(),
            track_count: 1,
        },
        track(1, "Ghost", false),
        track(2, "Hyperflux", true),
    ]);
    assert_eq!(current_row_position(&rows), 2);
    let none = list_rows(&[track(0, "Ghost", false)]);
    assert_eq!(current_row_position(&none), -1);
    assert_eq!(current_row_position(&[]), -1);
}

#[test]
fn picker_heading_rows_precede_each_cell_and_hold_its_names() {
    let sections = rail_for(&["Abba".to_string(), "Beta".to_string()]);
    let picker = picker(&sections, "Beta");
    let headings: Vec<&PickerName> = picker.names.iter().filter(|row| return row.section_start).collect();
    assert_eq!(headings.len(), 2);
    assert_eq!(headings[0].heading, "A");
    let beta_names: Vec<&str> = picker
        .names
        .iter()
        .filter(|row| return !row.section_start && row.heading == "B")
        .map(|row| return row.name.as_str())
        .collect();
    assert_eq!(beta_names, vec!["Beta"]);
}

#[test]
fn picker_highlights_the_cell_holding_the_current_folder() {
    let sections = rail_for(&["Abba".to_string(), "Beta".to_string()]);
    assert_eq!(picker(&sections, "Beta").current_cell, "B");
    assert_eq!(picker(&sections, "Missing").current_cell, "");
}

#[test]
fn picker_cell_key_equals_its_label() {
    let sections = rail_for(&["Abba".to_string()]);
    let picker = picker(&sections, "Abba");
    assert_eq!(picker.cells.len(), 1);
    assert_eq!(picker.cells[0].key, picker.cells[0].label);
}
