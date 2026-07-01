//! The loading and audio-pumping half of `Controller` (a second `impl` block on
//! the type defined in `controller.rs`). Split out so each file stays within the
//! line budget. These methods open decoders, prepare each track's true-peak swap
//! gain, push samples into the ring buffer, and report position.

/// What:     `use std::path::{Path, PathBuf};`. Borrowed (`&Path`) and owned (`PathBuf`)
///           filesystem-path types.
/// Why:      `install_source` borrows a `&Path` to read the current file;
///           `scan_root_into_queue` takes an owned `PathBuf` root.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // a path is just a string in TS
/// ```
use std::path::{Path, PathBuf};

/// What:     `use ringbuf::traits::Producer;`. Brings `push_slice` into scope for the
///           producer half of the ring buffer.
/// Why:      We push decoded samples into the buffer the output gave us.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // no equivalent: importing an interface to unlock .pushSlice()
/// ```
use ringbuf::traits::Producer;

/// What:     `use crate::command::Update;`. The engine->UI message enum.
/// Why:      These methods emit `NowPlaying`/`Position` updates.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Update } from "./command";
/// ```
use crate::command::Update;

/// What:     `use crate::controller::Controller;`. The state struct from the sibling
///           module; this file adds a second `impl Controller` block.
/// Why:      Name the type we are implementing methods on.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Controller } from "./controller";
/// ```
use crate::controller::Controller;

/// What:     `use crate::decode::Source;`. The decoder trait (so `Box<dyn Source>` is
///           nameable and its `spec`/`next_chunk`/`seek` methods are in scope).
/// Why:      `install_source` takes a `Box<dyn Source>` and we drive it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Source } from "./decode";
/// ```
use crate::decode::Source;

/// What:     `use crate::playback::{expand_paths, file_name_of, frames_to_secs, process_sample};`.
///           Folder-to-file expansion, display-name extraction, frame->seconds conversion,
///           and the per-sample gain+clamp stage.
/// Why:      Used by scan_root_into_queue, install_source, current_session/advance_position,
///           and pump_audio.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { expandPaths, fileNameOf, framesToSecs, processSample } from "./playback";
/// ```
use crate::playback::{expand_paths, file_name_of, frames_to_secs, process_sample};

/// What:     `use crate::session::Session;`. The serializable saved-state record.
/// Why:      `current_session` builds one.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Session } from "./session";
/// ```
use crate::session::Session;

/// What:     `const POSITION_EMIT_INTERVAL_SECS: f64 = 0.1;`. Minimum seconds of progress
///           between `Position` updates. `f64` matches the time contract.
/// Why:      Throttle position updates to ~10/second instead of per buffer.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const POSITION_EMIT_INTERVAL_SECS = 0.1;
/// ```
const POSITION_EMIT_INTERVAL_SECS: f64 = 0.1;

/// What:     `impl Controller { ... }`. The loading/audio half of the behaviour (a SECOND
///           inherent `impl` block for `Controller`, whose other half is in
///           `controller.rs`).
/// Why:      Keep these methods beside the command-handling half without one huge file.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Controller { /* current_session, save_session, load_current, install_source, seek, pump_audio, on_track_end, advance_position */ }
/// ```
impl Controller {
    /// What:     `fn current_session(&self) -> Session`. Snapshot the playback state into a
    ///           serializable `Session`.
    /// Why:      Persist where the user left off.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// currentSession(): Session { ... }
    /// ```
    fn current_session(&self) -> Session {
        // What:     `let position_secs = frames_to_secs(self.position_frames, self.spec.as_ref().map_or(0, |s| s.rate));`.
        //           Convert the frame counter to seconds. `self.spec.as_ref().map_or(0, |s| s.rate)`
        //           reads the rate (0 when no spec); the helper returns 0.0 for a 0 rate.
        // Why:      The session stores seconds, not frames.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const positionSecs = framesToSecs(this.positionFrames, this.spec ? this.spec.rate : 0);
        // ```
        let position_secs =
            frames_to_secs(self.position_frames, self.spec.as_ref().map_or(0, |s| s.rate));
        // What:     `Session { ... }`. Build the record from the Source Root + state.
        //           `self.source_root.clone()` copies the owned root option;
        //           `self.queue.current_path().cloned()` is the Selected Track's path (or
        //           `None`). The queue itself is NOT stored. Tail -> return.
        // Why:      Bundle only what the next launch needs to re-derive the queue: the root,
        //           the cued track, and the settings.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { sourceRoot: this.sourceRoot, selected: this.queue.currentPath() ?? null,
        //          positionSecs, volume: this.volume, shuffle: this.queue.shuffleMode(),
        //          repeatTrack: this.queue.repeatTrack() };
        // ```
        Session {
            source_root: self.source_root.clone(),
            selected: self.queue.current_path().cloned(),
            position_secs,
            volume: self.volume,
            shuffle: self.queue.shuffle_mode(),
            repeat_track: self.queue.repeat_track(),
        }
    }

