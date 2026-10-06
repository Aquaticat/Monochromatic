//! The thread that owns the inotify watcher and applies the UI's desired directory set.
//! Adding a watch blocks until notify's loop replies, so it must never run on the UI thread.

/// The wake's decisions, classified invalidations, the shared state, and the kernel watch calls.
use super::{
    reconcile::{Kernel, Request, Watches, reconcile},
    record::record,
    shared::{Shared, SourceChange, lock},
    watch_ops::{WatchFailure, add, remove},
};
/// Containment uses the same canonical check as every project read.
use crate::workspace::Workspace;
/// What: notify's inotify backend, its configuration, and the `Watcher` trait that provides `new`.
/// Why: Naming `INotifyWatcher` (not `RecommendedWatcher`) keeps a polling backend from ever being chosen.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { INotifyWatcher, Config } from 'notify';
/// ```
use notify::{Config, INotifyWatcher, Watcher};
/// What: `Arc` shares the state across threads; `Receiver`/`SyncSender` are the bounded wake channel's ends;
///       `Instant` is a monotonic time point for the watch-limit backoff.
/// Why: The handler and the UI wake this thread; it sleeps in `recv` otherwise.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Shared, Receiver, BoundedSender } from 'threads';
/// ```
use std::{
    path::Path,
    sync::{
        Arc, Mutex,
        mpsc::{Receiver, SyncSender},
    },
    time::Instant,
};

/// The real kernel calls: one borrowed watcher and the project boundary its watches must stay inside.
struct Inotify<'a> {
    /// What: `&'a mut INotifyWatcher` lends the watcher for as long as `'a`, the life of this value.
    /// Why: The watch thread keeps owning the watcher; a wake only borrows it.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// watcher: INotifyWatcher;
    /// ```
    watcher: &'a mut INotifyWatcher,
    /// Canonical project boundary.
    workspace: &'a Workspace,
}

/// Pass each call to notify, after the containment check for adds.
impl Kernel for Inotify<'_> {
    /// Add one non-recursive watch inside the root.
    fn add(&mut self, path: &Path) -> Result<(), WatchFailure> {
        return add(self.watcher, self.workspace, path);
    }

    /// Remove one watch; one the kernel already dropped is only logged.
    fn remove(&mut self, path: &Path) {
        remove(self.watcher, path);
    }
}

/// Apply one wake's worth of requests; returns false when the UI handle is closing.
fn apply(
    watcher: &mut INotifyWatcher,
    workspace: &Workspace,
    shared: &Mutex<Shared>,
    watches: &mut Watches,
) -> bool {
    let mut guard = lock(shared);
    if guard.closing {
        return false;
    }
    // What: `take` moves the value out and leaves the default (`None`, `false`, empty set) behind.
    // Why: Each request is handled once; later wakes see only newer requests.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const request = { desired: shared.desired, retry: shared.retry, ... }; shared.desired = undefined;
    // ```
    let request = Request {
        desired: guard.desired.take(),
        retry: std::mem::take(&mut guard.retry),
        user_retry: std::mem::take(&mut guard.user_retry),
        stale: std::mem::take(&mut guard.stale),
        file: guard.file.clone(),
    };
    drop(guard);
    // What: `Inotify { ... }` borrows the watcher into the real kernel; `&mut kernel` lends it to `reconcile`.
    // Why: The decisions stay testable with fake calls; only here do they reach the kernel.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const outcome = reconcile(watches, request, performance.now(), new Inotify(watcher, workspace));
    // ```
    let mut kernel = Inotify { watcher, workspace };
    let outcome = reconcile(watches, request, Instant::now(), &mut kernel);
    let mut published = lock(shared);
    // Retries that change nothing must not make the UI copy the set again.
    if published.watched != watches.active {
        published.watched = watches.active.clone();
        published.watched_changed = true;
    }
    if outcome.everything {
        published.pending.everything = true;
    }
    // A new watch can miss changes made before it existed, so its directory is read once more.
    // The same holds for a newly displayed file in a directory that was already watched.
    // No write was seen, so a write event recorded in the meantime keeps its own classification.
    let parent = watches.file.as_deref().and_then(Path::parent);
    if (outcome.switched
        || parent.is_some_and(|directory| return outcome.established.contains(directory)))
        && published.pending.source.is_none()
    {
        published.pending.source = Some(SourceChange::Reread);
    }
    published.pending.directories.extend(outcome.established);
    return true;
}

/// Thread body: create the watcher, then apply requests on every wake until the UI handle closes.
pub(super) fn run(
    workspace: Workspace,
    shared: Arc<Mutex<Shared>>,
    wakes: Receiver<()>,
    waker: SyncSender<()>,
) {
    let handler_shared = Arc::clone(&shared);
    // What: `move |event| ...` is a closure that takes ownership of `handler_shared` and `waker`.
    // Why: notify calls it on its own thread for every event, so it must own what it uses.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const handler = (event) => record(handlerShared, waker, event);
    // ```
    let created = INotifyWatcher::new(
        move |event| {
            record(&handler_shared, &waker, event);
        },
        Config::default().with_follow_symlinks(false),
    );
    let mut watcher = match created {
        Ok(watcher) => watcher,
        Err(error) => {
            tracing::warn!(%error, "cannot start inotify file-change watching; rereading shown directories and the displayed file on a timer");
            return;
        }
    };
    tracing::info!(root = %workspace.root().display(), "started inotify file-change watching");
    // `default()` starts with nothing watched, failed, or desired, and the limit not reached.
    let mut watches = Watches::default();
    loop {
        if let Err(error) = wakes.recv() {
            tracing::debug!(%error, "change-watch wake channel closed");
            break;
        }
        if !apply(&mut watcher, &workspace, &shared, &mut watches) {
            break;
        }
    }
    // Dropping the watcher asks notify's loop to remove every watch and close the inotify descriptor.
    drop(watcher);
    tracing::debug!("stopped inotify file-change watching");
}
