//! The find box keeps the toolkit text box's editing behavior: editing keys, the context menu, and
//! scrolling of a text wider than the box.

/// The generated window type from the shipped markup.
use super::AppWindow;
/// An opened find bar over a disposable two-match file, with keyboard focus in the find box.
use super::find_clear_tests::opened;
/// Real key events through the window and the wait for the find count, shared with the find tests.
use super::find_tests::{chord, key, status, type_text};
/// Rendered frames and single pixels, shared with the sidebar paint tests.
use super::sidebar_paint_tests::{frame, pixel};
/// Pointer helpers and the pinned width of the divider's line.
use super::sidebar_tests::{DIVIDER, press, release, settle};
/// What: `Rgba8Pixel` is one pixel of four bytes; `SharedPixelBuffer<Rgba8Pixel>` is a rendered frame
/// (the `<...>` names the element type, like `Array<Pixel>`); `WindowEvent` is the union of events a
/// windowing backend reports.
/// Why: Scrolling of the find text exists only in rendered pixels, and a held modifier is two events.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Frame = { width: number; pixels: Pixel[] };
/// ```
use slint::{
    ComponentHandle, Rgba8Pixel, SharedPixelBuffer,
    platform::{Key, PointerEventButton, WindowEvent},
};

/// What: `steps: usize` is how many times Down is pressed (`usize` is the unsigned counting type;
/// siblings `u32` and `i32`).
/// Why: The menu opens by a right click on the find text and is driven by keys like the toolkit's:
/// Down moves through Undo, Redo, Cut, Copy, Paste, and Select All, skipping the separator, and Return
/// runs the highlighted entry.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function menu(window: AppWindow, steps: number): void;
/// ```
fn menu(window: &AppWindow, steps: usize) {
    settle(window);
    // A point in the text area, 60px left of the clear cell and in the middle of the box.
    let x = window.get_find_clear_x() - 60.0;
    let y = window.get_find_clear_y() + 24.0;
    press(window, x, y, PointerEventButton::Right);
    release(window, x, y, PointerEventButton::Right);
    settle(window);
    for _ in 0..steps {
        key(window, Key::DownArrow);
    }
    key(window, Key::Return);
    settle(window);
}

/// Entry positions in the menu, counted in Down presses from the opened menu.
const UNDO: usize = 1;
/// Redo is the second entry.
const REDO: usize = 2;
/// Cut is the first entry after the separator, which Down skips.
const CUT: usize = 3;
/// Copy follows Cut.
const COPY: usize = 4;
/// Paste follows Copy.
const PASTE: usize = 5;
/// Select All is the last entry.
const SELECT_ALL: usize = 6;

/// Home, End, Backspace, Delete, Shift selection, select-all, copy, cut, paste, undo, and redo edit the find text.
#[test]
fn find_box_keeps_the_toolkit_editing_keys() {
    // `_fixture` keeps the directory alive until the test ends.
    let (_fixture, reader) = opened();
    // What: `&reader.window` borrows the window out of the reader record.
    // Why: The helpers take a borrowed window, and the reader keeps owning it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const window = reader.window;
    // ```
    let window = &reader.window;
    type_text(window, "ab");
    key(window, Key::Home);
    type_text(window, "c");
    assert_eq!(
        window.get_find_query(),
        "cab",
        "Home did not move the caret to the start of the find text"
    );
    key(window, Key::End);
    key(window, Key::Backspace);
    assert_eq!(
        window.get_find_query(),
        "ca",
        "End and Backspace did not delete the last character"
    );
    chord(window, Key::Control, "a");
    chord(window, Key::Control, "c");
    key(window, Key::End);
    chord(window, Key::Control, "v");
    assert_eq!(
        window.get_find_query(),
        "caca",
        "Ctrl+A, Ctrl+C, End, and Ctrl+V did not append a copy of the find text"
    );
    chord(window, Key::Control, "z");
    assert_eq!(
        window.get_find_query(),
        "ca",
        "Ctrl+Z did not undo the paste"
    );
    // What: `WindowEvent::KeyPressed { text }` is one variant of the event union; `Key::Control.into()`
    // converts the key name to the toolkit's encoded key text.
    // Why: Redo is Ctrl+Shift+Z, two held modifiers around one key.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // window.dispatchEvent({ kind: 'keyPressed', text: Key.Control });
    // ```
    window.window().dispatch_event(WindowEvent::KeyPressed {
        text: Key::Control.into(),
    });
    chord(window, Key::Shift, "Z");
    window.window().dispatch_event(WindowEvent::KeyReleased {
        text: Key::Control.into(),
    });
    assert_eq!(
        window.get_find_query(),
        "caca",
        "Ctrl+Shift+Z did not redo the paste"
    );
    chord(window, Key::Shift, Key::LeftArrow);
    chord(window, Key::Shift, Key::LeftArrow);
    key(window, Key::Delete);
    assert_eq!(
        window.get_find_query(),
        "ca",
        "Shift+Left twice and Delete did not remove the last two characters"
    );
    chord(window, Key::Control, "a");
    chord(window, Key::Control, "x");
    assert_eq!(
        window.get_find_query(),
        "",
        "Ctrl+A and Ctrl+X did not cut the find text"
    );
    chord(window, Key::Control, "v");
    assert_eq!(
        window.get_find_query(),
        "ca",
        "Ctrl+V did not paste the cut find text"
    );
    assert!(
        !window.get_search_open(),
        "editing keys opened the search overlay"
    );
    window.hide().expect("close editing window");
}