    /// What:     `pub(crate) fn save_session(&self)`. Write the current session to disk,
    ///           logging (not propagating) any IO error. `pub(crate)` so `engine::run` can
    ///           call it on quit.
    /// Why:      A failed save should not block shutdown.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// saveSession(): void { try { this.currentSession().save(); } catch (e) { console.error(e); } }
    /// ```
    pub(crate) fn save_session(&self) {
        // What:     `if let Err(e) = self.current_session().save() { ... }`. `save` returns
        //           `io::Result<()>`; the `if let Err(e)` runs the body only on the error
        //           variant, binding the error to `e`.
        // Why:      Best-effort persistence.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // try { this.currentSession().save(); } catch (e) { console.error(e); }
        // ```
        if let Err(e) = self.current_session().save() {
            tracing::warn!(error = %e, "session save failed");
        }
    }

    /// What:     `pub(crate) fn emit_reconciled(&self)`. Emit one `Update::Reconciled` carrying
    ///           the current queue (display paths) PLUS the re-anchored now-playing view (the
    ///           possibly-shifted index, its display name, and the loaded duration). `pub(crate)`
    ///           so the `Rescan` handler in `controller.rs` can call it.
    /// Why:      A live rescan must refresh the list and highlight together WITHOUT moving the
    ///           user's selected tab (the UI keeps its current page for `Reconciled`, unlike a
    ///           `Queue`/`NowPlaying` pair which would reset/follow the page).
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// emitReconciled(): void {
    ///   const names = this.queue.displayPaths();
    ///   const index = this.queue.currentIndex();
    ///   const name = index != null ? names[index] ?? "" : "";
    ///   const duration = index != null ? this.spec?.durationSecs ?? 0 : 0;
    ///   this.emit({ kind: "reconciled", names, index, name, duration });
    /// }
    /// ```
    pub(crate) fn emit_reconciled(&self) {
        // What:     `let names = self.queue.display_paths();`. The reconciled queue as display
        //           paths, computed once and moved into the update below.
        // Why:      The list itself may have gained or lost rows.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const names = this.queue.displayPaths();
        // ```
        let names = self.queue.display_paths();
        // What:     `let index = self.queue.current_index();`. The current track's load-order
        //           position (`Option<usize>`), which may have shifted after the rescan.
        // Why:      Drives the row highlight.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const index = this.queue.currentIndex();
        // ```
        let index = self.queue.current_index();
        // What:     `let name = index.and_then(|i| names.get(i).cloned()).unwrap_or_default();`.
        //           The display path at that index (borrowing from `names`), or `""`.
        // Why:      The window title and label use this same relative-path string.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const name = index != null ? names[index] ?? "" : "";
        // ```
        let name = index.and_then(|i| names.get(i).cloned()).unwrap_or_default();
        // What:     `let duration = if index.is_some() { self.spec...duration_secs } else { 0.0 };`.
        //           The loaded track's duration when a track stays selected, else 0.0.
        // Why:      A cleared selection (file left the root) has no duration; otherwise the
        //           seek-bar maximum is unchanged (same file).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const duration = index != null ? this.spec?.durationSecs ?? 0 : 0;
        // ```
        let duration = if index.is_some() {
            self.spec.as_ref().map_or(0.0, |s| s.duration_secs)
        } else {
            0.0
        };
        // What:     `self.emit(Update::Reconciled { names, index, name, duration });`. Push the
        //           combined list-and-highlight refresh.
        // Why:      One update so the UI keeps the page while updating both the rows and the
        //           highlighted track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.emit({ kind: "reconciled", names, index, name, duration });
        // ```
        self.emit(Update::Reconciled {
            names,
            index,
            name,
            duration,
        });
    }

