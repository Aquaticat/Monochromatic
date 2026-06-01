//! The loading and audio-pumping half of `Controller` (a second `impl` block on
//! the type defined in `controller.rs`). Split out so each file stays within the
//! line budget. These methods open decoders, resolve each track's true-peak
//! normalization gain, push samples into the ring buffer, and report position.

// What:     `use std::path::Path;`. Borrowed filesystem-path type (sibling: owned
//           `PathBuf`). The owned form is produced by `.clone()` here but not named.
// Why:      `install_source` borrows a `&Path` to read the current file.
// TS map:   `Path` is just `string`.
use std::path::Path;

// What:     `use ringbuf::traits::Producer;`. Brings `push_slice` into scope for the
//           producer half of the ring buffer.
// Why:      We push decoded samples into the buffer the output gave us.
// TS map:   importing the interface whose `pushSlice` we call.
use ringbuf::traits::Producer;

// What:     `use crate::command::Update;`. The engine->UI message enum.
// Why:      These methods emit `NowPlaying`/`Position` updates.
// TS map:   `import { Update } from "./command";`
use crate::command::Update;

// What:     `use crate::controller::Controller;`. The state struct from the sibling
//           module; this file adds a second `impl Controller` block.
// Why:      Name the type we are implementing methods on.
// TS map:   `import { Controller } from "./controller";`
use crate::controller::Controller;

// What:     `use crate::decode::Source;`. The decoder trait (so `Box<dyn Source>` is
//           nameable and its `spec`/`next_chunk`/`seek` methods are in scope).
// Why:      `install_source` takes a `Box<dyn Source>` and we drive it.
// TS map:   `import { Source } from "./decode";`
use crate::decode::Source;

// What:     `use crate::measure::resolve_track_gain;`. Cache-or-measure the current
//           track's normalization gain.
// Why:      Set `track_gain` when a track loads.
// TS map:   `import { resolveTrackGain } from "./measure";`
use crate::measure::resolve_track_gain;

// What:     `use crate::playback::{file_name_of, frames_to_secs, process_sample};`.
//           Display-name extraction, frame->seconds conversion, and the per-sample
//           gain+clamp stage.
// Why:      Used by install_source, current_session/advance_position, and pump_audio.
// TS map:   `import { fileNameOf, framesToSecs, processSample } from "./playback";`
use crate::playback::{file_name_of, frames_to_secs, process_sample};

// What:     `use crate::session::Session;`. The serializable saved-state record.
// Why:      `current_session` builds one.
// TS map:   `import { Session } from "./session";`
use crate::session::Session;

// What:     `const POSITION_EMIT_INTERVAL_SECS: f64 = 0.1;`. Minimum seconds of
//           progress between `Position` updates. `f64` matches the time contract.
// Why:      Throttle position updates to ~10/second instead of per buffer.
// TS map:   `const POSITION_EMIT_INTERVAL_SECS = 0.1;`
const POSITION_EMIT_INTERVAL_SECS: f64 = 0.1;

// What:     `impl Controller { ... }`. The loading/audio half of the behaviour.
// Why:      Keep these methods beside the command-handling half without one huge file.
// TS map:   more of the same class body.
impl Controller {
    // What:     `fn current_session(&self) -> Session`. Snapshot the playback state into
    //           a serializable `Session`.
    // Why:      Persist where the user left off.
    // TS map:   `currentSession(): Session`
    fn current_session(&self) -> Session {
        // What:     `let position_secs = frames_to_secs(self.position_frames, self.spec.as_ref().map_or(0, |s| s.rate));`.
        //           Convert the frame counter to seconds. `self.spec.as_ref().map_or(0, |s| s.rate)`
        //           reads the rate (0 when no spec); the helper returns 0.0 for a 0 rate.
        // Why:      The session stores seconds, not frames.
        // TS map:   `const positionSecs = framesToSecs(this.positionFrames, this.spec ? this.spec.rate : 0);`
        let position_secs =
            frames_to_secs(self.position_frames, self.spec.as_ref().map_or(0, |s| s.rate));
        // What:     `Session { ... }`. Build the record from the queue + state.
        //           `self.queue.tracks().to_vec()` clones borrowed paths into an owned
        //           `Vec`. Tail -> return.
        // Why:      Bundle everything the next launch needs.
        // TS map:   `return { tracks: [...], current: ..., ... };`
        Session {
            tracks: self.queue.tracks().to_vec(),
            current: self.queue.current_index(),
            position_secs,
            volume: self.volume,
            shuffle: self.queue.shuffle_mode(),
            repeat_track: self.queue.repeat_track(),
        }
    }

