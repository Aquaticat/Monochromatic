//! Refreshes the library when the watcher reports changes: the queue edits, the selection and the measurement.
//!
//! What: `impl Controller` methods that turn a `Change` into queue edits (`handle_source_changed`), walk the whole root
//! when events were lost (`rescan_everything`), and start or queue the refresh sweeps through the coalescer.
//! Why: D113 makes the library follow the disk with no action by the person. The cost of a refresh must follow what
//! changed, so a replaced file in a library of a million tracks costs lookups for that one path, not a walk and a stat of
//! every file.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::change_plan::{Plan, apply_plan, plan_changes};
use crate::change_set::Change;
use crate::command::Update;
use crate::controller::Controller;
use crate::disk_view::RealDisk;
use crate::measure::spawn_queue_measurement;
use crate::playback::expand_paths;
use crate::refresh_coalescer::{Files, Launch, Work};
use crate::sweep_gate::SweepGate;
use crate::sweep_report::SweepJob;
use crate::walk_order::locate;

/// Methods of `Controller` for refreshing the library.
impl Controller {
    /// What:
    ///      `pub(crate) fn handle_source_changed(&mut self, change: Change)`.
    ///  Applies one debounced change of the Source Root: the named paths, or everything.
    /// Why:
    ///       Named paths are planned against the sorted queue and the disk; only an added or removed track changes the list.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// handleSourceChanged(change: Change): void { if (change.kind === "everything") return this.rescanEverything(); /* plan, apply, refresh */ }
    /// ```
    pub(crate) fn handle_source_changed(&mut self, change: Change) {
        let Change::Paths(dirty) = change else {
            tracing::info!("the watcher lost events; every track is looked at");
            self.rescan_everything();
            return;
        };
        let Some(root) = self.source_root.clone() else {
            tracing::debug!("a change was reported with no folder open; ignored");
            return;
        };
        tracing::debug!(named = dirty.len(), "the watcher named changed paths");
        if !root.is_dir() {
            self.rescan_everything();
            return;
        }
        let started: std::time::Instant = std::time::Instant::now();
        let plan: Plan = plan_changes(self.queue.tracks(), &root, &dirty, &RealDisk);
        let planned: std::time::Duration = started.elapsed();
        let selected_path: Option<PathBuf> = self.queue.current_path().cloned();
        if plan.changes_the_list() {
            self.queue.replace_tracks_with(|old| return apply_plan(old, &root, &plan));
            let edited: std::time::Duration = started.elapsed();
            self.settle_selection(&root, selected_path.clone());
            tracing::debug!(planned_us = planned.as_micros(), edited_us = edited.as_micros(), settled_us = started.elapsed().as_micros(), "the list was edited");
        }
        if selected_path.as_ref().is_some_and(|selected| return plan.touched.contains(selected)) {
            self.reload_current_when_its_file_changed();
        }
        let announce: HashSet<PathBuf> = plan.added.into_iter().collect();
        let mut check: HashSet<PathBuf> = plan.touched.into_iter().chain(announce.iter().cloned()).collect();
        check.extend(self.recorded_failures());
        self.request_refresh(Work::Files(Files { check, announce }));
    }

    /// What:
    ///      `pub(crate) fn rescan_everything(&mut self)`.
    ///  Walks the Source Root again, replaces the queue when the list differs, and refreshes every track.
    /// Why:
    ///       The fallback when the watcher lost events or a registration just ended: nothing names what changed. An
    ///  unchanged list starts a quiet refresh sweep, which measures a file whose fingerprint changed (D113) and nothing
    ///  else; the watcher ignores the reads it makes, so it cannot loop.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// rescanEverything(): void { const fresh = expandPaths([root]); if (equal(fresh, tracks)) { refreshAll(); return; } setTracks(fresh); settle(); sweepAll(); }
    /// ```
    pub(crate) fn rescan_everything(&mut self) {
        let Some(root) = self.source_root.clone() else {
            tracing::debug!("a rescan was requested with no folder open; ignored");
            return;
        };
        tracing::info!(root = %root.display(), "the folder is walked again and every track is refreshed");
        let fresh: Vec<PathBuf> = expand_paths(vec![root.clone()]);
        if fresh.as_slice() == self.queue.tracks() {
            self.reload_current_when_its_file_changed();
            self.request_refresh(Work::Everything);
            return;
        }
        let selected_path: Option<PathBuf> = self.queue.current_path().cloned();
        self.queue.set_tracks(fresh);
        self.settle_selection(&root, selected_path);
        self.start_queue_measurement();
    }