    /// What:     `pub(crate) fn rewatch_source_root(&mut self)`. Point the file watcher at the
    ///           current Source Root (if both a root and a watcher exist). `pub(crate)` so the
    ///           open/restore handlers in `controller.rs` can call it.
    /// Why:      Called after every open/restore so on-disk changes to the newly-loaded root
    ///           drive a `Rescan`; a no-op in tests (no watcher) and when no root is set.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// rewatchSourceRoot(): void { if (this.sourceRoot && this.watcher) this.watcher.watch(this.sourceRoot); }
    /// ```
    pub(crate) fn rewatch_source_root(&mut self) {
        // What:     `if let Some(root) = self.source_root.clone() { ... }`. Clone the root so
        //           the immutable borrow ends before the mutable watcher borrow.
        // Why:      Nothing to watch without a root.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.sourceRoot) { ... }
        // ```
        if let Some(root) = self.source_root.clone() {
            // What:     `if let Some(watcher) = self.watcher.as_mut() { watcher.watch(&root); }`.
            //           Mutably borrow the watcher and re-point it.
            // Why:      Only the running app has a watcher; tests skip this.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.watcher?.watch(root);
            // ```
            if let Some(watcher) = self.watcher.as_mut() {
                watcher.watch(&root);
            }
        }
    }

    /// What:     `pub(crate) fn scan_root_into_queue(&mut self, root: PathBuf)`. Adopt `root`
    ///           as the Source Root: remember it, re-point the file watcher at it, and rebuild
    ///           the queue by scanning it from disk. Consumes the owned `root`. `pub(crate)`
    ///           so the command-handling half can call it.
    /// Why:      "The Queue is the scan of the Source Root" (see CONTEXT.md). Opening a folder
    ///           and restoring a session both start with this identical projection, so it
    ///           lives in one place instead of being duplicated across the two command arms.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// scanRootIntoQueue(root: string): void {
    ///   this.sourceRoot = root;
    ///   this.rewatchSourceRoot();
    ///   this.queue.setTracks(expandPaths([root]));
    /// }
    /// ```
    pub(crate) fn scan_root_into_queue(&mut self, root: PathBuf) {
        // What:     `self.source_root = Some(root.clone());`. Remember the directory the queue
        //           is scanned from. `.clone()` because `root` is moved into `expand_paths`.
        // Why:      The session, the watcher, and any rescan need the root.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.sourceRoot = root;
        // ```
        self.source_root = Some(root.clone());
        // What:     `self.rewatch_source_root();`. Point the file watcher at the new root so
        //           its changes drive live `Rescan`s.
        // Why:      Live updating follows whatever is currently open.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.rewatchSourceRoot();
        // ```
        self.rewatch_source_root();
        // What:     `self.queue.set_tracks(expand_paths(vec![root]));`. Scan the single root
        //           directory into its files (folders -> their files, recursively) and replace
        //           the queue with the result (consumes the owned `root`).
        // Why:      The queue holds files, not directories; one root is scanned into the new
        //           playlist.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.setTracks(expandPaths([root]));
        // ```
        self.queue.set_tracks(expand_paths(vec![root]));
    }