    // What:     `pub(crate) fn save_session(&self)`. Write the current session to disk,
    //           logging (not propagating) any IO error. `pub(crate)` so `engine::run`
    //           can call it on quit.
    // Why:      A failed save should not block shutdown.
    // TS map:   `saveSession(): void`
    pub(crate) fn save_session(&self) {
        // What:     `if let Err(e) = self.current_session().save() { ... }`. `save`
        //           returns `io::Result<()>`; on `Err` we log it.
        // Why:      Best-effort persistence.
        // TS map:   `try { currentSession().save(); } catch (e) { console.error(e); }`
        if let Err(e) = self.current_session().save() {
            eprintln!("music-player: session save failed: {e}");
        }
    }

    // What:     `pub(crate) fn load_current(&mut self) -> bool`. Open the queue's current
    //           track into a decoder + reconfigure output. Returns whether a track was
    //           loaded. Skips past files that fail to open. `pub(crate)` so the
    //           command-handling half can call it.
    // Why:      One place that turns "current path" into live playback state.
    // TS map:   `loadCurrent(): boolean`
    pub(crate) fn load_current(&mut self) -> bool {
        // What:     `let max_attempts = self.queue.len();`. How many opens to try
        //           before giving up.
        // Why:      `advance` now ALWAYS loops its scope (no end-of-queue `None`), so
        //           a queue of all-unreadable files would otherwise spin forever; cap
        //           the retries at the track count. Confinement is intentional: when a
        //           whole page is unreadable, stop rather than jump to another page.
        // TS map:   `const maxAttempts = this.queue.len();`
        let max_attempts = self.queue.len();
        // What:     `let mut attempts = 0;`. Count of failed opens so far.
        // Why:      Compare against `max_attempts` to bound the loop.
        // TS map:   `let attempts = 0;`
        let mut attempts = 0;
        // What:     `loop { ... }`. Iterate the queue, advancing past any unreadable
        //           file. Iterative (not recursive) so a long run of bad files cannot
        //           overflow the stack.
        // Why:      Robustly find the next playable track.
        // TS map:   `while (true) { ... }`
        loop {
            // What:     `let path = match self.queue.current_path() { ... };`. Copy the
            //           current path out (`.clone()` -> owned `PathBuf`), or return
            //           `false` if the queue is empty.
            // Why:      Need an owned path to open and to release the queue borrow.
            // TS map:   `const path = this.queue.currentPath(); if (!path) return false;`
            let path = match self.queue.current_path() {
                // What:     `Some(p) => p.clone()`. Own the path.
                // Why:      Outlive the borrow.
                // TS map:   `path = currentPath;`
                Some(p) => p.clone(),
                // What:     `None => return false`. Empty queue.
                // Why:      Nothing to load.
                // TS map:   `return false;`
                None => return false,
            };

            // What:     `match crate::decode::open(&path) { ... }`. Try to open a decoder.
            //           `&path` lends it.
            // Why:      Build the source.
            // TS map:   `try { const source = open(path); ... } catch (e) { ... }`
            match crate::decode::open(&path) {
                // What:     `Ok(source) => { self.install_source(source, &path); return true; }`.
                //           Loaded: install it and report success.
                // Why:      Begin playing this track.
                // TS map:   `this.installSource(source, path); return true;`
                Ok(source) => {
                    self.install_source(source, &path);
                    return true;
                }
                // What:     `Err(e) => { ... }`. Could not open this file.
                // Why:      Skip to the next track.
                // TS map:   `catch (e) { ... }`
                Err(e) => {
                    // What:     `eprintln!(...)`. Log the failure; `path.display()` formats it.
                    // Why:      Surface the bad file.
                    // TS map:   `console.error(`cannot open ${path}: ${e}`);`
                    eprintln!("music-player: cannot open {}: {e}", path.display());
                    // What:     `attempts += 1;`. Count this failed open.
                    // Why:      Track progress toward the retry cap.
                    // TS map:   `attempts += 1;`
                    attempts += 1;
                    // What:     `if attempts >= max_attempts { return false; }`. Give up
                    //           after trying every track once (advance loops, so it
                    //           never returns `None` on its own for a non-empty queue).
                    // Why:      Avoid an endless loop when all files are bad.
                    // TS map:   `if (attempts >= maxAttempts) return false;`
                    if attempts >= max_attempts {
                        return false;
                    }
                    // What:     `self.queue.advance(false);`. Step forward within the
                    //           scope; the returned index is ignored (we only need the
                    //           cursor moved). `advance` returns an `Option` that is
                    //           not `#[must_use]`, so discarding it is fine.
                    // Why:      Retry the loop with the next current track.
                    // TS map:   `this.queue.advance(false);`
                    self.queue.advance(false);
                    // Otherwise the loop retries with the new current track.
                }
            }
        }
    }

