//! The popup and the location list: what is shown, where, and when it goes away.
//!
//! The popup shows hover content or a note beside the line of the position it is about, never
//! over that line. It goes away on Escape, caret movement, scrolling, a reload, a file switch,
//! and, for a pointer hover, when the pointer leaves both the source and the popup. The list
//! closes on Escape, an outside click, a choice, a reload, and a file switch.

/// The window, its generated row type, and the source state.
use crate::native::{AppWindow, State, ui::ReferenceEntry};
/// Locations and the stamp they belong to.
use ide_app::language::{identity::DocumentStamp, reply::Target};
/// Toolkit models for the list rows.
use slint::{ModelRc, SharedString, VecModel};
/// What: `Rc` shares the row model with the window; `RefCell` is the borrow-checked state cell.
/// Why: Slint models are shared pointers; the state is shared with the timer.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Shared<T> = { current: T };
/// ```
use std::{cell::RefCell, rc::Rc};

/// What: Where the popup or the list was opened: the stamp, the caret, and the scroll offsets
///       at that moment. `(f32, f32)` is a pair of horizontal and vertical offsets.
/// Why: Any later difference means the reader moved on, which dismisses the surface.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Origin = { stamp: DocumentStamp; caret: number; scroll: [number, number] };
/// ```
#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) struct Origin {
    /// Displayed text when shown.
    pub(super) stamp: DocumentStamp,
    /// Caret head when shown.
    pub(super) caret: usize,
    /// Scroll offsets when shown.
    pub(super) scroll: (f32, f32),
}

/// What is on screen. An `enum` with data is a tagged union.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Shown = { kind: 'nothing' } | { kind: 'popup'; origin: Origin; pointer: boolean; note: boolean }
///            | { kind: 'list'; origin: Origin; targets: Target[] };
/// ```
#[derive(Clone, Debug)]
pub(super) enum Shown {
    /// No popup and no list.
    Nothing,
    /// The popup.
    Popup {
        /// Where and when it was opened.
        origin: Origin,
        /// It shows a resting pointer's hover content.
        pointer: bool,
        /// It shows a note rather than hover content.
        note: bool,
    },
    /// The location list.
    List {
        /// Where and when it was opened.
        origin: Origin,
        /// The listed locations, in row order.
        targets: Vec<Target>,
    },
}

/// What: The current origin: the displayed stamp, the caret head, and the scroll offsets.
/// Why: Recorded when a surface opens and compared on every tick afterwards.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function origin(window: AppWindow, state: State): Origin
/// ```
pub(super) fn origin(window: &AppWindow, state: &State) -> Origin {
    return Origin {
        stamp: displayed(state),
        caret: state.document.position().head,
        scroll: (window.get_scroll_x(), window.get_scroll_y()),
    };
}

/// The stamp of the displayed text.
pub(super) fn displayed(state: &State) -> DocumentStamp {
    return DocumentStamp {
        file: state.file_generation,
        revision: state.document.revision(),
    };
}

/// What: Tell the window which character the surface belongs to: its line and its x.
/// Why: The markup turns these into window coordinates that follow layout and scrolling.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function anchor(window: AppWindow, state: State, position: number): void
/// ```
fn anchor(window: &AppWindow, state: &State, position: usize) {
    let text = state.document.text();
    let line = text.char_to_line(position.min(text.len_chars()));
    let mut x = 0.0;
    // `if let` reads the shaped row of that line when it is materialized.
    if let Some(view) = &state.shaped {
        for row in &view.rows {
            if row.row == line {
                x = row.caret_x(position, view.viewport.scale);
            }
        }
    }
    window.set_language_anchor_x(x);
    window.set_language_anchor_line(line as i32);
}

