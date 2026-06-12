//! Controller: all mutable playback state, owned by the engine worker thread.
//! It holds the queue, the active decoder, the audio output, the shared true-peak
//! cache, and the current-track peak swap state. This file has the state struct,
//! command handling, and the background-measurement kickoff; the loading and
//! audio-pumping methods live in `controller_audio.rs` (a second `impl Controller`
//! block, kept separate so each file stays within the line budget). The type
//! stays crate-private because it holds the `!Send` `Output` and never leaves its
//! thread.

// What:     `use std::path::Path;`. Borrowed filesystem-path view. Sibling:
//           `PathBuf`, the owned path buffer, is not needed in this file.
// Why:      `prepare_peak_for_path` borrows the current track path without taking
//           ownership from the queue or loader.
// TS map:   paths are plain `string` values in TypeScript.
//
// In TS you'd write (pseudocode):
// ```ts
// type Path = string;
// ```
use std::path::Path;

// What:     `use std::sync::{Arc, Mutex};`. `Arc<T>` is a thread-safe shared owner
//           (atomic refcount; sibling: single-thread `Rc<T>`); `Mutex<T>` guards `T` so
//           one thread touches it at a time.
// Why:      The peak cache is shared with background measurement threads.
// TS map:   no equivalent; `Arc<Mutex<T>>` ~ "a shared, lockable object".
//
// In TS you'd write (pseudocode):
// ```ts
// // Arc<Mutex<T>> ~ a shared object you must lock() before touching
// ```
use std::sync::{Arc, Mutex};

// What:     `use std::thread;`. Rust's standard OS-thread API.
// Why:      `prepare_peak_for_path` passes the current engine thread handle to the
//           measurement worker so completion can wake the engine immediately.
// TS map:   closest equivalent is a `WorkerRef` for the current worker.
//
// In TS you'd write (pseudocode):
// ```ts
// const currentWorker = Worker.current;
// ```
use std::thread;

// What:     `use std::time::Duration;`. A monotonic span of time.
// Why:      Unit tests and the start path pass explicit wait windows to the peak
//           swap helper.
// TS map:   a millisecond count in TypeScript.
//
// In TS you'd write (pseudocode):
// ```ts
// type Duration = number;
// ```
use std::time::Duration;

// What:     `use ringbuf::HeapProd;`. The WRITE half of a heap ring buffer.
// Why:      The `producer` field type.
// TS map:   `type HeapProd<T> = RingProducer<T>;`
//
// In TS you'd write (pseudocode):
// ```ts
// type HeapProd = RingProducer;
// ```
use ringbuf::HeapProd;

// What:     `use crate::command::{Command, Update};`. The UI->engine and engine->UI
//           message enums.
// Why:      We match `Command`s and emit `Update`s.
// TS map:   `import { Command, Update } from "./command";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { Command, Update } from "./command";
// ```
use crate::command::{Command, Update};

// What:     `use crate::decode::{AudioSpec, Source};`. `AudioSpec` describes a decoded
//           stream; `Source` is the decoder trait (a `Box<dyn Source>` field).
// Why:      Struct fields name both types.
// TS map:   `import { AudioSpec, Source } from "./decode";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { AudioSpec, Source } from "./decode";
// ```
use crate::decode::{AudioSpec, Source};

// What:     `use crate::measure::spawn_queue_measurement;`. Starts the background sweep
//           that pre-measures a queue's tracks.
// Why:      Called on every queue load.
// TS map:   `import { spawnQueueMeasurement } from "./measure";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { spawnQueueMeasurement } from "./measure";
// ```
use crate::measure::spawn_queue_measurement;

// What:     `use crate::output::Output;`. The PipeWire output (FFI boundary).
// Why:      The `output` field and `new`'s parameter name it.
// TS map:   `import { Output } from "./output";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { Output } from "./output";
// ```
use crate::output::Output;

// What:     `use crate::peakcache::PeakCache;`. The persistent true-peak cache.
// Why:      The shared `peaks` field's inner type.
// TS map:   `import { PeakCache } from "./peakcache";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { PeakCache } from "./peakcache";
// ```
use crate::peakcache::PeakCache;

// What:     `use crate::peak_swap::{...};`. Import the current-track peak swap
//           helper functions and state/result enums.
// Why:      The controller owns pending current-track measurements and applies
//           measured gains when they arrive.
// TS map:   `import { fallbackTrackGain, peakSwapWait, prepareTrackGain, ... } from "./peak_swap";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { fallbackTrackGain, peakSwapWait, prepareTrackGain } from "./peak_swap";
// ```
use crate::peak_swap::{
    fallback_track_gain, peak_swap_wait, prepare_track_gain, PeakGainResult,
    PendingPeakMeasurement, PendingPeakStatus, TrackGainResolution,
};

// What:     `use crate::playback::expand_paths;`. Folder-to-file expansion.
// Why:      `OpenPaths` expands folders into their tracks.
// TS map:   `import { expandPaths } from "./playback";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { expandPaths } from "./playback";
// ```
use crate::playback::expand_paths;

// What:     `use crate::queue::Queue;`. The pure play-queue model.
// Why:      The `queue` field and `Queue::new()` name it.
// TS map:   `import { Queue } from "./queue";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { Queue } from "./queue";
// ```
use crate::queue::Queue;