/// A right click opens the toolkit's menu, and each of its entries acts on the find text.
#[test]
fn find_box_context_menu_runs_each_entry() {
    let (_fixture, reader) = opened();
    let window = &reader.window;
    type_text(window, "needle");
    menu(window, SELECT_ALL);
    type_text(window, "x");
    assert_eq!(
        window.get_find_query(),
        "x",
        "the menu's Select All did not select the whole find text"
    );
    assert!(
        window.get_find_has_focus(),
        "closing the menu did not return keyboard focus to the find box"
    );
    // The toolkit's undo history holds a replaced selection as two steps: its removal and the insertion.
    menu(window, UNDO);
    assert_eq!(
        window.get_find_query(),
        "",
        "the menu's Undo did not take back the typed character"
    );
    menu(window, UNDO);
    assert_eq!(
        window.get_find_query(),
        "needle",
        "the menu's Undo did not restore the replaced find text"
    );
    menu(window, REDO);
    menu(window, REDO);
    assert_eq!(
        window.get_find_query(),
        "x",
        "the menu's Redo did not repeat the replacement"
    );
    menu(window, UNDO);
    menu(window, UNDO);
    menu(window, SELECT_ALL);
    menu(window, COPY);
    key(window, Key::End);
    menu(window, PASTE);
    assert_eq!(
        window.get_find_query(),
        "needleneedle",
        "the menu's Copy and Paste did not append a copy of the find text"
    );
    menu(window, SELECT_ALL);
    menu(window, CUT);
    assert_eq!(
        window.get_find_query(),
        "",
        "the menu's Cut did not remove the selected find text"
    );
    menu(window, PASTE);
    assert_eq!(
        window.get_find_query(),
        "needleneedle",
        "the menu's Paste did not insert the cut find text"
    );
    window.hide().expect("close menu window");
}

/// What: `bounds` is a fixed array of four pixel positions, left, right, top, bottom; the answer is a
/// growable array (`Vec<Rgba8Pixel>`, sibling fixed array `[Rgba8Pixel; N]`) of the pixels inside them.
/// Why: Two frames show the same thing in a region exactly when these arrays are equal.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function pixels(frame: Frame, bounds: [number, number, number, number]): Pixel[];
/// ```
fn pixels(frame: &SharedPixelBuffer<Rgba8Pixel>, bounds: [usize; 4]) -> Vec<Rgba8Pixel> {
    // What: `Vec::new()` is an empty growable array; `mut` allows pushing into it.
    // Why: The region is collected pixel by pixel with plain loops.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const found: Pixel[] = [];
    // ```
    let mut found = Vec::new();
    for y in bounds[2]..bounds[3] {
        for x in bounds[0]..bounds[1] {
            found.push(pixel(frame, x, y));
        }
    }
    return found;
}

/// A text wider than the box scrolls so that its end and the caret stay visible, Home scrolls back to its
/// start, and no part of it is drawn inside the clear cell.
#[test]
fn find_box_scrolls_long_text_and_keeps_it_out_of_the_clear_cell() {
    let (_fixture, reader) = opened();
    let window = &reader.window;
    // The fixture holds neither letter typed here, so the count reads "No matches" throughout
    // and the box keeps its width.
    type_text(window, "M");
    status(window, "No matches");
    settle(window);
    // What: `ceil()` rounds a fractional edge up to the next whole pixel, and `as usize` converts that
    // logical position to a pixel index; the headless window renders one pixel per logical pixel.
    // Why: The box's width depends on the count text beside it, so the cell's left edge can be fractional;
    // the sampled columns must lie inside the cell.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const left = Math.ceil(window.findClearX);
    // ```
    let left = window.get_find_clear_x().ceil() as usize;
    let top = window.get_find_clear_y() as usize;
    let cell = [left, left + 47, top, top + 48];
    let short = pixels(&frame(window), cell);
    type_text(window, &"i".repeat(199));
    status(window, "No matches");
    let filled = frame(window);
    assert_eq!(
        window.get_find_clear_x().ceil() as usize,
        left,
        "typing moved the clear cell"
    );
    assert!(
        pixels(&filled, cell) == short,
        "a text wider than the box was drawn inside the clear cell"
    );
    // The toolkit keeps the caret 24px before the end of the text area, which ends where the cell starts.
    // The last character lies in the 18 columns before the caret's own columns.
    let last = [left - 45, left - 27, top + 12, top + 36];
    type_text(window, "M");
    status(window, "No matches");
    let ended = frame(window);
    assert!(
        pixels(&ended, last) != pixels(&filled, last),
        "the end of a text wider than the box was not scrolled into view"
    );
    // The text area starts 12px inside the bar and 12px inside the box; its first columns hold the caret.
    let start = (window.get_sidebar_width() + DIVIDER) as usize + 24;
    let first = [start + 3, start + 14, top + 12, top + 36];
    key(window, Key::Home);
    let home = frame(window);
    assert!(
        pixels(&home, first) != pixels(&ended, first),
        "Home did not scroll a text wider than the box back to its start"
    );
    assert!(
        pixels(&home, cell) == short,
        "scrolling the text changed the clear cell"
    );
    window.hide().expect("close scrolling window");
}
