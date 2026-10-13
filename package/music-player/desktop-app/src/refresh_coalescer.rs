//! At most one refresh sweep runs, and the requests that arrive meanwhile become one follow-up.
//!
//! What: `RefreshCoalescer` is a small state machine over "idle or running one numbered sweep, with work pending or not";
//! `Work` is what a refresh has to look at, either some files or the whole queue.
//! Why: D113 starts a refresh for every settled burst of watcher events. Sweeps that overlap would stat the same files
//! twice and contend for the idle-priority workers, so a request that arrives while a sweep runs joins one pending
//! follow-up that covers the union of everything asked meanwhile.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! class RefreshCoalescer { running: number | null; pending: Work | null; submit(w: Work): Launch | null; finished(id: number): Launch | null; }
//! ```

use std::collections::HashSet;
use std::path::PathBuf;

use crate::change_set::MAX_DIRTY_PATHS;

/// What:
///      `pub(crate) struct Files { check, announce }`.
///  The files a refresh sweep looks at, and the part of them whose rows are new.
/// Why:
///       A file that was replaced only needs its fingerprint checked and its peak measured; a file that was added also
///  needs its row announced by a peek at its header, so the row has a length at once. Announcing a replaced file would
///  blank its old peak until the decode ends.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(crate) struct Files {
    /// Every file whose fingerprint is checked.
    pub(crate) check: HashSet<PathBuf>,
    /// The files among them that are new to the list.
    pub(crate) announce: HashSet<PathBuf>,
}

/// What:
///      `pub(crate) enum Work { Files(Files), Everything }`.
///  What one refresh sweep has to look at.
/// Why:
///       A refresh after a few events looks at a few files; one after lost events looks at the whole queue.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum Work {
    /// These listed files.
    Files(Files),
    /// Every track of the queue.
    Everything,
}

/// Methods of `Work`.
impl Work {
    /// What:
    ///      `pub(crate) fn is_empty(&self) -> bool`.
    ///  True for a file set with no file.
    /// Why:
    ///       Nothing to look at means no sweep.
    pub(crate) fn is_empty(&self) -> bool {
        return matches!(self, Work::Files(files) if files.check.is_empty());
    }

    /// What:
    ///      `fn merge(self, other: Work) -> Work`.
    ///  The union: "everything" absorbs files, and a file set past the cap becomes "everything".
    /// Why:
    ///       The pending work of a long sweep must stay bounded however many events arrive.
    fn merge(self, other: Work) -> Work {
        return match (self, other) {
            (Work::Everything, _) | (_, Work::Everything) => Work::Everything,
            (Work::Files(mut left), Work::Files(right)) => {
                left.check.extend(right.check);
                left.announce.extend(right.announce);
                Work::Files(left).capped()
            }
        };
    }

    /// What:
    ///      `fn capped(self) -> Work`.
    ///  A file set past `MAX_DIRTY_PATHS` becomes "everything".
    /// Why:
    ///       Looking at that many named files costs as much as the whole queue, and the set must stay bounded.
    fn capped(self) -> Work {
        return match self {
            Work::Files(files) if files.check.len() > MAX_DIRTY_PATHS => Work::Everything,
            other => other,
        };
    }
}

/// What:
///      `pub(crate) struct Launch { id, work }`.
///  A sweep the caller must start now.
/// Why:
///       The coalescer decides; the controller starts the sweep and passes the number along so its end can be matched.
#[derive(Debug, PartialEq, Eq)]
pub(crate) struct Launch {
    /// The number of the sweep, unique for the life of the coalescer.
    pub(crate) id: u64,
    /// What the sweep looks at.
    pub(crate) work: Work,
}

/// What:
///      `pub(crate) struct RefreshCoalescer { running, pending, next_id }`.
///  Idle, or running one sweep with at most one follow-up pending.
/// Why:
///       See the module description. It is touched only by the engine thread, so it needs no lock: a request that arrives
///  after a sweep ended and before its end was handled joins the pending work, and the end then starts it.
#[derive(Debug, Default)]
pub(crate) struct RefreshCoalescer {
    /// The number of the sweep that runs, if any.
    running: Option<u64>,
    /// What was asked while it ran.
    pending: Option<Work>,
    /// The number the next sweep gets.
    next_id: u64,
}

/// Methods of `RefreshCoalescer`.
impl RefreshCoalescer {
    /// What:
    ///      `fn start(&mut self, work: Work) -> Launch`.
    ///  Marks a new sweep as running.
    /// Why:
    ///       Both `submit` and `finished` start sweeps the same way.
    fn start(&mut self, work: Work) -> Launch {
        self.next_id += 1;
        self.running = Some(self.next_id);
        return Launch { id: self.next_id, work };
    }

    /// What:
    ///      `pub(crate) fn submit(&mut self, work: Work) -> Option<Launch>`.
    ///  Asks for a refresh: a sweep to start now when idle, else `None` and the work joins the pending follow-up.
    /// Why:
    ///       This is the coalescing.
    pub(crate) fn submit(&mut self, requested: Work) -> Option<Launch> {
        let work: Work = requested.capped();
        if work.is_empty() {
            return None;
        }
        if self.running.is_none() {
            tracing::debug!(id = self.next_id + 1, "refresh starts at once; none is running");
            return Some(self.start(work));
        }
        tracing::debug!("a refresh is running; the request joins the pending follow-up");
        self.pending = Some(match self.pending.take() {
            Some(waiting) => waiting.merge(work),
            None => work,
        });
        return None;
    }

    /// What:
    ///      `pub(crate) fn finished(&mut self, id: u64) -> Option<Launch>`.
    ///  The sweep `id` ended: the follow-up to start now, or `None` and idle. Another number is ignored.
    /// Why:
    ///       The end of a sweep from before a reset must not release the sweep that runs now.
    pub(crate) fn finished(&mut self, id: u64) -> Option<Launch> {
        if self.running != Some(id) {
            tracing::debug!(id, running = ?self.running, "an end of a sweep that is not the running one is ignored");
            return None;
        }
        self.running = None;
        return self.pending.take().map(|waiting| return self.start(waiting));
    }

    /// What:
    ///      `pub(crate) fn reset(&mut self)`.
    ///  Forgets the running sweep and the pending work.
    /// Why:
    ///       A newly opened folder starts its own sweep, and the paths asked before it belong to the old folder.
    pub(crate) fn reset(&mut self) {
        tracing::debug!(running = ?self.running, had_pending = self.pending.is_some(), "the refresh state is reset");
        self.running = None;
        self.pending = None;
    }

    /// What:
    ///      `pub(crate) fn is_idle(&self) -> bool`.
    ///  True when no sweep runs.
    /// Why:
    ///       Tests wait for a sweep to end before the next run.
    #[cfg(test)]
    pub(crate) fn is_idle(&self) -> bool {
        return self.running.is_none();
    }

    /// What:
    ///      `pub(crate) fn pending(&self) -> Option<&Work>`.
    ///  The work waiting for the running sweep to end.
    /// Why:
    ///       Tests read what was merged.
    #[cfg(test)]
    pub(crate) fn pending(&self) -> Option<&Work> {
        return self.pending.as_ref();
    }
}

/// Unit tests in `refresh_coalescer_tests.rs`, pulled in at this point.
#[cfg(test)]
#[path = "refresh_coalescer_tests.rs"]
mod tests;
