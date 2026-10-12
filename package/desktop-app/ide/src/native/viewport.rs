//! Native scrolling retains fractional offsets between raster tile updates.

/// Parent state owns the document and the currently displayed tile;
///  `rows` holds the map-based scroll rules.
use super::{
    AppWindow, State, render, rows,
    tile::{self, TileBounds},
};
/// The side of a soft-wrap offset a position is read on.
use ide_app::document::ReadingAffinity;
/// Height of one code row:
///  the least a line can take,
///  which bounds how many lines a view can show.
use ide_app::row_map::CODE_ROW;
/// A wrap width must be a positive number of pixels.
use ide_app::wrap::has_wrap_width;
/// ComponentHandle supplies weak references for callback lifetimes.
use slint::ComponentHandle;
/// Checked shared ownership remains confined to the UI thread.
use std::{cell::RefCell, rc::Rc};

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
pub(super) fn holds(current: &State, bounds: TileBounds, view: f32, height: f32) -> bool {
    let lines = current.document.text().len_lines();
    let edge = RECENTER_EDGE_VIEWS * height;
    let end = (bounds.first + bounds.count).min(lines);
    let top_held = bounds.first == 0 || view >= current.row_map.block_top(bounds.first) + edge;
    let bottom_held = end >= lines || view + height <= current.row_map.block_top(end) - edge;
    return top_held && bottom_held;
}

/// What:
///  Room kept at the right edge of the text area, in logical pixels, for a caret standing after the last glyph
///  of a full row.
/// Why:
///  There is no horizontal scrolling, so the caret bar (2 px wide) must fit inside the view;
///  the view has no scrollbar element, so this is the only term besides the gutter.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const CARET_ROOM = 2;
/// ```
pub(super) const CARET_ROOM: f32 = 2.0;

/// What:
///  The wrap width for a text area `viewport_width` logical pixels wide:
///  the width without the caret room,
///  or nothing when that is not positive.
/// Why:
///  A width of zero or less means the view is not laid out yet;
///  wrapping then waits and the last width is kept, as IntelliJ's `SoftWrapApplianceManager` does.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function wrapWidth(viewportWidth: number): number | undefined;
/// ```
pub(super) fn wrap_width(viewport_width: f32) -> Option<f32> {
    let width = viewport_width - CARET_ROOM;
    return has_wrap_width(width).then_some(width);
}

