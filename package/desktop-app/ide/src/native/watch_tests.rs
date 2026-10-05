//! The shipped tree and source bindings follow external changes through inotify notifications,
//! fast enough that the old polling could not have produced them.

/// Tree-row lookup by label, shared with the navigation tests.
use super::navigation_tests::row;
/// The production window, source state, and the bindings the shipped application installs.
use super::{
    AppWindow, State, bind_appearance, bind_keys, bind_pointer, bind_viewport, navigation, reload,
    render,
};
/// Reading positions and the canonical project boundary.
use ide_app::{document::ReadingPosition, workspace::Workspace};
/// Real headless timers drive the same refresh timers as the shipped event loop.
use slint::{ComponentHandle, Model, SharedString, Timer, platform::update_timers_and_animations};
/// What: `Rc<RefCell<State>>` is the window's shared source state; `Path` borrows a fixture path.
/// Why: Assertions read the model the window renders, not pixels.
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

/// Every observed change must arrive within this bound. The old tree polling read one of 13 shown
/// directories every 500 ms (one visit per 6.5 s); in watched mode the source timer is the 10 s safety sweep.
const PROMPT: Duration = Duration::from_millis(1500);

/// Run native timers until `ready` holds; fail when it takes longer than `PROMPT`.
fn promptly(what: &str, mut ready: impl FnMut() -> bool) {
    let start = Instant::now();
    loop {
        update_timers_and_animations();
        if ready() {
            return;
        }
        assert!(
            start.elapsed() < PROMPT,
            "{what} did not appear within {PROMPT:?}"
        );
        std::thread::sleep(Duration::from_millis(2));
    }
}

/// A shipped window over `root`, displaying `file`, with refresh and navigation timers kept alive.
fn open(root: &Path, file: &Path) -> (AppWindow, Rc<RefCell<State>>, [Timer; 2]) {
    let text = fs::read_to_string(file).expect("displayed source");
    let workspace = Workspace::new(root).expect("workspace");
    let window = AppWindow::new().expect("native watch window");
    // `Some` marks an on-disk displayed file that the source refresh rereads.
    let state = Rc::new(RefCell::new(State::new(&text, Some(file.to_path_buf()))));
    window.set_file_label(SharedString::from(file.display().to_string()));
    bind_pointer(&window, &state);
    bind_viewport(&window, &state);
    bind_keys(&window, &state);
    bind_appearance(&window, &state);
    let refresh = reload::bind(&window, &state).expect("source refresh");
    let project = navigation::bind(&window, &state, workspace).expect("project navigation");
    window.show().expect("show watch window");
    render(&window, &state);
    return (window, state, [refresh, project]);
}

/// Depth of the visible row labelled `label`.
fn depth(window: &AppWindow, label: &str) -> Option<i32> {
    let index = row(window, label)?;
    let entry = window.get_tree_entries().row_data(index as usize)?;
    return Some(entry.depth);
}

