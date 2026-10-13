//! Loads the selected track again when its file was replaced on disk, where it was.
//!
//! What: `impl Controller` methods that notice a replaced selected file and swap its decoder, peak and gain in place.
//! Why: D113 makes the library follow the disk. A playing file that was replaced used to keep the old audio, peak and gain
//! until the next load, and a paused one restarted from zero; now both follow the new file without a toast or a jump.

use crate::command::Update;
use crate::controller::Controller;
use crate::decode::Source;

/// What:
///      `pub(crate) fn resume_position(position: f64, new_duration: f64, was_playing: bool) -> f64`.
///  Where the replaced file starts: the old position when the new file reaches it, else the end (playing) or zero (paused).
/// Why:
///       A playing track keeps its place and, when the new file is shorter, ends as if it had played out. A paused track
///  has no end to reach, so a position the new file does not contain is meaningless and it starts again. An unknown new
///  length (zero) cannot clamp anything.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const resumePosition = (pos, dur, playing) => dur <= 0 ? pos : pos < dur ? pos : playing ? dur : 0;
/// ```
pub(crate) fn resume_position(position: f64, new_duration: f64, was_playing: bool) -> f64 {
    if new_duration <= 0.0 || position < new_duration {
        return position.max(0.0);
    }
    return if was_playing { new_duration } else { 0.0 };
}

/// Methods of `Controller` for a replaced selected file.
impl Controller {
    /// What:
    ///      `pub(crate) fn reload_current_when_its_file_changed(&mut self)`.
    ///  Opens the selected track's file again when its size or modified time differs from the file the decoder was opened
    ///  on, and swaps it in at the same position, keeping the playing state, the page and the volume.
    /// Why:
    ///       D113. The file is opened first and swapped only when it opens, so a replacement that is still being written
    ///  leaves the old audio playing and is tried again at the next event; nothing is skipped and no toast is shown. The
    ///  peak and gain are worked out again for the new file, and the seek bar takes the new length.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// reloadCurrentWhenItsFileChanged(): void {
    ///   const [path, key] = this.loadedFile ?? []; if (!path || path !== this.queue.currentPath()) return;
    ///   if (fingerprint(path) === key) return;
    ///   const source = tryOpen(path); if (!source) return;
    ///   const pos = this.audibleSecs(); const dur = this.installSourceSilently(source, path);
    ///   this.seek(resumePosition(pos, dur, this.playing)); this.emit({ kind: "duration", secs: dur });
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
            tracing::debug!(path = %current.display(), "the selected file cannot be looked at; it stays as loaded");
            return;
        };
        if now == loaded_key {
            return;
        }
        let source: Box<dyn Source> = match crate::decode::open(&current) {
            Ok(source) => source,
            Err(error) => {
                tracing::warn!(path = %current.display(), error = %error, "the replaced selected file does not open yet; the old audio stays");
                return;
            }
        };
        let was_playing: bool = self.playing;
        let position: f64 = self.audible_secs();
        let new_duration: f64 = self.install_source_silently(source, &current);
        let target: f64 = resume_position(position, new_duration, was_playing);
        tracing::info!(
            path = %current.display(),
            was_playing,
            old_position = position,
            new_duration,
            target,
            "the selected file was replaced; loaded again at the same place"
        );
        if target > 0.0 {
            self.seek(target);
        }
        self.emit(Update::Duration(new_duration));
        self.emit(Update::Position(self.audible_secs()));
    }
}

/// Unit tests in `controller_reload_tests.rs`, pulled in at this point.
#[cfg(test)]
#[path = "controller_reload_tests.rs"]
mod tests;