    // What:     `fn install_source(&mut self, source: Box<dyn Source>, path: &Path)`.
    //           Store the source, reconfigure the output, resolve the track's
    //           normalization gain, reset position, and tell the UI what is playing.
    // Why:      The common setup after a successful `open`.
    // TS map:   `installSource(source: Source, path: string): void`
    fn install_source(&mut self, source: Box<dyn Source>, path: &Path) {
        // What:     `let spec = source.spec();`. Copy the stream's rate/channels/duration
        //           (`AudioSpec` is `Copy`).
        // Why:      Needed to configure the output and the position math.
        // TS map:   `const spec = source.spec();`
        let spec = source.spec();

        // What:     `self.track_gain = resolve_track_gain(path, &self.peaks);`. Look up
        //           (or measure now, on a cache miss) the track's true-peak normalization
        //           gain and store it. `&self.peaks` lends the shared cache handle.
        // Why:      Apply a correct constant gain from the first sample of this track;
        //           the synchronous miss-path decode is the per-track-normalization cost.
        // TS map:   `this.trackGain = resolveTrackGain(path, this.peaks);`
        self.track_gain = resolve_track_gain(path, &self.peaks);

        // What:     `if let Some(output) = self.output.as_mut() { ... }`. Reconfigure only
        //           when audio is available (not silent mode).
        // Why:      Skip audio setup when there is no output.
        // TS map:   `if (this.output) { ... }`
        if let Some(output) = self.output.as_mut() {
            // What:     `let capacity_frames = spec.rate as usize;`. ~1 second of audio.
            // Why:      Enough buffering to avoid underruns without big latency.
            // TS map:   `const capacityFrames = spec.rate;`
            let capacity_frames = spec.rate as usize;
            // What:     `match output.reconfigure(spec.rate, spec.channels, capacity_frames) { ... }`.
            //           Rebuild the stream at this track's format; returns a new producer.
            // Why:      Per-track native rate; fresh buffer flushes old audio.
            // TS map:   `try { this.producer = output.reconfigure(...); } catch (e) { ... }`
            match output.reconfigure(spec.rate, spec.channels, capacity_frames) {
                // What:     `Ok(prod) => self.producer = Some(prod)`. Store the write end.
                // Why:      Push samples here from now on.
                // TS map:   `this.producer = prod;`
                Ok(prod) => self.producer = Some(prod),
                // What:     `Err(e) => { eprintln!(...); self.producer = None; }`. Log and
                //           drop into silent mode for this track.
                // Why:      Don't crash if a stream fails to connect.
                // TS map:   `console.error(e); this.producer = null;`
                Err(e) => {
                    eprintln!("music-player: audio reconfigure failed: {e}");
                    self.producer = None;
                }
            }
        }

        // What:     `self.source = Some(source);`. Store the decoder.
        // Why:      Pump decodes from it.
        // TS map:   `this.source = source;`
        self.source = Some(source);
        // What:     `self.spec = Some(spec);`. Cache the format.
        // Why:      Position math + future reconfigure (seek).
        // TS map:   `this.spec = spec;`
        self.spec = Some(spec);
        // What:     `self.position_frames = 0;`. Restart the frame counter.
        // Why:      New track starts at 0.
        // TS map:   `this.positionFrames = 0;`
        self.position_frames = 0;
        // What:     `self.last_emit_secs = 0.0;`. Reset the throttle baseline.
        // Why:      Emit the first position promptly.
        // TS map:   `this.lastEmitSecs = 0;`
        self.last_emit_secs = 0.0;
        // What:     `self.pending.clear(); self.pending_pos = 0;`. Drop leftover samples.
        // Why:      Avoid mixing tracks.
        // TS map:   `this.pending = []; this.pendingPos = 0;`
        self.pending.clear();
        self.pending_pos = 0;

        // What:     `let name = file_name_of(path);`. The display filename.
        // Why:      Filename-only metadata policy.
        // TS map:   `const name = fileNameOf(path);`
        let name = file_name_of(path);
        // What:     `let index = self.queue.current_index();`. Its position in the queue.
        // Why:      Lets the UI highlight the current row.
        // TS map:   `const index = this.queue.currentIndex();`
        let index = self.queue.current_index();
        // What:     `self.emit(Update::NowPlaying { index, name, duration: spec.duration_secs });`.
        //           Tell the UI the new track.
        // Why:      Update the now-playing label and seek-bar maximum.
        // TS map:   `this.emit({ kind: "nowPlaying", index, name, duration: ... });`
        self.emit(Update::NowPlaying {
            index,
            name,
            duration: spec.duration_secs,
        });
        // What:     `self.emit(Update::Position(0.0));`. Reset the seek bar to 0.
        // Why:      New track starts at the beginning.
        // TS map:   `this.emit({ kind: "position", secs: 0 });`
        self.emit(Update::Position(0.0));
    }

