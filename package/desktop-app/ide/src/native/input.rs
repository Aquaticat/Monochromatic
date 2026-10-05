//! Caret and selection input never edit source.

/// Borrow the parent's state, its single rendering boundary, and the caret-following scroll.
use super::{AppWindow, State, render, viewport::follow};
/// Geometry-free caret movement over source characters.
use ide_app::caret_motion::{Motion, moved};
/// Source offsets remain independent of rendered pixels.
use ide_app::document::ReadingPosition;
/// Click counting and unit-wise drag extension.
use ide_app::pointer_selection::{ClickCounter, Granularity, extended, unit};
/// Line-wise movement by shaped pixel position with a remembered column.
use ide_app::vertical_motion::{PreferredColumn, vertical};
/// Toolkit key representations and weak window handles.
use slint::{ComponentHandle, SharedString, platform::Key};
/// What: `Rc` shares one owner on this thread, `RefCell` checks mutable borrows at run time,
/// and `Instant` is a point on a clock that never goes backwards.
/// Why: Press and drag callbacks change the same pointer state, and multi-clicks are defined by elapsed time.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const drag = { current: createDrag() }; const now = performance.now();
/// ```
use std::{cell::RefCell, rc::Rc, time::Instant};

/// What: The unit selected by the latest press; `(usize, usize)` is a pair of character positions.
/// Why: A drag extends from the pressed unit, so a double-click drag keeps whole words.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Drag = { clicks: ClickCounter; origin: [number, number]; granularity: Granularity };
/// ```
struct Drag {
    /// Time and place of the previous press.
    clicks: ClickCounter,
    /// Start and end of the unit selected by the press.
    origin: (usize, usize),
    /// Character, word, or line, as chosen by the click count.
    granularity: Granularity,
}

/// What: `&mut State` lends the source state mutably; `usize` is an address-sized index (siblings `u32`, `u64`);
/// `f32` is a 32-bit float (sibling `f64`).
/// Why: A drag can leave the materialized rows; such a line is shaped on demand
/// so the pointer still resolves by glyph geometry instead of falling back to the line start.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function pointerPosition(current: State, line: number, x: number, scale: number): number;
/// ```
fn pointer_position(current: &mut State, line: usize, x: f32, scale: f32) -> usize {
    // What: Destructuring `&mut State` lends three fields separately.
    // Why: The shaper must be mutable while the document and the shaped view are only read.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { document, shaper, shaped } = current;
    // ```
    let State {
        document,
        shaper,
        shaped,
        ..
    } = current;
    // What: `if let Some(view)` runs only when a viewport has been shaped.
    // Why: Materialized rows already hold the exact painted geometry.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const row = shaped?.rows.find(candidate => candidate.row === line);
    // ```
    if let Some(view) = shaped {
        for candidate in &view.rows {
            if candidate.row == line {
                return candidate.hit(x, view.viewport.scale);
            }
        }
    }
    return shaper.row(document, line, scale).hit(x, scale);
}

/// Bind pointer selection without letting the UI mutate source text.
pub(super) fn bind_pointer(owner: &AppWindow, shared: &Rc<RefCell<State>>) {
    // What: `Rc::new(RefCell::new(...))` creates the shared owner of the pointer state.
    // Why: The press and the drag callback both outlive this binding function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const drag = { current: { clicks: new ClickCounter(), origin: [0, 0], granularity: 'character' } };
    // ```
    let drag = Rc::new(RefCell::new(Drag {
        clicks: ClickCounter::default(),
        origin: (0, 0),
        granularity: Granularity::Character,
    }));
    // What: clone shares Rc ownership, whereas cloning a String copies its bytes.
    // Why: The callback remains valid after this binding function returns.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const callbackState = state;
    // ```
    let press_state = Rc::clone(shared);
    let press_drag = Rc::clone(&drag);
    let press_window = owner.as_weak();
    // What: move |...| transfers captured handles into a stored callback.
    // Why: Borrowed local variables would not outlive this function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // window.onPointerPress((row, x, extend) => { ... });
    // ```
    owner.on_pointer_press(move |row, x, extend| {
        // What: upgrade returns Some only while the window still exists; `let ... else` leaves otherwise.
        // Why: Closing the app must not keep a hidden window alive through callbacks.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const window = weak.deref(); if (!window) return;
        // ```
        let Some(window) = press_window.upgrade() else {
            return;
        };
        let mut current = press_state.borrow_mut();
        let line = row.max(0) as usize;
        let hit = pointer_position(&mut current, line, x, window.window().scale_factor());
        let mut position = current.document.position();
        let mut pressed = press_drag.borrow_mut();
        if extend {
            // Shift+click keeps the anchor and is never part of a double or triple click.
            pressed.clicks.reset();
            pressed.granularity = Granularity::Character;
            pressed.origin = (position.anchor, position.anchor);
            position.head = hit;
        } else {
            let granularity = pressed.clicks.press(Instant::now(), line, x);
            let (start, end) = unit(current.document.text().slice(..), hit, granularity);
            pressed.granularity = granularity;
            pressed.origin = (start, end);
            position.anchor = start;
            position.head = end;
        }
        drop(pressed);
        current.document.select(position);
        drop(current);
        render(&window, &press_state);
    });
    let state = Rc::clone(shared);
    let weak = owner.as_weak();
    owner.on_pointer_hit(move |row, x, _extend| {
        let Some(window) = weak.upgrade() else {
            return;
        };
        let mut current = state.borrow_mut();
        let line = row.max(0) as usize;
        let hit = pointer_position(&mut current, line, x, window.window().scale_factor());
        let pressed = drag.borrow();
        let (anchor, head) = extended(
            current.document.text().slice(..),
            pressed.origin,
            pressed.granularity,
            hit,
        );
        drop(pressed);
        let mut position = current.document.position();
        position.anchor = anchor;
        position.head = head;
        current.document.select(position);
        drop(current);
        // A drag past an edge of the view scrolls just far enough to show where the selection now ends.
        follow(&window, &state, 0.0);
    });
}

