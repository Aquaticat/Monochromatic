//! Caret and selection input never edit source.

/// Borrow the parent's state and its single rendering boundary.
use super::{AppWindow, State, render};
/// Source offsets remain independent of rendered pixels.
use ide_app::document::ReadingPosition;
/// Toolkit key representations and weak window handles.
use slint::{ComponentHandle, SharedString};
/// Rc and RefCell share checked mutable state on the UI thread.
use std::{cell::RefCell, rc::Rc};

/// Bind pointer selection without letting the UI mutate source text.
pub(super) fn bind_pointer(owner: &AppWindow, shared: &Rc<RefCell<State>>) {
    // What: clone shares Rc ownership, whereas cloning a String copies its bytes.
    // Why: The callback remains valid after this binding function returns.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const callbackState = state;
    // ```
    let state = Rc::clone(shared);
    let weak = owner.as_weak();
    // What: move |...| transfers captured handles into a stored callback.
    // Why: Borrowed local variables would not outlive this function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // window.onPointerHit((row, column, extend) => { ... });
    // ```
    owner.on_pointer_hit(move |row, x, extend| {
        let mut current = state.borrow_mut();
        let Some(view) = &current.shaped else {
            return;
        };
        let head = view.hit(&current.document, row.max(0) as usize, x);
        let mut position = current.document.position();
        if !extend {
            position.anchor = head;
        }
        position.head = head;
        current.document.select(position);
        drop(current);
        // What: upgrade returns Some only while the window still exists.
        // Why: Closing the app must not keep a hidden window alive through callbacks.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const window = weak.deref(); if (window) render(window, state);
        // ```
        if let Some(window) = weak.upgrade() {
            render(&window, &state);
        }
    });
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
    owner.on_key_input(move |key, control, shift, _alt| {
        let mut current = state.borrow_mut();
        let mut position = current.document.position();
        let text = current.document.text().slice(..);
        // Slint represents special keys as encoded strings, not Key enum values.
        if key == SharedString::from(slint::platform::Key::LeftArrow) {
            position.head = helix_core::graphemes::prev_grapheme_boundary(text, position.head);
        } else if key == SharedString::from(slint::platform::Key::RightArrow) {
            position.head = helix_core::graphemes::next_grapheme_boundary(text, position.head);
        } else if key == SharedString::from(slint::platform::Key::Home) {
            if control {
                position.head = 0;
            } else {
                position.head = text.line_to_char(text.char_to_line(position.head));
            }
        } else if key == SharedString::from(slint::platform::Key::End) {
            if control {
                position.head = text.len_chars();
            } else {
                let row = text.char_to_line(position.head);
                let start = text.line_to_char(row);
                let mut end = text.line_to_char((row + 1).min(text.len_lines()));
                // Skip the line terminator, not the final source character.
                while end > start && (text.char(end - 1) == '\n' || text.char(end - 1) == '\r') {
                    end -= 1;
                }
                position.head = end;
            }
        } else {
            return;
        }
        if !shift {
            position.anchor = position.head;
        }
        current.document.select(position);
        drop(current);
        if let Some(window) = weak.upgrade() {
            render(&window, &state);
        }
    });
}
