//! The bounded-window computation: given a scroll offset and a viewport size,
//! which contiguous run of fixed-pitch items is visible, plus a prefetch item on
//! each side. This single pure function serves all three virtualization levels:
//! columns (pitch = column pitch), panes within a column (pitch = pane pitch),
//! and would serve rows too, though `ListView` virtualizes rows itself. Keeping
//! it free of strip types makes it exhaustively unit-testable.

/// What:     `pub struct WindowRange` is a half-open index range: `start`
///           inclusive, `end` exclusive, both `usize` (the count/index integer;
///           siblings `u32`/`u64`).
/// Why:      A `start..end` slice of the full item list is exactly the bounded
///           window to publish to Slint.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type WindowRange = { start: number; end: number }; // end exclusive
/// ```
pub struct WindowRange {
    /// What:     `pub start: usize` is the first in-window index (inclusive).
    /// Why:      The window begins here.
    pub start: usize,
    /// What:     `pub end: usize` is one past the last in-window index.
    /// Why:      `start..end` is a Rust half-open range, so `end` is exclusive.
    pub end: usize,
}

/// What:     `impl WindowRange` attaches methods to the range type.
/// Why:      Callers ask "how many items?" often; give it a name.
impl WindowRange {
    /// What:     `pub fn len(&self) -> usize` returns the item count in the range.
    /// Why:      This count is the number of elements Slint will instantiate for
    ///           this level, the quantity the spike keeps bounded.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// len(): number { return this.end - this.start; }
    /// ```
    pub fn len(&self) -> usize {
        // What:     `self.end - self.start` is plain integer subtraction; tail
        //           expression (no `;`) so it is returned.
        // Why:      Half-open range length.
        self.end - self.start
    }

    /// What:     `pub fn is_empty(&self) -> bool` reports whether the range holds
    ///           no items.
    /// Why:      Clippy wants an `is_empty` beside any `len`; an empty strip or
    ///           column is a real state.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// isEmpty(): boolean { return this.end === this.start; }
    /// ```
    pub fn is_empty(&self) -> bool {
        // What:     `self.end == self.start` is an equality check returning bool.
        // Why:      Zero-length range means nothing to show.
        self.end == self.start
    }
}

/// What:     `pub fn visible_range(...) -> WindowRange` computes the window.
///           Parameters: `offset_px` (scroll position), `viewport_px` (visible
///           size), `item_pitch_px` (edge-to-edge distance per item),
///           `item_count` (total items), `prefetch` (extra items each side).
/// Why:      One function turns any scroll state into the small contiguous slice
///           to instantiate, so off-window items are never published.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function visibleRange(offsetPx, viewportPx, itemPitchPx, itemCount, prefetch): WindowRange
/// ```
pub fn visible_range(
    offset_px: f32,
    viewport_px: f32,
    item_pitch_px: f32,
    item_count: usize,
    prefetch: usize,
) -> WindowRange {
    // What:     `if item_count == 0 { return WindowRange { start: 0, end: 0 }; }`
    //           is an early return of the empty range. `return` exits now.
    // Why:      An empty list has no window; the maths below would divide fine
    //           but the clamps assume at least one item.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (itemCount === 0) return { start: 0, end: 0 };
    // ```
    if item_count == 0 {
        return WindowRange { start: 0, end: 0 };
    }
    // What:     `let offset = offset_px.max(0.0);` clamps negative offsets to 0.
    //           `.max(0.0)` returns the larger of the two floats.
    // Why:      Scroll never goes before the first item.
    let offset = offset_px.max(0.0);
    // What:     `let pitch = item_pitch_px.max(1.0);` forces a positive pitch.
    // Why:      A zero or negative pitch would divide by zero; 1px is a safe floor.
    let pitch = item_pitch_px.max(1.0);
    // What:     `let viewport = viewport_px.max(0.0);` clamps the viewport size.
    // Why:      A negative viewport (mid-resize) should read as empty, not wrap.
    let viewport = viewport_px.max(0.0);
    // What:     `let first = (offset / pitch).floor() as usize;`. `.floor()`
    //           rounds the float down; `as usize` truncates it to an integer
    //           index.
    // Why:      The first item whose top edge is at or before the viewport top.
    let first = (offset / pitch).floor() as usize;
    // What:     `let last = ((offset + viewport) / pitch).floor() as usize;`
    //           finds the item at the viewport's bottom/right edge.
    // Why:      The last item that the viewport still overlaps (may be partial).
    let last = ((offset + viewport) / pitch).floor() as usize;
    // What:     `let first = first.min(item_count - 1);` clamps the index to the
    //           last valid item. `.min(...)` returns the smaller value.
    // Why:      Scrolling past the end must not point beyond the list.
    let first = first.min(item_count - 1);
    // What:     `let last = last.min(item_count - 1);` clamps the same way.
    // Why:      Same end-of-list guard for the bottom edge.
    let last = last.min(item_count - 1);
    // What:     `let start = first.saturating_sub(prefetch);`. `saturating_sub`
    //           subtracts but stops at 0 instead of underflowing (usize can't go
    //           negative).
    // Why:      Extend the window one prefetch item BEFORE the viewport, without
    //           wrapping around to a huge number at the strip's start.
    let start = first.saturating_sub(prefetch);
    // What:     `let end = (last + 1 + prefetch).min(item_count);`. `+ 1` makes
    //           the range end exclusive; `+ prefetch` extends it; `.min(...)`
    //           caps at the item count.
    // Why:      Extend the window one prefetch item AFTER the viewport, clamped
    //           to the end of the list.
    let end = (last + 1 + prefetch).min(item_count);
    // What:     `WindowRange { start, end }` is the returned struct literal (field
    //           shorthand), the function's tail expression.
    // Why:      Hand back the bounded, prefetch-padded window.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { start, end };
    // ```
    WindowRange { start, end }
}

/// What:     `#[cfg(test)] #[path = "window_tests.rs"] mod tests;` declares a
///           test-only submodule whose code lives in the sibling file
///           `window_tests.rs`. `#[cfg(test)]` compiles it only for tests;
///           `#[path = "..."]` points at the flat sibling file instead of the
///           default `window/tests.rs` lookup.
/// Why:      Keep `window.rs` to production code; the tests sit beside it without
///           inflating this file (sibling `*_tests.rs` files are linter-exempt).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // window.unit.test.ts, run only by the test runner
/// ```
#[cfg(test)]
#[path = "window_tests.rs"]
mod tests;