// What:     `pub(crate) struct Controller { ... }`. All mutable playback state, owned by
//           the worker thread. Not `Send` (holds the `!Send` `Output`), which is fine
//           because it never leaves this thread. `pub(crate)` so `engine::run` can drive
//           it. Fields are `pub(crate)` too so the second `impl` block in
//           `controller_audio.rs` can reach them.
// Why:      Bundle the state so methods can mutate it.
// TS map:   `class Controller { ... }`
//
// In TS you'd write (pseudocode):
// ```ts
// class Controller { onUpdate; output; queue; source; producer; spec; playing; volume; trackGain; peakGeneration; pendingPeak; peaks; positionFrames; lastEmitSecs; pending; pendingPos; }
// ```
pub(crate) struct Controller {
    // What:     `on_update: Box<dyn Fn(Update) + Send>`. The UI callback (a heap-boxed
    //           trait object).
    // Why:      Push state changes back to the UI.
    // TS map:   `onUpdate: (u: Update) => void;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // onUpdate: (u: Update) => void;
    // ```
    pub(crate) on_update: Box<dyn Fn(Update) + Send>,
    // What:     `output: Option<Output>`. The PipeWire output, or `None` in silent mode.
    // Why:      Reconfigured per track; absent if audio init failed.
    // TS map:   `output: Output | null;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // output: Output | null;
    // ```
    pub(crate) output: Option<Output>,
    // What:     `queue: Queue`. The play-queue model.
    // Why:      Decides track order and current track.
    // TS map:   `queue: Queue;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // queue: Queue;
    // ```
    pub(crate) queue: Queue,
    // What:     `source: Option<Box<dyn Source>>`. The active decoder, or `None`.
    // Why:      Produces the PCM we push.
    // TS map:   `source: Source | null;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // source: Source | null;
    // ```
    pub(crate) source: Option<Box<dyn Source>>,
    // What:     `producer: Option<HeapProd<f32>>`. The ring-buffer write end, or `None`.
    // Why:      Where decoded samples go.
    // TS map:   `producer: RingProducer | null;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // producer: RingProducer | null;
    // ```
    pub(crate) producer: Option<HeapProd<f32>>,
    // What:     `spec: Option<AudioSpec>`. The current track's rate/channels/duration.
    // Why:      Drives position math and reconfigure calls.
    // TS map:   `spec: AudioSpec | null;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // spec: AudioSpec | null;
    // ```
    pub(crate) spec: Option<AudioSpec>,
    // What:     `playing: bool`. Whether we are actively feeding audio.
    // Why:      Pause/play gate.
    // TS map:   `playing: boolean;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // playing: boolean;
    // ```
    pub(crate) playing: bool,
    // What:     `volume: f32`. Linear user gain 0.0..=1.0 applied to samples.
    // Why:      Volume control (PCM-gain approach).
    // TS map:   `volume: number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // volume: number;
    // ```
    pub(crate) volume: f32,
    // What:     `track_gain: f32`. The current track's normalization gain (<=1.0), from
    //           true-peak measurement. Multiplied with `volume` per sample.
    // Why:      Per-track true-peak normalization to the -1 dBTP ceiling.
    // TS map:   `trackGain: number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // trackGain: number;
    // ```
    pub(crate) track_gain: f32,
    // What:     `peak_generation: u64`. Monotonic identifier for each loaded
    //           current track. `u64` is used instead of `usize` so the value is
    //           independent of platform pointer width.
    // Why:      Stale async peak results from older tracks must not change the
    //           current track's gain.
    // TS map:   `peakGeneration: number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // peakGeneration: number;
    // ```
    pub(crate) peak_generation: u64,
    // What:     `pending_peak: Option<PendingPeakMeasurement>`. Optional handle to
    //           the in-flight current-track measurement.
    // Why:      Cache misses need to be polled later, while cache hits have no
    //           pending work.
    // TS map:   `pendingPeak: PendingPeakMeasurement | null;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // pendingPeak: PendingPeakMeasurement | null;
    // ```
    pub(crate) pending_peak: Option<PendingPeakMeasurement>,
    // What:     `peaks: Arc<Mutex<PeakCache>>`. The shared, persistent true-peak cache.
    // Why:      Read on track load; written by load + background sweeps.
    // TS map:   `peaks: SharedPeakCache;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // peaks: SharedPeakCache;
    // ```
    pub(crate) peaks: Arc<Mutex<PeakCache>>,
    // What:     `position_frames: u64`. Frames pushed for the current track so far. `u64`
    //           because long tracks exceed `u32` frame counts.
    // Why:      Position seconds = frames / rate.
    // TS map:   `positionFrames: number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // positionFrames: number;
    // ```
    pub(crate) position_frames: u64,
    // What:     `last_emit_secs: f64`. Position (seconds) at the last `Position` update.
    // Why:      Throttle update frequency.
    // TS map:   `lastEmitSecs: number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // lastEmitSecs: number;
    // ```
    pub(crate) last_emit_secs: f64,
    // What:     `pending: Vec<f32>`. Gained samples decoded but not yet fully pushed.
    // Why:      Resume pushing them next cycle instead of dropping audio.
    // TS map:   `pending: number[];`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // pending: number[];
    // ```
    pub(crate) pending: Vec<f32>,
    // What:     `pending_pos: usize`. How many of `pending` are already pushed.
    // Why:      Push the remainder `pending[pending_pos..]` next time.
    // TS map:   `pendingPos: number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // pendingPos: number;
    // ```
    pub(crate) pending_pos: usize,
}