    /// What:     `pub(crate) fn load_current(&mut self) -> bool`. Open the queue's current
    ///           track into a decoder + reconfigure output. Returns whether a track was
    ///           loaded. Skips past files that fail to open. `pub(crate)` so the
    ///           command-handling half can call it.
    /// Why:      One place that turns "current path" into live playback state.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// loadCurrent(): boolean { ... }
    /// ```
    pub(crate) fn load_current(&mut self) -> bool {
        // What:     `let max_attempts = self.queue.len();`. How many opens to try before
        //           giving up.
        // Why:      `advance` now ALWAYS loops its scope (no end-of-queue `None`), so a queue
        //           of all-unreadable files would otherwise spin forever; cap the retries at
        //           the track count. Confinement is intentional: when a whole page is
        //           unreadable, stop rather than jump to another page.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const maxAttempts = this.queue.len();
        // ```
        let max_attempts = self.queue.len();
        // What:     `let mut attempts = 0;`. Count of failed opens so far.
        // Why:      Compare against `max_attempts` to bound the loop.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let attempts = 0;
        // ```
        let mut attempts = 0;
        // What:     `loop { ... }`. Iterate the queue, advancing past any unreadable file.
        //           Iterative (not recursive) so a long run of bad files cannot overflow the
        //           stack.
        // Why:      Robustly find the next playable track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // while (true) { ... }
        // ```
        loop {
            // What:     `let path = match self.queue.current_path() { ... };`. Copy the
            //           current path out (`.clone()` -> owned `PathBuf`), or return `false`
            //           if the queue is empty.
            // Why:      Need an owned path to open and to release the queue borrow.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const path = this.queue.currentPath(); if (!path) return false;
            // ```
            let path = match self.queue.current_path() {
                // What:     `Some(p) => p.clone()`. `.clone()` makes an owned `PathBuf`.
                // Why:      Outlive the borrow into the queue.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // path = currentPath;
                // ```
                Some(p) => p.clone(),
                // What:     `None => return false`. Empty queue.
                // Why:      Nothing to load.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // return false;
                // ```
                None => return false,
            };

            // What:     `match crate::decode::open(&path) { ... }`. Try to open a decoder.
            //           `&path` lends it. Returns `Result<Box<dyn Source>, PlayerError>`.
            // Why:      Build the source.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // try { const source = open(path); ... } catch (e) { ... }
            // ```
            match crate::decode::open(&path) {
                // What:     `Ok(source) => { self.install_source(source, &path); return true; }`.
                //           Loaded: install it and report success.
                // Why:      Begin playing this track.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.installSource(source, path); return true;
                // ```
                Ok(source) => {
                    self.install_source(source, &path);
                    return true;
                }
                // What:     `Err(e) => { ... }`. Could not open this file; bind the error.
                // Why:      Skip to the next track.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // catch (e) { ... }
                // ```
                Err(e) => {
                    // What:     `tracing::warn!(path = %path.display(), error = %e, "cannot open
                    //           file");`. Log the failure as a structured event; `%` formats the
                    //           path and error via Display. The module path is the tag.
                    // Why:      Surface the bad file.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // logger.warn(`cannot open ${path}: ${e}`);
                    // ```
                    tracing::warn!(path = %path.display(), error = %e, "cannot open file");
                    // What:     `attempts += 1;`. Count this failed open.
                    // Why:      Track progress toward the retry cap.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // attempts += 1;
                    // ```
                    attempts += 1;
                    // What:     `if attempts >= max_attempts { return false; }`. Give up after
                    //           trying every track once (advance loops, so it never returns
                    //           `None` on its own for a non-empty queue).
                    // Why:      Avoid an endless loop when all files are bad.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // if (attempts >= maxAttempts) return false;
                    // ```
                    if attempts >= max_attempts {
                        return false;
                    }
                    // What:     `self.queue.advance(false);`. Step forward within the scope;
                    //           the returned index is ignored (we only need the cursor
                    //           moved). `advance` returns an `Option` that is not
                    //           `#[must_use]`, so discarding it is fine.
                    // Why:      Retry the loop with the next current track.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // this.queue.advance(false);
                    // ```
                    self.queue.advance(false);
                    // Otherwise the loop retries with the new current track.
                }
            }
        }
    }

