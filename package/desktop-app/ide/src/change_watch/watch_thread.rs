//! The thread that owns the inotify watcher and applies the UI's desired directory set, then the language
//! servers' folders. Adding a watch blocks until notify's loop replies, so it must never run on the UI thread.

/// The wake's decisions, classified invalidations, the shared state, and the kernel watch calls.
use super::{
    reconcile::{Kernel, Request, Watches, reconcile},
    record::{record, wake},
    server_scan::{Scan, bases, scan},
    server_watch::{ServerRequest, ServerWatches, TreeFirst, forget_below, reconcile_servers},
    shared::{ServerChange, ServerChangeKind, Shared, SourceChange, lock},
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
///       `RecvTimeoutError` says why a timed wait ended; `JoinHandle` joins the scan thread; `Duration` and
///       `Instant` are a time span and a monotonic time point for the watch-limit backoff.
/// Why: The handler and the UI wake this thread; it sleeps in `recv` otherwise, or until a backoff ends.
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
        mpsc::{Receiver, RecvTimeoutError, SyncSender},
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};
/// The queue into the language worker, for the creations a newly watched folder may have missed.
use tokio::sync::mpsc::UnboundedSender;

/// Shortest sleep while waiting for the servers' backoff, so a wait that just ended does not spin.
const SHORTEST_BACKOFF_SLEEP: Duration = Duration::from_millis(50);

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

/// Everything the watch thread keeps for the language servers between wakes.
#[derive(Default)]
struct Servers {
    /// Desired, live, and waiting folders.
    watches: ServerWatches,
    /// Some server registered file watchers, so folders are watched and changes forwarded.
    active: bool,
    /// The next scan starts watching: its files are not reported as created.
    initial: bool,
    /// Which period of watching the next scan belongs to; clearing the feed starts a new one.
    generation: u64,
    /// What: `Option<JoinHandle<()>>` is the running scan thread, or `None`.
    /// Why: One scan runs at a time; requests that arrive meanwhile wait for the next one.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// scanning?: Thread;
    /// ```
    scanning: Option<JoinHandle<()>>,
    /// Paths that may be new folders, waiting for the next scan.
    candidates: BTreeSet<PathBuf>,
    /// Folders to scan again, waiting for the next scan.
    rescans: BTreeSet<PathBuf>,
}

/// Run the scans of `bases` on their own thread, because ripgrep can take a while on a large project,
/// and hand the results back through the shared state.
fn spawn_scan(
    root: PathBuf,
    bases: Vec<PathBuf>,
    initial: bool,
    generation: u64,
    shared: &Arc<Mutex<Shared>>,
    waker: &SyncSender<()>,
) -> Option<JoinHandle<()>> {
    // `Arc::clone` and `clone` give the thread its own handles to the state and the wake channel.
    let thread_shared = Arc::clone(shared);
    let thread_waker = waker.clone();
    let spawned = thread::Builder::new()
        .name("ide-server-scan".to_string())
        .spawn(move || {
            let mut results = Vec::new();
            for base in &bases {
                if lock(&thread_shared).closing {
                    return;
                }
                let mut found = scan(&root, base, initial);
                found.generation = generation;
                results.push(found);
            }
            lock(&thread_shared).server.scanned.extend(results);
            wake(&thread_waker);
        });
    // What: `match` on the spawn `Result`: a thread handle, or the reason no thread could start.
    // Why: Without a scan the servers' folders stay as they were; the window is unaffected.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { return spawn(...); } catch (error) { log.warn(error); return undefined; }
    // ```
    match spawned {
        Ok(handle) => {
            return Some(handle);
        }
        Err(error) => {
            tracing::warn!(%error, "cannot start a scan of the project for the language servers");
            return None;
        }
    }
}

/// Replace what was known below the scanned folder with what the scan found. Files in folders that had
/// no watch before, or only a provisional one whose events were held back, appeared without any event
/// the servers heard, so they hear about them as created.
fn apply_scan(
    servers: &mut ServerWatches,
    found: Scan,
    feed: Option<&UnboundedSender<ServerChange>>,
) {
    let base = found.base.clone();
    // What: `filter` keeps the folders below the base that were source folders; `cloned` copies them;
    //       `collect` builds the set.
    // Why: Only those folders have had their changes delivered.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const before = new Set([...desired].filter(path => isInside(path, base)));
    // ```
    let before: BTreeSet<PathBuf> = servers
        .desired
        .iter()
        .filter(|path| return path.starts_with(&base) && !servers.provisional.contains(*path))
        .cloned()
        .collect();
    forget_below(&mut servers.desired, &base);
    forget_below(&mut servers.provisional, &base);
    servers.desired.extend(found.directories);
    servers.desired.extend(found.provisional.iter().cloned());
    servers.provisional.extend(found.provisional);
    if found.initial {
        return;
    }
    let Some(sender) = feed else {
        return;
    };
    for file in found.files {
        let known = file
            .parent()
            .is_some_and(|folder| return before.contains(folder));
        if known {
            continue;
        }
        let message = ServerChange {
            path: file,
            kind: ServerChangeKind::Created,
        };
        if let Err(error) = sender.send(message) {
            tracing::debug!(%error, "the language worker stopped; a found file was not forwarded");
            return;
        }
    }
}

