//! Native project tree, bounded directory refresh, and successful-file navigation.

/// One source owner and one native window remain independent of background filesystem reads.
use super::{AppWindow, State};
/// Reuse filesystem-free tree state, bounded workers, and editord-compatible session-local history.
use ide_app::{directory_worker::DirectoryWorker, file_open::FileOpener, file_tree::{FileTree, TreeRow}, recent::RecentFiles, workspace::Workspace};
/// Startup failures must not silently disable project navigation.
use anyhow::Result;
/// Weak window handles and a retained timer bind worker results to the native event loop.
use slint::{ComponentHandle, SharedString, Timer, TimerMode};
/// UI-thread shared state is separate from worker-owned snapshots and native path identities.
use std::{cell::RefCell, path::PathBuf, rc::Rc, time::{Duration, Instant}};

/// Click, directory-navigation, and Ctrl+digit bindings.
mod actions;
/// Successful opens replace source atomically without losing the prior document on errors.
mod open;
/// Visible row presentation and ancestor expansion for reveal.
mod present;
/// Nonblocking reply consumption and bounded directory refresh scheduling.
mod tick;

/// All tree interaction stays on the native event-loop thread.
struct Navigation {
    /// Sole canonical root, also used for visible project context.
    workspace: Workspace,
    /// Cached directory snapshots and expansion/request state.
    tree: FileTree,
    /// One directory read or unread reply at a time.
    reader: DirectoryWorker,
    /// Unexpected reader disconnects suspend retries until restart rather than alternating diagnostics every tick.
    reader_available: bool,
    /// Path associated with the current directory reply for diagnostic recovery.
    reading: Option<PathBuf>,
    /// Last requested refresh time, independent of source-file polling.
    last_read: Option<Instant>,
    /// Round-robin position among visible expanded directories.
    refresh_index: usize,
    /// Latest directory failure; unrelated successes must not erase its diagnostic.
    directory_error: Option<(PathBuf, String)>,
    /// Background source opens retain only the latest requested target.
    opener: FileOpener,
    /// Current flat rows preserve paths independently of their lossy display labels.
    rows: Vec<TreeRow>,
    /// Ten session-local promoted file slots.
    recent: RecentFiles,
    /// Continue expanding/loading ancestors until this successfully opened file can be revealed.
    reveal: Option<PathBuf>,
}

/// Start navigation against the canonical root without synchronously enumerating its directories.
pub(super) fn bind(window: &AppWindow, source: &Rc<RefCell<State>>, workspace: Workspace) -> Result<Timer> {
    // What: clone owns the initial file identity without keeping a UI borrow alive through callbacks.
    // Why: History records only the already successful startup open, not pending requests.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const initial = source.current.filePath;
    // ```
    let initial = source.borrow().file_path.clone();
    let mut recent = RecentFiles::default();
    if let Some(path) = &initial {
        recent.opened(path.clone());
    }
    // Workspace clones copy canonical path metadata; workers own their independent read-only boundary.
    let reader = DirectoryWorker::new(workspace.clone())?;
    let opener = FileOpener::new(workspace.clone())?;
    let tree = FileTree::new(workspace.root());
    // Rc/RefCell shares checked mutable UI ownership; workers never receive this shared object.
    let navigation = Rc::new(RefCell::new(Navigation {
        workspace, tree, reader, opener, recent, reader_available: true,
        rows: Vec::new(), reading: None, last_read: None, refresh_index: 0,
        directory_error: None, reveal: initial,
    }));
    window.set_project_label(SharedString::from(navigation.borrow().workspace.root().display().to_string()));
    window.set_project_visible(true);
    actions::bind(window, source, &navigation);
    // The timer and callback owners retain navigation until window shutdown; Drop joins both readers.
    let timer = Timer::default();
    let active_source = Rc::clone(source);
    let weak_window = window.as_weak();
    timer.start(TimerMode::Repeated, Duration::from_millis(20), move || {
        if let Some(active) = weak_window.upgrade() {
            tick::update(&active, &active_source, &navigation);
        }
    });
    return Ok(timer);
}