    /// What:     `fn install_source(&mut self, source: Box<dyn Source>, path: &Path)`. Store
    ///           the source, reconfigure the output, resolve the track's normalization gain,
    ///           reset position, and tell the UI what is playing.
    /// Why:      The common setup after a successful `open`.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// installSource(source: Source, path: string): void { ... }
    /// ```
    fn install_source(&mut self, source: Box<dyn Source>, path: &Path) {
        // What:     `let spec = source.spec();`. Copy the stream's rate/channels/duration
        //           (`AudioSpec` is `Copy`).
        // Why:      Needed to configure the output and the position math.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const spec = source.spec();
        // ```
        let spec = source.spec();

        // What:     `self.prepare_peak_for_path(path);`. Start the current-track
        //           peak swap path: cache hit applies immediately; cache miss sets
        //           fallback gain and stores a pending measurement receiver.
        // Why:      Loading no longer blocks on a full-track true-peak decode.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.preparePeakForPath(path);
        // ```
        self.prepare_peak_for_path(path);

        // What:     `if let Some(output) = self.output.as_mut() { ... }`. `.as_mut()` borrows
        //           the `Option<Output>` as `Option<&mut Output>`; reconfigure only when
        //           audio is available (not silent mode).
        // Why:      Skip audio setup when there is no output.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.output) { ... }
        // ```
        if let Some(output) = self.output.as_mut() {
            // What:     `let capacity_frames = spec.rate as usize;`. ~1 second of audio (`as
            //           usize` widens the rate).
            // Why:      Enough buffering to avoid underruns without big latency.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const capacityFrames = spec.rate;
            // ```
            let capacity_frames = spec.rate as usize;
            // What:     `match output.reconfigure(spec.rate, spec.channels, capacity_frames) { ... }`.
            //           Rebuild the stream at this track's format; returns a new producer.
            // Why:      Per-track native rate; fresh buffer flushes old audio.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // try { this.producer = output.reconfigure(spec.rate, spec.channels, capacityFrames); } catch (e) { ... }
            // ```
            match output.reconfigure(spec.rate, spec.channels, capacity_frames) {
                // What:     `Ok(prod) => self.producer = Some(prod)`. Store the write end.
                // Why:      Push samples here from now on.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.producer = prod;
                // ```
                Ok(prod) => self.producer = Some(prod),
                // What:     `Err(e) => { eprintln!(...); self.producer = None; }`. Log and drop
                //           into silent mode for this track.
                // Why:      Don't crash if a stream fails to connect.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // console.error(e); this.producer = null;
                // ```
                Err(e) => {
                    tracing::warn!(error = %e, "audio reconfigure failed");
                    self.producer = None;
                }
            }
        }

        // What:     `self.source = Some(source);`. Store the decoder (moves it in, wrapped
        //           in `Some`).
        // Why:      Pump decodes from it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.source = source;
        // ```
        self.source = Some(source);
        // What:     `self.spec = Some(spec);`. Cache the format.
        // Why:      Position math + future reconfigure (seek).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.spec = spec;
        // ```
        self.spec = Some(spec);
        // What:     `self.position_frames = 0;`. Restart the frame counter.
        // Why:      New track starts at 0.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.positionFrames = 0;
        // ```
        self.position_frames = 0;
        // What:     `self.last_emit_secs = 0.0;`. Reset the throttle baseline.
        // Why:      Emit the first position promptly.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.lastEmitSecs = 0;
        // ```
        self.last_emit_secs = 0.0;
        // What:     `self.pending.clear(); self.pending_pos = 0;`. Drop leftover samples.
        // Why:      Avoid mixing tracks.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.pending = []; this.pendingPos = 0;
        // ```
        self.pending.clear();
        self.pending_pos = 0;

        // What:     `let index = self.queue.current_index();`. Its LOAD-ORDER position in the
        //           queue (an `Option<usize>`).
        // Why:      Lets the UI highlight the current row, and indexes the display paths for
        //           the name below.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const index = this.queue.currentIndex();
        // ```
        let index = self.queue.current_index();
        // What:     `let name = index.and_then(|i| self.queue.display_paths().into_iter().nth(i)).unwrap_or_else(|| file_name_of(path));`.
        //           The track's DISPLAY PATH relative to the queue root (the same string the
        //           list row shows, e.g. `r-906/diaLOG/06 V.flac`): `.and_then` indexes
        //           `display_paths()` by the load-order index (`.into_iter().nth(i)`), and
        //           `.unwrap_or_else(...)` falls back to the bare filename if the index is
        //           absent. `display_paths()` runs only when `index` is `Some` (lazily,
        //           inside the closure).
        // Why:      The window title shows this name, so it must match the list row, not just
        //           the filename. Still filesystem-derived (no embedded tags).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const name = index != null ? this.queue.displayPaths()[index] : fileNameOf(path);
        // ```
        let name = index
            .and_then(|i| self.queue.display_paths().into_iter().nth(i))
            .unwrap_or_else(|| file_name_of(path));
        // What:     `self.emit(Update::NowPlaying { index, name, duration: spec.duration_secs });`.
        //           Tell the UI the new track (struct-variant literal).
        // Why:      Update the now-playing label and seek-bar maximum.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.emit({ kind: "nowPlaying", index, name, duration: spec.durationSecs });
        // ```
        self.emit(Update::NowPlaying {
            index,
            name,
            duration: spec.duration_secs,
        });
        // What:     `self.emit(Update::Position(0.0));`. Reset the seek bar to 0.
        // Why:      New track starts at the beginning.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.emit({ kind: "position", secs: 0 });
        // ```
        self.emit(Update::Position(0.0));
        // What:     `if self.playing { self.wait_for_pending_peak_before_start(); }`.
        //           When a track change happens during active playback, wait up to the
        //           one-second swap window before decoding new-track samples.
        // Why:      Next/prev while playing and natural auto-advance get the same
        //           wait-then-fallback behavior as an explicit Play command.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.playing) this.waitForPendingPeakBeforeStart();
        // ```
        if self.playing {
            self.wait_for_pending_peak_before_start();
        }
    }

