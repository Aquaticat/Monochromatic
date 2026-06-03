// What:     Unit tests for `progress.rs`, pulled in by
//           `#[cfg(test)] #[path = "progress_tests.rs"] mod tests;` at
//           the bottom of `progress.rs`. Compiles only under
//           `cargo nextest run` / `cargo test`; reaches the module items
//           (including private ones) via `use super::*` because this file is
//           the `tests` CHILD of progress.
// Why:      Keep the tests beside the code without inflating
//           `progress.rs` or its max-lines budget (sibling
//           `*_tests.rs` files are exempt from the linter).
// TS map:   `progress.unit.test.ts` beside `progress.ts`.

// What:     `use super::{...};` imports names from the parent module into the
//           test module.
// Why:      Tests call the debouncer without long `super::` prefixes.
// TS map:   `import { ProgressDebouncer, ProgressUpdateKind } from "../progress";`
use super::{ProgressDebouncer, ProgressUpdateKind, PROGRESS_UPDATE_DEBOUNCE_INTERVAL};

// What:     `use std::time::Duration;`. Import the time-span type for test
//           timestamps.
// Why:      Test inputs are explicit elapsed times.
// TS map:   `type Duration = number;`
use std::time::Duration;

// What:     `#[test] fn first_debounced_update_surfaces()`. A unit test function.
// Why:      A fresh player still needs its first progress value to appear.
// TS map:   `test("first debounced update surfaces", () => { ... })`
#[test]
fn first_debounced_update_surfaces() {
    // What:     `let mut debouncer = ProgressDebouncer::new();`. A mutable
    //           debouncer instance.
    // Why:      `should_surface` updates its internal baseline.
    // TS map:   `const debouncer = new ProgressDebouncer();`
    let mut debouncer = ProgressDebouncer::new();

    // What:     `assert!(...)` fails the test unless the expression is true.
    // Why:      The first progress update must not be hidden.
    // TS map:   `expect(...).toBe(true);`
    assert!(debouncer.should_surface(Duration::from_millis(0), ProgressUpdateKind::Debounced));
}

// What:     `#[test] fn rapid_debounced_updates_wait_for_interval()`. A unit
//           test for the normal debounce window.
// Why:      Repeated position ticks inside the window should not repaint.
// TS map:   `test("rapid debounced updates wait for interval", () => { ... })`
#[test]
fn rapid_debounced_updates_wait_for_interval() {
    // What:     `let mut debouncer = ProgressDebouncer::new();`. Fresh state.
    // Why:      Start with no accepted progress baseline.
    // TS map:   `const debouncer = new ProgressDebouncer();`
    let mut debouncer = ProgressDebouncer::new();

    // What:     First call at `0ms`.
    // Why:      Establish the baseline.
    // TS map:   `debouncer.shouldSurface(0, "debounced");`
    assert!(debouncer.should_surface(Duration::from_millis(0), ProgressUpdateKind::Debounced));
    // What:     Second call before `PROGRESS_UPDATE_DEBOUNCE_INTERVAL`.
    // Why:      This is the flicker-prone rapid update case.
    // TS map:   `expect(debouncer.shouldSurface(100, "debounced")).toBe(false);`
    assert!(!debouncer.should_surface(Duration::from_millis(100), ProgressUpdateKind::Debounced));
    // What:     Call exactly at the configured interval.
    // Why:      The next visible progress update is allowed once the gap elapsed.
    // TS map:   `expect(debouncer.shouldSurface(250, "debounced")).toBe(true);`
    assert!(debouncer.should_surface(
        PROGRESS_UPDATE_DEBOUNCE_INTERVAL,
        ProgressUpdateKind::Debounced,
    ));
}

// What:     `#[test] fn immediate_update_surfaces_and_suppresses_following_reset()`.
//           A unit test for play-state or visibility changes.
// Why:      The taskbar must hide/show immediately, but a zero-position reset a
//           millisecond later should not flicker the progress surfaces.
// TS map:   `test("immediate update suppresses following reset", () => { ... })`
#[test]
fn immediate_update_surfaces_and_suppresses_following_reset() {
    // What:     `let mut debouncer = ProgressDebouncer::new();`. Fresh state.
    // Why:      Test the exact state sequence from startup or play.
    // TS map:   `const debouncer = new ProgressDebouncer();`
    let mut debouncer = ProgressDebouncer::new();

    // What:     Immediate update at `10ms`.
    // Why:      Visibility state must be delivered right away.
    // TS map:   `expect(debouncer.shouldSurface(10, "immediate")).toBe(true);`
    assert!(debouncer.should_surface(Duration::from_millis(10), ProgressUpdateKind::Immediate));
    // What:     Debounced reset at `11ms`.
    // Why:      This is the rapid zero-duration track reset that flickers bars.
    // TS map:   `expect(debouncer.shouldSurface(11, "debounced")).toBe(false);`
    assert!(!debouncer.should_surface(Duration::from_millis(11), ProgressUpdateKind::Debounced));
}
