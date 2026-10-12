//! Controller side of the per-track measures: forwards sweep reports, refreshes them when files change, and names the opened folder.
//!
//! What: `impl Controller` methods that turn sweep reports into `Update::Measures` and `Update::Analysis`,
//! and announce the opened folder's display name.
//! Why: the controller owns the queue generation and the cache handle, so stale reports are dropped here.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use truepeak_core::Decision;

use crate::command::Update;
use crate::controller::Controller;
use crate::measure::spawn_queue_measurement;
use crate::sweep_gate::SweepGate;
use crate::sweep_report::{SweepJob, SweepReport};
use crate::track_measure::measure_from_decision;

/// What:
///      `fn display_name_of(root: &Path) -> String`.
///  The folder's last path component, or its whole path when it has none.
/// Why:
///       A root such as `/` has no file name, and the first-run copy still needs a name to show.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const displayNameOf = (root: string) => basename(root) || root;
/// ```
pub(crate) fn display_name_of(root: &Path) -> String {
    return root
        .file_name()
        .map_or_else(|| return root.display().to_string(), |name| return name.to_string_lossy().into_owned());
}

impl Controller {
    /// What:
    ///      `pub(crate) fn emit_source_root(&self)`.
    ///  Sends the opened folder's display name, or `None` when no folder is open.
    /// Why:
    ///       The first-run copy depends on whether a folder is open and what it is called.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// emitSourceRoot(): void { this.emit({ kind: "sourceRoot", name: this.sourceRoot ? displayNameOf(this.sourceRoot) : null }); }
    /// ```
    pub(crate) fn emit_source_root(&self) {
        let name = self.source_root.as_deref().map(display_name_of);
        self.emit(Update::SourceRoot(name));
    }

    /// What:
    ///      `pub(crate) fn handle_sweep_report(&self, report: SweepReport)`.
    ///  Forwards a sweep report to the window when it belongs to the newest queue load.
    /// Why:
    ///       Sweeps are never cancelled, so a report from a replaced queue must not update the rows or the bar.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// handleSweepReport(report: SweepReport): void { if (report.generation === this.analysisGeneration) this.emit(toUpdate(report)); }
    /// ```
    pub(crate) fn handle_sweep_report(&self, report: SweepReport) {
        match report {
            SweepReport::Measures { generation, measures } => {
                if generation != self.analysis_generation {
                    tracing::debug!(generation, current = self.analysis_generation, "dropped measures from a replaced queue");
                    return;
                }
                self.forget_reports_of_decoded(&measures);
                self.emit(Update::Measures(measures));
            }
            SweepReport::Progress { generation, done, total } => {
                if generation != self.analysis_generation {
                    tracing::debug!(generation, current = self.analysis_generation, "dropped progress from a replaced queue");
                    return;
                }
                self.emit(Update::Analysis { done, total });
            }
            SweepReport::Unreadable { generation, files } => {
                if generation != self.analysis_generation {
                    tracing::debug!(generation, current = self.analysis_generation, "dropped unreadable files from a replaced queue");
                    return;
                }
                self.report_unplayable_once(files);
            }
        }
    }

    /// What:
    ///      `pub(crate) fn publish_decision_measure(&self, path: &Path, decision: &Decision)`.
    ///  Sends the measure of the track that was just measured on the current-track worker.
    /// Why:
    ///       The playing track is measured outside the sweep, so its row and deck would otherwise stay blank until the next load.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// publishDecisionMeasure(path: string, decision: Decision): void { this.emit({ kind: "measures", measures: [[path, measureFromDecision(decision)]] }); }
    /// ```
    pub(crate) fn publish_decision_measure(&self, path: &Path, decision: &Decision) {
        self.emit(Update::Measures(vec![(path.to_path_buf(), measure_from_decision(decision))]));
    }

    /// What:
    ///      `pub(crate) fn refresh_measurement(&self)`.
    ///  Starts a quiet sweep over the current queue for files whose size or modified time changed since they were measured.
    /// Why:
    ///       D113: analysis follows the files by itself. A file replaced or edited on disk keeps its path, so the queue does
    ///  not change and no load runs; this sweep measures it again, skips every file with a known fingerprint, shares the
    ///  claims of the load's own sweep so nothing is decoded twice, and sends no progress and no peeked rows. A file that
    ///  failed to decode earlier has no decision, so it is tried again here.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// refreshMeasurement(): void { spawnQueueMeasurement({ tracks, current, cache, sink, generation, claims, quiet: true }); }
    /// ```
    pub(crate) fn refresh_measurement(&self) {
        if self.queue.tracks().is_empty() {
            return;
        }
        tracing::debug!(tracks = self.queue.tracks().len(), generation = self.analysis_generation, "refresh sweep started");
        spawn_queue_measurement(SweepJob {
            tracks: self.queue.tracks().to_vec(),
            current: self.queue.current_path().cloned(),
            cache: self.peaks.clone(),
            sink: Arc::clone(&self.sweep_sink),
            generation: self.analysis_generation,
            gate: SweepGate::shared(),
            claims: Arc::clone(&self.sweep_claims),
            quiet: true,
        });
    }