// What:     `impl Controller { ... }`. The command/state half of the behaviour.
// Why:      Construction, command handling, and the measurement kickoff.
// TS map:   part of the class body.
//
// In TS you'd write (pseudocode):
// ```ts
// class Controller { /* new, emit, set_playing, start_queue_measurement, handle_command, after_move */ }
// ```
impl Controller {
    // What:     `pub(crate) fn new(on_update: Box<dyn Fn(Update) + Send>, output: Option<Output>) -> Controller`.
    //           Build initial state (empty queue, nothing playing, full volume + gain,
    //           loaded peak cache). `pub(crate)` so `engine::run` can construct it.
    // Why:      Starting point for the worker.
    // TS map:   `constructor(onUpdate, output)`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // constructor(onUpdate, output) { ... }
    // ```
    pub(crate) fn new(
        on_update: Box<dyn Fn(Update) + Send>,
        output: Option<Output>,
    ) -> Controller {
        // What:     `Controller { ... }`. Struct literal. `Queue::new()` empty queue;
        //           volume/gain start at 1.0; `PeakCache::load()` reads any saved peaks;
        //           `Arc::new(Mutex::new(...))` wraps it for sharing. Tail -> return.
        // Why:      A clean idle state with the cache ready.
        // TS map:   `return new Controller(...);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { onUpdate, output, queue: new Queue(), source: null, producer: null,
        //          spec: null, playing: false, volume: 1, trackGain: 1, peaks: PeakCache.load(),
        //          positionFrames: 0, lastEmitSecs: 0, pending: [], pendingPos: 0 };
        // ```
        Controller {
            on_update,
            output,
            queue: Queue::new(),
            source: None,
            producer: None,
            spec: None,
            playing: false,
            volume: 1.0,
            track_gain: 1.0,
            peak_generation: 0,
            pending_peak: None,
            peaks: Arc::new(Mutex::new(PeakCache::load())),
            position_frames: 0,
            last_emit_secs: 0.0,
            pending: Vec::new(),
            pending_pos: 0,
        }
    }

    // What:     `pub(crate) fn emit(&self, update: Update)`. Call the UI callback.
    //           `pub(crate)` because `controller_audio.rs` also emits.
    // Why:      One place to push updates out.
    // TS map:   `emit(update) { this.onUpdate(update); }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // emit(update) { this.onUpdate(update); }
    // ```
    pub(crate) fn emit(&self, update: Update) {
        // What:     `(self.on_update)(update);`. Call the boxed closure. The parens make it
        //           call the field, not a method.
        // Why:      Deliver the update to the UI.
        // TS map:   `this.onUpdate(update);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.onUpdate(update);
        // ```
        (self.on_update)(update);
    }

    // What:     `pub(crate) fn prepare_peak_for_path(&mut self, path: &Path)`. Start
    //           or resolve peak gain for a newly loaded current track.
    // Why:      Loading a track must never synchronously decode the whole file on a
    //           cache miss; it sets fallback gain and stores a pending measurement instead.
    // TS map:   `preparePeakForPath(path: string): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // preparePeakForPath(path: string): void { ... }
    // ```
    pub(crate) fn prepare_peak_for_path(&mut self, path: &Path) {
        // What:     `self.peak_generation = self.peak_generation.wrapping_add(1);`.
        //           Increment the generation with explicit wrap semantics.
        // Why:      Every loaded track gets a different id; wrapping is practically
        //           unreachable but avoids a debug-build overflow panic.
        // TS map:   `this.peakGeneration = (this.peakGeneration + 1) >>> 0;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.peakGeneration += 1;
        // ```
        self.peak_generation = self.peak_generation.wrapping_add(1);
        // What:     `let generation = self.peak_generation;`. Copy the current id.
        // Why:      Pass a stable generation into the worker spawn call.
        // TS map:   `const generation = this.peakGeneration;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const generation = this.peakGeneration;
        // ```
        let generation = self.peak_generation;
        // What:     `match prepare_track_gain(path, &self.peaks, generation, thread::current()) { ... }`.
        //           Ask the peak-swap module for cache-hit gain or an async pending handle.
        // Why:      Centralize cache lookup and worker spawning.
        // TS map:   `switch (prepareTrackGain(path, this.peaks, generation, currentWorker).kind) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // switch (prepareTrackGain(path, this.peaks, generation, currentWorker).kind) { /* ready or pending */ }
        // ```
        match prepare_track_gain(path, &self.peaks, generation, thread::current()) {
            // What:     `TrackGainResolution::Ready(gain) => { ... }`. Cache hit.
            // Why:      Apply the measured gain immediately and clear any old pending handle.
            // TS map:   `case "ready": this.trackGain = gain; this.pendingPeak = null;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.trackGain = gain;
            // this.pendingPeak = null;
            // ```
            TrackGainResolution::Ready(gain) => {
                self.track_gain = gain;
                self.pending_peak = None;
            }
            // What:     `TrackGainResolution::Pending(pending) => { ... }`. Cache miss.
            // Why:      Use the safe ceiling fallback now, and keep the receiver for the
            //           later measured-gain swap.
            // TS map:   `case "pending": this.trackGain = fallbackTrackGain(); this.pendingPeak = pending;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.trackGain = fallbackTrackGain();
            // this.pendingPeak = pending;
            // ```
            TrackGainResolution::Pending(pending) => {
                self.track_gain = fallback_track_gain();
                self.pending_peak = Some(pending);
            }
        }
    }

    // What:     `fn apply_peak_result(&mut self, result: PeakGainResult) -> bool`.
    //           Apply a measured gain only when its generation matches the current track.
    // Why:      Old measurement workers may finish after the user changes tracks; their
    //           cache writes are useful, but their playback result is stale.
    // TS map:   `applyPeakResult(result): boolean`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // applyPeakResult(result: PeakGainResult): boolean { ... }
    // ```
    fn apply_peak_result(&mut self, result: PeakGainResult) -> bool {
        // What:     `if result.generation != self.peak_generation { return false; }`.
        //           Compare worker generation to the current track generation.
        // Why:      Ignore stale results without disturbing the current fallback or gain.
        // TS map:   `if (result.generation !== this.peakGeneration) return false;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (result.generation !== this.peakGeneration) return false;
        // ```
        if result.generation != self.peak_generation {
            return false;
        }
        // What:     `self.track_gain = result.gain;`. Replace fallback with measured gain.
        // Why:      Future decoded samples use exact true-peak normalization.
        // TS map:   `this.trackGain = result.gain;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.trackGain = result.gain;
        // ```
        self.track_gain = result.gain;
        // What:     `true`. Tail expression returns success.
        // Why:      Let callers know a live current-track result was applied.
        // TS map:   `return true;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return true;
        // ```
        true
    }

