//! In-file find through real window key events: open, type, step, wrap, reveal, reload, and close.

/// Bounded waits and tree-row lookup shared with the navigation tests.
use super::navigation_tests::wait_until;
/// The production window, source state, and every binding the shipped application installs.
use super::{
    AppWindow, State, bind_appearance, bind_keys, bind_pointer, bind_viewport, find, navigation,
    reload, render,
};
/// The canonical project boundary is created only over disposable fixtures.
use ide_app::workspace::Workspace;
/// Real toolkit key events reach the same capture scopes as seat input.
use slint::{
    ComponentHandle, Model, SharedString, Timer,
    platform::{Key, WindowEvent},
};
/// What: `Rc<RefCell<State>>` is the window's shared source state; `Path` borrows a filesystem name.
/// Why: Assertions read canonical character positions instead of guessing from pixels.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Shared<T> = { current: T };
/// ```
use std::{
    cell::RefCell,
    fs,
    path::Path,
    rc::Rc,
    time::{Duration, Instant},
};

/// A complete reader: source refresh, in-file find, and project navigation on one window.
pub(super) struct Reader {
    /// Native window built from the shipped markup.
    pub(super) window: AppWindow,
    /// Source state shared with every binding.
    pub(super) source: Rc<RefCell<State>>,
    /// Dropping the timers releases the reload, find, and navigation workers.
    _timers: [Timer; 3],
}

/// Memory-backed directory for fixtures, when the system has one.
const MEMORY_DIRECTORY: &str = "/dev/shm";

/// What: A fresh disposable project directory, in `/dev/shm` when that exists and the usual
///       temporary directory otherwise; dropping the `TempDir` removes it.
/// Why: On btrfs the reload worker's first read of a freshly written file updates its access
///      time inside a filesystem transaction, which waited for seconds while the machine flushed,
///      so an external change looked like it was never reloaded. inotify reports changes on
///      `/dev/shm` like on disk, so the watcher path stays the one exercised.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function memoryProject(prefix: string): TempDir
/// ```
pub(super) fn memory_project(prefix: &str) -> tempfile::TempDir {
    let memory = Path::new(MEMORY_DIRECTORY);
    if memory.is_dir()
        && let Ok(directory) = tempfile::Builder::new().prefix(prefix).tempdir_in(memory)
    {
        return directory;
    }
    return tempfile::tempdir().expect("disposable project");
}

/// What: Replace the contents of `path` as an editor's atomic save does: write a hidden sibling
///       file, then rename it over `path`. `&Path` and `&str` are lent read-only.
/// Why: An in-place write truncates the file first and writes the text after. A test thread
///      descheduled between the two for longer than the 50 ms write-quiet period is read
///      mid-write by design (`WRITE_QUIET` in `src/refresh_policy.rs`), and the reload of the
///      empty file loses the selection these tests follow. A rename shows the whole text at once.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function replaceFile(path: string, text: string): void { writeFileSync(sibling, text); renameSync(sibling, path); }
/// ```
pub(super) fn replace_file(path: &Path, text: &str) {
    // `file_name` is the last path component; `to_string_lossy` reads it as text for the sibling's name.
    let name = path.file_name().expect("file name").to_string_lossy();
    let sibling = path.with_file_name(format!(".{name}.replacement"));
    fs::write(&sibling, text).expect("replacement text");
    fs::rename(&sibling, path).expect("replace the file");
}

/// Open `name` inside the disposable project with every production binding installed.
pub(super) fn reader(root: &Path, name: &str) -> Reader {
    let path = root.join(name);
    // What: `expect` extracts a successful value or fails the test with this message.
    // Why: Fixture setup failures are test defects, not behavior under test.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const text = readFileSync(path, 'utf8');
    // ```
    let text = fs::read_to_string(&path).expect("fixture source");
    let workspace = Workspace::new(root).expect("disposable workspace");
    let window = AppWindow::new().expect("native find window");
    // What: `Some(path.clone())` stores an owned copy of the path as the displayed file.
    // Why: Reload and navigation both need the file identity while the test keeps its own copy.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const source = { current: new State(text, path) };
    // ```
    let source = Rc::new(RefCell::new(State::new(&text, Some(path.clone()))));
    window.set_file_label(SharedString::from(path.display().to_string()));
    bind_pointer(&window, &source);
    bind_viewport(&window, &source);
    bind_keys(&window, &source);
    bind_appearance(&window, &source);
    let refresh = reload::bind(&window, &source).expect("source refresh");
    let finder = find::bind(&window, &source).expect("in-file find");
    let project = navigation::bind(&window, &source, workspace).expect("project navigation");
    window.show().expect("show find window");
    render(&window, &source);
    window.window().take_snapshot().expect("initial layout");
    window.invoke_focus_source();
    return Reader {
        window,
        source,
        _timers: [refresh, finder, project],
    };
}

