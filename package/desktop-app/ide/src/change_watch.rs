//! OS file-change notifications for what the window shows, reported as invalidations the UI polls.
//! Events never carry data: the existing bounded readers reread, and their request fencing decides.

/// Turn notify events into pending invalidations on notify's thread.
mod record;
/// State shared by the UI handle, the watch thread, and the event handler.
mod shared;
/// The thread that owns the inotify watcher.
mod watch_thread;

/// Invalidation kinds returned by `ChangeWatcher::take`.
pub use shared::{Changes, SourceChange};

/// Directory watches are checked against the same canonical root as every project read.
use crate::workspace::Workspace;
/// Thread startup failures stay actionable.
use anyhow::{Context, Result};
/// The non-blocking wake shared with notify's event handler.
use record::wake;
/// Private shared state and its poison-tolerant lock.
use shared::{Shared, lock};
/// What: `Arc<Mutex<Shared>>` is a thread-safe shared owner of locked state (`Rc<RefCell<..>>` is the
///       single-thread sibling); `sync_channel(1)` makes a one-slot wake channel; `JoinHandle` joins the thread.
/// Why: Three threads (UI, watch thread, notify's loop) touch the same small state.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const shared = new SharedArrayState(); const wake = boundedChannel(1);
/// ```
use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex, MutexGuard,
        mpsc::{SyncSender, sync_channel},
    },
    thread::{self, JoinHandle},
};

/// UI-owned handle: say what is shown, then poll invalidations without blocking.
pub struct ChangeWatcher {
    /// Shared with the watch thread and notify's event handler.
    shared: Arc<Mutex<Shared>>,
    /// One-slot wake channel into the watch thread.
    wake: SyncSender<()>,
    /// Joined on Drop, never detached.
    thread: Option<JoinHandle<()>>,
    /// Last directory set and file sent, so unchanged requests are not resent every tick.
    sent: Option<(BTreeSet<PathBuf>, Option<PathBuf>)>,
    /// The watch thread ended unexpectedly; reported once, then everything stays on timers.
    stopped: bool,
}

/// Test seam: while held, notify's event handler cannot record, so the kernel queue fills up.
pub struct DeliveryPause<'a> {
    /// What: a lock guard kept only for its Drop, which unlocks; the leading `_` marks it unused.
    /// Why: Overflow tests need notify's thread blocked on this lock while files are created.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// const release = await shared.acquire();
    /// ```
    _guard: MutexGuard<'a, Shared>,
}

/// Lifecycle and polling for one project root.
impl ChangeWatcher {
    /// Start the watch thread; inotify setup failures leave every shown item on its timer instead.
    pub fn new(workspace: Workspace) -> Result<Self> {
        // `to_path_buf` copies the canonical root into the shared state the handler filters with.
        let shared = Arc::new(Mutex::new(Shared::new(workspace.root().to_path_buf())));
        let (sender, receiver) = sync_channel(1);
        let thread_shared = Arc::clone(&shared);
        let thread_waker = sender.clone();
        let thread = thread::Builder::new()
            .name("ide-change-watch".to_string())
            .spawn(move || {
                watch_thread::run(workspace, thread_shared, receiver, thread_waker);
            })
            .context("Cannot start the file-change watch thread")?;
        return Ok(Self {
            shared,
            wake: sender,
            thread: Some(thread),
            sent: None,
            stopped: false,
        });
    }

    /// Watch exactly these directories plus the displayed file's parent; unchanged requests are free.
    pub fn watch_only(&mut self, directories: &BTreeSet<PathBuf>, file: Option<&Path>) {
        let mut wanted = directories.clone();
        // What: `and_then` maps `Some(file)` to its optional parent; `map` copies it into an owned path.
        // Why: Watching the parent (not the file) sees atomic replace and delete then recreate.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (file !== undefined) wanted.add(dirname(file));
        // ```
        if let Some(parent) = file.and_then(Path::parent) {
            wanted.insert(parent.to_path_buf());
        }
        let owned_file = file.map(Path::to_path_buf);
        if self
            .sent
            .as_ref()
            .is_some_and(|(directories_sent, file_sent)| {
                return directories_sent == &wanted && file_sent == &owned_file;
            })
        {
            return;
        }
        let mut guard = lock(&self.shared);
        guard.desired = Some(wanted.clone());
        guard.file = owned_file.clone();
        drop(guard);
        wake(&self.wake);
        self.sent = Some((wanted, owned_file));
    }

    /// Retry watches that failed, for example on the safety sweep after a directory was recreated.
    pub fn retry(&self) {
        lock(&self.shared).retry = true;
        wake(&self.wake);
    }

    /// Take everything recorded since the last call; never blocks on the filesystem.
    pub fn take(&mut self) -> Changes {
        let mut guard = lock(&self.shared);
        let mut changes = std::mem::take(&mut guard.pending);
        if guard.watched_changed {
            guard.watched_changed = false;
            changes.watched = Some(guard.watched.clone());
        }
        drop(guard);
        let finished = self
            .thread
            .as_ref()
            .is_some_and(|thread| return thread.is_finished());
        if finished && !self.stopped {
            self.stopped = true;
            tracing::warn!(
                "file-change watching stopped; shown directories and the displayed file are reread on timers"
            );
            changes.everything = true;
            changes.watched = Some(BTreeSet::new());
        }
        return changes;
    }

    /// Test seam: block notify's event handler until the returned value is dropped.
    pub fn pause_delivery(&self) -> DeliveryPause<'_> {
        return DeliveryPause {
            _guard: lock(&self.shared),
        };
    }

    /// Test seam: record an event or error exactly as notify's handler would.
    pub fn deliver(&self, event: notify::Result<notify::Event>) {
        record::record(&self.shared, &self.wake, event);
    }
}

/// Close the watch thread, then join it; notify's own loop thread is detached by notify and exits on its own.
impl Drop for ChangeWatcher {
    /// A watch call stuck on a hung filesystem delays this join, like the existing readers' joins.
    fn drop(&mut self) {
        lock(&self.shared).closing = true;
        wake(&self.wake);
        let Some(thread) = self.thread.take() else {
            return;
        };
        if let Err(error) = thread.join() {
            tracing::error!(?error, "file-change watch thread panicked");
        }
    }
}
