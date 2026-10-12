//! Controller side of the per-track measures: forwards sweep reports, re-analyses one track, names the opened folder.
//!
//! What: `impl Controller` methods that turn sweep reports into `Update::Measures` and `Update::Analysis`,
//! discard the decision of one track on request, and announce the opened folder's display name.
//! Why: the controller owns the queue generation and the cache handle, so stale reports are dropped here.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use truepeak_core::Decision;

use crate::command::Update;
use crate::controller::Controller;
use crate::duration_probe::probe_duration_secs;
use crate::measure::spawn_track_measurement;
use crate::peakcache;
use crate::sweep_report::SweepReport;
use crate::track_measure::{measure_from_decision, measure_from_duration};

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
fn display_name_of(root: &Path) -> String {
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
                self.emit(Update::Measures(measures));
            }
            SweepReport::Progress { generation, done, total } => {
                if generation != self.analysis_generation {
                    tracing::debug!(generation, current = self.analysis_generation, "dropped progress from a replaced queue");
                    return;
                }
                self.emit(Update::Analysis { done, total });
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
    ///      `pub(crate) fn reanalyse_track(&self, path: PathBuf)`.
    ///  Discards one track's cached decision, shows its length without a peak, and measures it again.
    /// Why:
    ///       The track menu's Re-analyse action must change the row at once and end with a fresh exact peak.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// reanalyseTrack(path: string): void { cache.remove(key); emit(measures: [[path, lengthOnly(path)]]); spawnTrackMeasurement(path, key); }
    /// ```
    pub(crate) fn reanalyse_track(&self, path: PathBuf) {
        // What:     `let Some(key) = peakcache::fingerprint(&path) else { ... };`. Key the track.
        // Why:      A file without a fingerprint has no cache entry to discard or to write.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const key = fingerprint(path); if (key === null) return;
        // ```
        let Some(key) = peakcache::fingerprint(&path) else {
            tracing::warn!(path = %path.display(), "re-analysis skipped: the file has no fingerprint");
            return;
        };
        // What:     `self.peaks.remove(key);`. Queue the removal of the track's decision.
        // Why:      The write channel is ordered, so the new decision written later lands after this removal.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.peaks.remove(key);
        // ```
        self.peaks.remove(key);
        // What:     emit the length from the header with no peak, so the row changes at once.
        // Why:      The old peak is no longer valid; the row shows the length until the new measurement lands.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.emit({ kind: "measures", measures: [[path, { durationSecs: probeDurationSecs(path), peakDbtp: null }]] });
        // ```
        self.emit(Update::Measures(vec![(path.clone(), measure_from_duration(probe_duration_secs(&path)))]));
        // What:     `spawn_track_measurement(path, key, ...)`. Decode the track once more in its own thread.
        // Why:      Re-analysis is a single full decode, so it does not go through the sweep's known-set skip.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // startTrackMeasurement(path, key, this.peaks, this.sweepSink, this.analysisGeneration);
        // ```
        spawn_track_measurement(
            path,
            key,
            self.peaks.clone(),
            Arc::clone(&self.sweep_sink),
            self.analysis_generation,
        );
    }
}

#[cfg(test)]
#[path = "controller_measures_tests.rs"]
mod tests;