    // What:     `fn handle_peak_status(&mut self, status: PendingPeakStatus) -> bool`.
    //           Convert a pending measurement status into controller state updates.
    // Why:      Polling and timed waiting share the same ready/pending/closed handling.
    // TS map:   `handlePeakStatus(status): boolean`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // handlePeakStatus(status: PendingPeakStatus): boolean { ... }
    // ```
    fn handle_peak_status(&mut self, status: PendingPeakStatus) -> bool {
        // What:     `match status { ... }`. Branch on ready, still pending, or closed.
        // Why:      Each state affects `pending_peak` differently.
        // TS map:   `switch (status.kind) { ... }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // switch (status.kind) { /* ready, pending, closed */ }
        // ```
        match status {
            // What:     `PendingPeakStatus::Ready(result) => { ... }`. A worker result
            //           is available.
            // Why:      Consume the pending handle and maybe apply the gain.
            // TS map:   `case "ready": this.pendingPeak = null; return this.applyPeakResult(result);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.pendingPeak = null;
            // return this.applyPeakResult(result);
            // ```
            PendingPeakStatus::Ready(result) => {
                self.pending_peak = None;
                self.apply_peak_result(result)
            }
            // What:     `PendingPeakStatus::Pending => false`. No result yet.
            // Why:      Keep the pending handle and fallback gain unchanged.
            // TS map:   `return false;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return false;
            // ```
            PendingPeakStatus::Pending => false,
            // What:     `PendingPeakStatus::Closed => { ... }`. Worker ended without
            //           a result.
            // Why:      Stop polling, and retain the fallback gain already in place.
            // TS map:   `case "closed": this.pendingPeak = null; return false;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.pendingPeak = null;
            // return false;
            // ```
            PendingPeakStatus::Closed => {
                self.pending_peak = None;
                false
            }
        }
    }

    // What:     `pub(crate) fn poll_pending_peak(&mut self) -> bool`. Poll the
    //           current-track measurement once without blocking.
    // Why:      The engine loop calls this before pumping audio so a newly landed
    //           measurement affects the next decoded chunk.
    // TS map:   `pollPendingPeak(): boolean`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // pollPendingPeak(): boolean { ... }
    // ```
    pub(crate) fn poll_pending_peak(&mut self) -> bool {
        // What:     `let status = match self.pending_peak.as_ref() { ... }`. Borrow the
        //           optional pending handle and poll it, or return if none exists.
        // Why:      Avoid moving the receiver unless a ready or closed status tells us to
        //           clear it.
        // TS map:   `const status = this.pendingPeak?.tryResult(); if (!status) return false;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const status = this.pendingPeak?.tryResult(); if (!status) return false;
        // ```
        let status = match self.pending_peak.as_ref() {
            // What:     `Some(pending) => pending.try_result()`. Poll the receiver.
            // Why:      Check whether the worker has sent a gain.
            // TS map:   `status = pending.tryResult();`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // status = pending.tryResult();
            // ```
            Some(pending) => pending.try_result(),
            // What:     `None => return false`. No in-flight current-track measurement.
            // Why:      Nothing to apply.
            // TS map:   `return false;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return false;
            // ```
            None => return false,
        };
        // What:     `self.handle_peak_status(status)`. Apply common status handling.
        //           Tail expression returns whether a current gain was applied.
        // Why:      Share logic with the timed wait path.
        // TS map:   `return this.handlePeakStatus(status);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.handlePeakStatus(status);
        // ```
        self.handle_peak_status(status)
    }

    // What:     `pub(crate) fn wait_for_pending_peak(&mut self, timeout: Duration)`.
    //           Give an in-flight current-track measurement a bounded chance to finish.
    // Why:      Playback starts should wait briefly for exact gain, then swap to
    //           fallback instead of blocking indefinitely.
    // TS map:   `waitForPendingPeak(timeoutMs): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // waitForPendingPeak(timeoutMs: number): void { ... }
    // ```
    pub(crate) fn wait_for_pending_peak(&mut self, timeout: Duration) {
        // What:     `if self.poll_pending_peak() { return; }`. First handle any result
        //           that already landed without waiting.
        // Why:      Avoid sleeping for the full timeout on a ready channel.
        // TS map:   `if (this.pollPendingPeak()) return;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.pollPendingPeak()) return;
        // ```
        if self.poll_pending_peak() {
            return;
        }
        // What:     `let status = match self.pending_peak.as_ref() { ... }`. If still
        //           pending, wait on the receiver for the caller's bounded duration.
        // Why:      This is the one-second swap wait, with shorter values available to tests.
        // TS map:   `const status = this.pendingPeak?.waitResult(timeoutMs); if (!status) return;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const status = this.pendingPeak?.waitResult(timeoutMs); if (!status) return;
        // ```
        let status = match self.pending_peak.as_ref() {
            // What:     `Some(pending) => pending.wait_result(timeout)`. Wait for the
            //           measurement or timeout.
            // Why:      Give exact gain a short chance before fallback playback.
            // TS map:   `status = pending.waitResult(timeoutMs);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // status = pending.waitResult(timeoutMs);
            // ```
            Some(pending) => pending.wait_result(timeout),
            // What:     `None => return`. The first poll cleared the pending state.
            // Why:      Nothing left to wait for.
            // TS map:   `return;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return;
            // ```
            None => return,
        };
        // What:     `self.handle_peak_status(status);`. Apply result/timeout/closed
        //           handling and ignore the boolean here.
        // Why:      A timeout deliberately leaves fallback gain and pending state intact.
        // TS map:   `this.handlePeakStatus(status);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.handlePeakStatus(status);
        // ```
        self.handle_peak_status(status);
    }