    // What:     `pub(crate) fn seek(&mut self, secs: f64)`. Move playback to `secs` and
    //           flush buffered audio. `pub(crate)` so the command-handling half can call it.
    // Why:      Seek-bar control.
    // TS map:   `seek(secs: number): void`
    pub(crate) fn seek(&mut self, secs: f64) {
        // What:     `let spec = match self.spec { Some(s) => s, None => return };`. Copy the
        //           format out, or do nothing if no track is loaded.
        // Why:      Need the rate to recompute the frame position.
        // TS map:   `const spec = this.spec; if (!spec) return;`
        let spec = match self.spec {
            // What:     `Some(s) => s`. Copy the spec (`AudioSpec` is `Copy`).
            // Why:      No borrow held.
            // TS map:   `spec = this.spec;`
            Some(s) => s,
            // What:     `None => return`. Nothing loaded.
            // Why:      Ignore the seek.
            // TS map:   `return;`
            None => return,
        };

        // What:     `if let Some(source) = self.source.as_mut() { ... } else { return; }`.
        //           Seek the decoder; bail if there is no source.
        // Why:      The decoder must reposition.
        // TS map:   `if (!this.source) return; this.source.seek(secs);`
        if let Some(source) = self.source.as_mut() {
            // What:     `if let Err(e) = source.seek(secs) { eprintln!(...); return; }`.
            //           Attempt the seek; on error, log and abort.
            // Why:      A failed seek should not corrupt position state.
            // TS map:   `try { source.seek(secs); } catch (e) { console.error(e); return; }`
            if let Err(e) = source.seek(secs) {
                eprintln!("music-player: seek failed: {e}");
                return;
            }
        } else {
            // What:     `return;`. No source -> nothing to seek.
            // Why:      Guard.
            // TS map:   `return;`
            return;
        }

        // What:     `if let Some(output) = self.output.as_mut() { ... }`. Rebuild the
        //           stream at the SAME format to flush stale buffered audio.
        // Why:      Otherwise ~1s of pre-seek audio would still play.
        // TS map:   `if (this.output) { this.producer = output.reconfigure(...); }`
        if let Some(output) = self.output.as_mut() {
            // What:     `match output.reconfigure(spec.rate, spec.channels, spec.rate as usize) { ... }`.
            //           Same rate/channels, ~1s buffer; new empty producer.
            // Why:      Clean slate after the jump.
            // TS map:   `try { this.producer = output.reconfigure(...); } catch (e) { ... }`
            match output.reconfigure(spec.rate, spec.channels, spec.rate as usize) {
                // What:     `Ok(prod) => self.producer = Some(prod)`. Replace the producer.
                // Why:      Flush.
                // TS map:   `this.producer = prod;`
                Ok(prod) => self.producer = Some(prod),
                // What:     `Err(e) => eprintln!(...)`. Log a reconfigure failure.
                // Why:      Keep going (position still updates).
                // TS map:   `console.error(e);`
                Err(e) => eprintln!("music-player: seek reconfigure failed: {e}"),
            }
        }

        // What:     `self.pending.clear(); self.pending_pos = 0;`. Drop leftover pre-seek
        //           samples we had not pushed yet.
        // Why:      They belong to the old position.
        // TS map:   `this.pending = []; this.pendingPos = 0;`
        self.pending.clear();
        self.pending_pos = 0;

        // What:     `self.position_frames = (secs * spec.rate as f64) as u64;`. Convert the
        //           target seconds to a frame count; `as u64` truncates the float.
        // Why:      Keep position reporting consistent after the jump.
        // TS map:   `this.positionFrames = Math.floor(secs * spec.rate);`
        self.position_frames = (secs * spec.rate as f64) as u64;
        // What:     `self.last_emit_secs = secs;`. Update the throttle baseline.
        // Why:      Avoid an immediate redundant emit.
        // TS map:   `this.lastEmitSecs = secs;`
        self.last_emit_secs = secs;
        // What:     `self.emit(Update::Position(secs));`. Snap the UI seek bar.
        // Why:      Reflect the jump immediately.
        // TS map:   `this.emit({ kind: "position", secs });`
        self.emit(Update::Position(secs));
    }

