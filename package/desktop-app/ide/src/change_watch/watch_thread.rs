//! The thread that owns the inotify watcher and applies the UI's desired directory set.
//! Adding a watch blocks until notify's loop replies, so it must never run on the UI thread.

/// Classified invalidations and the non-blocking wake shared with the event handler.
use super::{
    record::record,
    shared::{Shared, SourceChange, lock},
};
/// Containment uses the same canonical check as every project read.
use crate::workspace::Workspace;
/// Failures name the directory and, for the watch limit, the sysctl to raise.
use anyhow::{Result, bail};
/// What: notify's inotify backend, its configuration, the non-recursive mode, and the `Watcher` trait
///       whose methods (`new`, `watch`, `unwatch`) the backend implements.
/// Why: Naming `INotifyWatcher` (not `RecommendedWatcher`) keeps a polling backend from ever being chosen.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { INotifyWatcher, Config, RecursiveMode } from 'notify';
/// ```
use notify::{Config, ErrorKind, INotifyWatcher, RecursiveMode, Watcher};
/// What: `Arc` shares the state across threads; `Receiver`/`SyncSender` are the bounded wake channel's ends.
/// Why: The handler and the UI wake this thread; it sleeps in `recv` otherwise.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Shared, Receiver, BoundedSender } from 'threads';
/// ```
use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        mpsc::{Receiver, SyncSender},
    },
};

/// Watch one directory non-recursively after checking that it is its own canonical path inside the root.
fn add(watcher: &mut INotifyWatcher, workspace: &Workspace, path: &Path) -> Result<()> {
    // What: `?` returns the resolve error to the caller; `resolve` canonicalizes and rejects escapes.
    // Why: inotify follows symbolic links, so a symlinked alias could otherwise watch outside the project.
    // Gotcha: A swap between this check and the watch is not prevented; reads have the same window.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const resolved = workspace.resolve(path); // throws on escape
    // ```
    let resolved = workspace.resolve(path)?;
    if resolved != path {
        bail!(
            "Not watching {}: it resolves to {} through a symbolic link",
            path.display(),
            resolved.display()
        );
    }
    // What: `if let Err(error) = ...` runs the block only when `watch` failed.
    // Why: The failure is described with its directory and, for the watch limit, its remedy.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { watcher.watch(path, 'non-recursive'); } catch (error) { throw new Error(describe(error, path)); }
    // ```
    if let Err(error) = watcher.watch(path, RecursiveMode::NonRecursive) {
        bail!("{}", describe(&error, path));
    }
    return Ok(());
}

/// Name the directory; the watch limit (`ENOSPC` from `inotify_add_watch`) gets the sysctl to raise.
pub(super) fn describe(error: &notify::Error, path: &Path) -> String {
    if let ErrorKind::MaxFilesWatch = error.kind {
        return format!(
            "Cannot watch {}: the inotify watch limit is reached; raise fs.inotify.max_user_watches",
            path.display()
        );
    }
    return format!("Cannot watch {}: {error}", path.display());
}

/// The watch-limit message cannot be provoked without exhausting the host's inotify watches.
#[cfg(test)]
#[path = "watch_thread_tests.rs"]
mod tests;

/// Remove one watch; a watch the kernel already dropped (removed directory) is expected and only logged.
fn remove(watcher: &mut INotifyWatcher, path: &Path) {
    if let Err(error) = watcher.unwatch(path) {
        tracing::debug!(path = %path.display(), %error, "watch was already gone");
    }
}

/// Mutable bookkeeping owned by the watch thread alone.
struct Watches {
    /// Directories with a live watch.
    active: BTreeSet<PathBuf>,
    /// Desired directories whose last watch attempt failed; retried only on request.
    failed: BTreeSet<PathBuf>,
    /// The UI's latest desired set.
    desired: BTreeSet<PathBuf>,
    /// The displayed file as of the previous wake, to notice a switch to another file.
    file: Option<PathBuf>,
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
    // const desired = shared.desired; shared.desired = undefined;
    // ```
    let desired = guard.desired.take();
    let retry = std::mem::take(&mut guard.retry);
    let stale = std::mem::take(&mut guard.stale);
    let file = guard.file.clone();
    drop(guard);
    if let Some(next) = desired {
        watches.desired = next;
    }
    // The handler reports only the file named in the shared state, so a change made to a newly
    // displayed file before the switch reached that state went unrecorded.
    let switched = file.is_some() && file != watches.file;
    watches.file = file.clone();
    if retry {
        watches.failed.clear();
    }
    for path in &stale {
        if watches.active.remove(path) {
            remove(watcher, path);
        }
    }
    // Collect first: the set cannot change while it is being iterated.
    let mut hidden = Vec::new();
    for path in watches.active.difference(&watches.desired) {
        hidden.push(path.clone());
    }
    for path in &hidden {
        watches.active.remove(path);
        remove(watcher, path);
        tracing::debug!(path = %path.display(), "stopped watching a directory that is no longer shown");
    }
    // What: `retain` keeps only the entries for which the closure `|path| ...` returns true.
    // Why: A directory that is no longer shown must not be retried later.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // failed = new Set([...failed].filter(path => desired.has(path)));
    // ```
    watches
        .failed
        .retain(|path| return watches.desired.contains(path));
    let mut established = BTreeSet::new();
    let mut lost = false;
    for path in &watches.desired {
        if watches.active.contains(path) || watches.failed.contains(path) {
            continue;
        }
        match add(watcher, workspace, path) {
            Ok(()) => {
                tracing::debug!(path = %path.display(), "watching directory");
                watches.active.insert(path.clone());
                established.insert(path.clone());
            }
            Err(error) => {
                tracing::warn!(%error, "directory watch failed; rereading it on a timer and rereading everything shown");
                watches.failed.insert(path.clone());
                lost = true;
            }
        }
    }
    let mut published = lock(shared);
    published.watched = watches.active.clone();
    published.watched_changed = true;
    if lost {
        published.pending.everything = true;
    }
    // A new watch can miss changes made before it existed, so its directory is read once more.
    // The same holds for a newly displayed file in a directory that was already watched.
    let parent = file.as_deref().and_then(Path::parent);
    if switched || parent.is_some_and(|directory| return established.contains(directory)) {
        published.pending.source = Some(SourceChange::Settled);
    }
    published.pending.directories.extend(established);
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
    let mut watches = Watches {
        active: BTreeSet::new(),
        failed: BTreeSet::new(),
        desired: BTreeSet::new(),
        file: None,
    };
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