/// Create, rename, move in, move out, and delete in the last of twelve expanded folders all show promptly.
#[test]
fn native_tree_follows_changes_in_one_of_many_expanded_folders() {
    let fixture = tempfile::tempdir().expect("disposable project");
    let displayed = fixture.path().join("view.txt");
    fs::write(&displayed, "view\n").expect("displayed source");
    fs::write(fixture.path().join("outer.txt"), "outer\n").expect("root file");
    for index in 0..12 {
        let folder = fixture.path().join(format!("folder-{index:02}"));
        fs::create_dir(&folder).expect("fixture folder");
        fs::write(folder.join(format!("seed-{index:02}.txt")), "").expect("folder seed");
    }
    let (window, _state, _timers) = open(fixture.path(), &displayed);
    for index in 0..12 {
        let label = format!("folder-{index:02}");
        super::navigation_tests::wait_until(|| return row(&window, &label).is_some());
        window.invoke_tree_activate(row(&window, &label).expect("folder row"));
        let seed = format!("seed-{index:02}.txt");
        super::navigation_tests::wait_until(|| return row(&window, &seed).is_some());
    }
    let last = fixture.path().join("folder-11");
    fs::write(last.join("created.txt"), "").expect("external create");
    promptly("a created file", || {
        return row(&window, "created.txt").is_some();
    });
    fs::rename(last.join("created.txt"), last.join("renamed.txt")).expect("external rename");
    promptly("a renamed file", || {
        return row(&window, "renamed.txt").is_some() && row(&window, "created.txt").is_none();
    });
    fs::rename(fixture.path().join("outer.txt"), last.join("outer.txt"))
        .expect("move into the folder");
    promptly("a file moved into the folder", || {
        return depth(&window, "outer.txt") == Some(1);
    });
    fs::rename(last.join("outer.txt"), fixture.path().join("outer.txt"))
        .expect("move out of the folder");
    promptly("a file moved out of the folder", || {
        return depth(&window, "outer.txt") == Some(0);
    });
    fs::remove_file(last.join("renamed.txt")).expect("external delete");
    promptly("a deleted file's removal", || {
        return row(&window, "renamed.txt").is_none();
    });
    window.hide().expect("close watch window");
}

/// Atomic replace keeps both correspondence examples; delete then recreate shows the error and recovers.
/// The displayed file's folder is collapsed in the tree, so only its own watch can report these changes.
#[test]
fn native_source_follows_atomic_replace_and_delete_then_recreate() {
    let fixture = tempfile::tempdir().expect("disposable project");
    let folder = fixture.path().join("nested");
    fs::create_dir(&folder).expect("collapsed folder");
    let displayed = folder.join("view.txt");
    fs::write(&displayed, "I am a big cat.\n").expect("displayed source");
    let (window, state, _timers) = open(fixture.path(), &displayed);
    super::navigation_tests::wait_until(|| return state.borrow().refresh.is_watched());
    let replace = |text: &str| {
        let staged = folder.join(".view.txt.tmp");
        fs::write(&staged, text).expect("staged replacement");
        fs::rename(&staged, &displayed).expect("atomic replace");
    };
    // Caret example: `I am a bi|g cat.` becomes `I was a bi|g cat.`.
    state.borrow_mut().document.select(ReadingPosition {
        anchor: 9,
        head: 9,
        viewport: 0,
    });
    replace("I was a big cat.\n");
    promptly("the caret replacement", || {
        return window.get_source_text() == "I was a big cat.\n";
    });
    assert_eq!(
        state.borrow().document.position().head,
        10,
        "the caret left the g"
    );
    fs::write(&displayed, "I am a big cat\n").expect("reset text");
    promptly("the reset text", || {
        return window.get_source_text() == "I am a big cat\n";
    });
    // Selection example: `I [am a] big cat` follows the replaced region, not the later literal.
    state.borrow_mut().document.select(ReadingPosition {
        anchor: 2,
        head: 6,
        viewport: 0,
    });
    render(&window, &state);
    replace("I was a big cat, but now I am a human!\n");
    promptly("the selection replacement", || {
        return window.get_source_text() == "I was a big cat, but now I am a human!\n";
    });
    assert_eq!(
        window.get_selected_text(),
        "was a",
        "selection followed the later literal"
    );
    fs::remove_file(&displayed).expect("delete displayed file");
    promptly("the missing-file diagnostic", || {
        return state.borrow().file_error.is_some();
    });
    assert_eq!(
        window.get_source_text(),
        "I was a big cat, but now I am a human!\n"
    );
    fs::write(&displayed, "recreated\n").expect("recreate displayed file");
    promptly("the recreated file", || {
        return window.get_source_text() == "recreated\n" && state.borrow().file_error.is_none();
    });
    assert!(
        state.borrow().refresh.is_watched(),
        "the source fell back to polling"
    );
    window.hide().expect("close watch window");
}