    // What:     `pub(crate) fn wait_for_pending_peak_before_start(&mut self)`. Use the
    //           standard one-second swap window before starting playback.
    // Why:      All start paths share the same wait/fallback behavior.
    // TS map:   `waitForPendingPeakBeforeStart(): void`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // waitForPendingPeakBeforeStart(): void { this.waitForPendingPeak(1000); }
    // ```
    pub(crate) fn wait_for_pending_peak_before_start(&mut self) {
        // What:     `self.wait_for_pending_peak(peak_swap_wait());`. Call the generic
        //           wait helper with the configured one-second duration.
        // Why:      Keep the literal timeout in `peak_swap`, not scattered through controller code.
        // TS map:   `this.waitForPendingPeak(peakSwapWait());`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.waitForPendingPeak(peakSwapWait());
        // ```
        self.wait_for_pending_peak(peak_swap_wait());
    }

    // What:     `fn set_playing(&mut self, on: bool)`. Set the flag and tell the UI.
    // Why:      Keep the play/pause button in sync.
    // TS map:   `setPlaying(on) { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setPlaying(on: boolean): void { ... }
    // ```
    fn set_playing(&mut self, on: bool) {
        // What:     `if on && !self.playing { self.wait_for_pending_peak_before_start(); }`.
        //           When the caller starts playback from a paused state, run the
        //           one-second peak swap wait before audio output is marked playing.
        // Why:      CLI start, the Play button, and explicit Play commands get the
        //           wait-then-fallback behavior, while track changes that are already
        //           playing wait in `install_source` and do not wait twice.
        // TS map:   `if (on && !this.playing) this.waitForPendingPeakBeforeStart();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (on && !this.playing) this.waitForPendingPeakBeforeStart();
        // ```
        if on && !self.playing {
            self.wait_for_pending_peak_before_start();
        }
        // What:     `self.playing = on;`. Update the gate.
        // Why:      Pump respects it.
        // TS map:   `this.playing = on;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.playing = on;
        // ```
        self.playing = on;
        // What:     `if let Some(output) = self.output.as_ref() { output.set_playing(on); }`.
        //           Tell the audio output (no-op in silent mode). `.as_ref()` borrows the
        //           `Option<Output>` as `Option<&Output>`.
        // Why:      The realtime callback reacts instantly: on pause it stops draining the
        //           ring buffer and emits silence, so buffered audio does not keep playing
        //           (the pause-delay bug).
        // TS map:   `this.output?.setPlaying(on);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.output?.setPlaying(on);
        // ```
        if let Some(output) = self.output.as_ref() {
            output.set_playing(on);
        }
        // What:     `self.emit(Update::Playing(on));`. Mirror to the UI.
        // Why:      Visual state.
        // TS map:   `this.emit({ kind: "playing", on });`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.emit({ kind: "playing", on });
        // ```
        self.emit(Update::Playing(on));
    }

    // What:     `fn start_queue_measurement(&self)`. Kick off the background sweep that
    //           pre-measures every non-current track in the current queue into the
    //           shared cache. Read-only borrow (it only clones paths and the cache handle).
    // Why:      Called on every queue load so later track changes hit the cache, while
    //           the dedicated current-track measurement owns the visible track.
    // TS map:   `startQueueMeasurement(): void`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // startQueueMeasurement(): void { ... }
    // ```
    fn start_queue_measurement(&self) {
        // What:     `let current = self.queue.current_path().cloned();`. Read the
        //           current path and clone it into an owned `PathBuf` if present.
        // Why:      The background sweep must skip this path so the current-track
        //           swap worker owns it.
        // TS map:   `const current = this.queue.currentPath();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const current = this.queue.currentPath();
        // ```
        let current = self.queue.current_path().cloned();
        // What:     `let tracks = self.queue.tracks().iter().filter(...).cloned().collect();`.
        //           Iterate borrowed queue paths, keep every path that is not the current
        //           one, clone the survivors, and collect them into a `Vec<PathBuf>`.
        // Why:      Give the detached sweep owned inputs while avoiding duplicate current
        //           track measurement.
        // TS map:   `const tracks = this.queue.tracks().filter((path) => path !== current);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const tracks = this.queue.tracks().filter((path) => path !== current);
        // ```
        let tracks = self
            .queue
            .tracks()
            .iter()
            .filter(|path| current.as_ref() != Some(*path))
            .cloned()
            .collect();
        // What:     `spawn_queue_measurement(tracks, Arc::clone(&self.peaks));`.
        //           Spawn the detached sweep. `Arc::clone(&self.peaks)` makes another
        //           shared handle to the cache (same data, refcount bumped).
        // Why:      Hand the worker its own track list and shared cache.
        // TS map:   `spawnQueueMeasurement(tracks, this.peaks);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // spawnQueueMeasurement(tracks, this.peaks);
        // ```
        spawn_queue_measurement(tracks, Arc::clone(&self.peaks));
    }