/// What:
///  `&mut State` lends the source state mutably;
///  `f32` is a 32-bit float of logical pixels;
/// the `bool` answer says whether the materialized tile changed.
/// Why:
///  Native scrolling and programmatic reveal must agree on which rows are materialized;
///  the wrap width joins the tile's identity, so a resize asks for a new tile.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function place(current: State, offset: number, width: number, height: number): boolean;
/// ```
pub(super) fn place(current: &mut State, offset: f32, viewport_width: f32, height: f32) -> bool {
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
    // Any placement supersedes a scroll re-center still waiting for the worker; `place_scrolled` sets it again.
    current.scroll_wanted = None;
    // A width that cannot wrap keeps the last one.
    if let Some(wrap) = wrap_width(viewport_width) {
        current.width = wrap;
    }
    let width = current.width;
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
    // if (current.width === width && holds(current, view, height)) return false;
    // ```
    let shown = current.shown;
    if shown.width == width && holds(current, shown, view, height) {
        // The displayed tile still holds the view, so nothing is wanted; the requested window is the displayed one.
        tile::cancel(current);
        current.first = shown.first;
        current.count = shown.count;
        current.width = shown.width;
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
    current.width = width;
    return true;
}

/// What:
///  `place` for the reader's own scrolling: a tile it changes is a scroll re-center,
///  which the worker may build while the displayed tile stays on screen.
/// Why:
///  Keyboard, pointer, and reveal moves call `place` directly and keep the synchronous path.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function placeScrolled(state: State, offset: number, width: number, height: number): boolean;
/// ```
pub(super) fn place_scrolled(
    current: &mut State,
    offset: f32,
    viewport_width: f32,
    height: f32,
) -> bool {
    let changed = place(current, offset, viewport_width, height);
    // The first width the view reports replaces a tile that was never wrapped; it is built at once, so the
    // window never shows long lines unwrapped.
    if changed && current.shown.width > 0.0 {
        current.scroll_wanted = Some(tile::requested(current));
    }
    return changed;
}

/// Retain pixel scrolling;
///  update the raster only at viewport tile boundaries and when the wrap width changes.
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
    // owner.onViewportChanged((offset, width, height) => { ... });
    // ```
    owner.on_viewport_changed(move |offset, viewport_width, height| {
        // What: `borrow_mut` lends the state mutably; `&mut current` passes that loan to `place`.
        // Why: The loan must end before rendering borrows the state again.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const changed = place(state.current, offset, width, height);
        // ```
        let mut current = state.borrow_mut();
        // An offset nobody announced is the reader scrolling: by wheel, by touch, or by a drag past an edge.
        if offset != current.offset {
            // `Some(...)` records this moment as the latest scroll.
            current.scrolled_at = Some(rows::quiet_now());
        }
        let changed = place_scrolled(&mut current, offset, viewport_width, height);
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

/// What:
///  How many visual rows below the first row of its line the character `position` is drawn,
///  on the side of a soft wrap `affinity` names.
///  A line outside the materialized rows is shaped on the spot.
/// Why:
///  Keeping the caret in view means keeping its visual row in view, not only its line.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function rowsDown(current: State, position: number, affinity: ReadingAffinity, scale: number): number;
/// ```
fn rows_down(current: &mut State, position: usize, affinity: ReadingAffinity, scale: f32) -> usize {
    let line = current
        .document
        .text()
        .char_to_line(position.min(current.document.text().len_chars()));
    if let Some(view) = &current.shaped {
        for row in &view.rows {
            if row.row == line {
                return row.caret_at(position, affinity, view.viewport.scale).row;
            }
        }
    }
    if !has_wrap_width(current.width) {
        return 0;
    }
    let State {
        document,
        shaper,
        width,
        ..
    } = current;
    return shaper
        .wrapped_row(document, line, scale, *width)
        .caret_at(position, affinity, scale)
        .row;
}

/// Render after a keyboard caret movement and keep the caret visible with the smallest possible scroll.
///
/// `paged` first moves the view by that many logical pixels,
///  so a page key keeps the caret's place on screen.
/// A caret above the view becomes the top row,
///  one below the bottom row;
///  a visible caret keeps the offset.
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
    let before = -window.get_scroll_y();
    let scale = window.window().scale_factor();
    let mut current = state.borrow_mut();
    let caret = current.document.position();
    let head = caret.head;
    let row = current.document.text().char_to_line(head);
    let down = rows_down(&mut current, head, caret.affinity, scale);
    let limit = rows::limit(&current.row_map, height);
    let paged_offset = (before + paged).clamp(0.0, limit);
    let mut offset =
        rows::showing(&current.row_map, row, down, paged_offset, height).clamp(0.0, limit);
    // A fractional offset left by smooth scrolling is kept while the caret stays in view.
    if offset != before {
        offset = offset.round();
    }
    place(&mut current, offset, width, height);
    drop(current);
    if offset != before {
        window.set_scroll_y(-offset);
    }
    render(window, state);
    tracing::debug!(row, vertical = offset, "followed source caret");
}

/// Scroll a source character range into view and render it.
/// A visible range keeps its offset;
///  a hidden row is centered.
/// Offsets are assigned directly,
///  like other programmatic reveals;
///  native wheel easing is unaffected.
pub(super) fn reveal(window: &AppWindow, state: &Rc<RefCell<State>>, start: usize, end: usize) {
    let height = window.get_viewport_height();
    let width = window.get_viewport_width();
    let before = -window.get_scroll_y();
    let scale = window.window().scale_factor();
    let mut offset = before;
    let mut current = state.borrow_mut();
    let text = current.document.text();
    let bounded = start.min(text.len_chars());
    let row = text.char_to_line(bounded);
    // A range to reveal is not the caret, so its start stands on the default side of a wrap offset.
    let down = rows_down(&mut current, bounded, ReadingAffinity::Downstream, scale);
    let top = current.row_map.code_top(row) + down as f32 * CODE_ROW;
    if top < offset || top + CODE_ROW > offset + height {
        let limit = rows::limit(&current.row_map, height);
        offset = (top - ((height - CODE_ROW) / 2.0).max(0.0))
            .clamp(0.0, limit)
            .round();
    }
    place(&mut current, offset, width, height);
    drop(current);
    if offset != before {
        window.set_scroll_y(-offset);
    }
    render(window, state);
    tracing::debug!(row, vertical = offset, end, "revealed source range");
}