/// Press and release one key through the window, exactly like a seat key event.
pub(super) fn key(window: &AppWindow, text: impl Into<SharedString>) {
    let encoded: SharedString = text.into();
    window.window().dispatch_event(WindowEvent::KeyPressed {
        text: encoded.clone(),
    });
    window
        .window()
        .dispatch_event(WindowEvent::KeyReleased { text: encoded });
}

/// Hold one modifier around one key, releasing it afterwards.
pub(super) fn chord(window: &AppWindow, modifier: Key, text: impl Into<SharedString>) {
    window.window().dispatch_event(WindowEvent::KeyPressed {
        text: modifier.into(),
    });
    key(window, text);
    window.window().dispatch_event(WindowEvent::KeyReleased {
        text: modifier.into(),
    });
}

/// Type text one character at a time into whatever has keyboard focus.
pub(super) fn type_text(window: &AppWindow, text: &str) {
    for character in text.chars() {
        key(window, SharedString::from(character.to_string()));
    }
}

/// Wait until the bar shows exactly this count text.
pub(super) fn status(window: &AppWindow, expected: &str) {
    wait_until(|| return window.get_find_status() == expected);
}

/// Advance native timers until `ready` holds, failing with a message naming the missing behavior.
pub(super) fn eventually(message: &str, mut ready: impl FnMut() -> bool) {
    let start = Instant::now();
    loop {
        slint::platform::update_timers_and_animations();
        if ready() {
            return;
        }
        assert!(start.elapsed() < Duration::from_secs(5), "{message}");
        std::thread::sleep(Duration::from_millis(2));
    }
}

/// What: `fn status_for(window: &AppWindow, query: &str, expected: &str)` takes three borrowed values
///       (`&` lends them; the caller keeps ownership) and waits for one combined condition:
///       the bar shows `expected`, and the active match, which is the reading selection,
///       spells the whole `query` ignoring case.
/// Why:  Typing sends one find request per character, and a reply for a shorter prefix can
///       show the same count; `n` and `needle` both give 301 matches in the paint fixture,
///       and `am ` and `am a` both give one in the reload fixture. Waiting on the count alone
///       let those tests assert against the prefix's results and fail intermittently.
/// Gotcha: Only use this after typing, with an `expected` count whose active index is at least 1;
///         a `0/N` count has no active match, so the selection never spells the query.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function statusFor(window: AppWindow, query: string, expected: string): void {
///   eventually(`results for "${query}" did not arrive`, () =>
///     window.findStatus === expected &&
///     window.selectedText.toLowerCase() === query.toLowerCase());
/// }
/// ```
pub(super) fn status_for(window: &AppWindow, query: &str, expected: &str) {
    // What: `format!` builds a `String` from a template, like a TS template literal.
    // Why: The failure message names the query whose results never arrived.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const message = `results for "${query}" did not reach ${expected}`;
    // ```
    let message = format!("results for {query:?} did not reach {expected}");
    // What: `&message` lends the text; `|| return ...` is a zero-argument arrow function.
    //       `.to_lowercase()` returns a new lower-cased `String` and leaves the original unchanged.
    // Why: Find is case-insensitive, so the active match may differ from the query only in case.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // eventually(message, () => window.findStatus === expected
    //   && window.selectedText.toLowerCase() === query.toLowerCase());
    // ```
    eventually(&message, || {
        return window.get_find_status() == expected
            && window.get_selected_text().to_lowercase() == query.to_lowercase();
    });
}