    // What:     `pub(crate) fn pump_audio(&mut self) -> bool`. Push at most one block of
    //           audio into the ring buffer. Returns whether it did meaningful work.
    //           `pub(crate)` so `engine::run` can call it each loop iteration.
    // Why:      The decode->buffer feeding step.
    // TS map:   `pumpAudio(): boolean`
    pub(crate) fn pump_audio(&mut self) -> bool {
        // What:     `if !self.playing { return false; }`. Paused: no work.
        // Why:      Respect pause.
        // TS map:   `if (!this.playing) return false;`
        if !self.playing {
            return false;
        }
        // What:     `if self.producer.is_none() || self.source.is_none() { return false; }`.
        //           Need both a write end and a decoder.
        // Why:      Nothing to do otherwise.
        // TS map:   `if (!this.producer || !this.source) return false;`
        if self.producer.is_none() || self.source.is_none() {
            return false;
        }

        // What:     `if self.pending_pos < self.pending.len() { ... }`. Leftover samples
        //           from last time; push them first.
        // Why:      Finish the previous block before decoding more.
        // TS map:   `if (this.pendingPos < this.pending.length) { ... }`
        if self.pending_pos < self.pending.len() {
            // What:     push the unsent tail; `push_slice` returns how many were accepted.
            //           `&self.pending[a..]` borrows a sub-slice (disjoint from producer).
            // Why:      Make progress draining `pending`.
            // TS map:   `const pushed = producer.pushSlice(this.pending.slice(this.pendingPos));`
            let pushed = if let Some(producer) = self.producer.as_mut() {
                producer.push_slice(&self.pending[self.pending_pos..])
            } else {
                0
            };
            // What:     `self.pending_pos += pushed;`. Advance the sent cursor.
            // Why:      Track what is left.
            // TS map:   `this.pendingPos += pushed;`
            self.pending_pos += pushed;
            // What:     fully drained -> reset the buffer.
            // Why:      Ready to decode next time.
            // TS map:   `if (this.pendingPos >= this.pending.length) { this.pending = []; this.pendingPos = 0; }`
            if self.pending_pos >= self.pending.len() {
                self.pending.clear();
                self.pending_pos = 0;
            }
            // What:     `self.advance_position(pushed);`. Count pushed frames.
            // Why:      Update the seek bar.
            // TS map:   `this.advancePosition(pushed);`
            self.advance_position(pushed);
            // What:     `return pushed > 0;`. Did work only if something was pushed.
            // Why:      Tell the caller whether to sleep.
            // TS map:   `return pushed > 0;`
            return pushed > 0;
        }

        // What:     decode the next block; `Result<Vec<f32>, _>`.
        // Why:      Produce more audio.
        // TS map:   `const decoded = source.nextChunk();`
        let decoded = if let Some(source) = self.source.as_mut() {
            source.next_chunk()
        } else {
            return false;
        };

        // What:     `let mut chunk = match decoded { ... };`. Unwrap; on error, log, end
        //           the track, and report work done.
        // Why:      Handle decode failures without crashing.
        // TS map:   `let chunk; try { chunk = decoded; } catch (e) { ...; this.onTrackEnd(); return true; }`
        let mut chunk = match decoded {
            // What:     `Ok(c) => c`. The decoded samples.
            // Why:      Continue.
            // TS map:   `chunk = c;`
            Ok(c) => c,
            // What:     `Err(e) => { eprintln!(...); self.on_track_end(); return true; }`.
            //           Treat a decode error as end-of-track.
            // Why:      Move on rather than stall.
            // TS map:   `catch (e) { console.error(e); this.onTrackEnd(); return true; }`
            Err(e) => {
                eprintln!("music-player: decode error: {e}");
                self.on_track_end();
                return true;
            }
        };

        // What:     `if chunk.is_empty() { self.on_track_end(); return true; }`. An empty
        //           chunk is the end-of-stream signal.
        // Why:      Advance at natural end.
        // TS map:   `if (chunk.length === 0) { this.onTrackEnd(); return true; }`
        if chunk.is_empty() {
            self.on_track_end();
            return true;
        }

        // What:     `let gain = self.volume * self.track_gain;`. Combine the user volume
        //           with the track's true-peak normalization gain.
        // Why:      One scalar applied per sample below.
        // TS map:   `const gain = this.volume * this.trackGain;`
        let gain = self.volume * self.track_gain;
        // What:     `for sample in chunk.iter_mut() { *sample = process_sample(*sample, gain); }`.
        //           Run every sample through the output stage in place. `iter_mut` yields
        //           `&mut f32`; the right `*sample` reads, the left `*sample =` writes back.
        // Why:      Apply gain + clamp in one tested place.
        // TS map:   `for (let i = 0; i < chunk.length; i++) chunk[i] = processSample(chunk[i], gain);`
        for sample in chunk.iter_mut() {
            *sample = process_sample(*sample, gain);
        }

        // What:     push the gained chunk; `push_slice` returns the accepted count.
        // Why:      Feed the audio thread.
        // TS map:   `const pushed = producer.pushSlice(chunk);`
        let pushed = if let Some(producer) = self.producer.as_mut() {
            producer.push_slice(&chunk)
        } else {
            0
        };
        // What:     `self.advance_position(pushed);`. Count pushed frames.
        // Why:      Update the seek bar.
        // TS map:   `this.advancePosition(pushed);`
        self.advance_position(pushed);
        // What:     `if pushed < chunk.len() { self.pending = chunk; self.pending_pos = pushed; }`.
        //           Stash the remainder if the buffer could not take all of it.
        // Why:      Push the rest next cycle instead of dropping samples.
        // TS map:   `if (pushed < chunk.length) { this.pending = chunk; this.pendingPos = pushed; }`
        if pushed < chunk.len() {
            self.pending = chunk;
            self.pending_pos = pushed;
        }
        // What:     `true`. We decoded and pushed: work was done.
        // Why:      Caller should not sleep.
        // TS map:   `return true;`
        true
    }

