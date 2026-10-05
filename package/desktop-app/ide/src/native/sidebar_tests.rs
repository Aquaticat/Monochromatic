//! Real pointer press, move, and release on the sidebar divider: resize, both bounds, and the drag origin.

/// The shipped window and source state, with the bindings that repaint source when its width changes.
use super::{
    AppWindow, State, bind_appearance, bind_keys, bind_pointer, bind_viewport, render,
    ui::TreeEntry,
};
/// Window events reach the same items as seat input delivered by a windowing backend.
use slint::{
    ComponentHandle, LogicalPosition, LogicalSize, ModelRc, SharedString, VecModel,
    platform::{PointerEventButton, WindowEvent, update_timers_and_animations},
};
/// What: `Rc` is a shared pointer for one thread (sibling `Arc` works across threads); `RefCell` and
/// `Cell` allow changing a value behind a shared pointer, `Cell` for small copied values such as a number.
/// Why: The window callbacks and the test body both need the same source state and recorded row index.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Shared<T> = { current: T };
/// ```
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
};

/// What: `pub(super) const NAME: f32` is a compile-time constant visible to sibling test modules;
/// `f32` is a 32-bit float (sibling `f64`), the type Slint uses for logical pixels.
/// Why: The narrowest sidebar the layout allows is a documented value the tests pin.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const MINIMUM = 160;
/// ```
pub(super) const MINIMUM: f32 = 160.0;
/// Width of the divider's own layout cell, which is also its whole input area.
pub(super) const DIVIDER: f32 = 48.0;
/// Narrowest source column; the widest sidebar is the window width minus this and the divider.
pub(super) const SOURCE_MINIMUM: f32 = 240.0;
/// Width of the line-number gutter at the left edge of the source column.
pub(super) const GUTTER: f32 = 56.0;
/// Height of the project and file label rows above the tree and the source.
pub(super) const HEADER: f32 = 32.0;
/// Vertical position used for divider drags, inside the tree rows and the source lines.
pub(super) const DRAG_Y: f32 = 300.0;

/// What: A record owning the window, the shared source state, and the last activated tree row.
/// Why: Every sidebar test drives one window and then reads these three things.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Fixture = { window: AppWindow; source: Shared<State>; activated: Shared<number> };
/// ```
pub(super) struct Fixture {
    /// Native window built from the shipped markup.
    pub(super) window: AppWindow,
    /// Source state shared with the pointer, key, and viewport bindings.
    pub(super) source: Rc<RefCell<State>>,
    /// Model index of the last tree row a click activated, or -1.
    pub(super) activated: Rc<Cell<i32>>,
}

/// What: `usize` is an unsigned index-sized integer (siblings `u32`, `i32`); `ModelRc<TreeEntry>` is the
/// shared list type the window accepts for tree rows.
/// Why: Tests choose a row count that does or does not overflow the tree, which decides whether the
/// tree shows its scrollbar beside the divider.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function entries(count: number): TreeEntry[];
/// ```
fn entries(count: usize) -> ModelRc<TreeEntry> {
    // What: `Vec::new()` is an empty growable array; `mut` allows pushing into it.
    // Why: Rows are built one at a time with a plain loop.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const rows: TreeEntry[] = [];
    // ```
    let mut rows = Vec::new();
    for index in 0..count {
        // What: `..TreeEntry::default()` fills every field not named here with its default value;
        // `format!` builds an owned string and `SharedString::from` converts it to Slint's string type.
        // Why: Only the label matters for these rows.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // rows.push({ ...defaultEntry, label: `source-${index}.txt` });
        // ```
        rows.push(TreeEntry {
            label: SharedString::from(format!("source-{index}.txt")),
            ..TreeEntry::default()
        });
    }
    // What: `VecModel::from` wraps the array as a Slint model, `Rc::new` shares it, `ModelRc::from` erases
    // the concrete model type.
    // Why: The window property accepts only the erased shared model.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return rows;
    // ```
    return ModelRc::from(Rc::new(VecModel::from(rows)));
}

