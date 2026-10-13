//! From the paths the watcher named to the edits of the queue, without walking the library.
//!
//! What: `plan_changes` looks at each named path on the disk and in the sorted queue and says which queue runs to remove,
//! which tracks to add and which listed tracks to look at again; `apply_plan` builds the new queue from the old one.
//! Why: D113 makes every watcher event a refresh. Walking and stat'ing a million tracks for one replaced file took
//! seconds of idle-priority work per event; this costs a few binary searches and one `lstat` per named path.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! const plan = planChanges(tracks, root, dirty, disk); const next = applyPlan(tracks, plan, root);
//! ```

use std::collections::HashSet;
use std::ops::Range;
use std::path::{Path, PathBuf};

use crate::change_set::DirtyPaths;
use crate::disk_view::{Disk, EntryKind};
use crate::walk_order::{direct_files, locate, subtree_range, walk_cmp};

/// What:
///      `pub(crate) struct Plan { removed, added, touched }`.
///  The edits one change set asks of the queue.
/// Why:
///       The queue is edited once, and the tracks that exist on both sides are handed to the measurement.
#[derive(Debug, Default, PartialEq, Eq)]
pub(crate) struct Plan {
    /// Index runs of the old queue that are gone, sorted and disjoint.
    pub(crate) removed: Vec<Range<usize>>,
    /// Tracks that are on disk and not in the queue, in queue order.
    pub(crate) added: Vec<PathBuf>,
    /// Tracks that are listed and still on disk and were named: their file may have been replaced.
    pub(crate) touched: Vec<PathBuf>,
}

/// Methods of `Plan`.
impl Plan {
    /// What:
    ///      `pub(crate) fn changes_the_list(&self) -> bool`.
    ///  True when the queue gains or loses a track.
    /// Why:
    ///       A replaced file leaves the list alone, so nothing but the measurement follows.
    pub(crate) fn changes_the_list(&self) -> bool {
        return !self.removed.is_empty() || !self.added.is_empty();
    }
}

/// What:
///      `struct Planner<'a> { tracks, root, disk, plan, walked_until }`.
///  The state of one planning pass.
/// Why:
///       The helpers share the queue, the root and the disk, and write into one plan.
struct Planner<'a> {
    /// The queue, in walk order.
    tracks: &'a [PathBuf],
    /// The folder the queue was scanned from.
    root: &'a Path,
    /// The answers about the disk.
    disk: &'a dyn Disk,
    /// The edits so far.
    plan: Plan,
    /// The last folder whose whole subtree was read; named paths below it are already covered.
    walked_until: Option<PathBuf>,
}

/// Methods of `Planner`.
impl Planner<'_> {
    /// What: `remove_path` removes a file or a whole folder's run from the queue.
    /// Why: a path that is gone takes everything listed at or under it.
    fn remove_path(&mut self, path: &Path) {
        let run: Range<usize> = subtree_range(self.tracks, self.root, path);
        if !run.is_empty() {
            self.plan.removed.push(run);
        } else if let Ok(index) = locate(self.tracks, self.root, path) {
            self.plan.removed.push(index..index + 1);
        }
    }

    /// What: `visit_track` adds a track that is not listed, or marks a listed one to be looked at again.
    /// Why: a replaced file keeps its path; a new one needs a row.
    fn visit_track(&mut self, path: &Path) {
        let run: Range<usize> = subtree_range(self.tracks, self.root, path);
        if !run.is_empty() {
            self.plan.removed.push(run);
        }
        match locate(self.tracks, self.root, path) {
            Ok(_) => self.plan.touched.push(path.to_path_buf()),
            Err(_) => self.plan.added.push(path.to_path_buf()),
        }
    }

    /// What: `read_subtree` replaces the run of a folder by what the disk holds under it now.
    /// Why: a folder that is new, renamed in or recreated may hold anything, and no event names its contents.
    fn read_subtree(&mut self, folder: &Path) {
        let run: Range<usize> = subtree_range(self.tracks, self.root, folder);
        let fresh: Vec<PathBuf> = self.disk.walk(folder);
        let old: &[PathBuf] = &self.tracks[run.clone()];
        let (mut left, mut right) = (0_usize, 0_usize);
        while left < old.len() || right < fresh.len() {
            let order = match (old.get(left), fresh.get(right)) {
                (Some(a), Some(b)) if a == b => std::cmp::Ordering::Equal,
                (Some(a), Some(b)) => walk_cmp(self.root, a, b),
                (Some(_), None) => std::cmp::Ordering::Less,
                _ => std::cmp::Ordering::Greater,
            };
            match order {
                std::cmp::Ordering::Equal => {
                    self.plan.touched.push(fresh[right].clone());
                    left += 1;
                    right += 1;
                }
                std::cmp::Ordering::Less => {
                    self.plan.removed.push(run.start + left..run.start + left + 1);
                    left += 1;
                }
                std::cmp::Ordering::Greater => {
                    self.plan.added.push(fresh[right].clone());
                    right += 1;
                }
            }
        }
        self.walked_until = Some(folder.to_path_buf());
    }

    /// What: `compare_entries` compares a folder's direct entries with the queue's.
    /// Why: an entry appeared or went in a folder that is already listed; only that folder's own entries are read.
    fn compare_entries(&mut self, folder: &Path, run: Range<usize>) {
        let entries: Vec<(PathBuf, EntryKind)> = self.disk.entries(folder);
        let on_disk_files: HashSet<&Path> = entries.iter().filter(|(_, kind)| return *kind == EntryKind::Track).map(|(path, _)| return path.as_path()).collect();
        let on_disk_folders: HashSet<&Path> = entries.iter().filter(|(_, kind)| return *kind == EntryKind::Folder).map(|(path, _)| return path.as_path()).collect();
        let own: Range<usize> = direct_files(self.tracks, folder, run.clone());
        let mut listed_files: HashSet<&Path> = HashSet::new();
        for index in own.clone() {
            let track: &Path = self.tracks[index].as_path();
            listed_files.insert(track);
            if !on_disk_files.contains(track) {
                self.plan.removed.push(index..index + 1);
            }
        }
        for file in &on_disk_files {
            if !listed_files.contains(file) {
                self.plan.added.push((*file).to_path_buf());
            }
        }
        let mut listed_folders: HashSet<PathBuf> = HashSet::new();
        let mut position: usize = own.end;
        while position < run.end {
            let Some(child) = self.tracks[position].strip_prefix(folder).ok().and_then(|below| return below.components().next()) else {
                position += 1;
                continue;
            };
            let subfolder: PathBuf = folder.join(child.as_os_str());
            let sub_run: Range<usize> = subtree_range(self.tracks, self.root, &subfolder);
            if !on_disk_folders.contains(subfolder.as_path()) {
                self.plan.removed.push(sub_run.clone());
            }
            listed_folders.insert(subfolder);
            position = sub_run.end.max(position + 1);
        }
        for subfolder in on_disk_folders {
            if !listed_folders.contains(subfolder) {
                self.read_subtree(subfolder);
            }
        }
    }

    /// What: `visit` handles one named path.
    /// Why: what the path is now decides what the queue needs.
    fn visit(&mut self, path: &Path, structural: bool) {
        if !path.starts_with(self.root) || self.walked_until.as_deref().is_some_and(|folder| return path.starts_with(folder)) {
            return;
        }
        match self.disk.kind(path) {
            EntryKind::Missing | EntryKind::Other => self.remove_path(path),
            EntryKind::Track => self.visit_track(path),
            EntryKind::Folder => {
                if let Ok(index) = locate(self.tracks, self.root, path) {
                    self.plan.removed.push(index..index + 1);
                }
                let run: Range<usize> = subtree_range(self.tracks, self.root, path);
                if structural || run.is_empty() {
                    self.read_subtree(path);
                } else {
                    self.compare_entries(path, run);
                }
            }
        }
    }
}

