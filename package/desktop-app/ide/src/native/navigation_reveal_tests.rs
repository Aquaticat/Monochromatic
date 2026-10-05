//! Reveal intent must not continuously replace unchanged models, and canonical aliases retain reading state.

/// Share production bindings and native polling helpers without adding test interfaces to the shipped binary.
use super::{AppWindow, State, bind_appearance, bind_viewport, navigation, navigation_tests::{row, wait_until}, render};
/// Canonical project identity and source positions are the same types used in navigation.
use ide_app::{document::ReadingPosition, workspace::Workspace};
/// ModelRc equality compares underlying model identity, not only equal row values.
use slint::{ComponentHandle, Model, SharedString};
/// Native symlinks and file replacement live only in disposable directories.
use std::{cell::RefCell, fs, os::unix::fs::symlink, rc::Rc, time::{Duration, Instant}};

/// A missing current row waits for real directory changes instead of rebuilding the ListView every timer tick.
#[test]
fn missing_reveal_keeps_the_existing_model_until_tree_changes() {
    let fixture = tempfile::tempdir().expect("disposable project");
    let path = fixture.path().join("source.txt");
    fs::write(&path, "source").expect("source fixture");
    let workspace = Workspace::new(fixture.path()).expect("workspace");
    let window = AppWindow::new().expect("native window");
    let source = Rc::new(RefCell::new(State::new("source", Some(path.clone()))));
    bind_viewport(&window, &source);
    bind_appearance(&window, &source);
    let _navigation = navigation::bind(&window, &source, workspace).expect("navigation");
    window.show().expect("show window");
    render(&window, &source);
    wait_until(|| return row(&window, "source.txt").is_some());
    let original = window.get_tree_entries();
    fs::write(fixture.path().join("control.txt"), "positive control").expect("additional source");
    wait_until(|| return row(&window, "control.txt").is_some());
    // Positive control: the identity assertion must detect an actual published-model replacement.
    assert_ne!(original, window.get_tree_entries());
    fs::remove_file(&path).expect("external removal");
    wait_until(|| return row(&window, "source.txt").is_none());
    window.invoke_tree_shortcut(SharedString::from("0"), true, false, false);
    let retained = window.get_tree_entries();
    let start = Instant::now();
    wait_until(|| return start.elapsed() >= Duration::from_millis(120));
    assert_eq!(retained, window.get_tree_entries(), "unresolved reveal replaced an unchanged tree model");
    fs::write(&path, "source").expect("restore source");
    wait_until(|| return row(&window, "source.txt").is_some());
    assert_ne!(retained, window.get_tree_entries());
    assert_eq!(window.get_tree_focused_row(), row(&window, "source.txt").expect("restored revealed row"));
    window.hide().expect("close window");
}

/// Inside symlink aliases converge on the canonical row without resetting an already displayed document.
#[test]
fn contained_alias_open_preserves_current_selection_and_stops_reveal_updates() {
    let fixture = tempfile::tempdir().expect("disposable project");
    let path = fixture.path().join("source.txt");
    fs::write(&path, "source").expect("source fixture");
    symlink(&path, fixture.path().join("alias.txt")).expect("inside alias");
    let workspace = Workspace::new(fixture.path()).expect("workspace");
    let window = AppWindow::new().expect("native window");
    let source = Rc::new(RefCell::new(State::new("source", Some(path.clone()))));
    bind_viewport(&window, &source);
    bind_appearance(&window, &source);
    let _navigation = navigation::bind(&window, &source, workspace).expect("navigation");
    window.show().expect("show window");
    render(&window, &source);
    wait_until(|| return row(&window, "alias.txt").is_some());
    source.borrow_mut().document.select(ReadingPosition { anchor: 1, head: 4, viewport: 0 });
    render(&window, &source);
    let generation = source.borrow().file_generation;
    let before = window.get_tree_entries();
    window.invoke_tree_activate(row(&window, "alias.txt").expect("alias row"));
    // A completed alias open republishes recency; unchanged periodic reads do not replace the model.
    wait_until(|| return window.get_tree_entries() != before);
    assert_eq!(source.borrow().file_path.as_ref(), Some(&path));
    assert_eq!(source.borrow().file_generation, generation);
    assert_eq!(window.get_selected_text(), "our");
    let canonical = row(&window, "source.txt").expect("canonical row");
    let model = window.get_tree_entries();
    assert!(model.row_data(canonical as usize).expect("canonical metadata").selected);
    assert_eq!(model.row_data(canonical as usize).expect("canonical slot").recency, "0");
    let start = Instant::now();
    wait_until(|| return start.elapsed() >= Duration::from_millis(120));
    assert_eq!(model, window.get_tree_entries());
    window.hide().expect("close window");
}