/// What: `Option<Motion>` is a movement or nothing (TypeScript's `Motion | undefined`);
/// `&SharedString` borrows the toolkit's encoded key text.
/// Why: Slint represents special keys as encoded strings, not enum values, and most keys are not movements.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function horizontal(key: string, control: boolean): Motion | undefined;
/// ```
fn horizontal(key: &SharedString, control: bool) -> Option<Motion> {
    let mut plain = None;
    let mut modified = None;
    if *key == SharedString::from(Key::LeftArrow) {
        plain = Some(Motion::Left);
        modified = Some(Motion::WordLeft);
    } else if *key == SharedString::from(Key::RightArrow) {
        plain = Some(Motion::Right);
        modified = Some(Motion::WordRight);
    } else if *key == SharedString::from(Key::Home) {
        plain = Some(Motion::LineStart);
        modified = Some(Motion::DocumentStart);
    } else if *key == SharedString::from(Key::End) {
        plain = Some(Motion::LineEnd);
        modified = Some(Motion::DocumentEnd);
    }
    if control {
        return modified;
    }
    return plain;
}

/// Signed line count for Up, Down, PageUp, and PageDown, and whether the view pages along with the caret.
/// `page` is the number of whole lines the viewport shows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function vertical_rows(key: string, page: number): [rows: number, paging: boolean] | undefined;
/// ```
fn vertical_rows(key: &SharedString, page: isize) -> Option<(isize, bool)> {
    if *key == SharedString::from(Key::UpArrow) {
        return Some((-1, false));
    }
    if *key == SharedString::from(Key::DownArrow) {
        return Some((1, false));
    }
    if *key == SharedString::from(Key::PageUp) {
        return Some((-page, true));
    }
    if *key == SharedString::from(Key::PageDown) {
        return Some((page, true));
    }
    return None;
}

/// Bind native keyboard caret movement and select-all.
pub(super) fn bind_keys(owner: &AppWindow, shared: &Rc<RefCell<State>>) {
    let select_state = Rc::clone(shared);
    let select_window = owner.as_weak();
    owner.on_select_all_request(move || {
        let mut current = select_state.borrow_mut();
        let end = current.document.text().len_chars();
        current.document.select(ReadingPosition {
            anchor: 0,
            head: end,
            viewport: 0,
        });
        drop(current);
        if let Some(window) = select_window.upgrade() {
            render(&window, &select_state);
        }
    });
    let state = Rc::clone(shared);
    let weak = owner.as_weak();
    // The remembered column names the caret it belongs to, so any other caret change invalidates it.
    let mut column: Option<PreferredColumn> = None;
    owner.on_key_input(move |key, control, shift, alt| {
        // Alt combinations are not reading keys; leaving them alone keeps them free for later commands.
        if alt {
            return;
        }
        let Some(window) = weak.upgrade() else {
            return;
        };
        let height = window.get_viewport_height();
        let scale = window.window().scale_factor();
        let mut current = state.borrow_mut();
        let mut position = current.document.position();
        let start = position.anchor.min(position.head);
        let end = position.anchor.max(position.head);
        // A page is the number of whole lines in view, and at least one line.
        let page = ((height / 24.0).floor() as isize).max(1);
        let mut scrolled = 0.0;
        if let Some(motion) = horizontal(&key, control) {
            // A horizontal key names a new aim even when the caret cannot move, such as Home at a line start.
            column = None;
            // Without Shift, Left and Right first collapse a selection to the side they point at.
            if !shift && start != end && motion == Motion::Left {
                position.head = start;
            } else if !shift && start != end && motion == Motion::Right {
                position.head = end;
            } else {
                position.head = moved(current.document.text().slice(..), position.head, motion);
            }
        } else if let Some((rows, paging)) = vertical_rows(&key, page)
            && !control
        {
            // Destructure the mutable borrow so the shaper can work while the document is lent read-only.
            let State {
                document, shaper, ..
            } = &mut *current;
            let landed = vertical(shaper, document, scale, rows, column);
            column = Some(landed);
            position.head = landed.head;
            if paging {
                scrolled = rows as f32 * 24.0;
            }
        } else {
            return;
        }
        if !shift {
            position.anchor = position.head;
        }
        current.document.select(position);
        drop(current);
        follow(&window, &state, scrolled);
    });
}