/// What:
///      `fn merge_runs(mut runs: Vec<Range<usize>>) -> Vec<Range<usize>>`.
///  Sorts index runs and joins the ones that overlap or touch.
/// Why:
///       Two named paths can remove the same track, and the queue is rebuilt in one pass over disjoint runs.
fn merge_runs(mut runs: Vec<Range<usize>>) -> Vec<Range<usize>> {
    runs.sort_by_key(|run| return run.start);
    let mut merged: Vec<Range<usize>> = Vec::new();
    for run in runs {
        match merged.last_mut() {
            Some(last) if run.start <= last.end => last.end = last.end.max(run.end),
            _ => merged.push(run),
        }
    }
    return merged;
}

/// What:
///      `pub(crate) fn plan_changes(tracks, root, dirty, disk) -> Plan`.
///  Plans the queue edits for the named paths.
/// Why:
///       See the module description. Paths are visited in path order so a folder is read before what is inside it.
pub(crate) fn plan_changes(tracks: &[PathBuf], root: &Path, dirty: &DirtyPaths, disk: &dyn Disk) -> Plan {
    let mut planner: Planner = Planner { tracks, root, disk, plan: Plan::default(), walked_until: None };
    for (path, structural) in dirty.sorted() {
        planner.visit(&path, structural);
    }
    let mut plan: Plan = planner.plan;
    plan.removed = merge_runs(plan.removed);
    plan.added.sort_by(|left, right| return walk_cmp(root, left, right));
    plan.added.dedup();
    let mut seen: HashSet<PathBuf> = HashSet::new();
    plan.touched.retain(|path| return seen.insert(path.clone()));
    tracing::info!(
        named = dirty.len(),
        removed_runs = plan.removed.len(),
        added = plan.added.len(),
        touched = plan.touched.len(),
        "the named paths are planned"
    );
    return plan;
}

/// What:
///      `pub(crate) fn apply_plan(old: Vec<PathBuf>, root: &Path, plan: &Plan) -> Vec<PathBuf>`.
///  Builds the new queue: the old one without the removed runs and with the added tracks in their places.
/// Why:
///       One pass that moves paths and clones none; the additions are placed by binary search in the old queue.
pub(crate) fn apply_plan(old: Vec<PathBuf>, root: &Path, plan: &Plan) -> Vec<PathBuf> {
    let places: Vec<usize> = plan.added.iter().map(|path| return locate(&old, root, path).unwrap_or_else(|place| return place)).collect();
    let mut rebuilt: Vec<PathBuf> = Vec::with_capacity(old.len() + plan.added.len());
    let mut next_added: usize = 0;
    let mut runs = plan.removed.iter().peekable();
    for (index, track) in old.into_iter().enumerate() {
        while next_added < places.len() && places[next_added] <= index {
            rebuilt.push(plan.added[next_added].clone());
            next_added += 1;
        }
        while runs.peek().is_some_and(|run| return run.end <= index) {
            runs.next();
        }
        if runs.peek().is_some_and(|run| return run.contains(&index)) {
            continue;
        }
        rebuilt.push(track);
    }
    rebuilt.extend(plan.added[next_added..].iter().cloned());
    return rebuilt;
}

/// Unit tests in `change_plan_tests.rs`, pulled in at this point.
#[cfg(test)]
#[path = "change_plan_tests.rs"]
mod tests;
