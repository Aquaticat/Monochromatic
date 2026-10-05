//! Decide when the displayed file is reread.

/// Intervals shared with the directory schedule.
use super::{SAFETY_SWEEP, UNWATCHED_SOURCE_POLL, WRITE_QUIET, WRITE_WAIT_LIMIT};
/// Notifications classify a change as finished or still being written.
use crate::change_watch::SourceChange;
/// What: `Instant` is a monotonic point in time; it never jumps with the wall clock.
/// Why: Intervals stay correct across clock adjustments.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const now = performance.now();
/// ```
use std::time::Instant;

/// Displayed-file reread schedule; the native reload tick owns one inside the source state.
#[derive(Clone, Debug, Default)]
pub struct SourceRefresh {
    /// The displayed file's directory has a live watch, so timers fall back to the safety sweep.
    watched: bool,
    /// What: `Option<Instant>` is a time or nothing (`number | undefined`).
    /// Why: When the first unread notification arrived; bounds the wait for an unfinished write.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// pendingSince?: number;
    /// ```
    pending_since: Option<Instant>,
    /// Time of the latest notification when it was an unfinished write; `None` when it was settled.
    unsettled_at: Option<Instant>,
    /// When the last read was admitted by the reader; `None` before the first read.
    last_request: Option<Instant>,
}

/// Pure scheduling: callers pass the current time, so tests choose it.
impl SourceRefresh {
    /// Record whether the displayed file's directory currently has a live watch.
    pub fn set_watched(&mut self, watched: bool) {
        if self.watched != watched {
            tracing::debug!(watched, "displayed-file refresh mode changed");
        }
        self.watched = watched;
    }

    /// Report whether the displayed file's directory currently has a live watch.
    pub fn is_watched(&self) -> bool {
        return self.watched;
    }

    /// Record a notification; the latest classification wins, so delete then rewrite waits for the write.
    pub fn changed(&mut self, change: SourceChange, now: Instant) {
        if self.pending_since.is_none() {
            self.pending_since = Some(now);
        }
        // What: `match` on the two-variant enum chooses which timestamp to keep.
        // Why: A later close-write settles an earlier unfinished write; a later write unsettles a delete.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.unsettledAt = change === 'settled' ? undefined : now;
        // ```
        match change {
            SourceChange::Settled => {
                self.unsettled_at = None;
            }
            SourceChange::Unsettled => {
                self.unsettled_at = Some(now);
            }
        }
    }

    /// True when a read should start now: first read, a settled or quiet change, or the timer elapsed.
    pub fn due(&self, now: Instant) -> bool {
        // What: `let ... else` binds `Some(last)` or returns early when there was no read yet.
        // Why: The first read happens immediately, as it did under polling.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.lastRequest === undefined) return true;
        // ```
        let Some(last) = self.last_request else {
            return true;
        };
        if let Some(since) = self.pending_since {
            match self.unsettled_at {
                None => {
                    return true;
                }
                Some(at) => {
                    if now.saturating_duration_since(at) >= WRITE_QUIET
                        || now.saturating_duration_since(since) >= WRITE_WAIT_LIMIT
                    {
                        return true;
                    }
                }
            }
        }
        let interval = if self.watched {
            SAFETY_SWEEP
        } else {
            UNWATCHED_SOURCE_POLL
        };
        return now.saturating_duration_since(last) >= interval;
    }

    /// A read was admitted: clear pending notifications; later ones schedule another read.
    pub fn requested(&mut self, now: Instant) {
        self.last_request = Some(now);
        self.pending_since = None;
        self.unsettled_at = None;
    }
}
