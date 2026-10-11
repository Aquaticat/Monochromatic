//! Native scrolling retains fractional offsets between raster tile updates.

/// Parent state owns the document and the currently displayed tile;
///  `rows` holds the map-based scroll rules.
use super::{AppWindow, State, render, rows};
/// Height of one code row:
///  the least a line can take,
///  which bounds how many lines a view can show.
use ide_app::row_map::CODE_ROW;
/// ComponentHandle supplies weak references for callback lifetimes.
use slint::ComponentHandle;
/// Checked shared ownership remains confined to the UI thread;
///  `Instant` times the reader's scrolling.
use std::{cell::RefCell, rc::Rc, time::Instant};

/// What:
///  The materialized tile spans this many view heights: one above the view, the view, and one below.
/// Why:
///  A view inside the tile's middle band needs no new pixels, so scrolling inside it does no source work.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const TILE_VIEWS = 3;
/// ```
const TILE_VIEWS: f32 = 3.0;

/// What:
///  How close, in view heights, the view's edge may come to the tile's edge before the tile is re-centered.
/// Why:
///  The view starts a re-center with one view height of room on each side, so it may scroll
///  `1 - RECENTER_EDGE_VIEWS` = 0.75 view heights before the next re-center: about one view height,
///  and the tile edge never reaches the view.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const RECENTER_EDGE_VIEWS = 0.25;
/// ```
const RECENTER_EDGE_VIEWS: f32 = 0.25;

/// What:
///  Lines materialized past the last line of the tile's bottom edge, as a margin against rounding.
/// Why:
///  A line's block can be taller than one code row when it carries virtual rows,
///  so the line count of the tile is not the tile's pixel height divided by one code row.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const TILE_SPARE_LINES = 2;
/// ```
const TILE_SPARE_LINES: usize = 2;

/// What:
///  Whether the materialized tile still holds the view:
///  the view's top edge is at least `RECENTER_EDGE_VIEWS` view heights below the tile's top edge,
///  and its bottom edge is as far above the tile's bottom edge.
///  A side that touches the first or last line of the text is always held.
/// Why:
///  Edges come from the live vertical mapping, so rows that appear above the tile move them with the rows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function holds(current: State, view: number, height: number): boolean;
/// ```
fn holds(current: &State, view: f32, height: f32) -> bool {
    let lines = current.document.text().len_lines();
    let edge = RECENTER_EDGE_VIEWS * height;
    let end = (current.first + current.count).min(lines);
    let top_held = current.first == 0 || view >= current.row_map.block_top(current.first) + edge;
    let bottom_held = end >= lines || view + height <= current.row_map.block_top(end) - edge;
    return top_held && bottom_held;
}

/// What:
///  `&mut State` lends the source state mutably;
///  `f32` is a 32-bit float of logical pixels;
/// the `bool` answer says whether the materialized tile changed.
/// Why:
///  Native scrolling and programmatic reveal must agree on which rows and columns are materialized.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function place(current: State, horizontal: number, offset: number, width: number, height: number): boolean;
/// ```
pub(super) fn place(
    current: &mut State,
    horizontal: f32,
    offset: f32,
    viewport_width: f32,
    height: f32,
) -> bool {
    // What: The map names the line at the view's top edge; `as usize` truncates a non-negative float to an
    //       address-sized index (sibling `u32`).
    // Why: Row indices address rope lines, whose interfaces use `usize`. Every line takes at least one code
    //      row, so this many lines always cover the view and its overscan, however many virtual rows there are.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const first = map.lineAt(Math.max(offset, 0)); const count = Math.ceil(height / CODE_ROW) + 3;
    // ```
    // Every caller that moves the view itself passes its new offset here first, so the offset the window
    // reports afterwards is recognized as not being the reader's own scrolling.
    current.offset = offset;
    let tile_x = ((horizontal.max(0.0) / 128.0).floor() * 128.0 - 128.0).max(0.0);
    let width = viewport_width.max(1.0);
    let view = offset.max(0.0);
    // What: The document position's viewport line follows the view's top edge on every scroll step.
    // Why: Reload anchoring and navigation read that line, and it must not lag behind the view while the tile holds.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // position.viewport = text.lineToChar(map.lineAt(view));
    // ```
    let view_line = current.row_map.line_at(view);
    let text = current.document.text();
    let line = view_line.min(text.len_lines().saturating_sub(1));
    let viewport_char = text.line_to_char(line);
    if current.document.position().viewport != viewport_char {
        let mut position = current.document.position();
        position.viewport = viewport_char;
        current.document.select(position);
    }
    // What: A view inside the tile's middle band keeps the tile, so the frame stamp and the raster do not change.
    // Why: Scrolling inside the tile must not cost a shaping pass, a raster, or an image upload.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (current.horizontal === tileX && current.width === width && holds(current, view, height)) return false;
    // ```
    if current.horizontal == tile_x && current.width == width && holds(current, view, height) {
        return false;
    }
    // What: The tile is re-centered on the view: one view height of overscan above it and one below.
    // Why: Re-centering then happens only after the view has traveled about one view height inside the tile.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const tileStart = Math.max(0, view + height / 2 - (TILE_VIEWS * height) / 2);
    // ```
    let tile_start = (view + height * 0.5 - height * TILE_VIEWS * 0.5).max(0.0);
    let tile_end = view + height * 0.5 + height * TILE_VIEWS * 0.5;
    let first = current.row_map.line_at(tile_start);
    let last = current.row_map.line_at(tile_end);
    current.first = first;
    current.count = last.saturating_sub(first) + 1 + TILE_SPARE_LINES;
    current.horizontal = tile_x;
    current.width = width;
    return true;
}

/// Retain pixel scrolling;
///  update the raster only at viewport tile boundaries.
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
        // An offset nobody announced is the reader scrolling: by wheel, by touch, or by a drag past an edge.
        if offset != current.offset {
            // `Some(Instant::now())` records this moment as the latest scroll.
            current.scrolled_at = Some(Instant::now());
        }
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
/// `paged` first moves the view by that many logical pixels,
///  so a page key keeps the caret's place on screen.
/// A caret above the view becomes the top line,
///  one below the bottom line;
///  a visible caret keeps the offsets.
/// Horizontally the caret gets up to 48 px of room on the side it left the view.
/// Offsets are assigned directly,
///  like other programmatic reveals;
///  native wheel easing is unaffected.
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
    let limit = rows::limit(&current.row_map, height);
    let paged_offset = (before + paged).clamp(0.0, limit);
    let mut offset = rows::showing(&current.row_map, row, paged_offset, height).clamp(0.0, limit);
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
/// A visible range keeps its offsets;
///  a hidden row is centered;
///  a hidden column starts 48 px from the left.
/// Offsets are assigned directly,
///  like other programmatic reveals;
///  native wheel easing is unaffected.
pub(super) fn reveal(window: &AppWindow, state: &Rc<RefCell<State>>, start: usize, end: usize) {
    let height = window.get_viewport_height();
    let width = window.get_viewport_width();
    let horizontal = -window.get_scroll_x();
    let before = -window.get_scroll_y();
    let mut offset = before;
    let mut current = state.borrow_mut();
    let text = current.document.text();
    let row = text.char_to_line(start.min(text.len_chars()));
    let top = current.row_map.code_top(row);
    if top < offset || top + CODE_ROW > offset + height {
        let limit = rows::limit(&current.row_map, height);
        offset = (top - ((height - CODE_ROW) / 2.0).max(0.0))
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
