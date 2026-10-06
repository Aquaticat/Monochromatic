//! State shared by the UI handle, the watch thread, and notify's event-handler thread.

/// What: `BTreeSet` is an ordered set of owned paths; `PathBuf` owns a path, `Path` borrows one.
/// Why: Pending invalidations collapse repeated events for one directory into a single entry.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const pending = new Set<string>();
/// ```
use std::{
    collections::BTreeSet,
    path::PathBuf,
    sync::{Mutex, MutexGuard},
};

/// How finished an observed change to the displayed file looks.
///
/// What: an `enum` with two payload-free variants, like a TS string-literal union.
/// Why: A closed write can be read now; a write still in progress waits briefly,
///      so a truncated or half-written file never replaces the displayed text.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type SourceChange = 'settled' | 'unsettled';
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SourceChange {
    /// Closed after writing, renamed into place, removed, or changed in permissions: read now.
    Settled,
    /// Created or written but not yet closed: read after the writer goes quiet.
    Unsettled,
}

/// Invalidations accumulated since the last `ChangeWatcher::take`; events carry no file data.
#[derive(Debug, Default)]
pub struct Changes {
    /// Watched directories whose entries changed, or whose watch just started and needs a fresh read.
    pub directories: BTreeSet<PathBuf>,
    /// What: `Option<SourceChange>` is either `Some(change)` or `None`, like `SourceChange | undefined`.
    /// Why: Only the latest event for the displayed file matters; `None` means it was untouched.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// source?: SourceChange;
    /// ```
    pub source: Option<SourceChange>,
    /// Reread everything shown: queue overflow, a notification error, a lost or failed watch, or a stopped watcher.
    pub everything: bool,
    /// The directories with a live watch, present only when that set changed since the last take.
    pub watched: Option<BTreeSet<PathBuf>>,
}

/// One lock guards all cross-thread state; no holder performs a filesystem call while holding it.
#[derive(Debug)]
pub(super) struct Shared {
    /// Canonical project root; events and watches outside it are ignored.
    pub(super) root: PathBuf,
    /// Latest directory set the UI wants watched, not yet applied by the watch thread.
    pub(super) desired: Option<BTreeSet<PathBuf>>,
    /// Displayed file whose own events become source invalidations.
    pub(super) file: Option<PathBuf>,
    /// Retry watches that failed earlier, for example after a directory was recreated.
    pub(super) retry: bool,
    /// Set once by the UI handle's Drop; the watch thread exits at its next wake.
    pub(super) closing: bool,
    /// Live watches whose directory was removed or renamed; the watch thread drops and re-adds them.
    pub(super) stale: BTreeSet<PathBuf>,
    /// Invalidations for the UI, drained by `take`.
    pub(super) pending: Changes,
    /// Directories with a live watch, as last published by the watch thread.
    pub(super) watched: BTreeSet<PathBuf>,
    /// The watched set changed since the UI last took it.
    pub(super) watched_changed: bool,
}

/// Construct the empty shared state for one project root.
impl Shared {
    /// Nothing is watched or pending until the UI names what it shows.
    pub(super) fn new(root: PathBuf) -> Self {
        return Self {
            root,
            // What: `None` is the empty variant of `Option`, like `undefined`.
            // Why: No desired set has been sent yet, which differs from an empty set.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // desired: undefined,
            // ```
            desired: None,
            file: None,
            retry: false,
            closing: false,
            stale: BTreeSet::new(),
            pending: Changes::default(),
            watched: BTreeSet::new(),
            watched_changed: false,
        };
    }
}

/// Lock the shared state, recovering it if a thread panicked while holding the lock.
///
/// What: `MutexGuard<'_, Shared>` is the unlocked view; the lock is released when it goes out of scope.
///       `'_` ties the guard's lifetime to the borrowed `Mutex`.
/// Why: A poisoned lock only means another thread panicked; the sets inside stay valid,
///      and refusing them would stop all refresh instead of degrading to rereads.
/// Gotcha: Unlike a TS object, the data is reachable only through the guard.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function lock(shared: Mutex<Shared>): Shared { return shared.acquire(); }
/// ```
pub(super) fn lock(shared: &Mutex<Shared>) -> MutexGuard<'_, Shared> {
    // What: `match` on the lock `Result`: `Ok(guard)` is the normal case, `Err(poisoned)` wraps the guard
    //       of a lock whose previous holder panicked; `into_inner` takes the guard out anyway.
    // Why: Keep watching after an unexpected panic elsewhere, and say so in the log.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { return shared.acquire(); } catch (poisoned) { log(poisoned); return poisoned.guard; }
    // ```
    match shared.lock() {
        Ok(guard) => {
            return guard;
        }
        Err(poisoned) => {
            tracing::error!(
                "change-watch state lock was poisoned by a panic; continuing with its contents"
            );
            return poisoned.into_inner();
        }
    }
}
