//! What the file watcher saw change, as a set of paths or as "everything".
//!
//! What: `Change` is either the union of the paths the watcher named (`Paths`) or the admission that the watcher cannot
//! say what changed (`Everything`); `DirtyPaths` is the set, with a flag per path that tells an entry appearing or
//! disappearing from an entry that was only written.
//! Why: D113 refreshes only what changed. The debounced watcher events name the changed paths, so the refresh can look
//! at those paths and fall back to a whole-library sweep only when the watcher reports lost events (an overflow of the
//! kernel queue, an error) or when a person opens a folder.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! type Change = { kind: "paths"; paths: Map<string, boolean> } | { kind: "everything" };
//! ```

use std::collections::HashMap;
use std::path::PathBuf;

use notify_debouncer_mini::notify::{Event, EventKind, event::ModifyKind};

/// What:
///      `pub(crate) const MAX_DIRTY_PATHS: usize = 100_000;`.
///  The most distinct paths a change set holds before it becomes "everything".
/// Why:
///       Past a tenth of the largest supported library (a copy of a hundred thousand files), looking at each named
///  path costs as much as walking the library once, and the memory of the set must stay bounded in a storm of events.
pub(crate) const MAX_DIRTY_PATHS: usize = 100_000;

/// What:
///      `pub(crate) struct DirtyPaths { entries }`.
///  The paths named by events, each with whether an entry appeared or disappeared there.
/// Why:
///       A path that only had its data written needs its file looked at; a path where an entry was created, removed or
///  renamed also needs, when it is a folder, a look at what is inside it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type DirtyPaths = Map<string, boolean>; // path -> structural
/// ```
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DirtyPaths {
    /// Each named path with its structural flag.
    entries: HashMap<PathBuf, bool>,
}

/// Methods of `DirtyPaths`.
impl DirtyPaths {
    /// What:
    ///      `pub(crate) fn single(path: PathBuf, structural: bool) -> DirtyPaths`.
    ///  A set of one path.
    /// Why:
    ///       Tests and the controller build small sets by hand.
    #[cfg(test)]
    pub(crate) fn single(path: PathBuf, structural: bool) -> DirtyPaths {
        let mut set: DirtyPaths = DirtyPaths::default();
        set.insert(path, structural);
        return set;
    }

    /// What:
    ///      `pub(crate) fn insert(&mut self, path: PathBuf, structural: bool)`.
    ///  Adds a path; a path named twice stays structural if either naming was.
    /// Why:
    ///       A file replaced by a rename shows up as a write and as a rename; the stronger meaning must survive.
    pub(crate) fn insert(&mut self, path: PathBuf, structural: bool) {
        let entry: &mut bool = self.entries.entry(path).or_insert(false);
        *entry = *entry || structural;
    }

    /// What:
    ///      `pub(crate) fn len(&self) -> usize`.
    ///  How many distinct paths are named.
    /// Why:
    ///       The cap on a change set and the tests read it.
    pub(crate) fn len(&self) -> usize {
        return self.entries.len();
    }

    /// What:
    ///      `pub(crate) fn is_empty(&self) -> bool`.
    ///  True when no path is named.
    /// Why:
    ///       An empty set means there is nothing to refresh.
    pub(crate) fn is_empty(&self) -> bool {
        return self.entries.is_empty();
    }

    /// What:
    ///      `pub(crate) fn sorted(&self) -> Vec<(PathBuf, bool)>`.
    ///  The paths in path order, so a folder comes before everything inside it.
    /// Why:
    ///       The planner handles a folder first and skips what its walk already covered.
    pub(crate) fn sorted(&self) -> Vec<(PathBuf, bool)> {
        let mut all: Vec<(PathBuf, bool)> = self.entries.iter().map(|(path, structural)| return (path.clone(), *structural)).collect();
        all.sort();
        return all;
    }

    /// What:
    ///      `fn absorb(&mut self, other: DirtyPaths)`.
    ///  Adds every path of another set.
    /// Why:
    ///       Two bursts of events become one change.
    fn absorb(&mut self, other: DirtyPaths) {
        for (path, structural) in other.entries {
            self.insert(path, structural);
        }
    }
}

/// What:
///      `pub(crate) enum Change { Paths(DirtyPaths), Everything }`.
///  What a burst of events means for the library.
/// Why:
///       Lost events cannot be turned into paths; they are the one case that needs the whole library looked at again.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Change = { kind: "paths"; paths: DirtyPaths } | { kind: "everything" };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Change {
    /// These paths changed.
    Paths(DirtyPaths),
    /// The watcher lost events or the library was just opened; look at everything.
    Everything,
}

/// Methods of `Change`.
impl Change {
    /// What:
    ///      `pub(crate) fn of_event(result: &notify::Result<Event>) -> Option<Change>`.
    ///  What one raw watcher event means: nothing for a read, everything for lost events and errors, else its paths.
    /// Why:
    ///       The rescan's own walk reads every directory, and reads must never count as changes or each refresh would
    ///  request another; an overflow or an error means events were lost.
    pub(crate) fn of_event(result: &notify_debouncer_mini::notify::Result<Event>) -> Option<Change> {
        let event: &Event = match result {
            Ok(event) => event,
            Err(_) => return Some(Change::Everything),
        };
        if event.kind.is_access() {
            return None;
        }
        if event.need_rescan() {
            return Some(Change::Everything);
        }
        let structural: bool = !matches!(event.kind, EventKind::Modify(ModifyKind::Data(_) | ModifyKind::Metadata(_)));
        let mut set: DirtyPaths = DirtyPaths::default();
        for path in &event.paths {
            set.insert(path.clone(), structural);
        }
        if set.is_empty() {
            return Some(Change::Everything);
        }
        return Some(Change::Paths(set));
    }

    /// What:
    ///      `pub(crate) fn merge(self, other: Change) -> Change`.
    ///  The union of two changes; "everything" absorbs paths, and a set past the cap becomes "everything".
    /// Why:
    ///       A storm of events must end in a bounded set, and a request that arrives while a refresh runs joins the one
    ///  that follows it.
    pub(crate) fn merge(self, other: Change) -> Change {
        return match (self, other) {
            (Change::Everything, _) | (_, Change::Everything) => Change::Everything,
            (Change::Paths(mut left), Change::Paths(right)) => {
                left.absorb(right);
                if left.len() > MAX_DIRTY_PATHS {
                    tracing::info!(paths = left.len(), "too many changed paths; the whole library is looked at instead");
                    return Change::Everything;
                }
                Change::Paths(left)
            }
        };
    }
}

/// Unit tests in `change_set_tests.rs`, pulled in at this point.
#[cfg(test)]
#[path = "change_set_tests.rs"]
mod tests;