/// Let several polling ticks and any worker reply pass before asserting that nothing changed.
pub(super) fn settle() {
    let start = Instant::now();
    while start.elapsed() < Duration::from_millis(120) {
        slint::platform::update_timers_and_animations();
        std::thread::sleep(Duration::from_millis(2));
    }
}

/// The selection as (start, end) source character positions.
pub(super) fn selection(reader: &Reader) -> (usize, usize) {
    let position = reader.source.borrow().document.position();
    return (
        position.anchor.min(position.head),
        position.anchor.max(position.head),
    );
}

/// Ctrl+F, typing, Enter, Shift+Enter, wrapping, reveal, Escape, and the remembered query.
#[test]
fn native_find_opens_types_steps_wraps_reveals_and_closes() {
    let fixture = tempfile::tempdir().expect("disposable find project");
    let filler = "ordinary line\n".repeat(80);
    let text = format!("first needle\n{filler}second Needle here\n{filler}third NEEDLE\n");
    fs::write(fixture.path().join("find.txt"), &text).expect("find fixture");
    let reader = reader(fixture.path(), "find.txt");
    let window = &reader.window;
    assert!(!window.get_find_open());
    chord(window, Key::Control, "f");
    assert!(window.get_find_open(), "Ctrl+F did not open the find bar");
    assert!(
        window.get_find_has_focus(),
        "Ctrl+F did not focus the find input"
    );
    type_text(window, "needle");
    assert_eq!(window.get_find_query(), "needle");
    status_for(window, "needle", "1/3");
    assert_eq!(selection(&reader), (6, 12));
    assert!(window.get_selection_is_match());
    assert_eq!(
        window.get_source_text(),
        text.as_str(),
        "find changed source"
    );
    let second = 13 + filler.chars().count() + 7;
    let third = second + 12 + filler.chars().count() + 6;
    key(window, Key::Return);
    status(window, "2/3");
    assert_eq!(selection(&reader), (second, second + 6));
    assert_eq!(
        window.get_selected_text(),
        "Needle",
        "copy must use original source text"
    );
    let offset = -window.get_scroll_y();
    let height = window.get_viewport_height();
    let row = 81.0 * 24.0;
    assert!(
        offset > 0.0 && row >= offset && row + 24.0 <= offset + height,
        "the second match on line 82 was not scrolled into view: offset {offset}, height {height}"
    );
    key(window, Key::Return);
    status(window, "3/3");
    assert_eq!(selection(&reader), (third, third + 6));
    key(window, Key::Return);
    status(window, "1/3");
    assert_eq!(
        selection(&reader),
        (6, 12),
        "next after the last match must wrap to the first"
    );
    assert!(
        -window.get_scroll_y() < 24.0,
        "wrapping did not reveal the first match"
    );
    chord(window, Key::Shift, Key::Return);
    status(window, "3/3");
    assert_eq!(
        selection(&reader),
        (third, third + 6),
        "previous before the first match must wrap to the last"
    );
    chord(window, Key::Shift, Key::Return);
    status(window, "2/3");
    assert!(
        !window.get_search_open(),
        "Shift+Enter must not count as double-Shift"
    );
    key(window, Key::Escape);
    assert!(!window.get_find_open(), "Escape did not close the find bar");
    assert!(!window.get_find_has_focus());
    assert_eq!(
        window.get_source_matches().row_count(),
        0,
        "highlights survived closing"
    );
    assert!(!window.get_selection_is_match());
    assert_eq!(window.get_find_status(), "");
    settle();
    assert!(
        window.get_find_status() == ""
            && !window.get_selection_is_match()
            && window.get_source_matches().row_count() == 0,
        "highlights returned after closing"
    );
    assert_eq!(
        window.get_selected_text(),
        "Needle",
        "the last active match must stay selected"
    );
    type_text(window, "typed into source");
    assert_eq!(window.get_source_text(), text.as_str());
    assert_eq!(
        window.get_find_query(),
        "needle",
        "typing reached the closed find input"
    );
    chord(window, Key::Control, "f");
    assert!(window.get_find_open());
    assert_eq!(
        window.get_find_query(),
        "needle",
        "the previous find text was not kept"
    );
    status(window, "2/3");
    type_text(window, "z");
    assert_eq!(
        window.get_find_query(),
        "z",
        "the previous find text was not selected for replacement"
    );
    status(window, "No matches");
    assert!(window.get_find_no_match());
    assert_eq!(window.get_find_status_detail(), "No matches");
    key(window, Key::Return);
    assert_eq!(
        window.get_selected_text(),
        "Needle",
        "Enter without matches moved the selection"
    );
    window.hide().expect("close find window");
}