    /// What:     `pub(crate) fn seek(&mut self, secs: f64)`. Move playback to `secs` and
    ///           flush buffered audio. `pub(crate)` so the command-handling half can call it.
    /// Why:      Seek-bar control.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// seek(secs: number): void { ... }
    /// ```
    pub(crate) fn seek(&mut self, secs: f64) {
        // What:     `let spec = match self.spec { Some(s) => s, None => return };`. Copy the
        //           format out, or do nothing if no track is loaded.
        // Why:      Need the rate to recompute the frame position.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const spec = this.spec; if (!spec) return;
        // ```
        let spec = match self.spec {
            // What:     `Some(s) => s`. Copy the spec (`AudioSpec` is `Copy`).
            // Why:      No borrow held.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // spec = this.spec;
            // ```
            Some(s) => s,
            // What:     `None => return`. Nothing loaded.
            // Why:      Ignore the seek.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return;
            // ```
            None => return,
        };

        // What:     `if let Some(source) = self.source.as_mut() { ... } else { return; }`.
        //           `.as_mut()` borrows the optional source mutably; seek the decoder, or
        //           bail if there is no source.
        // Why:      The decoder must reposition.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!this.source) return; this.source.seek(secs);
        // ```
        if let Some(source) = self.source.as_mut() {
            // What:     `if let Err(e) = source.seek(secs) { eprintln!(...); return; }`.
            //           Attempt the seek; on the error variant, log and abort.
            // Why:      A failed seek should not corrupt position state.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // try { source.seek(secs); } catch (e) { console.error(e); return; }
            // ```
            if let Err(e) = source.seek(secs) {
                tracing::warn!(error = %e, "seek failed");
                return;
            }
        } else {
            // What:     `return;`. No source -> nothing to seek.
            // Why:      Guard.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return;
            // ```
            return;
        }

        // What:     `if let Some(output) = self.output.as_mut() { ... }`. Rebuild the stream
        //           at the SAME format to flush stale buffered audio.
        // Why:      Otherwise ~1s of pre-seek audio would still play.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.output) { this.producer = output.reconfigure(spec.rate, spec.channels, spec.rate); }
        // ```
        if let Some(output) = self.output.as_mut() {
            // What:     `match output.reconfigure(spec.rate, spec.channels, spec.rate as usize) { ... }`.
            //           Same rate/channels, ~1s buffer; new empty producer.
            // Why:      Clean slate after the jump.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // try { this.producer = output.reconfigure(spec.rate, spec.channels, spec.rate); } catch (e) { ... }
            // ```
            match output.reconfigure(spec.rate, spec.channels, spec.rate as usize) {
                // What:     `Ok(prod) => self.producer = Some(prod)`. Replace the producer.
                // Why:      Flush.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.producer = prod;
                // ```
                Ok(prod) => self.producer = Some(prod),
                // What:     `Err(e) => eprintln!(...)`. Log a reconfigure failure.
                // Why:      Keep going (position still updates).
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // console.error(e);
                // ```
                Err(e) => tracing::warn!(error = %e, "seek reconfigure failed"),
            }
        }

        // What:     `self.pending.clear(); self.pending_pos = 0;`. Drop leftover pre-seek
        //           samples we had not pushed yet.
        // Why:      They belong to the old position.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.pending = []; this.pendingPos = 0;
        // ```
        self.pending.clear();
        self.pending_pos = 0;

        // What:     `self.position_frames = (secs * spec.rate as f64) as u64;`. Convert the
        //           target seconds to a frame count; `as u64` truncates the float.
        // Why:      Keep position reporting consistent after the jump.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.positionFrames = Math.floor(secs * spec.rate);
        // ```
        self.position_frames = (secs * spec.rate as f64) as u64;
        // What:     `self.last_emit_secs = secs;`. Update the throttle baseline.
        // Why:      Avoid an immediate redundant emit.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.lastEmitSecs = secs;
        // ```
        self.last_emit_secs = secs;
        // What:     `self.emit(Update::Position(secs));`. Snap the UI seek bar.
        // Why:      Reflect the jump immediately.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.emit({ kind: "position", secs });
        // ```
        self.emit(Update::Position(secs));
    }

