//! Watch exactly what the window shows, and turn change notifications into due rereads.
//! Notifications never carry listings or text: the existing readers reread and fence their replies.

/// Navigation owns the watcher and the directory schedule; the source state owns its own schedule.
use super::{Navigation, State};
/// A full reread treats the displayed file as changed and finished.
use ide_app::change_watch::SourceChange;
/// What: `Rc<RefCell<State>>` is the UI-thread shared source state; `BTreeSet` is an ordered set.
/// Why: The watcher compares whole sets, so an unchanged tree sends nothing to the watch thread.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const shown = new Set<string>(paths);
/// ```
use std::{
    cell::RefCell,
    collections::BTreeSet,
    path::{Path, PathBuf},
    rc::Rc,
    time::Instant,
};

/// Recompute the shown directories from the visible rows and send them with the displayed file.
/// Collapsed folders drop out, so their watches are removed; descendants of collapsed folders are not shown.
pub(super) fn show(source: &Rc<RefCell<State>>, navigation: &mut Navigation) {
    // `to_path_buf` copies the canonical root; it is always shown, even before its first listing.
    let mut shown = vec![navigation.workspace.root().to_path_buf()];
    for row in &navigation.rows {
        if row.entry.is_directory && row.expanded {
            shown.push(row.entry.path.clone());
        }
    }
    // What: `collect` builds a set from the iterator of cloned paths; the type annotation picks `BTreeSet`.
    // Why: The watcher keys watches by path; the visible order stays in `shown` for scheduling.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const wanted = new Set(shown);
    // ```
    let wanted: BTreeSet<PathBuf> = shown.iter().cloned().collect();
    let file = source.borrow().file_path.clone();
    navigation.watcher.watch_only(&wanted, file.as_deref());
    navigation.shown = shown;
}

/// Apply notifications: notified shown directories and the displayed file become due for a reread.
pub(super) fn update(source: &Rc<RefCell<State>>, navigation: &mut Navigation) {
    let changes = navigation.watcher.take();
    let now = Instant::now();
    // What: `if let Some(watched)` moves a newly reported live-watch set into navigation.
    // Why: Shown directories without a live watch keep the old 500 ms round robin.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (changes.watched !== undefined) navigation.watched = changes.watched;
    // ```
    if let Some(watched) = changes.watched {
        navigation.watched = watched;
    }
    if changes.everything {
        navigation.directories.changed_all(&navigation.shown);
    }
    for directory in changes.directories {
        // The displayed file's directory may be watched without being a shown tree folder.
        if navigation.shown.contains(&directory) {
            navigation.directories.changed(directory);
        }
    }
    let mut current = source.borrow_mut();
    if changes.everything {
        current.refresh.changed(SourceChange::Settled, now);
    } else if let Some(change) = changes.source {
        current.refresh.changed(change, now);
    }
    // What: `as_deref` borrows the optional owned path as `Option<&Path>`; `and_then(Path::parent)` takes its directory.
    // Why: The source keeps the old 250 ms timer until its directory has a live watch.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const parent = filePath === undefined ? undefined : dirname(filePath);
    // ```
    let parent = current.file_path.as_deref().and_then(Path::parent);
    let watched = parent.is_some_and(|directory| return navigation.watched.contains(directory));
    current.refresh.set_watched(watched);
    drop(current);
    if navigation
        .directories
        .start_sweep_if_due(&navigation.shown, now)
    {
        navigation.watcher.retry();
    }
}