/// Apply one wake's worth of requests; returns false when the UI handle is closing.
fn apply(
    watcher: &mut INotifyWatcher,
    workspace: &Workspace,
    shared: &Arc<Mutex<Shared>>,
    waker: &SyncSender<()>,
    watches: &mut Watches,
    servers: &mut Servers,
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
    let feed_changed = std::mem::take(&mut guard.server.feed_changed);
    let feed = guard.server.feed.clone();
    let candidates = std::mem::take(&mut guard.server.candidates);
    let rescans = std::mem::take(&mut guard.server.rescans);
    let gone = std::mem::take(&mut guard.server.gone);
    let scanned = std::mem::take(&mut guard.server.scanned);
    drop(guard);
    let mut desired_changed = false;
    if feed_changed {
        if feed.is_some() && !servers.active {
            tracing::info!(
                "a language server registered file watchers; watching the project's source folders for it"
            );
            servers.active = true;
            servers.initial = true;
            servers.rescans.insert(workspace.root().to_path_buf());
        } else if feed.is_none() && servers.active {
            tracing::info!(
                "no language server registers file watchers any more; releasing their folder watches"
            );
            servers.active = false;
            servers.generation += 1;
            servers.candidates.clear();
            servers.rescans.clear();
            servers.watches.desired.clear();
            servers.watches.provisional.clear();
            desired_changed = true;
        }
    }
    if servers.active {
        servers.candidates.extend(candidates);
        servers.rescans.extend(rescans);
        for path in &gone {
            forget_below(&mut servers.watches.desired, path);
            forget_below(&mut servers.watches.provisional, path);
            desired_changed = true;
        }
        for found in scanned {
            if found.generation == servers.generation {
                apply_scan(&mut servers.watches, found, feed.as_ref());
                desired_changed = true;
            }
        }
    }
    let now = Instant::now();
    let mut kernel = Inotify { watcher, workspace };
    // What: `TreeFirst { ... }` wraps the real kernel so the tree shares folders with the servers and
    //       takes one of their watches when the limit refuses it; the block ends that borrow.
    // Why: The decisions stay testable with fake calls; only here do they reach the kernel.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const outcome = reconcile(watches, request, now, new TreeFirst(kernel, servers));
    // ```
    let outcome = {
        let mut first = TreeFirst {
            inner: &mut kernel,
            servers: &mut servers.watches,
            tree_held: watches.active.clone(),
        };
        reconcile(watches, request, now, &mut first)
    };
    let server_request = ServerRequest {
        desired_changed,
        tree_limited: !watches.limited.is_empty(),
    };
    reconcile_servers(
        &mut servers.watches,
        &watches.active,
        server_request,
        now,
        &mut kernel,
    );
    // One scan at a time: requests that arrived during the running one start the next.
    let finished = servers
        .scanning
        .as_ref()
        .is_none_or(|handle| return handle.is_finished());
    let requested = !servers.candidates.is_empty() || !servers.rescans.is_empty();
    if servers.active && finished && requested {
        if let Some(handle) = servers.scanning.take()
            && handle.join().is_err()
        {
            tracing::warn!("a scan of the project for the language servers panicked");
        }
        let root = workspace.root().to_path_buf();
        let wanted = bases(&root, &servers.candidates, &servers.rescans);
        servers.candidates.clear();
        servers.rescans.clear();
        if !wanted.is_empty() {
            servers.scanning = spawn_scan(
                root,
                wanted,
                servers.initial,
                servers.generation,
                shared,
                waker,
            );
            servers.initial = false;
        }
    }
    let mut published = lock(shared);
    // Retries that change nothing must not make the UI copy the set again.
    if published.watched != watches.active {
        published.watched = watches.active.clone();
        published.watched_changed = true;
    }
    published.server.watched = servers.watches.active.clone();
    published.server.provisional = servers.watches.provisional.clone();
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
    let handler_waker = waker.clone();
    // What: `move |event| ...` is a closure that takes ownership of `handler_shared` and `handler_waker`.
    // Why: notify calls it on its own thread for every event, so it must own what it uses.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const handler = (event) => record(handlerShared, handlerWaker, event);
    // ```
    let created = INotifyWatcher::new(
        move |event| {
            record(&handler_shared, &handler_waker, event);
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
    let mut servers = Servers::default();
    loop {
        // While the servers wait on the limit, the thread also wakes when their backoff ends.
        let backoff = servers.watches.limit.map(|limit| {
            return limit
                .until_retry(Instant::now())
                .max(SHORTEST_BACKOFF_SLEEP);
        });
        // What: `recv_timeout` waits for a wake or the end of the backoff; `Timeout` is the latter.
        // Why: The servers' retries need no UI tick, so they also work in the headless inspection tool.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const woke = backoff === undefined ? await wakes.next() : await Promise.race([wakes.next(), sleep(backoff)]);
        // ```
        let received: Result<(), String> = match backoff {
            Some(wait) => match wakes.recv_timeout(wait) {
                Ok(()) | Err(RecvTimeoutError::Timeout) => Ok(()),
                Err(error) => Err(error.to_string()),
            },
            None => wakes.recv().map_err(|error| return error.to_string()),
        };
        if let Err(error) = received {
            tracing::debug!(%error, "change-watch wake channel closed");
            break;
        }
        if !apply(
            &mut watcher,
            &workspace,
            &shared,
            &waker,
            &mut watches,
            &mut servers,
        ) {
            break;
        }
    }
    // A scan still running ends on its own once ripgrep finishes; it is joined so no thread outlives this one.
    if let Some(handle) = servers.scanning.take()
        && handle.join().is_err()
    {
        tracing::warn!("a scan of the project for the language servers panicked");
    }
    // Dropping the watcher asks notify's loop to remove every watch and close the inotify descriptor.
    drop(watcher);
    tracing::debug!("stopped inotify file-change watching");
}