    /// What:
    ///      `fn recorded_failures(&self) -> Vec<PathBuf>`.
    ///  The files that failed to decode and have not decoded since, minus the ones that no longer exist.
    /// Why:
    ///       D113: a failed decode is retried at the next library change, whichever file changed. The set is the files already
    ///  reported as unplayable, which is small, so adding it to every refresh keeps the cost bounded. A removed file is
    ///  forgotten here so the set cannot grow with deleted files. A file that decodes again leaves the set when its peak is
    ///  measured, so it is not retried after that.
    fn recorded_failures(&self) -> Vec<PathBuf> {
        let Ok(mut reported) = self.reported_unplayable.lock() else {
            return Vec::new();
        };
        reported.retain(|path| return !matches!(std::fs::symlink_metadata(path), Err(error) if error.kind() == std::io::ErrorKind::NotFound));
        return reported.iter().cloned().collect();
    }

    /// What:
    ///      `fn settle_selection(&mut self, root: &Path, selected_path: Option<PathBuf>)`.
    ///  After the list changed: keeps the selected track by its path, or clears the selection when its file left.
    /// Why:
    ///       Audio is owned by the decoder, so a live change to other files must not interrupt playback or move the
    ///  person's page; a selected file that left stops playback and says so (PB2, D9, D83).
    fn settle_selection(&mut self, root: &Path, selected_path: Option<PathBuf>) {
        let found: Option<usize> = selected_path.as_ref().and_then(|path| {
            return match locate(self.queue.tracks(), root, path) {
                Ok(index) => Some(index),
                Err(_) => self.queue.tracks().iter().position(|track| return track == path),
            };
        });
        match found {
            Some(index) => {
                self.queue.restore_index_preserving_page(index);
                self.emit_reconciled();
            }
            None => {
                let was_playing: bool = self.playing;
                self.queue.clear_selection();
                self.emit_reconciled();
                self.emit(Update::Position(0.0));
                if self.playing {
                    self.set_playing(false);
                }
                if let Some(path) = selected_path {
                    tracing::info!(path = %path.display(), was_playing, "the selected track's file left the folder");
                    self.emit(Update::FileGone { path, was_playing });
                }
            }
        }
    }

    /// What:
    ///      `pub(crate) fn request_refresh(&mut self, work: Work)`.
    ///  Asks for a refresh sweep: it starts now when none runs, else it joins the pending follow-up.
    /// Why:
    ///       Overlapping sweeps would stat the same files twice; the coalescer merges what arrives meanwhile.
    pub(crate) fn request_refresh(&mut self, work: Work) {
        if let Some(launch) = self.refresh.submit(work) {
            self.launch_refresh(launch);
        }
    }

    /// What:
    ///      `pub(crate) fn finish_refresh(&mut self, id: u64)`.
    ///  A refresh sweep ended: starts the follow-up if work arrived meanwhile.
    /// Why:
    ///       The end is reported through the command channel, so the follow-up starts on the engine thread.
    pub(crate) fn finish_refresh(&mut self, id: u64) {
        tracing::debug!(id, "a refresh sweep ended");
        if let Some(next) = self.refresh.finished(id) {
            self.launch_refresh(next);
        }
    }

    /// What:
    ///      `fn launch_refresh(&mut self, launch: Launch)`.
    ///  Starts the sweep the coalescer asked for.
    /// Why:
    ///       A listed sweep carries only the changed files; "everything" carries the queue. A sweep with nothing to look at
    ///  ends at once so the follow-up is not held back.
    fn launch_refresh(&mut self, launch: Launch) {
        let mut next: Option<Launch> = Some(launch);
        while let Some(current) = next.take() {
            let selected: Option<PathBuf> = self.queue.current_path().cloned();
            let (tracks, listed, announce): (Vec<PathBuf>, bool, Vec<PathBuf>) = match current.work {
                Work::Everything => (self.queue.tracks().to_vec(), false, Vec::new()),
                Work::Files(files) => {
                    let mut listed_files: Vec<PathBuf> = files.check.into_iter().collect();
                    listed_files.sort();
                    let mut announced: Vec<PathBuf> = files.announce.into_iter().filter(|path| return Some(path) != selected.as_ref()).collect();
                    announced.sort();
                    (listed_files, true, announced)
                }
            };
            if tracks.is_empty() {
                next = self.refresh.finished(current.id);
                continue;
            }
            tracing::debug!(id = current.id, tracks = tracks.len(), listed, generation = self.analysis_generation, "refresh sweep started");
            spawn_queue_measurement(SweepJob {
                tracks,
                current: selected,
                cache: self.peaks.clone(),
                sink: Arc::clone(&self.sweep_sink),
                generation: self.analysis_generation,
                gate: SweepGate::shared(),
                claims: Arc::clone(&self.sweep_claims),
                quiet: true,
                listed,
                announce,
                refresh_id: Some(current.id),
            });
        }
    }
}
