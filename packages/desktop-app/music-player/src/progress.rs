//! Progress-surface debounce helpers.
//!
//! The engine already throttles media-position messages by playback seconds, but
//! short or zero-duration tracks can still create rapid progress resets. This
//! module keeps the UI seek bar and the desktop taskbar progress from being
//! repainted for every reset while still allowing play-state changes through
//! immediately.

// What:     `use std::time::Duration;`. A standard-library span of time.
//           Siblings a TS reader might expect: `Instant` (a timestamp) and raw
//           integer milliseconds.
// Why:      Debouncing compares elapsed spans; `Duration` keeps the unit explicit
//           and avoids mixing seconds with milliseconds.
// TS map:   `type Duration = number; // milliseconds`
use std::time::Duration;

// What:     `pub const PROGRESS_UPDATE_DEBOUNCE_INTERVAL: Duration = Duration::from_millis(250);`.
//           A public constant holding the minimum gap between ordinary progress
//           repaints. `Duration::from_millis` builds the time span from an
//           integer millisecond count.
// Why:      A quarter-second cap is fast enough for a seek bar but slow enough to
//           prevent sub-second tracks from flashing the UI and taskbar.
// TS map:   `export const PROGRESS_UPDATE_DEBOUNCE_INTERVAL = 250;`
pub const PROGRESS_UPDATE_DEBOUNCE_INTERVAL: Duration = Duration::from_millis(250);

// What:     `pub enum ProgressUpdateKind { ... }` declares which debounce rule an
//           update should use. It is public so the binary can classify Slint
//           updates before asking the debouncer.
// Why:      Position ticks can wait; play/pause visibility changes must surface
//           immediately.
// TS map:   `type ProgressUpdateKind = "debounced" | "immediate";`
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProgressUpdateKind {
    /// Ordinary progress movement or track-reset progress.
    Debounced,
    /// State transitions that must update visible/hidden taskbar state now.
    Immediate,
}

// What:     `pub struct ProgressDebouncer { ... }` stores the last time a progress
//           surface was allowed to repaint. `Option<Duration>` is either
//           `Some(last_time)` or `None` before the first repaint.
// Why:      One small state object gates both the Slint seek bar and taskbar
//           progress through the same timing rule.
// TS map:   `class ProgressDebouncer { lastSurfaceAt: number | null }`
#[derive(Debug, Default)]
pub struct ProgressDebouncer {
    // What:     `last_surface_at: Option<Duration>` remembers the elapsed time of
    //           the last accepted progress update. `None` means no update has
    //           surfaced yet.
    // Why:      The next debounced update compares against this baseline.
    // TS map:   `lastSurfaceAt: number | null;`
    last_surface_at: Option<Duration>,
}

// What:     `impl ProgressDebouncer { ... }` defines methods on the debounce
//           state object.
// Why:      Keep the timing rule next to the state it mutates.
// TS map:   `class ProgressDebouncer { ...methods... }`
impl ProgressDebouncer {
    // What:     `pub fn new() -> Self`. Build a fresh debouncer. `Self` means
    //           `ProgressDebouncer` inside this impl block.
    // Why:      Callers should not construct the internal field directly.
    // TS map:   `constructor()`
    pub fn new() -> Self {
        // What:     `Self::default()` calls the derived `Default`, which sets
        //           `last_surface_at` to `None`.
        // Why:      Reuse the generated empty-state constructor.
        // TS map:   `return new ProgressDebouncer();`
        Self::default()
    }

    // What:     `pub fn should_surface(&mut self, now: Duration, kind: ProgressUpdateKind) -> bool`.
    //           Mutably borrow the debouncer, inspect the update kind, and return
    //           whether the caller should repaint progress now.
    // Why:      This is the single debounce decision used by UI and taskbar code.
    // TS map:   `shouldSurface(now: number, kind: ProgressUpdateKind): boolean`
    pub fn should_surface(&mut self, now: Duration, kind: ProgressUpdateKind) -> bool {
        // What:     `if kind == ProgressUpdateKind::Immediate { ... }`. Compare the
        //           enum value against the immediate variant.
        // Why:      Play/pause visibility changes should never be held back.
        // TS map:   `if (kind === "immediate") { ... }`
        if kind == ProgressUpdateKind::Immediate {
            // What:     `self.last_surface_at = Some(now);`. Store this accepted
            //           update time, wrapped in `Some`.
            // Why:      A following position reset still waits for the debounce gap.
            // TS map:   `this.lastSurfaceAt = now;`
            self.last_surface_at = Some(now);
            // What:     `return true;`. Leave the function immediately.
            // Why:      The caller should repaint now.
            // TS map:   `return true;`
            return true;
        }

        // What:     `let interval_elapsed = match self.last_surface_at { ... };`.
        //           Branch on whether a previous accepted update exists.
        // Why:      The first debounced update should surface, later ones must wait.
        // TS map:   `const intervalElapsed = this.lastSurfaceAt === null ? true : ...;`
        let interval_elapsed = match self.last_surface_at {
            // What:     `Some(last_surface_at) => ...`. There was a previous update;
            //           subtract it from `now` with `saturating_sub`, which returns
            //           zero instead of underflowing when clocks are equal or reset.
            // Why:      Compare elapsed time safely.
            // TS map:   `now - lastSurfaceAt >= PROGRESS_UPDATE_DEBOUNCE_INTERVAL`
            Some(last_surface_at) => {
                now.saturating_sub(last_surface_at) >= PROGRESS_UPDATE_DEBOUNCE_INTERVAL
            }
            // What:     `None => true`. No previous progress update.
            // Why:      The first progress value must be visible.
            // TS map:   `true`
            None => true,
        };

        // What:     `if interval_elapsed { ... }`. Only accepted updates refresh the
        //           stored baseline.
        // Why:      Suppressed rapid updates should not push the window forward.
        // TS map:   `if (intervalElapsed) { this.lastSurfaceAt = now; }`
        if interval_elapsed {
            // What:     `self.last_surface_at = Some(now);`. Record this accepted
            //           repaint time.
            // Why:      Start a new debounce interval.
            // TS map:   `this.lastSurfaceAt = now;`
            self.last_surface_at = Some(now);
        }

        // What:     `interval_elapsed` is the tail expression, so it is returned.
        // Why:      The caller receives the decision.
        // TS map:   `return intervalElapsed;`
        interval_elapsed
    }
}

// What:     `#[cfg(test)] #[path = "progress_tests.rs"] mod tests;`
//           declares a test-only submodule whose code lives in the sibling
//           file `progress_tests.rs`. `#[cfg(test)]` gates it to test
//           builds only; `#[path = "..."]` aims the module at a flat sibling
//           file instead of the default `progress/tests.rs`
//           subdirectory lookup. The file stays the `tests` CHILD of
//           progress, so its `use super::*` reaches the module items
//           (including private ones) unchanged.
// Why:      Keep `progress.rs` to production code; the tests live
//           beside it without inflating this file or its max-lines budget
//           (sibling `*_tests.rs` files are exempt from the linter).
// TS map:   the `progress.unit.test.ts` file beside
//           `progress.ts`, excluded from the production bundle.
//
// In TS you'd write (pseudocode):
// ```ts
// // progress.unit.test.ts, run only by the test runner
// ```
#[cfg(test)]
#[path = "progress_tests.rs"]
mod tests;