    /// What:     `pub(crate) fn pump_audio(&mut self) -> bool`. Push at most one block of
    ///           audio into the ring buffer. Returns whether it did meaningful work.
    ///           `pub(crate)` so `engine::run` can call it each loop iteration.
    /// Why:      The decode->buffer feeding step.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// pumpAudio(): boolean { ... }
    /// ```
    pub(crate) fn pump_audio(&mut self) -> bool {
        // What:     `if !self.playing { return false; }`. Paused: no work.
        // Why:      Respect pause.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!this.playing) return false;
        // ```
        if !self.playing {
            return false;
        }
        // What:     `if self.producer.is_none() || self.source.is_none() { return false; }`.
        //           Need both a write end and a decoder. `.is_none()` is true for the empty
        //           `Option`.
        // Why:      Nothing to do otherwise.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!this.producer || !this.source) return false;
        // ```
        if self.producer.is_none() || self.source.is_none() {
            return false;
        }

        // What:     `if self.pending_pos < self.pending.len() { ... }`. Leftover samples from
        //           last time; push them first.
        // Why:      Finish the previous block before decoding more.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.pendingPos < this.pending.length) { ... }
        // ```
        if self.pending_pos < self.pending.len() {
            // What:     `let pushed = if let Some(producer) = self.producer.as_mut() { producer.push_slice(&self.pending[self.pending_pos..]) } else { 0 };`.
            //           Push the unsent tail; `push_slice` returns how many were accepted.
            //           `&self.pending[a..]` borrows a sub-slice (disjoint from the producer).
            // Why:      Make progress draining `pending`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const pushed = this.producer.pushSlice(this.pending.slice(this.pendingPos));
            // ```
            let pushed = if let Some(producer) = self.producer.as_mut() {
                producer.push_slice(&self.pending[self.pending_pos..])
            } else {
                0
            };
            // What:     `self.pending_pos += pushed;`. Advance the sent cursor.
            // Why:      Track what is left.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.pendingPos += pushed;
            // ```
            self.pending_pos += pushed;
            // What:     `if self.pending_pos >= self.pending.len() { self.pending.clear(); self.pending_pos = 0; }`.
            //           Fully drained -> reset the buffer.
            // Why:      Ready to decode next time.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (this.pendingPos >= this.pending.length) { this.pending = []; this.pendingPos = 0; }
            // ```
            if self.pending_pos >= self.pending.len() {
                self.pending.clear();
                self.pending_pos = 0;
            }
            // What:     `self.advance_position(pushed);`. Count pushed frames.
            // Why:      Update the seek bar.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.advancePosition(pushed);
            // ```
            self.advance_position(pushed);
            // What:     `return pushed > 0;`. Did work only if something was pushed.
            // Why:      Tell the caller whether to sleep.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return pushed > 0;
            // ```
            return pushed > 0;
        }

        // What:     `let decoded = if let Some(source) = self.source.as_mut() { source.next_chunk() } else { return false; };`.
        //           Decode the next block; `next_chunk()` returns `Result<Vec<f32>, _>`.
        // Why:      Produce more audio.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const decoded = this.source.nextChunk();
        // ```
        let decoded = if let Some(source) = self.source.as_mut() {
            source.next_chunk()
        } else {
            return false;
        };

        // What:     `let mut chunk = match decoded { ... };`. Unwrap; on error, log, end the
        //           track, and report work done. `mut` because the samples are gained in
        //           place below.
        // Why:      Handle decode failures without crashing.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let chunk; try { chunk = decoded; } catch (e) { console.error(e); this.onTrackEnd(); return true; }
        // ```
        let mut chunk = match decoded {
            // What:     `Ok(c) => c`. The decoded samples.
            // Why:      Continue.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // chunk = c;
            // ```
            Ok(c) => c,
            // What:     `Err(e) => { eprintln!(...); self.on_track_end(); return true; }`. Treat
            //           a decode error as end-of-track.
            // Why:      Move on rather than stall.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // catch (e) { console.error(e); this.onTrackEnd(); return true; }
            // ```
            Err(e) => {
                tracing::warn!(error = %e, "decode error; treating as end of track");
                self.on_track_end();
                return true;
            }
        };

        // What:     `if chunk.is_empty() { self.on_track_end(); return true; }`. An empty
        //           chunk is the end-of-stream signal.
        // Why:      Advance at natural end.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (chunk.length === 0) { this.onTrackEnd(); return true; }
        // ```
        if chunk.is_empty() {
            self.on_track_end();
            return true;
        }

        // What:     `let gain = self.volume * self.track_gain;`. Combine the user volume with
        //           the track's true-peak normalization gain.
        // Why:      One scalar applied per sample below.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const gain = this.volume * this.trackGain;
        // ```
        let gain = self.volume * self.track_gain;
        // What:     `for sample in chunk.iter_mut() { *sample = process_sample(*sample, gain); }`.
        //           Run every sample through the output stage in place. `iter_mut` yields
        //           `&mut f32`; the right `*sample` reads, the left `*sample =` writes back.
        // Why:      Apply gain + clamp in one tested place.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (let i = 0; i < chunk.length; i++) chunk[i] = processSample(chunk[i], gain);
        // ```
        for sample in chunk.iter_mut() {
            *sample = process_sample(*sample, gain);
        }

        // What:     `let pushed = if let Some(producer) = self.producer.as_mut() { producer.push_slice(&chunk) } else { 0 };`.
        //           Push the gained chunk; `push_slice` returns the accepted count.
        // Why:      Feed the audio thread.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const pushed = this.producer.pushSlice(chunk);
        // ```
        let pushed = if let Some(producer) = self.producer.as_mut() {
            producer.push_slice(&chunk)
        } else {
            0
        };
        // What:     `self.advance_position(pushed);`. Count pushed frames.
        // Why:      Update the seek bar.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.advancePosition(pushed);
        // ```
        self.advance_position(pushed);
        // What:     `if pushed < chunk.len() { self.pending = chunk; self.pending_pos = pushed; }`.
        //           Stash the remainder if the buffer could not take all of it (MOVES
        //           `chunk` into `self.pending`).
        // Why:      Push the rest next cycle instead of dropping samples.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (pushed < chunk.length) { this.pending = chunk; this.pendingPos = pushed; }
        // ```
        if pushed < chunk.len() {
            self.pending = chunk;
            self.pending_pos = pushed;
        }
        // What:     `true`. We decoded and pushed: work was done. Tail expression -> return.
        // Why:      Caller should not sleep.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return true;
        // ```
        true
    }