    /// What:
    ///      `pub(crate) fn reload_current_when_its_file_changed(&mut self)`.
    ///  Loads the selected track again, paused, when its file changed on disk since the decoder opened it and nothing is playing.
    /// Why:
    ///       D113: the sweep leaves the selected track to the playback path, which measures it only when it loads. A paused
    ///  track whose file was replaced would keep the old decoder, the old peak and the old gain until the person picked it
    ///  again. A playing track is left alone, because loading it again would cut the audio; it picks up the new file when it
    ///  is loaded next. The reload starts at the beginning of the file, because the old position may not exist in the new one.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// reloadCurrentWhenItsFileChanged(): void {
    ///   const [path, key] = this.loadedFile ?? []; if (!path || path !== this.queue.currentPath() || this.playing) return;
    ///   if (fingerprint(path) !== key) this.loadCurrent();
    /// }
    /// ```
    pub(crate) fn reload_current_when_its_file_changed(&mut self) {
        let Some(current) = self.queue.current_path().cloned() else {
            return;
        };
        let Some((loaded_path, loaded_key)) = self.loaded_file.clone() else {
            return;
        };
        if loaded_path != current || self.source.is_none() {
            return;
        }
        let Some(now) = crate::peakcache::fingerprint(&current) else {
            return;
        };
        if now == loaded_key {
            return;
        }
        if self.playing {
            tracing::info!(path = %current.display(), "the playing file changed on disk; it is loaded again when it next loads");
            return;
        }
        tracing::info!(path = %current.display(), "the selected file changed on disk; loading it again, paused");
        if !self.load_current() {
            self.emit_no_track();
        }
    }

    /// What:
    ///      `pub(crate) fn report_unplayable_once(&self, files: Vec<PathBuf>)`.
    ///  Tells the window about the files it has not yet been told about.
    /// Why:
    ///       D113 and D83: a failure is reported once per file in plain words. The same broken file fails again at every
    ///  later sweep, and a person who already saw the message does not need it again. A file that is still being written
    ///  fails with each partial state it passes through, so the report is per file and not per state of the file; it is
    ///  forgotten when a peak is measured for the file (it decodes now), so a file that breaks again is told again.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// reportUnplayableOnce(files: string[]): void { const fresh = files.filter(f => reported.add(f)); if (fresh.length) emit({ kind: "unplayable", paths: fresh }); }
    /// ```
    pub(crate) fn report_unplayable_once(&self, files: Vec<PathBuf>) {
        let fresh: Vec<PathBuf> = match self.reported_unplayable.lock() {
            Ok(mut reported) => files.into_iter().filter(|file| return reported.insert(file.clone())).collect(),
            Err(_poisoned) => files,
        };
        if fresh.is_empty() {
            tracing::debug!("every unplayable file was already reported");
            return;
        }
        self.emit_unplayable(fresh);
    }

    /// What:
    ///      `fn forget_reports_of_decoded(&self, measures: &[(PathBuf, TrackMeasure)])`.
    ///  Forgets the failure report of every file that now has a measured peak.
    /// Why:
    ///       A file that decodes again was fixed or replaced; if it breaks later the person is told again (D113).
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// forgetReportsOfDecoded(measures: [string, TrackMeasure][]): void { for (const [p, m] of measures) if (m.peakDbtp !== null) reported.delete(p); }
    /// ```
    fn forget_reports_of_decoded(&self, measures: &[(PathBuf, crate::track_measure::TrackMeasure)]) {
        if let Ok(mut reported) = self.reported_unplayable.lock() {
            for (path, measure) in measures {
                if measure.peak_dbtp.is_some() {
                    reported.remove(path);
                }
            }
        }
    }
}

#[cfg(test)]
#[path = "controller_measures_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "controller_refresh_tests.rs"]
mod refresh_tests;