/// A reload while the bar is open recomputes matches and keeps the active match by correspondence.
#[test]
fn native_find_recomputes_after_external_reload_and_follows_selection_correspondence() {
    let fixture = memory_project("ide-find-reload-");
    let path = fixture.path().join("cat.txt");
    fs::write(&path, "I am a big cat\n").expect("reload fixture");
    let reader = reader(fixture.path(), "cat.txt");
    let window = &reader.window;
    // The external changes below reach the reader through its live watch, not the sweep.
    wait_until(|| return reader.source.borrow().refresh.is_watched());
    chord(window, Key::Control, "f");
    type_text(window, "am a");
    status_for(window, "am a", "1/1");
    assert_eq!(selection(&reader), (2, 6));
    let revision = reader.source.borrow().document.revision();
    replace_file(&path, "A new first line\nI am a big cat\n");
    wait_until(|| return reader.source.borrow().document.revision() > revision);
    eventually(
        "matches were not recomputed for the reloaded revision",
        || {
            return window.get_selection_is_match() && window.get_find_status() == "1/1";
        },
    );
    assert_eq!(
        selection(&reader),
        (19, 23),
        "the active match did not follow its moved text"
    );
    assert_eq!(window.get_selected_text(), "am a");
    let moved = reader.source.borrow().document.revision();
    replace_file(
        &path,
        "A new first line\nI was a big cat, but now I am a human!\n",
    );
    wait_until(|| return reader.source.borrow().document.revision() > moved);
    eventually(
        "the selection must follow the replaced region, not jump to a later match",
        || return window.get_find_status() == "0/1",
    );
    assert_eq!(window.get_selected_text(), "was a");
    assert!(!window.get_selection_is_match());
    assert_eq!(
        window.get_source_matches().row_count(),
        1,
        "the later match was not marked after the replacement reload"
    );
    key(window, Key::Return);
    status(window, "1/1");
    assert_eq!(selection(&reader), (44, 48));
    assert_eq!(window.get_selected_text(), "am a");
    window.hide().expect("close reload window");
}

/// Matches are drawn only for materialized rows, and a far column is scrolled into view.
#[test]
fn native_find_paints_visible_matches_only_and_reveals_far_columns() {
    let fixture = tempfile::tempdir().expect("disposable paint project");
    let wide = format!("{}needle\n", "x".repeat(400));
    let text = format!("{}{wide}", "needle here\n".repeat(300));
    fs::write(fixture.path().join("many.txt"), &text).expect("paint fixture");
    let reader = reader(fixture.path(), "many.txt");
    let window = &reader.window;
    chord(window, Key::Control, "f");
    type_text(window, "needle");
    status_for(window, "needle", "1/301");
    let rows = reader.source.borrow().count;
    let painted = window.get_source_matches().row_count();
    assert!(
        painted > 0 && painted < rows,
        "expected fewer than {rows} visible match rectangles, found {painted}"
    );
    let first = window
        .get_source_matches()
        .row_data(0)
        .expect("first other match");
    assert!(
        first.width > 40.0 && first.height == 24.0,
        "a match rectangle must cover its six characters on one row"
    );
    chord(window, Key::Shift, Key::Return);
    status(window, "301/301");
    let horizontal = -window.get_scroll_x();
    assert!(
        horizontal > 0.0,
        "a match 400 columns to the right was not scrolled into view"
    );
    let reading = reader.source.borrow();
    let view = reading.shaped.as_ref().expect("shaped source");
    let (start, end) = (text.chars().count() - 7, text.chars().count() - 1);
    let rectangle = view.range(start, end)[0];
    assert!(
        rectangle.x >= horizontal
            && rectangle.x + rectangle.width <= horizontal + window.get_viewport_width(),
        "the active match is outside the horizontal viewport"
    );
    drop(reading);
    window.hide().expect("close paint window");
}