/// What: `&AppWindow` lends the window without giving it away; the two `f32` values are logical pixels.
/// Why: Tests set an exact window size before measuring layout.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function resize(window: AppWindow, width: number, height: number): void;
/// ```
pub(super) fn resize(window: &AppWindow, width: f32, height: f32) {
    // What: `WindowEvent::Resized { size }` is one variant of an event union, built with a named field.
    // Why: Dispatching the event is how a windowing backend reports a new window size.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // window.dispatchEvent({ kind: 'resized', size: { width, height } });
    // ```
    window.window().dispatch_event(WindowEvent::Resized {
        size: LogicalSize::new(width, height),
    });
    settle(window);
}

/// Run queued change handlers, force layout through a rendered frame, then run handlers the frame queued.
pub(super) fn settle(window: &AppWindow) {
    update_timers_and_animations();
    // What: `expect` returns the successful value or fails the test with this message.
    // Why: A frame that cannot render is a broken fixture, not behavior under test.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // window.takeSnapshot(); // throws on failure
    // ```
    window
        .window()
        .take_snapshot()
        .expect("settled sidebar layout");
    update_timers_and_animations();
}

/// Press one pointer button at a window position.
pub(super) fn press(window: &AppWindow, x: f32, y: f32, button: PointerEventButton) {
    window.window().dispatch_event(WindowEvent::PointerPressed {
        position: LogicalPosition::new(x, y),
        button,
    });
}

/// Move the pointer to a window position; a held button turns this into a drag.
pub(super) fn motion(window: &AppWindow, x: f32, y: f32) {
    window.window().dispatch_event(WindowEvent::PointerMoved {
        position: LogicalPosition::new(x, y),
    });
}

/// Release one pointer button at a window position.
pub(super) fn release(window: &AppWindow, x: f32, y: f32, button: PointerEventButton) {
    window
        .window()
        .dispatch_event(WindowEvent::PointerReleased {
            position: LogicalPosition::new(x, y),
            button,
        });
}

/// Press and release the left button at one position, then let the window settle.
pub(super) fn click(window: &AppWindow, x: f32, y: f32) {
    press(window, x, y, PointerEventButton::Left);
    release(window, x, y, PointerEventButton::Left);
    settle(window);
}

/// Drag the divider's line with the left button until the sidebar is `target` wide.
pub(super) fn drag_to(window: &AppWindow, target: f32) {
    let line = window.get_sidebar_width() + DIVIDER / 2.0;
    let end = line + target - window.get_sidebar_width();
    press(window, line, DRAG_Y, PointerEventButton::Left);
    motion(window, end, DRAG_Y);
    release(window, end, DRAG_Y, PointerEventButton::Left);
    settle(window);
}

/// A 1100 by 660 window with a visible project of `rows` files and a displayed source of long lines.
pub(super) fn fixture(rows: usize) -> Fixture {
    // What: `String::new()` is an empty owned string; `push_str(&line)` appends a borrowed string.
    // Why: 120 lines of 160 columns overflow the source view in both directions.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const text = `${'0123456789'.repeat(16)}\n`.repeat(120);
    // ```
    let line = "0123456789".repeat(16);
    let mut text = String::new();
    for _ in 0..120 {
        text.push_str(&line);
        text.push('\n');
    }
    let window = AppWindow::new().expect("native sidebar window");
    // What: `Rc::new(RefCell::new(value))` puts the state behind a shared, checked-mutable pointer;
    // `None` means the source has no file on disk.
    // Why: Production bindings take the state in exactly this form.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const source = { current: new State(text, undefined) };
    // ```
    let source = Rc::new(RefCell::new(State::new(&text, None)));
    window.set_project_visible(true);
    window.set_tree_entries(entries(rows));
    let activated = Rc::new(Cell::new(-1));
    // What: `Rc::clone` copies the pointer, not the number; `move |index|` is a callback that takes
    // ownership of that copy.
    // Why: The callback outlives this function and records which row a click activated.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // window.onTreeActivate(index => { activated.current = index; });
    // ```
    let observer = Rc::clone(&activated);
    window.on_tree_activate(move |index| {
        observer.set(index);
    });
    bind_pointer(&window, &source);
    bind_viewport(&window, &source);
    bind_keys(&window, &source);
    bind_appearance(&window, &source);
    window.show().expect("show sidebar window");
    resize(&window, 1100.0, 660.0);
    render(&window, &source);
    settle(&window);
    return Fixture {
        window,
        source,
        activated,
    };
}