    // What:     `pub(crate) fn handle_command(&mut self, command: Command)`. Apply one UI
    //           command. `pub(crate)` so `engine::run` can call it.
    // Why:      The core of UI control.
    // TS map:   `handleCommand(command: Command): void`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // handleCommand(command: Command): void { ... }
    // ```
    pub(crate) fn handle_command(&mut self, command: Command) {
        // What:     `match command { ... }`. Dispatch on the command variant (exhaustive
        //           over every `Command`).
        // Why:      Each command does a different thing.
        // TS map:   `switch (command.kind) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // switch (command.kind) { ... }
        // ```
        match command {
            // What:     `Command::OpenPaths { paths, play } => { ... }`. STRUCT-variant
            //           pattern: destructure `paths` and `play`. Replace the queue with the
            //           given files/folders, load the first track, and play it only when
            //           `play` is true.
            // Why:      Opening replaces the queue; the launch auto-load loads paused.
            // TS map:   `case "openPaths": { const { paths, play } = command; ... }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "openPaths": { const { paths, play } = command; ... }
            // ```
            Command::OpenPaths { paths, play } => {
                // What:     `let tracks = expand_paths(paths);`. Folders -> their files.
                // Why:      The queue holds files, not directories.
                // TS map:   `const tracks = expandPaths(paths);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const tracks = expandPaths(paths);
                // ```
                let tracks = expand_paths(paths);
                // What:     `self.queue.set_tracks(tracks);`. Replace the queue (consumes
                //           the owned `tracks`).
                // Why:      New playlist.
                // TS map:   `this.queue.setTracks(tracks);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.queue.setTracks(tracks);
                // ```
                self.queue.set_tracks(tracks);
                // What:     `self.emit(Update::Queue(self.queue.display_paths()));`. Send
                //           the relative-path list to the UI.
                // Why:      Render the queue list (grouped by folder / first letter).
                // TS map:   `this.emit({ kind: "queue", names: ... });`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "queue", names: this.queue.displayPaths() });
                // ```
                self.emit(Update::Queue(self.queue.display_paths()));
                // What:     `self.start_queue_measurement();`. Pre-measure the whole queue
                //           in the background (true-peak normalization cache).
                // Why:      Every queue load (open or auto-load) warms the peak cache.
                // TS map:   `this.startQueueMeasurement();`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.startQueueMeasurement();
                // ```
                self.start_queue_measurement();
                // What:     `if self.queue.current_path().is_some() { ... } else { ... }`.
                //           Load the first track if the queue is non-empty. `.is_some()` is
                //           true when the `Option` has a value.
                // Why:      Opening should make a track current.
                // TS map:   `if (this.queue.currentPath()) { ... } else { ... }`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (this.queue.currentPath()) { ... } else { ... }
                // ```
                if self.queue.current_path().is_some() {
                    // What:     `let ok = self.load_current();`. Load the current track.
                    // Why:      Make it ready to play.
                    // TS map:   `const ok = this.loadCurrent();`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // const ok = this.loadCurrent();
                    // ```
                    let ok = self.load_current();
                    // What:     `self.set_playing(play && ok);`. Play only if asked AND a
                    //           track loaded. `&&` short-circuits.
                    // Why:      `play` is true only for a `--start-playing` command-line
                    //           launch; the folder picker, auto-load, and restore pass
                    //           false, so they load paused.
                    // TS map:   `this.setPlaying(play && ok);`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // this.setPlaying(play && ok);
                    // ```
                    self.set_playing(play && ok);
                } else {
                    // What:     `self.set_playing(false);`. Empty queue -> stopped.
                    // Why:      Nothing to play.
                    // TS map:   `this.setPlaying(false);`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // this.setPlaying(false);
                    // ```
                    self.set_playing(false);
                }
            }
            // What:     `Command::TogglePlay => self.set_playing(!self.playing)`. Flip
            //           play/pause (`!` negates the current flag).
            // Why:      The play/pause button.
            // TS map:   `case "togglePlay": this.setPlaying(!this.playing);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "togglePlay": this.setPlaying(!this.playing); break;
            // ```
            Command::TogglePlay => self.set_playing(!self.playing),
            // What:     `Command::Play => self.set_playing(true)`. Explicit play.
            // Why:      Explicit play command.
            // TS map:   `case "play": this.setPlaying(true);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "play": this.setPlaying(true); break;
            // ```
            Command::Play => self.set_playing(true),
            // What:     `Command::Pause => self.set_playing(false)`. Explicit pause.
            // Why:      Explicit pause command.
            // TS map:   `case "pause": this.setPlaying(false);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "pause": this.setPlaying(false); break;
            // ```
            Command::Pause => self.set_playing(false),
            // What:     `Command::Next => { ... }`. Advance (not a natural end) and load.
            // Why:      Next button.
            // TS map:   `case "next": ...`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "next": { const moved = this.queue.advance(false); this.afterMove(moved); break; }
            // ```
            Command::Next => {
                // What:     `let moved = self.queue.advance(false);`. Step forward. `false`
                //           means "not a natural track end".
                // Why:      Decide whether to load or stop.
                // TS map:   `const moved = this.queue.advance(false);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const moved = this.queue.advance(false);
                // ```
                let moved = self.queue.advance(false);
                // What:     `self.after_move(moved);`. Load the new current or stop.
                // Why:      Shared follow-up.
                // TS map:   `this.afterMove(moved);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.afterMove(moved);
                // ```
                self.after_move(moved);
            }
            // What:     `Command::Prev => { ... }`. Step backward and load.
            // Why:      Previous button.
            // TS map:   `case "prev": ...`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "prev": { const moved = this.queue.prev(); this.afterMove(moved); break; }
            // ```
            Command::Prev => {
                // What:     `let moved = self.queue.prev();`. Step back.
                // Why:      Get the previous index, if any.
                // TS map:   `const moved = this.queue.prev();`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const moved = this.queue.prev();
                // ```
                let moved = self.queue.prev();
                // What:     `self.after_move(moved);`. Load or stop.
                // Why:      Shared follow-up.
                // TS map:   `this.afterMove(moved);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.afterMove(moved);
                // ```
                self.after_move(moved);
            }
            // What:     `Command::SelectIndex(index) => { ... }`. Tuple-variant pattern
            //           binding `index`. Make a queue slot current and load it PAUSED,
            //           without starting playback.
            // Why:      A single click selects (and pauses); only a click on the
            //           already-selected row plays it (via a follow-up `TogglePlay`).
            // TS map:   `case "selectIndex": ...`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "selectIndex": { const { index } = command; if (this.queue.playIndex(index) != null) { ... } break; }
            // ```
            Command::SelectIndex(index) => {
                // What:     `if self.queue.play_index(index).is_some() { ... }`. Act only on
                //           a valid index. (`Queue::play_index` only moves the cursor and
                //           rebuilds the page scope; it does not start audio.)
                // Why:      Ignore out-of-range clicks.
                // TS map:   `if (this.queue.playIndex(index) != null) { ... }`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (this.queue.playIndex(index) != null) { ... }
                // ```
                if self.queue.play_index(index).is_some() {
                    // What:     `self.load_current();`. Load the chosen track so its
                    //           name/duration show and its row highlights. The bool result
                    //           is unused: we pause either way.
                    // Why:      Make the track ready and current, without playing it.
                    // TS map:   `this.loadCurrent();`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // this.loadCurrent();
                    // ```
                    self.load_current();
                    // What:     `self.set_playing(false);`. Force PAUSED. If audio was
                    //           playing (this or another track), it stops here.
                    // Why:      "Single click merely selects (if currently playing, set to
                    //           paused)" — selecting never auto-plays.
                    // TS map:   `this.setPlaying(false);`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // this.setPlaying(false);
                    // ```
                    self.set_playing(false);
                }
            }
            // What:     `Command::Seek(secs) => self.seek(secs)`. Tuple-variant binding
            //           `secs`; jump within the track.
            // Why:      Seek bar drag.
            // TS map:   `case "seek": this.seek(secs);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "seek": this.seek(command.secs); break;
            // ```
            Command::Seek(secs) => self.seek(secs),
            // What:     `Command::SetVolume(v) => { ... }`. Update the gain and mirror it.
            // Why:      Volume slider.
            // TS map:   `case "setVolume": ...`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "setVolume": { this.volume = command.volume; this.emit({ kind: "volume", v: command.volume }); break; }
            // ```
            Command::SetVolume(v) => {
                // What:     `self.volume = v;`. Store the new gain.
                // Why:      Applied to subsequently decoded samples.
                // TS map:   `this.volume = v;`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.volume = v;
                // ```
                self.volume = v;
                // What:     `self.emit(Update::Volume(v));`. Mirror to the UI.
                // Why:      Keep the slider in sync.
                // TS map:   `this.emit({ kind: "volume", v });`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "volume", v });
                // ```
                self.emit(Update::Volume(v));
            }
            // What:     `Command::SetShuffle(mode) => { ... }`. Set the shuffle mode.
            // Why:      Shuffle radio group.
            // TS map:   `case "setShuffle": ...`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "setShuffle": { this.queue.setShuffle(command.mode); this.emit({ kind: "shuffle", mode: command.mode }); break; }
            // ```
            Command::SetShuffle(mode) => {
                // What:     `self.queue.set_shuffle(mode);`. Rebuild the playback
                //           scope/order for the new mode, keeping the current track.
                // Why:      Apply the shuffle mode (off / within-page / all).
                // TS map:   `this.queue.setShuffle(mode);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.queue.setShuffle(mode);
                // ```
                self.queue.set_shuffle(mode);
                // What:     `self.emit(Update::Shuffle(mode));`. Mirror state. `mode` is
                //           `Copy`, so using it twice is fine.
                // Why:      Radio-group visual.
                // TS map:   `this.emit({ kind: "shuffle", mode });`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "shuffle", mode });
                // ```
                self.emit(Update::Shuffle(mode));
            }
            // What:     `Command::SetRepeatTrack(on) => { ... }`. Toggle "repeat track".
            // Why:      Repeat-track checkbox.
            // TS map:   `case "setRepeatTrack": ...`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "setRepeatTrack": { this.queue.setRepeatTrack(command.on); this.emit({ kind: "repeatTrack", on: command.on }); break; }
            // ```
            Command::SetRepeatTrack(on) => {
                // What:     `self.queue.set_repeat_track(on);`. Apply it.
                // Why:      Affects natural-end behaviour (replay current track).
                // TS map:   `this.queue.setRepeatTrack(on);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.queue.setRepeatTrack(on);
                // ```
                self.queue.set_repeat_track(on);
                // What:     `self.emit(Update::RepeatTrack(on));`. Mirror state.
                // Why:      Checkbox visual.
                // TS map:   `this.emit({ kind: "repeatTrack", on });`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "repeatTrack", on });
                // ```
                self.emit(Update::RepeatTrack(on));
            }
            // What:     `Command::Restore { tracks, current, position, volume, shuffle, repeat_track } => { ... }`.
            //           STRUCT-variant pattern destructuring all six saved fields. Reinstate
            //           a saved session, loading the current track PAUSED at the saved
            //           position.
            // Why:      Resume where the user left off, on launch.
            // TS map:   `case "restore": { const { tracks, current, ... } = command; ... }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "restore": { const { tracks, current, position, volume, shuffle, repeatTrack } = command; ... }
            // ```
            Command::Restore {
                tracks,
                current,
                position,
                volume,
                shuffle,
                repeat_track,
            } => {
                // What:     `self.volume = volume;`. Restore the saved gain.
                // Why:      Applied to decoded samples.
                // TS map:   `this.volume = volume;`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.volume = volume;
                // ```
                self.volume = volume;
                // What:     `self.queue.set_repeat_track(repeat_track);`. Restore the
                //           "repeat track" flag.
                // Why:      Affects auto-advance (replay current on natural end).
                // TS map:   `this.queue.setRepeatTrack(repeatTrack);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.queue.setRepeatTrack(repeatTrack);
                // ```
                self.queue.set_repeat_track(repeat_track);
                // What:     `self.queue.set_tracks(tracks);`. Rebuild the queue.
                // Why:      Restore the playlist.
                // TS map:   `this.queue.setTracks(tracks);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.queue.setTracks(tracks);
                // ```
                self.queue.set_tracks(tracks);
                // What:     `self.queue.set_shuffle(shuffle);`. Restore shuffle ordering.
                // Why:      Restore shuffle state.
                // TS map:   `this.queue.setShuffle(shuffle);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.queue.setShuffle(shuffle);
                // ```
                self.queue.set_shuffle(shuffle);
                // What:     `if let Some(idx) = current { self.queue.play_index(idx); }`.
                //           Move the cursor to the saved current track, if any.
                // Why:      Resume on the right track before spawning the background
                //           sweep, so the sweep skips the actual current track.
                // TS map:   `if (current != null) this.queue.playIndex(current);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (current != null) this.queue.playIndex(current);
                // ```
                if let Some(idx) = current {
                    self.queue.play_index(idx);
                }
                // What:     `self.start_queue_measurement();`. Pre-measure the restored
                //           queue in the background, like any other queue load.
                // Why:      Warm the peak cache for restored tracks while leaving the
                //           current track to its dedicated swap measurement.
                // TS map:   `this.startQueueMeasurement();`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.startQueueMeasurement();
                // ```
                self.start_queue_measurement();
                // What:     `self.emit(Update::Queue(self.queue.display_paths()));`. Push the
                //           relative-path list to the UI.
                // Why:      Render the restored queue (grouped by folder / first letter).
                // TS map:   `this.emit({ kind: "queue", names: ... });`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "queue", names: this.queue.displayPaths() });
                // ```
                self.emit(Update::Queue(self.queue.display_paths()));
                // What:     `self.emit(Update::Volume(volume));`. Mirror volume.
                // Why:      Sync the slider.
                // TS map:   `this.emit({ kind: "volume", volume });`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "volume", volume });
                // ```
                self.emit(Update::Volume(volume));
                // What:     `self.emit(Update::Shuffle(self.queue.shuffle_mode()));`. Mirror
                //           the shuffle mode.
                // Why:      Sync the radio group.
                // TS map:   `this.emit({ kind: "shuffle", mode: ... });`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "shuffle", mode: this.queue.shuffleMode() });
                // ```
                self.emit(Update::Shuffle(self.queue.shuffle_mode()));
                // What:     `self.emit(Update::RepeatTrack(self.queue.repeat_track()));`.
                //           Mirror the "repeat track" flag.
                // Why:      Sync the checkbox.
                // TS map:   `this.emit({ kind: "repeatTrack", on: ... });`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "repeatTrack", on: this.queue.repeatTrack() });
                // ```
                self.emit(Update::RepeatTrack(self.queue.repeat_track()));
                // What:     `self.playing = false;`. Restore PAUSED.
                // Why:      Resuming should not blast audio on launch.
                // TS map:   `this.playing = false;`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.playing = false;
                // ```
                self.playing = false;
                // What:     `let loaded = self.load_current();`. Load the current track.
                // Why:      Make it ready to play from the saved position.
                // TS map:   `const loaded = this.loadCurrent();`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const loaded = this.loadCurrent();
                // ```
                let loaded = self.load_current();
                // What:     `self.emit(Update::Playing(false));`. Mirror paused state.
                // Why:      Show the Play button.
                // TS map:   `this.emit({ kind: "playing", on: false });`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "playing", on: false });
                // ```
                self.emit(Update::Playing(false));
                // What:     `if loaded && position > 0.0 { self.seek(position); }`. Jump to
                //           the saved position if a track loaded. `&&` short-circuits.
                // Why:      Resume mid-track.
                // TS map:   `if (loaded && position > 0) this.seek(position);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (loaded && position > 0) this.seek(position);
                // ```
                if loaded && position > 0.0 {
                    self.seek(position);
                }
            }
            // What:     `Command::Quit => {}`. Empty arm: handled in `run`'s drain loop;
            //           this keeps the match exhaustive.
            // Why:      Rust requires every variant to be matched.
            // TS map:   `case "quit": break; // handled elsewhere`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "quit": break; // handled in run()'s drain loop
            // ```
            Command::Quit => {}
        }
    }

