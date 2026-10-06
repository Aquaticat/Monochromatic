//! The resting pointer: which source character it is over, and since when.
//!
//! editord asks for hover information when the pointer has not moved for 350 ms
//! (`HOVER_DEBOUNCE_MS` in `package-paused/desktop-daemon/editord/src/client/timing.ts`).
//! This view does the same per character: moving within one character keeps the timer.

/// The source state holds the shaped rows the pointer is resolved against.
use crate::native::State;
/// What: `Duration` is a time span; `Instant` is a point on a clock that never goes backwards.
/// Why: Resting is measured from the last move to another character.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const now = performance.now();
/// ```
use std::time::{Duration, Instant};

/// How long the pointer rests on one character before hover information is asked for.
pub(super) const REST: Duration = Duration::from_millis(350);

/// What: Where the pointer rests. `Option<(Option<usize>, Instant)>` is "nothing" while the
///       pointer is outside the source, or the character it is over (nothing between lines'
///       ends and gutters) with the moment it arrived there.
/// Why: A hover request is sent once per rest, and resting over no character hides the popup.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Rest = { at?: [character: number | undefined, since: number]; asked: boolean };
/// ```
#[derive(Debug, Default)]
pub(super) struct Rest {
    /// Character under the pointer and when the pointer arrived on it.
    pub(super) at: Option<(Option<usize>, Instant)>,
    /// The request for the current rest was already made.
    pub(super) asked: bool,
}

/// Movement and timing.
impl Rest {
    /// The pointer moved to `character`; a different character restarts the rest.
    pub(super) fn moved(&mut self, character: Option<usize>) {
        // `map` reads the character of the present rest, if any.
        if self.at.map(|(current, _)| return current) == Some(character) {
            return;
        }
        // `Some((character, Instant::now()))` starts a new rest at this moment.
        self.at = Some((character, Instant::now()));
        self.asked = false;
    }

    /// The pointer left the source.
    pub(super) fn left(&mut self) {
        self.at = None;
        self.asked = false;
    }

    /// The pointer is over the source text area.
    pub(super) fn over(&self) -> bool {
        return self.at.is_some();
    }

    /// What: The character to ask hover information for, once the rest lasted long enough.
    /// Why: Only one request per rest; the caller marks it asked.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// due(): number | undefined
    /// ```
    pub(super) fn due(&self) -> Option<usize> {
        if self.asked {
            return None;
        }
        // `let Some(...) = ... else` binds a resting character or leaves with nothing.
        let Some((Some(character), since)) = self.at else {
            return None;
        };
        if since.elapsed() < REST {
            return None;
        }
        return Some(character);
    }

    /// True once the pointer rested over no character for the rest time.
    pub(super) fn idle(&self) -> bool {
        return matches!(self.at, Some((None, since)) if since.elapsed() >= REST);
    }
}

/// What: The source character under a point: `y` is the logical distance from the top of the text
///       and `x` the logical distance from the start of a line's text, negative over the line numbers.
/// Why: Hover and Ctrl+click ask about the character the pointer is over, not the nearest caret
///      boundary; a point past the end of a line, over the gutter, below the text, or on a line's
///      virtual rows (its hints and diagnostic messages) is over no character.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function characterAt(state: State, y: number, x: number): number | undefined
/// ```
pub(super) fn character_at(state: &State, y: f32, x: f32) -> Option<usize> {
    if y < 0.0 || x < 0.0 || y >= state.row_map.height() {
        return None;
    }
    // The vertical mapping names the line and tells its code row from the virtual rows above it.
    let place = state.row_map.locate(y);
    if place.in_block {
        return None;
    }
    let line = place.line;
    // `?` returns nothing when no rows are shaped yet.
    let view = state.shaped.as_ref()?;
    let scale = view.viewport.scale;
    // `find` returns the first shaped row of that line, or nothing when it is not materialized.
    let row = view
        .rows
        .iter()
        .find(|candidate| return candidate.row == line)?;
    let length = row.source_len();
    let end = row.source_start + length;
    if length == 0 || x >= row.caret_x(end, scale) {
        return None;
    }
    let boundary = row.hit(x, scale);
    // The nearest boundary right of the point means the character before it is under the point.
    let character = if boundary > row.source_start && x < row.caret_x(boundary, scale) {
        boundary - 1
    } else {
        boundary
    };
    if character >= end {
        return None;
    }
    return Some(character);
}
