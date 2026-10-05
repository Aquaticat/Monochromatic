//! Search crosses real native key capture, debounce, subprocess, and source-open boundaries.

/// Existing timer waits enforce a finite deadline for observable native state.
use super::navigation_tests::{row, wait_until};
/// Reuse the production window and source bindings, not a parallel test-only overlay.
use super::{AppWindow, State, bind_appearance, bind_keys, bind_viewport, navigation};
/// Project boundary creation reads only disposable fixtures.
use ide_app::workspace::Workspace;
/// Real toolkit key events drive capture before focused input handling.
use slint::{
    ComponentHandle, Model, SharedString, Timer,
    platform::{Key, WindowEvent},
};
/// Fixture writes never touch shared project state.
use std::{
    cell::RefCell,
    fs,
    path::Path,
    rc::Rc,
    time::{Duration, Instant},
};

/// The retained timer owns navigation until the test window is released.
struct Reader {
    /// Native consumer window, including the actual imported search markup.
    window: AppWindow,
    /// Source state lets assertions inspect canonical character positions, not pixel guesses.
    source: Rc<RefCell<State>>,
    /// Drop ends polling and releases the worker owners.
    _timer: Timer,
}

/// Bind a source-empty reader so the first successful search result controls initial installation.
fn reader(root: &Path) -> Reader {
    let workspace = Workspace::new(root).expect("disposable workspace");
    let window = AppWindow::new().expect("native search window");
    let source = Rc::new(RefCell::new(State::new("", None)));
    window.set_source_available(false);
    bind_viewport(&window, &source);
    bind_keys(&window, &source);
    bind_appearance(&window, &source);
    let timer =
        navigation::bind(&window, &source, workspace).expect("navigation and search workers");
    window.show().expect("show native search");
    window.window().take_snapshot().expect("initial layout");
    window.invoke_focus_tree();
    return Reader {
        window,
        source,
        _timer: timer,
    };
}

/// What: Key enum values convert to the toolkit's encoded key text, then press/release events are dispatched.
/// Why: Calling the shortcut callback directly would not test whether the outer FocusScope receives input.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// window.dispatchEvent(keydown(key));
/// window.dispatchEvent(keyup(key));
/// ```
fn key(window: &AppWindow, key: Key) {
    window
        .window()
        .dispatch_event(WindowEvent::KeyPressed { text: key.into() });
    window
        .window()
        .dispatch_event(WindowEvent::KeyReleased { text: key.into() });
}

/// Two native Shift releases should focus the transient query input from either tree or source.
fn open(window: &AppWindow) {
    key(window, Key::Shift);
    key(window, Key::Shift);
    assert!(
        window.get_search_open(),
        "double-Shift did not open the native search overlay"
    );
    window
        .window()
        .take_snapshot()
        .expect("opened overlay layout");
}

/// Search completion means accepted results or a visible diagnostic, not merely elapsed debounce time.
fn query(window: &AppWindow, raw: &str) {
    window.invoke_search_edited(SharedString::from(raw));
    assert!(window.get_search_busy());
    assert_eq!(
        window.get_search_entries().row_count(),
        0,
        "old rows survived a new query"
    );
    wait_until(|| return !window.get_search_busy());
}

/// Filename results precede contents; content-only results can move inside the already displayed file.
#[test]
fn native_search_orders_results_filters_contents_and_reveals_source_lines() {
    let fixture = tempfile::tempdir().expect("disposable search project");
    let text = format!("{}needle here\n", "ordinary line\n".repeat(119));
    fs::write(fixture.path().join("needle-file.txt"), &text).expect("matching path and content");
    fs::write(fixture.path().join("other.txt"), "needle in another file")
        .expect("content-only match");
    fs::write(fixture.path().join("[.txt"), "plain text").expect("literal invalid-regex path");
    let reader = reader(fixture.path());
    wait_until(|| return row(&reader.window, "needle-file.txt").is_some());
    open(&reader.window);
    query(&reader.window, "needle");
    assert_eq!(reader.window.get_search_entries().row_count(), 3);
    assert_eq!(
        reader
            .window
            .get_search_entries()
            .row_data(0)
            .expect("first result")
            .detail,
        "File"
    );
    key(&reader.window, Key::UpArrow);
    assert_eq!(reader.window.get_search_selected(), 2);
    key(&reader.window, Key::DownArrow);
    assert_eq!(reader.window.get_search_selected(), 0);
    key(&reader.window, Key::Return);
    wait_until(|| return reader.window.get_source_text() == text.as_str());
    assert!(!reader.window.get_search_open());
    let generation = reader.source.borrow().file_generation;
    open(&reader.window);
    query(&reader.window, "%needle");
    let model = reader.window.get_search_entries();
    assert_eq!(model.row_count(), 2);
    let target = (0..model.row_count())
        .find(|index| return model.row_data(*index).expect("content row").path == "needle-file.txt")
        .expect("current file content hit");
    reader.window.invoke_search_choose(target as i32);
    assert_eq!(
        reader.source.borrow().file_generation,
        generation,
        "same-file content hit reloaded source"
    );
    assert_eq!(
        reader.source.borrow().document.position().head,
        "ordinary line\n".chars().count() * 119
    );
    assert!(
        reader.window.get_scroll_y() < 0.0,
        "content line did not scroll into view"
    );
    open(&reader.window);
    query(&reader.window, "[");
    assert_eq!(reader.window.get_search_entries().row_count(), 1);
    assert!(reader.window.get_search_error().contains("Content search"));
    key(&reader.window, Key::Escape);
    assert!(!reader.window.get_search_open());
    assert_eq!(reader.window.get_source_text(), text.as_str());
    reader.window.hide().expect("close search reader");
}

/// Tree-selected scope stays fixed during a query, and closing invalidates late result publication.
#[test]
fn native_search_scopes_to_tree_directory_and_close_clears_pending_results() {
    let fixture = tempfile::tempdir().expect("disposable scoped project");
    fs::create_dir(fixture.path().join("nested")).expect("nested directory");
    fs::write(fixture.path().join("needle-root.txt"), "needle root").expect("root hit");
    fs::write(
        fixture.path().join("nested/needle-child.txt"),
        "needle child",
    )
    .expect("child hit");
    let reader = reader(fixture.path());
    wait_until(|| return row(&reader.window, "nested").is_some());
    reader
        .window
        .invoke_tree_user_focus(row(&reader.window, "nested").expect("directory row"));
    open(&reader.window);
    assert_eq!(reader.window.get_search_scope(), "nested");
    query(&reader.window, "needle");
    assert_eq!(reader.window.get_search_entries().row_count(), 2);
    reader.window.invoke_search_edited("not-present".into());
    reader.window.invoke_search_edited("needle".into());
    key(&reader.window, Key::Escape);
    assert!(!reader.window.get_search_open());
    assert!(!reader.window.get_search_busy());
    let closed = Instant::now();
    wait_until(|| return closed.elapsed() >= Duration::from_millis(250));
    assert_eq!(
        reader.window.get_search_entries().row_count(),
        0,
        "closed overlay accepted a late query"
    );
    open(&reader.window);
    // Reopening an already visible overlay must retain its original focus-return destination.
    open(&reader.window);
    assert_eq!(reader.window.get_search_query(), "");
    reader.window.invoke_search_edited("%  ".into());
    assert!(!reader.window.get_search_busy());
    assert_eq!(reader.window.get_search_entries().row_count(), 0);
    reader.window.invoke_search_dismiss();
    assert!(
        reader.window.get_tree_has_focus(),
        "dismiss did not restore tree focus"
    );
    reader.window.hide().expect("close scoped reader");
}