    // What:     `fn on_track_end(&mut self)`. Natural end of the current track: advance
    //           the queue (natural end, so repeat-one replays) and load, or stop.
    // Why:      Auto-advance between tracks.
    // TS map:   `onTrackEnd(): void`
    fn on_track_end(&mut self) {
        // What:     `let moved = self.queue.advance(true);`. `true` = natural end, letting
        //           repeat-one replay the same track.
        // Why:      Honour the repeat mode.
        // TS map:   `const moved = this.queue.advance(true);`
        let moved = self.queue.advance(true);
        // What:     `self.after_move(moved);`. Load the next or stop. `after_move` lives in
        //           the command-handling half but is the same type's method.
        // Why:      Shared follow-up logic.
        // TS map:   `this.afterMove(moved);`
        self.after_move(moved);
    }

    // What:     `fn advance_position(&mut self, samples_pushed: usize)`. Add the pushed
    //           frames to the position counter and emit a throttled `Position` update.
    // Why:      Keep the seek bar moving without flooding the UI.
    // TS map:   `advancePosition(samplesPushed: number): void`
    fn advance_position(&mut self, samples_pushed: usize) {
        // What:     `let channels = self.spec.as_ref().map_or(0, |s| s.channels) as u64;`.
        //           Read the channel count (0 if no spec); widen for the division.
        // Why:      Frames = interleaved samples / channels.
        // TS map:   `const channels = this.spec ? this.spec.channels : 0;`
        let channels = self.spec.as_ref().map_or(0, |s| s.channels) as u64;
        // What:     `if channels == 0 { return; }`. Avoid divide-by-zero.
        // Why:      No valid spec yet.
        // TS map:   `if (channels === 0) return;`
        if channels == 0 {
            return;
        }
        // What:     `self.position_frames += samples_pushed as u64 / channels;`. Convert
        //           pushed interleaved samples to frames and accumulate.
        // Why:      Track playback progress.
        // TS map:   `this.positionFrames += Math.floor(samplesPushed / channels);`
        self.position_frames += samples_pushed as u64 / channels;
        // What:     `let rate = self.spec.as_ref().map_or(0, |s| s.rate);`. Sample rate.
        // Why:      Seconds = frames / rate.
        // TS map:   `const rate = this.spec ? this.spec.rate : 0;`
        let rate = self.spec.as_ref().map_or(0, |s| s.rate);
        // What:     `if rate == 0 { return; }`. Avoid divide-by-zero.
        // Why:      Cannot compute seconds.
        // TS map:   `if (rate === 0) return;`
        if rate == 0 {
            return;
        }
        // What:     `let secs = frames_to_secs(self.position_frames, rate);`. Current
        //           position in seconds (same helper the session snapshot uses).
        // Why:      The unit the UI uses.
        // TS map:   `const secs = framesToSecs(this.positionFrames, rate);`
        let secs = frames_to_secs(self.position_frames, rate);
        // What:     `if secs - self.last_emit_secs >= POSITION_EMIT_INTERVAL_SECS { ... }`.
        //           Only emit when enough progress has accumulated.
        // Why:      Throttle to ~10 updates/second.
        // TS map:   `if (secs - this.lastEmitSecs >= POSITION_EMIT_INTERVAL_SECS) { ... }`
        if secs - self.last_emit_secs >= POSITION_EMIT_INTERVAL_SECS {
            // What:     `self.last_emit_secs = secs;`. Update the baseline.
            // Why:      Next emit waits another interval.
            // TS map:   `this.lastEmitSecs = secs;`
            self.last_emit_secs = secs;
            // What:     `self.emit(Update::Position(secs));`. Send the position.
            // Why:      Move the seek bar.
            // TS map:   `this.emit({ kind: "position", secs });`
            self.emit(Update::Position(secs));
        }
    }
}
