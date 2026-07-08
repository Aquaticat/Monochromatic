// Unit tests for `crate::model` (the pane-strip spawn/dedup/close state machine). Exempt from
// require-rustdoc/max-lines because the file name ends in `_tests.rs`.

use std::path::PathBuf;

use crate::model::PaneStripState;
use crate::types::PaneLocation;

fn dir(path: &str) -> PaneLocation {
    PaneLocation::Directory(PathBuf::from(path))
}

fn preview(path: &str) -> PaneLocation {
    PaneLocation::Preview(PathBuf::from(path))
}

#[test]
fn open_root_places_pane_in_column_zero_and_focuses() {
    let mut strip = PaneStripState::new();
    let root = strip.open_root(dir("/home"));
    assert_eq!(strip.len(), 1);
    assert_eq!(strip.active(), Some(root));
    assert_eq!(strip.pane(root).expect("root pane").column, 0);
    assert_eq!(strip.columns()[0], vec![root]);
}

#[test]
fn spawn_child_opens_next_column_and_focuses_child() {
    let mut strip = PaneStripState::new();
    let root = strip.open_root(dir("/home"));
    let child = strip.spawn_child(root, dir("/home/docs"), false);
    assert_ne!(root, child);
    assert_eq!(strip.pane(child).expect("child pane").column, 1);
    assert_eq!(strip.active(), Some(child));
    assert_eq!(strip.len(), 2);
}

#[test]
fn revisiting_a_location_dedups_and_focuses_existing() {
    let mut strip = PaneStripState::new();
    let root = strip.open_root(dir("/home"));
    let first = strip.spawn_child(root, dir("/home/docs"), false);
    strip.focus(root);
    let again = strip.spawn_child(root, dir("/home/docs"), false);
    assert_eq!(first, again);
    assert_eq!(strip.len(), 2);
    assert_eq!(strip.active(), Some(first));
}

#[test]
fn ctrl_click_forces_a_duplicate_pane() {
    let mut strip = PaneStripState::new();
    let root = strip.open_root(dir("/home"));
    let first = strip.spawn_child(root, dir("/home/docs"), false);
    let dup = strip.spawn_child(root, dir("/home/docs"), true);
    assert_ne!(first, dup);
    assert_eq!(strip.len(), 3);
}

#[test]
fn close_removes_pane_and_clears_dedup() {
    let mut strip = PaneStripState::new();
    let root = strip.open_root(dir("/home"));
    let child = strip.spawn_child(root, dir("/home/docs"), false);
    strip.close(child);
    assert_eq!(strip.len(), 1);
    assert!(strip.pane(child).is_none());
    let respawn = strip.spawn_child(root, dir("/home/docs"), false);
    assert_ne!(child, respawn);
    assert_eq!(strip.len(), 2);
}

#[test]
fn close_column_removes_all_panes_in_it() {
    let mut strip = PaneStripState::new();
    let root = strip.open_root(dir("/home"));
    strip.spawn_child(root, dir("/home/a"), false);
    strip.spawn_child(root, dir("/home/b"), false);
    assert_eq!(strip.columns()[1].len(), 2);
    strip.close_column(1);
    assert_eq!(strip.len(), 1);
    assert!(strip.columns()[1].is_empty());
}

#[test]
fn close_right_of_clears_the_tail() {
    let mut strip = PaneStripState::new();
    let root = strip.open_root(dir("/home"));
    let a = strip.spawn_child(root, dir("/home/a"), false);
    strip.spawn_child(a, dir("/home/a/b"), false);
    strip.close_right_of(0);
    assert_eq!(strip.len(), 1);
    assert_eq!(strip.active(), None);
}

#[test]
fn preview_and_directory_locations_are_distinct_keys() {
    let mut strip = PaneStripState::new();
    let root = strip.open_root(dir("/home"));
    let listing = strip.spawn_child(root, dir("/home/x"), false);
    let prev = strip.spawn_child(root, preview("/home/x"), false);
    assert_ne!(listing, prev);
    assert_eq!(strip.len(), 3);
}