    /// What:     `fn on_track_end(&mut self)`. Natural end of the current track: advance the
    ///           queue (natural end, so repeat-one replays) and load, or stop.
    /// Why:      Auto-advance between tracks.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// onTrackEnd(): void { const moved = this.queue.advance(true); this.afterMove(moved); }
    /// ```
    fn on_track_end(&mut self) {
        // What:     `let moved = self.queue.advance(true);`. `true` = natural end, letting
        //           repeat-one replay the same track.
        // Why:      Honour the repeat mode.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const moved = this.queue.advance(true);
        // ```
        let moved = self.queue.advance(true);
        // What:     `self.after_move(moved);`. Load the next or stop. `after_move` lives in
        //           the command-handling half but is the same type's method.
        // Why:      Shared follow-up logic.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.afterMove(moved);
        // ```
        self.after_move(moved);
    }

    /// What:     `fn advance_position(&mut self, samples_pushed: usize)`. Add the pushed
    ///           frames to the position counter and emit a throttled `Position` update.
    /// Why:      Keep the seek bar moving without flooding the UI.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// advancePosition(samplesPushed: number): void { ... }
    /// ```
    fn advance_position(&mut self, samples_pushed: usize) {
        // What:     `let channels = self.spec.as_ref().map_or(0, |s| s.channels) as u64;`.
        //           Read the channel count (0 if no spec); `as u64` widens for the division.
        // Why:      Frames = interleaved samples / channels.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const channels = this.spec ? this.spec.channels : 0;
        // ```
        let channels = self.spec.as_ref().map_or(0, |s| s.channels) as u64;
        // What:     `if channels == 0 { return; }`. Avoid divide-by-zero.
        // Why:      No valid spec yet.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (channels === 0) return;
        // ```
        if channels == 0 {
            return;
        }
        // What:     `self.position_frames += samples_pushed as u64 / channels;`. Convert
        //           pushed interleaved samples to frames and accumulate.
        // Why:      Track playback progress.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.positionFrames += Math.floor(samplesPushed / channels);
        // ```
        self.position_frames += samples_pushed as u64 / channels;
        // What:     `let rate = self.spec.as_ref().map_or(0, |s| s.rate);`. Sample rate.
        // Why:      Seconds = frames / rate.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const rate = this.spec ? this.spec.rate : 0;
        // ```
        let rate = self.spec.as_ref().map_or(0, |s| s.rate);
        // What:     `if rate == 0 { return; }`. Avoid divide-by-zero.
        // Why:      Cannot compute seconds.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (rate === 0) return;
        // ```
        if rate == 0 {
            return;
        }
        // What:     `let secs = frames_to_secs(self.position_frames, rate);`. Current position
        //           in seconds (same helper the session snapshot uses).
        // Why:      The unit the UI uses.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const secs = framesToSecs(this.positionFrames, rate);
        // ```
        let secs = frames_to_secs(self.position_frames, rate);
        // What:     `if secs - self.last_emit_secs >= POSITION_EMIT_INTERVAL_SECS { ... }`.
        //           Only emit when enough progress has accumulated.
        // Why:      Throttle to ~10 updates/second.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (secs - this.lastEmitSecs >= POSITION_EMIT_INTERVAL_SECS) { ... }
        // ```
        if secs - self.last_emit_secs >= POSITION_EMIT_INTERVAL_SECS {
            // What:     `self.last_emit_secs = secs;`. Update the baseline.
            // Why:      Next emit waits another interval.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.lastEmitSecs = secs;
            // ```
            self.last_emit_secs = secs;
            // What:     `self.emit(Update::Position(secs));`. Send the position.
            // Why:      Move the seek bar.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.emit({ kind: "position", secs });
            // ```
            self.emit(Update::Position(secs));
        }
    }
}
