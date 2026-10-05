//! Decide which shown directory the single directory reader lists next.

/// Intervals shared with the source schedule.
use super::{SAFETY_SWEEP, UNWATCHED_DIRECTORY_POLL};
/// What: `BTreeSet<PathBuf>` is an ordered set of owned paths; `Instant` is a monotonic time point.
/// Why: Notified directories collapse into one pending entry each, however many events arrived.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const changed = new Set<string>();
/// ```
use std::{collections::BTreeSet, path::PathBuf, time::Instant};

/// Directory reread schedule; `shown` is always the root plus visible expanded folders, in visible order.
#[derive(Clone, Debug, Default)]
pub struct DirectoryRefresh {
    /// Notified directories; read before anything else except first listings.
    changed: BTreeSet<PathBuf>,
    /// Remaining directories of the current safety sweep; read only when nothing else waits.
    sweep: BTreeSet<PathBuf>,
    /// When the last sweep started; `None` until the first schedule call starts the clock.
    last_sweep: Option<Instant>,
    /// When the last unwatched directory was read.
    last_unwatched: Option<Instant>,
    /// What: `usize` is the unsigned index type (siblings `u32`, `u64`); collections index with it.
    /// Why: Round-robin position among unwatched shown directories, as the old polling kept.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// unwatchedIndex = 0;
    /// ```
    unwatched_index: usize,
}

/// Remove and return the first path of `shown` (visible order) that `pending` contains.
fn first_in(pending: &mut BTreeSet<PathBuf>, shown: &[PathBuf]) -> Option<PathBuf> {
    if pending.is_empty() {
        return None;
    }
    for path in shown {
        if pending.remove(path) {
            // `clone` returns an owned copy; the caller keeps its shown list intact.
            return Some(path.clone());
        }
    }
    // Whatever is left is no longer shown; a later expansion reads it as a first or established listing.
    pending.clear();
    return None;
}

/// Pure scheduling: callers pass `shown`, the live-watch set, and the current time.
impl DirectoryRefresh {
    /// A notification or a newly established watch made this directory's listing stale.
    pub fn changed(&mut self, path: PathBuf) {
        self.changed.insert(path);
    }

    /// Overflow, an error, or a lost watch: every shown directory is stale.
    pub fn changed_all(&mut self, shown: &[PathBuf]) {
        for path in shown {
            self.changed.insert(path.clone());
        }
    }

    /// Start a safety sweep when one is due; true tells the caller to retry failed watches too.
    pub fn start_sweep_if_due(&mut self, shown: &[PathBuf], now: Instant) -> bool {
        // What: `let ... else` binds the last start time or starts the clock on the first call.
        // Why: Startup already lists everything shown, so the first sweep waits one full interval.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.lastSweep === undefined) { this.lastSweep = now; return false; }
        // ```
        let Some(last) = self.last_sweep else {
            self.last_sweep = Some(now);
            return false;
        };
        if now.saturating_duration_since(last) < SAFETY_SWEEP {
            return false;
        }
        self.last_sweep = Some(now);
        for path in shown {
            self.sweep.insert(path.clone());
        }
        tracing::debug!(
            directories = shown.len(),
            "started the safety reread of shown directories"
        );
        return true;
    }

    /// The next directory to list, or `None` when nothing is due; the caller lists it right away.
    pub fn next(
        &mut self,
        shown: &[PathBuf],
        watched: &BTreeSet<PathBuf>,
        now: Instant,
    ) -> Option<PathBuf> {
        if let Some(path) = first_in(&mut self.changed, shown) {
            return Some(path);
        }
        // What: `is_none_or` is true for `None` or when the closure accepts the contained time.
        // Why: Unwatched directories keep the old 500 ms round robin, never faster.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.lastUnwatched === undefined || now - this.lastUnwatched >= 500) { ... }
        // ```
        if self
            .last_unwatched
            .is_none_or(|at| return now.saturating_duration_since(at) >= UNWATCHED_DIRECTORY_POLL)
        {
            let mut unwatched = Vec::new();
            for path in shown {
                if !watched.contains(path) {
                    unwatched.push(path);
                }
            }
            if !unwatched.is_empty() {
                self.unwatched_index %= unwatched.len();
                let path = unwatched[self.unwatched_index].clone();
                self.unwatched_index += 1;
                self.last_unwatched = Some(now);
                return Some(path);
            }
        }
        return first_in(&mut self.sweep, shown);
    }
}
