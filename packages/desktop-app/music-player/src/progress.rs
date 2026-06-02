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

// What:     `#[cfg(test)] mod tests { ... }` declares a test-only module.
// Why:      The debounce timing rule is pure, so unit tests can lock down the
//           short-track flicker behavior without a GUI or D-Bus session.
// TS map:   `describe("ProgressDebouncer", () => { ... })`
#[cfg(test)]
mod tests {
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
}