/// What: Show `text` in the popup beside the line of `position`.
/// Why: One popup serves hover content and notes; `note` switches its styling and live region.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function popup(window, state, position: number, text: string, note: boolean, pointer: boolean): Shown
/// ```
pub(super) fn popup(
    window: &AppWindow,
    source: &Rc<RefCell<State>>,
    position: usize,
    text: &str,
    flags: (bool, bool),
) -> Shown {
    let (note, pointer) = flags;
    let state = source.borrow();
    anchor(window, &state, position);
    let opened = origin(window, &state);
    drop(state);
    close_list(window);
    window.set_language_popup_note(note);
    window.set_language_popup_text(SharedString::from(text));
    tracing::debug!(note, pointer, position, "language popup shown");
    return Shown::Popup {
        origin: opened,
        pointer,
        note,
    };
}

/// What: Show the location list beside the line of `position`, select its first row, and focus it.
/// Why: editord lists several references at the caret and selects the first one.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function list(window, state, position: number, title: string, targets: Target[], rows: ReferenceEntry[]): Shown
/// ```
pub(super) fn list(
    window: &AppWindow,
    source: &Rc<RefCell<State>>,
    position: usize,
    title: &str,
    targets: Vec<Target>,
    rows: Vec<ReferenceEntry>,
) -> Shown {
    let state = source.borrow();
    anchor(window, &state, position);
    let opened = origin(window, &state);
    drop(state);
    window.set_language_popup_text(SharedString::new());
    window.set_references_title(SharedString::from(title));
    // `ModelRc::from(Rc::new(VecModel::from(rows)))` hands the rows to the window as a shared model.
    window.set_references_entries(ModelRc::from(Rc::new(VecModel::from(rows))));
    window.set_references_selected(0);
    window.invoke_reset_references_scroll();
    window.set_references_open(true);
    window.invoke_focus_references();
    tracing::debug!(rows = targets.len(), title, "language location list shown");
    return Shown::List {
        origin: opened,
        targets,
    };
}

/// Hide the list without moving focus.
fn close_list(window: &AppWindow) {
    window.set_references_open(false);
    window.set_references_entries(ModelRc::default());
}

/// What: Remove whatever is shown. A list returns keyboard focus to the source view.
/// Why: Every dismissal, by key, click, or a change of what is displayed, goes through here.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function dismiss(window: AppWindow, shown: Shown): Shown
/// ```
pub(super) fn dismiss(window: &AppWindow, shown: &Shown, reason: &str) -> Shown {
    match shown {
        Shown::Nothing => return Shown::Nothing,
        Shown::Popup { .. } => {
            window.set_language_popup_text(SharedString::new());
        }
        Shown::List { .. } => {
            let had_focus = window.get_references_has_focus();
            close_list(window);
            // Focus returns to the source only when the list still held it, never from the search input.
            if had_focus {
                window.invoke_focus_source();
            }
        }
    }
    tracing::debug!(reason, "language surface dismissed");
    return Shown::Nothing;
}

/// What: Why the shown surface must go now, or nothing when it stays.
/// Why: Caret movement, scrolling, a reload, a file switch, and the search overlay all end it;
///      a pointer hover also ends when the pointer is over neither the source nor the popup.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function stale(window: AppWindow, state: State, shown: Shown, pointerOver: boolean): string | undefined
/// ```
pub(super) fn stale(
    window: &AppWindow,
    state: &State,
    shown: &Shown,
    pointer_over: bool,
) -> Option<&'static str> {
    let now = origin(window, state);
    let (opened, pointer) = match shown {
        Shown::Nothing => return None,
        Shown::Popup { origin, pointer, .. } => (*origin, *pointer),
        Shown::List { origin, .. } => (*origin, false),
    };
    // Another file or a reload of this one: positions of the surface no longer describe the text.
    if now.stamp != opened.stamp {
        return Some("the displayed text changed");
    }
    if window.get_search_open() {
        return Some("the search overlay opened");
    }
    // The list holds focus, so the caret and the view cannot move under it.
    if matches!(shown, Shown::List { .. }) {
        return None;
    }
    if now.caret != opened.caret {
        return Some("the caret moved");
    }
    if now.scroll != opened.scroll {
        return Some("the view scrolled");
    }
    if pointer && !pointer_over && !window.get_language_popup_has_pointer() {
        return Some("the pointer left the source and the popup");
    }
    return None;
}