    // What:     `pub(crate) fn after_move(&mut self, moved: Option<usize>)`. Shared
    //           follow-up for Next/Prev/natural-end: load the new current track, or stop at
    //           the end. `pub(crate)` so `on_track_end` (in `controller_audio.rs`) can call
    //           it.
    // Why:      Avoid duplicating the load-or-stop logic.
    // TS map:   `afterMove(moved: number | null): void`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // afterMove(moved: number | null): void { ... }
    // ```
    pub(crate) fn after_move(&mut self, moved: Option<usize>) {
        // What:     `match moved { ... }`. `Some` = a track to load; `None` = end.
        // Why:      Two outcomes.
        // TS map:   `if (moved != null) { ... } else { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (moved != null) { ... } else { ... }
        // ```
        match moved {
            // What:     `Some(_) => { if !self.load_current() { self.set_playing(false); } }`.
            //           Load it; stop if loading failed. `_` ignores the index.
            // Why:      Keep the current playing state when a track loads.
            // TS map:   `if (!this.loadCurrent()) this.setPlaying(false);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (!this.loadCurrent()) this.setPlaying(false);
            // ```
            Some(_) => {
                if !self.load_current() {
                    self.set_playing(false);
                }
            }
            // What:     `None => self.set_playing(false)`. End of queue: stop.
            // Why:      Nothing more to play.
            // TS map:   `else this.setPlaying(false);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // else this.setPlaying(false);
            // ```
            None => self.set_playing(false),
        }
    }
}

// What:     `#[cfg(test)] #[path = "controller_tests.rs"] mod tests;` declares a
//           test-only child module loaded from the sibling file.
// Why:      Keep controller peak-swap tests beside the controller without adding
//           production code.
// TS map:   a colocated `controller.unit.test.ts` file.
//
// In TS you'd write (pseudocode):
// ```ts
// // test runner imports controller.unit.test.ts only for tests
// ```
#[cfg(test)]
#[path = "controller_tests.rs"]
mod tests;
