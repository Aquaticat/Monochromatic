//! Native scrolling retains fractional offsets between raster tile updates.

/// Parent state owns the document and the currently displayed tile.
use super::{AppWindow, State, render};
/// ComponentHandle supplies weak references for callback lifetimes.
use slint::ComponentHandle;
/// Checked shared ownership remains confined to the UI thread.
use std::{cell::RefCell, rc::Rc};

/// What: `&mut State` lends the source state mutably; `f32` is a 32-bit float of logical pixels;
/// the `bool` answer says whether the materialized tile changed.
/// Why: Native scrolling and programmatic reveal must agree on which rows and columns are materialized.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function place(current: State, horizontal: number, offset: number, width: number, height: number): boolean;
/// ```
fn place(
    current: &mut State,
    horizontal: f32,
    offset: f32,
    viewport_width: f32,
    height: f32,
) -> bool {
    // What: `as usize` truncates a non-negative float to an address-sized index (sibling `u32`).
    // Why: Row indices address rope lines, whose interfaces use `usize`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const first = Math.floor(Math.max(offset, 0) / 24);
    // ```
    let first = (offset.max(0.0) / 24.0) as usize;
    let count = (height.max(0.0) / 24.0).ceil() as usize + 3;
    let tile_x = ((horizontal.max(0.0) / 128.0).floor() * 128.0 - 128.0).max(0.0);
    let width = viewport_width.max(1.0);
    if current.first == first.saturating_sub(1)
        && current.count == count
        && current.horizontal == tile_x
        && current.width == width
    {
        return false;
    }
    current.first = first.saturating_sub(1);
    current.count = count;
    current.horizontal = tile_x;
    current.width = width;
    let text = current.document.text();
    let line = first.min(text.len_lines().saturating_sub(1));
    let mut position = current.document.position();
    position.viewport = text.line_to_char(line);
    current.document.select(position);
    return true;
}

/// Retain pixel scrolling; update the raster only at viewport tile boundaries.
pub(super) fn bind_viewport(owner: &AppWindow, shared: &Rc<RefCell<State>>) {
    // What: `Rc::clone` copies the pointer to the shared state; `as_weak` does not keep the window alive.
    // Why: The stored callback outlives this binding function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const state = shared; const weak = new WeakRef(owner);
    // ```
    let state = Rc::clone(shared);
    let weak = owner.as_weak();
    // What: `move |...|` transfers the captured handles into the stored callback.
    // Why: Borrowed locals would not outlive this function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // owner.onViewportChanged((horizontal, offset, width, height) => { ... });
    // ```
    owner.on_viewport_changed(move |horizontal, offset, viewport_width, height| {
        // What: `borrow_mut` lends the state mutably; `&mut current` passes that loan to `place`.
        // Why: The loan must end before rendering borrows the state again.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const changed = place(state.current, horizontal, offset, width, height);
        // ```
        let mut current = state.borrow_mut();
        let changed = place(&mut current, horizontal, offset, viewport_width, height);
        drop(current);
        if !changed {
            return;
        }
        // What: `upgrade` returns `Some(window)` only while the window still exists.
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

/// Render after a keyboard caret movement and keep the caret visible with the smallest possible scroll.
///
/// `paged` first moves the view by that many logical pixels, so a page key keeps the caret's place on screen.
/// A caret above the view becomes the top line, one below the bottom line; a visible caret keeps the offsets.
/// Horizontally the caret gets up to 48 px of room on the side it left the view.
/// Offsets are assigned directly, like other programmatic reveals; native wheel easing is unaffected.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function follow(window: AppWindow, state: Shared<State>, paged: number): void;
/// ```
pub(super) fn follow(window: &AppWindow, state: &Rc<RefCell<State>>, paged: f32) {
    let height = window.get_viewport_height();
    let width = window.get_viewport_width();
    let horizontal = -window.get_scroll_x();
    let before = -window.get_scroll_y();
    let mut current = state.borrow_mut();
    let text = current.document.text();
    let row = text.char_to_line(current.document.position().head);
    let top = row as f32 * 24.0;
    let limit = (text.len_lines() as f32 * 24.0 - height).max(0.0);
    let mut offset = (before + paged).clamp(0.0, limit);
    if top < offset {
        offset = top;
    } else if top + 24.0 > offset + height {
        offset = top + 24.0 - height;
    }
    offset = offset.clamp(0.0, limit);
    // A fractional offset left by smooth scrolling is kept while the caret stays in view.
    if offset != before {
        offset = offset.round();
    }
    place(&mut current, horizontal, offset, width, height);
    drop(current);
    if offset != before {
        window.set_scroll_y(-offset);
    }
    render(window, state);
    let mut shown = state.borrow_mut();
    let mut left = horizontal;
    // The caret's x comes from shaped glyph geometry, available only after its row is rendered.
    if let Some(view) = &shown.shaped {
        let caret = view.caret(&shown.document);
        let room = 48.0_f32.min(width / 4.0);
        if caret.x < horizontal {
            left = caret.x - room;
        } else if caret.x + caret.width > horizontal + width {
            left = caret.x + caret.width + room - width;
        }
    }
    let widest = (shown.document_width - width).max(0.0);
    left = left.clamp(0.0, widest).round();
    tracing::debug!(
        row,
        vertical = offset,
        horizontal = left,
        "followed source caret"
    );
    if left == horizontal {
        return;
    }
    place(&mut shown, left, offset, width, height);
    drop(shown);
    window.set_scroll_x(-left);
    render(window, state);
}

/// Scroll a source character range into view and render it.
/// A visible range keeps its offsets; a hidden row is centered; a hidden column starts 48 px from the left.
/// Offsets are assigned directly, like other programmatic reveals; native wheel easing is unaffected.
pub(super) fn reveal(window: &AppWindow, state: &Rc<RefCell<State>>, start: usize, end: usize) {
    let height = window.get_viewport_height();
    let width = window.get_viewport_width();
    let horizontal = -window.get_scroll_x();
    let before = -window.get_scroll_y();
    let mut offset = before;
    let mut current = state.borrow_mut();
    let text = current.document.text();
    let row = text.char_to_line(start.min(text.len_chars()));
    let top = row as f32 * 24.0;
    if top < offset || top + 24.0 > offset + height {
        let limit = (text.len_lines() as f32 * 24.0 - height).max(0.0);
        offset = (top - ((height - 24.0) / 2.0).max(0.0))
            .clamp(0.0, limit)
            .round();
    }
    place(&mut current, horizontal, offset, width, height);
    drop(current);
    if offset != before {
        window.set_scroll_y(-offset);
    }
    render(window, state);
    let mut shown = state.borrow_mut();
    let mut left = horizontal;
    // What: `if let Some(view)` runs only when shaped rows exist; `first()` is the range's first rectangle.
    // Why: Horizontal position comes from shaped glyph geometry, available only after the row is rendered.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const rectangle = shown.shaped?.range(start, end)[0];
    // ```
    if let Some(view) = &shown.shaped
        && let Some(rectangle) = view.range(start, end).first()
        && (rectangle.x < horizontal || rectangle.x + rectangle.width > horizontal + width)
    {
        let limit = (shown.document_width - width).max(0.0);
        left = (rectangle.x - 48.0).clamp(0.0, limit).round();
    }
    tracing::debug!(
        row,
        vertical = offset,
        horizontal = left,
        "revealed source range"
    );
    if left == horizontal {
        return;
    }
    place(&mut shown, left, offset, width, height);
    drop(shown);
    window.set_scroll_x(-left);
    render(window, state);
}