/// A drag follows the pointer from its press point, stops at both bounds, and stores no width outside them.
#[test]
fn divider_drag_resizes_and_stops_at_both_bounds() {
    let shared = fixture(60);
    // What: `&shared.window` borrows the window out of the fixture record.
    // Why: The helpers take a borrowed window, and the fixture keeps owning it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const window = shared.window;
    // ```
    let window = &shared.window;
    assert_eq!(
        window.get_sidebar_width(),
        256.0,
        "the sidebar must start at its default width"
    );
    let line = 256.0 + DIVIDER / 2.0;
    let maximum = 1100.0 - DIVIDER - SOURCE_MINIMUM;
    press(window, line, DRAG_Y, PointerEventButton::Left);
    motion(window, line + 100.0, DRAG_Y);
    settle(window);
    assert_eq!(
        window.get_sidebar_width(),
        356.0,
        "a 100px drag must widen the sidebar by 100px"
    );
    motion(window, 5000.0, DRAG_Y);
    settle(window);
    assert_eq!(
        window.get_sidebar_requested_width(),
        maximum,
        "a drag stored a width above the maximum"
    );
    assert_eq!(
        window.get_sidebar_width(),
        maximum,
        "the sidebar must stop where the source keeps its minimum width"
    );
    motion(window, line + 50.0, DRAG_Y);
    settle(window);
    assert_eq!(
        window.get_sidebar_width(),
        306.0,
        "returning from beyond a bound must follow the press point again"
    );
    motion(window, -4000.0, DRAG_Y);
    settle(window);
    assert_eq!(
        window.get_sidebar_requested_width(),
        MINIMUM,
        "a drag stored a width below the minimum"
    );
    assert_eq!(
        window.get_sidebar_width(),
        MINIMUM,
        "the sidebar must stop at its minimum"
    );
    release(window, -4000.0, DRAG_Y, PointerEventButton::Left);
    settle(window);
    assert_eq!(
        window.get_sidebar_width(),
        MINIMUM,
        "releasing the button must keep the dragged width"
    );
    window.hide().expect("close sidebar window");
}

/// A click or double-click without movement, a right-button drag, and a drag while the tree has focus
/// change nothing else.
#[test]
fn divider_ignores_plain_clicks_and_other_buttons_and_keeps_keyboard_focus() {
    let shared = fixture(60);
    let window = &shared.window;
    window.invoke_focus_tree();
    assert!(window.get_tree_has_focus(), "tree focus positive control");
    let line = 256.0 + DIVIDER / 2.0;
    let before = shared.source.borrow().document.position();
    click(window, line, DRAG_Y);
    assert_eq!(
        window.get_sidebar_width(),
        256.0,
        "a click without movement resized the sidebar"
    );
    // Slint counts a second press within 500 ms and 10 px of the first as a repeat, so two presses
    // with no frame between them are a double-click (`i-slint-core` 1.18.1 `input.rs` `check_repeat`).
    press(window, line, DRAG_Y, PointerEventButton::Left);
    release(window, line, DRAG_Y, PointerEventButton::Left);
    press(window, line, DRAG_Y, PointerEventButton::Left);
    release(window, line, DRAG_Y, PointerEventButton::Left);
    settle(window);
    assert_eq!(
        window.get_sidebar_width(),
        256.0,
        "a double-click on the divider resized the sidebar"
    );
    assert_eq!(
        shared.activated.get(),
        -1,
        "a click on the divider activated a tree row"
    );
    assert_eq!(
        shared.source.borrow().document.position(),
        before,
        "a click on the divider moved the source caret"
    );
    press(window, line, DRAG_Y, PointerEventButton::Right);
    motion(window, line + 100.0, DRAG_Y);
    release(window, line + 100.0, DRAG_Y, PointerEventButton::Right);
    settle(window);
    assert_eq!(
        window.get_sidebar_width(),
        256.0,
        "a right-button drag resized the sidebar"
    );
    drag_to(window, 216.0);
    assert_eq!(
        window.get_sidebar_width(),
        216.0,
        "left-button drag positive control"
    );
    assert!(
        window.get_tree_has_focus(),
        "dragging the divider took keyboard focus from the tree"
    );
    assert!(
        !window.get_sidebar_divider_has_focus(),
        "a pointer press focused the divider"
    );
    window.hide().expect("close sidebar window");
}
