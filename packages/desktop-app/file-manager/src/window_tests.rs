// What:     Unit tests for `window.rs`, pulled in by
//           `#[cfg(test)] #[path = "window_tests.rs"] mod tests;` at the bottom
//           of `window.rs`. Compiles only under `cargo nextest run`; reaches the
//           parent module items via `use super::*` because this file is the
//           `tests` CHILD of window.
// Why:      Keep the bounded-window maths covered without inflating window.rs.

// What:     `use super::*;` glob-imports every item from the parent `window`
//           module (`visible_range`, `WindowRange`).
// Why:      Tests call `visible_range` directly.
//
// In TS you'd write (pseudocode):
// ```ts
// import { visibleRange } from "./window";
// ```
use super::*;

// What:     `const PREFETCH: usize = 1;` names the prefetch count these tests
//           use, matching the spike's one-item-each-side budget.
// Why:      Avoid repeating the literal and document intent.
const PREFETCH: usize = 1;

// What:     `#[test]` marks a unit-test function Cargo runs under `test`.
// Why:      Register this case with the test harness.
//
// In TS you'd write (pseudocode):
// ```ts
// test("empty list yields empty range", () => {});
// ```
#[test]
fn empty_list_yields_empty_range() {
    // What:     `let range = visible_range(0.0, 600.0, 226.0, 0, PREFETCH);`
    //           calls the function with zero items.
    // Why:      Exercise the early-return branch.
    let range = visible_range(0.0, 600.0, 226.0, 0, PREFETCH);
    // What:     `assert!(range.is_empty());` panics (failing the test) unless the
    //           range reports empty. `assert!` takes a bool.
    // Why:      No items means no window.
    assert!(range.is_empty());
    // What:     `assert_eq!(range.len(), 0);` fails unless the two values are
    //           equal.
    // Why:      Length must be zero too.
    assert_eq!(range.len(), 0);
}

// What:     `#[test]` on the top-of-strip case.
// Why:      At offset 0 the window must start at 0 (no negative prefetch wrap).
#[test]
fn top_of_strip_starts_at_zero() {
    // What:     Call with offset 0, a 600px viewport, 226px pitch, 500 items.
    // Why:      Reproduce a strip scrolled fully to the start.
    let range = visible_range(0.0, 600.0, 226.0, 500, PREFETCH);
    // What:     `assert_eq!(range.start, 0);` checks the start clamped to 0.
    // Why:      `saturating_sub` must not underflow below the first item.
    assert_eq!(range.start, 0);
    // What:     600/226 = 2.65 so items 0..=2 are visible; +1 prefetch after → end 4.
    // Why:      Confirm the visible span plus trailing prefetch.
    assert_eq!(range.end, 4);
}

// What:     `#[test]` on a mid-strip case with leading prefetch.
// Why:      Away from the edges the window must pad one item on each side.
#[test]
fn mid_strip_pads_both_sides() {
    // What:     Offset 2260px at 226px pitch means the first fully-scrolled item
    //           is index 10.
    // Why:      Land the viewport at a clean item boundary for an exact check.
    let range = visible_range(2260.0, 600.0, 226.0, 500, PREFETCH);
    // What:     first = floor(2260/226) = 10; minus 1 prefetch → start 9.
    // Why:      Leading prefetch item precedes the first visible item.
    assert_eq!(range.start, 9);
    // What:     last = floor((2260+600)/226) = floor(12.65) = 12; +1 exclusive
    //           +1 prefetch → end 14.
    // Why:      Trailing prefetch item follows the last visible item.
    assert_eq!(range.end, 14);
}

// What:     `#[test]` proving the window size stays bounded no matter where the
//           strip is scrolled.
// Why:      This is the spike's core invariant: instantiation is viewport-bound,
//           not strip-bound.
#[test]
fn window_size_is_bounded_everywhere() {
    // What:     `let count = 100_000;` is a huge item list.
    // Why:      If the window scaled with the list this would blow up.
    let count = 100_000;
    // What:     `for step in 0..1000 {` sweeps 1000 scroll positions.
    // Why:      Sample the whole strip, including both ends.
    for step in 0..1000 {
        // What:     `let offset = step as f32 * 226.0 * 40.0;` jumps 40 items per
        //           step; `as f32` converts the loop integer to a float.
        // Why:      Cover far-apart positions across the strip.
        let offset = step as f32 * 226.0 * 40.0;
        // What:     Compute the window at this offset.
        // Why:      Measure its size.
        let range = visible_range(offset, 600.0, 226.0, count, PREFETCH);
        // What:     `assert!(range.len() <= 8, ...)` fails if the window exceeds
        //           8 items. A 600px viewport over 226px items shows at most 3,
        //           plus 2 prefetch and boundary slack stays well under 8.
        // Why:      Prove the window never grows with the 100k item count.
        assert!(
            range.len() <= 8,
            "window {} too large at offset {}",
            range.len(),
            offset
        );
    }
}

// What:     `#[test]` proving the end clamps at the last item.
// Why:      Scrolling past the end must not point beyond the list.
#[test]
fn past_end_clamps_to_last_item() {
    // What:     Offset far beyond a 5-item list.
    // Why:      Reproduce an over-scroll (e.g., a shrunk column).
    let range = visible_range(1_000_000.0, 600.0, 226.0, 5, PREFETCH);
    // What:     `assert_eq!(range.end, 5);` checks the exclusive end is the count.
    // Why:      The window must stop at the final item.
    assert_eq!(range.end, 5);
    // What:     `assert!(range.start <= range.end);` guards the range invariant.
    // Why:      A start past the end would slice-panic later.
    assert!(range.start <= range.end);
}
