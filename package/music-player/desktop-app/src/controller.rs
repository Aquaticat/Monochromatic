//! Controller: all mutable playback state, owned by the engine worker thread.
//! It holds the queue, the active decoder, the audio output, the shared true-peak
//! cache, and the current-track peak swap state. This file has the state struct,
//! command handling, and the background-measurement kickoff; the loading and
//! audio-pumping methods live in `controller_audio.rs` (a second `impl Controller`
//! block, kept separate so each file stays within the line budget). The type
//! stays crate-private because it holds the `!Send` `Output` and never leaves its
//! thread.

/// What:     `use std::path::{Path, PathBuf};`. `Path` is the borrowed filesystem-path
///           view; `PathBuf` is the owned path buffer.
/// Why:      `prepare_peak_for_path` borrows the current track path, and the controller
///           now also OWNS the current Source Root path in a field.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Path = string;
/// ```
use std::path::{Path, PathBuf};

/// What:     `use std::thread;`. Rust's standard OS-thread API.
/// Why:      `prepare_peak_for_path` passes the current engine thread handle to the
///           measurement worker so completion can wake the engine immediately.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const currentWorker = Worker.current;
/// ```
use std::thread;

/// What:     `use std::time::Duration;`. A monotonic span of time.
/// Why:      Unit tests and the start path pass explicit wait windows to the peak
///           swap helper.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Duration = number;
/// ```
use std::time::Duration;

/// What:     `use ringbuf::HeapProd;`. The WRITE half of a heap ring buffer.
/// Why:      The `producer` field type.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type HeapProd = RingProducer;
/// ```
use ringbuf::HeapProd;

/// What:     `use crate::command::{Command, Update};`. The UI->engine and engine->UI
///           message enums.
/// Why:      We match `Command`s and emit `Update`s.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Command, Update } from "./command";
/// ```
use crate::command::{Command, Update};

/// What:     `use crate::watch::SourceWatcher;`. The Source Root file watcher type.
/// Why:      The controller owns one and re-points it whenever the Source Root changes.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { SourceWatcher } from "./watch";
/// ```
use crate::watch::SourceWatcher;

/// What:     `use crate::decode::{AudioSpec, Source};`. `AudioSpec` describes a decoded
///           stream; `Source` is the decoder trait (a `Box<dyn Source>` field).
/// Why:      Struct fields name both types.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { AudioSpec, Source } from "./decode";
/// ```
use crate::decode::{AudioSpec, Source};

/// What:     `use crate::measure::spawn_queue_measurement;`. Starts the background sweep
///           that pre-measures a queue's tracks.
/// Why:      Called on every queue load.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { spawnQueueMeasurement } from "./measure";
/// ```
use crate::measure::spawn_queue_measurement;

/// What:     `use crate::output::Output;`. The PipeWire output (FFI boundary).
/// Why:      The `output` field and `new`'s parameter name it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Output } from "./output";
/// ```
use crate::output::Output;

/// What:     `use crate::peakcache::CacheHandle;`. The synchronous handle to the
///           persistent true-peak cache actor.
/// Why:      The `peaks` field's type.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { CacheHandle } from "./peakcache";
/// ```
use crate::peakcache::CacheHandle;

/// What:     `use crate::peak_swap::{...};`. Import the current-track peak swap
///           helper functions and state/result enums.
/// Why:      The controller owns pending current-track measurements and applies
///           measured gains when they arrive.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { fallbackTrackGain, peakSwapWait, prepareTrackGain } from "./peak_swap";
/// ```
use crate::peak_swap::{
    fallback_track_gain, peak_swap_wait, prepare_track_gain, PeakGainResult,
    PendingPeakMeasurement, PendingPeakStatus, TrackGainResolution,
};

/// What:     `use crate::playback::expand_paths;`. Folder-to-file expansion.
/// Why:      `OpenPaths` expands folders into their tracks.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { expandPaths } from "./playback";
/// ```
use crate::playback::expand_paths;

/// What:     `use crate::queue::Queue;`. The pure play-queue model.
/// Why:      The `queue` field and `Queue::new()` name it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Queue } from "./queue";
/// ```
use crate::queue::Queue;

/// What:     `pub(crate) struct Controller { ... }`. All mutable playback state, owned by
///           the worker thread. Not `Send` (holds the `!Send` `Output`), which is fine
///           because it never leaves this thread. `pub(crate)` so `engine::run` can drive
///           it. Fields are `pub(crate)` too so the second `impl` block in
///           `controller_audio.rs` can reach them.
/// Why:      Bundle the state so methods can mutate it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Controller { onUpdate; output; queue; source; producer; spec; playing; volume; trackGain; peakGeneration; pendingPeak; peaks; positionFrames; lastEmitSecs; pending; pendingPos; }
/// ```
pub(crate) struct Controller {
    /// What:     `on_update: Box<dyn Fn(Update) + Send>`. The UI callback (a heap-boxed
    ///           trait object).
    /// Why:      Push state changes back to the UI.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// onUpdate: (u: Update) => void;
    /// ```
    pub(crate) on_update: Box<dyn Fn(Update) + Send>,
    /// What:     `output: Option<Output>`. The PipeWire output, or `None` in silent mode.
    /// Why:      Reconfigured per track; absent if audio init failed.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// output: Output | null;
    /// ```
    pub(crate) output: Option<Output>,
    /// What:     `queue: Queue`. The play-queue model.
    /// Why:      Decides track order and current track.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// queue: Queue;
    /// ```
    pub(crate) queue: Queue,
    /// What:     `source_root: Option<PathBuf>`. The directory the current queue was scanned
    ///           from (`Some`), or `None` before anything is loaded.
    /// Why:      The session persists this, the watcher watches it, and a rescan re-derives
    ///           the queue from it. The queue holds files; this holds the one directory they
    ///           came from, which `expand_paths` otherwise discards.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// sourceRoot: string | null;
    /// ```
    pub(crate) source_root: Option<PathBuf>,
    /// What:     `watcher: Option<SourceWatcher>`. The Source Root file watcher (`Some` in the
    ///           running app, `None` in unit tests and if the OS watcher failed to start).
    /// Why:      Re-pointed at the current root on open/restore so on-disk changes drive a
    ///           `Rescan`; `None` simply means no live updates.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// watcher: SourceWatcher | null;
    /// ```
    pub(crate) watcher: Option<SourceWatcher>,
    /// What:     `source: Option<Box<dyn Source>>`. The active decoder, or `None`.
    /// Why:      Produces the PCM we push.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// source: Source | null;
    /// ```
    pub(crate) source: Option<Box<dyn Source>>,
    /// What:     `producer: Option<HeapProd<f32>>`. The ring-buffer write end, or `None`.
    /// Why:      Where decoded samples go.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// producer: RingProducer | null;
    /// ```
    pub(crate) producer: Option<HeapProd<f32>>,
    /// What:     `spec: Option<AudioSpec>`. The current track's rate/channels/duration.
    /// Why:      Drives position math and reconfigure calls.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// spec: AudioSpec | null;
    /// ```
    pub(crate) spec: Option<AudioSpec>,
    /// What:     `playing: bool`. Whether we are actively feeding audio.
    /// Why:      Pause/play gate.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// playing: boolean;
    /// ```
    pub(crate) playing: bool,
    /// What:     `volume: f32`. Linear user gain 0.0..=1.0 applied to samples.
    /// Why:      Volume control (PCM-gain approach).
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// volume: number;
    /// ```
    pub(crate) volume: f32,
    /// What:     `track_gain: f32`. The current track's normalization gain (<=1.0), from
    ///           true-peak measurement. Multiplied with `volume` per sample.
    /// Why:      Per-track true-peak normalization to the -1 dBTP ceiling.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// trackGain: number;
    /// ```
    pub(crate) track_gain: f32,
    /// What:     `peak_generation: u64`. Monotonic identifier for each loaded
    ///           current track. `u64` is used instead of `usize` so the value is
    ///           independent of platform pointer width.
    /// Why:      Stale async peak results from older tracks must not change the
    ///           current track's gain.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// peakGeneration: number;
    /// ```
    pub(crate) peak_generation: u64,
    /// What:     `pending_peak: Option<PendingPeakMeasurement>`. Optional handle to
    ///           the in-flight current-track measurement.
    /// Why:      Cache misses need to be polled later, while cache hits have no
    ///           pending work.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// pendingPeak: PendingPeakMeasurement | null;
    /// ```
    pub(crate) pending_peak: Option<PendingPeakMeasurement>,
    /// What:     `peaks: CacheHandle`. The synchronous handle to the persistent true-peak
    ///           cache actor.
    /// Why:      Read on track load; written by the current-track worker + background sweeps.
    ///           No `Mutex`: the actor owns the only mutable cache state.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// peaks: CacheHandle;
    /// ```
    pub(crate) peaks: CacheHandle,
    /// What:     `position_frames: u64`. Frames pushed for the current track so far. `u64`
    ///           because long tracks exceed `u32` frame counts.
    /// Why:      Position seconds = frames / rate.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// positionFrames: number;
    /// ```
    pub(crate) position_frames: u64,
    /// What:     `last_emit_secs: f64`. Position (seconds) at the last `Position` update.
    /// Why:      Throttle update frequency.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// lastEmitSecs: number;
    /// ```
    pub(crate) last_emit_secs: f64,
    /// What:     `pending: Vec<f32>`. Gained samples decoded but not yet fully pushed.
    /// Why:      Resume pushing them next cycle instead of dropping audio.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// pending: number[];
    /// ```
    pub(crate) pending: Vec<f32>,
    /// What:     `pending_pos: usize`. How many of `pending` are already pushed.
    /// Why:      Push the remainder `pending[pending_pos..]` next time.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// pendingPos: number;
    /// ```
    pub(crate) pending_pos: usize,
}

/// What:     `impl Controller { ... }`. The command/state half of the behaviour.
/// Why:      Construction, command handling, and the measurement kickoff.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Controller { /* new, emit, set_playing, start_queue_measurement, handle_command, after_move */ }
/// ```
impl Controller {
    /// What:     `pub(crate) fn new(on_update: Box<dyn Fn(Update) + Send>, output: Option<Output>, peaks: CacheHandle) -> Controller`.
    ///           Build initial state (empty queue, nothing playing, full volume + gain) around
    ///           an INJECTED cache handle. `pub(crate)` so `engine::run` can construct it.
    /// Why:      Starting point for the worker. The cache is injected (not opened here) so
    ///           production passes `CacheHandle::open()` while tests pass a throwaway or
    ///           degraded handle and never touch the real config dir.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// constructor(onUpdate, output, peaks) { ... }
    /// ```
    pub(crate) fn new(
        on_update: Box<dyn Fn(Update) + Send>,
        output: Option<Output>,
        peaks: CacheHandle,
    ) -> Controller {
        // What:     `Controller { ... }`. Struct literal. `Queue::new()` empty queue;
        //           volume/gain start at 1.0; `peaks` is the injected cache handle (field
        //           shorthand). Tail -> return.
        // Why:      A clean idle state with the cache ready.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { onUpdate, output, queue: new Queue(), source: null, producer: null,
        //          spec: null, playing: false, volume: 1, trackGain: 1, peaks,
        //          positionFrames: 0, lastEmitSecs: 0, pending: [], pendingPos: 0 };
        // ```
        Controller {
            on_update,
            output,
            queue: Queue::new(),
            source_root: None,
            watcher: None,
            source: None,
            producer: None,
            spec: None,
            playing: false,
            volume: 1.0,
            track_gain: 1.0,
            peak_generation: 0,
            pending_peak: None,
            peaks,
            position_frames: 0,
            last_emit_secs: 0.0,
            pending: Vec::new(),
            pending_pos: 0,
        }
    }

    /// What:     `pub(crate) fn emit(&self, update: Update)`. Call the UI callback.
    ///           `pub(crate)` because `controller_audio.rs` also emits.
    /// Why:      One place to push updates out.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// emit(update) { this.onUpdate(update); }
    /// ```
    pub(crate) fn emit(&self, update: Update) {
        // What:     `(self.on_update)(update);`. Call the boxed closure. The parens make it
        //           call the field, not a method.
        // Why:      Deliver the update to the UI.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.onUpdate(update);
        // ```
        (self.on_update)(update);
    }

    /// What:     `pub(crate) fn prepare_peak_for_path(&mut self, path: &Path)`. Start
    ///           or resolve peak gain for a newly loaded current track.
    /// Why:      Loading a track must never synchronously decode the whole file on a
    ///           cache miss; it sets fallback gain and stores a pending measurement instead.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// preparePeakForPath(path: string): void { ... }
    /// ```
    pub(crate) fn prepare_peak_for_path(&mut self, path: &Path) {
        // What:     `self.peak_generation = self.peak_generation.wrapping_add(1);`.
        //           Increment the generation with explicit wrap semantics.
        // Why:      Every loaded track gets a different id; wrapping is practically
        //           unreachable but avoids a debug-build overflow panic.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.peakGeneration += 1;
        // ```
        self.peak_generation = self.peak_generation.wrapping_add(1);
        // What:     `let generation = self.peak_generation;`. Copy the current id.
        // Why:      Pass a stable generation into the worker spawn call.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const generation = this.peakGeneration;
        // ```
        let generation = self.peak_generation;
        // What:     `match prepare_track_gain(path, &self.peaks, generation, thread::current()) { ... }`.
        //           Ask the peak-swap module for cache-hit gain or an async pending handle.
        // Why:      Centralize cache lookup and worker spawning.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // switch (prepareTrackGain(path, this.peaks, generation, currentWorker).kind) { /* ready or pending */ }
        // ```
        match prepare_track_gain(path, &self.peaks, generation, thread::current()) {
            // What:     `TrackGainResolution::Ready(gain) => { ... }`. Cache hit.
            // Why:      Apply the measured gain immediately and clear any old pending handle.
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

    /// What:     `fn apply_peak_result(&mut self, result: PeakGainResult) -> bool`.
    ///           Apply a measured gain only when its generation matches the current track.
    /// Why:      Old measurement workers may finish after the user changes tracks; their
    ///           cache writes are useful, but their playback result is stale.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// applyPeakResult(result: PeakGainResult): boolean { ... }
    /// ```
    fn apply_peak_result(&mut self, result: PeakGainResult) -> bool {
        // What:     `if result.generation != self.peak_generation { return false; }`.
        //           Compare worker generation to the current track generation.
        // Why:      Ignore stale results without disturbing the current fallback or gain.
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
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.trackGain = result.gain;
        // ```
        self.track_gain = result.gain;
        // What:     `true`. Tail expression returns success.
        // Why:      Let callers know a live current-track result was applied.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return true;
        // ```
        true
    }

    /// What:     `fn handle_peak_status(&mut self, status: PendingPeakStatus) -> bool`.
    ///           Convert a pending measurement status into controller state updates.
    /// Why:      Polling and timed waiting share the same ready/pending/closed handling.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// handlePeakStatus(status: PendingPeakStatus): boolean { ... }
    /// ```
    fn handle_peak_status(&mut self, status: PendingPeakStatus) -> bool {
        // What:     `match status { ... }`. Branch on ready, still pending, or closed.
        // Why:      Each state affects `pending_peak` differently.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // switch (status.kind) { /* ready, pending, closed */ }
        // ```
        match status {
            // What:     `PendingPeakStatus::Ready(result) => { ... }`. A worker result
            //           is available.
            // Why:      Consume the pending handle and maybe apply the gain.
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
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return false;
            // ```
            PendingPeakStatus::Pending => false,
            // What:     `PendingPeakStatus::Closed => { ... }`. Worker ended without
            //           a result.
            // Why:      Stop polling, and retain the fallback gain already in place.
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

    /// What:     `pub(crate) fn poll_pending_peak(&mut self) -> bool`. Poll the
    ///           current-track measurement once without blocking.
    /// Why:      The engine loop calls this before pumping audio so a newly landed
    ///           measurement affects the next decoded chunk.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// pollPendingPeak(): boolean { ... }
    /// ```
    pub(crate) fn poll_pending_peak(&mut self) -> bool {
        // What:     `let status = match self.pending_peak.as_ref() { ... }`. Borrow the
        //           optional pending handle and poll it, or return if none exists.
        // Why:      Avoid moving the receiver unless a ready or closed status tells us to
        //           clear it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const status = this.pendingPeak?.tryResult(); if (!status) return false;
        // ```
        let status = match self.pending_peak.as_ref() {
            // What:     `Some(pending) => pending.try_result()`. Poll the receiver.
            // Why:      Check whether the worker has sent a gain.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // status = pending.tryResult();
            // ```
            Some(pending) => pending.try_result(),
            // What:     `None => return false`. No in-flight current-track measurement.
            // Why:      Nothing to apply.
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
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.handlePeakStatus(status);
        // ```
        self.handle_peak_status(status)
    }

    /// What:     `pub(crate) fn wait_for_pending_peak(&mut self, timeout: Duration)`.
    ///           Give an in-flight current-track measurement a bounded chance to finish.
    /// Why:      Playback starts should wait briefly for exact gain, then swap to
    ///           fallback instead of blocking indefinitely.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// waitForPendingPeak(timeoutMs: number): void { ... }
    /// ```
    pub(crate) fn wait_for_pending_peak(&mut self, timeout: Duration) {
        // What:     `if self.poll_pending_peak() { return; }`. First handle any result
        //           that already landed without waiting.
        // Why:      Avoid sleeping for the full timeout on a ready channel.
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
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const status = this.pendingPeak?.waitResult(timeoutMs); if (!status) return;
        // ```
        let status = match self.pending_peak.as_ref() {
            // What:     `Some(pending) => pending.wait_result(timeout)`. Wait for the
            //           measurement or timeout.
            // Why:      Give exact gain a short chance before fallback playback.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // status = pending.waitResult(timeoutMs);
            // ```
            Some(pending) => pending.wait_result(timeout),
            // What:     `None => return`. The first poll cleared the pending state.
            // Why:      Nothing left to wait for.
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
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.handlePeakStatus(status);
        // ```
        self.handle_peak_status(status);
    }

    /// What:     `pub(crate) fn wait_for_pending_peak_before_start(&mut self)`. Use the
    ///           standard one-second swap window before starting playback.
    /// Why:      All start paths share the same wait/fallback behavior.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// waitForPendingPeakBeforeStart(): void { this.waitForPendingPeak(1000); }
    /// ```
    pub(crate) fn wait_for_pending_peak_before_start(&mut self) {
        // What:     `self.wait_for_pending_peak(peak_swap_wait());`. Call the generic
        //           wait helper with the configured one-second duration.
        // Why:      Keep the literal timeout in `peak_swap`, not scattered through controller code.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.waitForPendingPeak(peakSwapWait());
        // ```
        self.wait_for_pending_peak(peak_swap_wait());
    }

    /// What:     `fn set_playing(&mut self, on: bool)`. Set the flag and tell the UI.
    /// Why:      Keep the play/pause button in sync.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// setPlaying(on: boolean): void { ... }
    /// ```
    fn set_playing(&mut self, on: bool) {
        // What:     `if on && !self.playing { self.wait_for_pending_peak_before_start(); }`.
        //           When the caller starts playback from a paused state, run the
        //           one-second peak swap wait before audio output is marked playing.
        // Why:      CLI start, the Play button, and explicit Play commands get the
        //           wait-then-fallback behavior, while track changes that are already
        //           playing wait in `install_source` and do not wait twice.
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
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.emit({ kind: "playing", on });
        // ```
        self.emit(Update::Playing(on));
    }

    /// What:     `fn emit_no_track(&self)`. Tell the UI that NOTHING is current: a cleared
    ///           now-playing label and a reset seek bar. `&self` is a SHARED (read-only) borrow
    ///           (we only send messages, never mutate state here).
    /// Why:      The desktop's `current-index` and `track-name` UI properties change ONLY via a
    ///           `NowPlaying` emit, so clearing the queue cursor is not enough; we must also
    ///           push the "nothing playing" view on a normal open or a no-selection restore.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// emitNoTrack(): void {
    ///   this.emit({ kind: "nowPlaying", index: null, name: "", duration: 0 });
    ///   this.emit({ kind: "position", secs: 0 });
    /// }
    /// ```
    fn emit_no_track(&self) {
        // What:     `self.emit(Update::NowPlaying { index: None, name: String::new(), duration: 0.0 });`.
        //           Struct-variant literal: `index: None` is the absent `Option<usize>` (the UI
        //           maps it to its -1 "no highlight" sentinel); `String::new()` builds a fresh
        //           empty OWNED `String` (sibling: a borrowed `&str`; the field is owned); and
        //           `0.0` is an `f64` zero duration.
        // Why:      Blank the now-playing label (the window title then falls back to "Music
        //           Player") and drop any row highlight.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.emit({ kind: "nowPlaying", index: null, name: "", duration: 0 });
        // ```
        self.emit(Update::NowPlaying {
            index: None,
            name: String::new(),
            duration: 0.0,
        });
        // What:     `self.emit(Update::Position(0.0));`. Tuple-variant carrying an `f64` `0.0`.
        // Why:      Snap the seek bar to the start so no stale position lingers.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.emit({ kind: "position", secs: 0 });
        // ```
        self.emit(Update::Position(0.0));
    }

    /// What:     `fn start_queue_measurement(&self)`. Kick off the background sweep that
    ///           pre-measures every non-current track in the current queue into the
    ///           shared cache. Read-only borrow (it only clones paths and the cache handle).
    /// Why:      Called on every queue load so later track changes hit the cache, while
    ///           the dedicated current-track measurement owns the visible track.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// startQueueMeasurement(): void { ... }
    /// ```
    fn start_queue_measurement(&self) {
        // What:     `let current = self.queue.current_path().cloned();`. Read the
        //           current path and clone it into an owned `PathBuf` if present.
        // Why:      The background sweep must skip this path so the current-track
        //           swap worker owns it.
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
        // What:     `spawn_queue_measurement(tracks, self.peaks.clone());`. Spawn the
        //           detached sweep. `self.peaks.clone()` copies the cache handle's channel
        //           senders (cheap; same actor).
        // Why:      Hand the sweep its own track list and a handle to the shared cache.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // spawnQueueMeasurement(tracks, this.peaks);
        // ```
        spawn_queue_measurement(tracks, self.peaks.clone());
    }

    /// What:     `pub(crate) fn handle_command(&mut self, command: Command)`. Apply one UI
    ///           command. `pub(crate)` so `engine::run` can call it.
    /// Why:      The core of UI control.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// handleCommand(command: Command): void { ... }
    /// ```
    pub(crate) fn handle_command(&mut self, command: Command) {
        // What:     `match command { ... }`. Dispatch on the command variant (exhaustive
        //           over every `Command`).
        // Why:      Each command does a different thing.
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
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "openPaths": { const { paths, play } = command; ... }
            // ```
            Command::OpenRoot { root, select, play } => {
                // What:     `self.scan_root_into_queue(root);`. Remember `root` as the Source
                //           Root, re-point the watcher at it, and rebuild the queue by scanning
                //           it (defined in `controller_audio.rs`). Consumes the owned `root`.
                // Why:      Opening a folder replaces the queue with the scan of that root; this
                //           shared projection lives in one place so Restore stays identical.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.scanRootIntoQueue(root);
                // ```
                self.scan_root_into_queue(root);
                // What:     `self.emit(Update::Queue(self.queue.display_paths()));`. Send
                //           the relative-path list to the UI.
                // Why:      Render the queue list (grouped by folder / first letter).
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "queue", names: this.queue.displayPaths() });
                // ```
                self.emit(Update::Queue(self.queue.display_paths()));
                // What:     `self.start_queue_measurement();`. Pre-measure the whole queue
                //           in the background (true-peak normalization cache).
                // Why:      Every queue load (open or auto-load) warms the peak cache.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.startQueueMeasurement();
                // ```
                self.start_queue_measurement();
                // What:     `match select { Some(sel) => ..., None => ... }`. A single-file
                //           launch carries `Some(file)` to preselect; a folder open or
                //           auto-load carries `None`.
                // Why:      Preselect the named file inside its folder, else fall back to the
                //           normal open behavior (select nothing unless `--start-playing`).
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (select) { /* preselect */ } else { /* normal open */ }
                // ```
                match select {
                    // What:     `Some(sel) => { ... }`. Find `sel` in the scanned queue and
                    //           select it; `position(|p| *p == sel)` returns the matching index
                    //           or `None`.
                    // Why:      Cue the file the launch named, loaded paused unless `play`.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // const idx = tracks.indexOf(sel);
                    // ```
                    Some(sel) => match self.queue.tracks().iter().position(|p| *p == sel) {
                        // What:     `Some(idx) => { ... }`. The file is in the scan: select,
                        //           load, and play only when `play` AND the load succeeded.
                        // Why:      A preselected file is cued; `--start-playing` plays it.
                        //
                        // In TS you'd write (pseudocode):
                        // ```ts
                        // this.queue.playIndex(idx); const ok = this.loadCurrent(); this.setPlaying(play && ok);
                        // ```
                        Some(idx) => {
                            self.queue.play_index(idx);
                            let ok = self.load_current();
                            self.set_playing(play && ok);
                        }
                        // What:     `None => { ... }`. The named file is not in the scan (e.g.
                        //           it vanished): open with nothing selected, paused.
                        // Why:      Match the "selected track missing" rule: clear the cue.
                        //
                        // In TS you'd write (pseudocode):
                        // ```ts
                        // this.queue.clearSelection(); this.emitNoTrack(); this.setPlaying(false);
                        // ```
                        None => {
                            self.queue.clear_selection();
                            self.emit_no_track();
                            self.set_playing(false);
                        }
                    },
                    // What:     `None => { ... }`. No preselect. Only a `--start-playing`
                    //           launch with a non-empty queue auto-plays the anchored first
                    //           track; every other open selects and loads NOTHING.
                    // Why:      A normal open must not auto-select or blast audio.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // if (play && this.queue.currentPath()) { ... } else { ... }
                    // ```
                    None => {
                        if play && self.queue.current_path().is_some() {
                            let ok = self.load_current();
                            self.set_playing(ok);
                        } else {
                            self.queue.clear_selection();
                            self.emit_no_track();
                            self.set_playing(false);
                        }
                    }
                }
            }
            // What:     `Command::TogglePlay => self.set_playing(!self.playing)`. Flip
            //           play/pause (`!` negates the current flag).
            // Why:      The play/pause button.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "togglePlay": this.setPlaying(!this.playing); break;
            // ```
            Command::TogglePlay => self.set_playing(!self.playing),
            // What:     `Command::Play => self.set_playing(true)`. Explicit play.
            // Why:      Explicit play command.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "play": this.setPlaying(true); break;
            // ```
            Command::Play => self.set_playing(true),
            // What:     `Command::Pause => self.set_playing(false)`. Explicit pause.
            // Why:      Explicit pause command.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "pause": this.setPlaying(false); break;
            // ```
            Command::Pause => self.set_playing(false),
            // What:     `Command::Next => { ... }`. Advance (not a natural end) and load.
            // Why:      Next button.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "next": { const moved = this.queue.advance(false); this.afterMove(moved); break; }
            // ```
            Command::Next => {
                // What:     `let moved = self.queue.advance(false);`. Step forward. `false`
                //           means "not a natural track end".
                // Why:      Decide whether to load or stop.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const moved = this.queue.advance(false);
                // ```
                let moved = self.queue.advance(false);
                // What:     `self.after_move(moved);`. Load the new current or stop.
                // Why:      Shared follow-up.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.afterMove(moved);
                // ```
                self.after_move(moved);
            }
            // What:     `Command::Prev => { ... }`. Step backward and load.
            // Why:      Previous button.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "prev": { const moved = this.queue.prev(); this.afterMove(moved); break; }
            // ```
            Command::Prev => {
                // What:     `let moved = self.queue.prev();`. Step back.
                // Why:      Get the previous index, if any.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const moved = this.queue.prev();
                // ```
                let moved = self.queue.prev();
                // What:     `self.after_move(moved);`. Load or stop.
                // Why:      Shared follow-up.
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
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "seek": this.seek(command.secs); break;
            // ```
            Command::Seek(secs) => self.seek(secs),
            // What:     `Command::SetVolume(v) => { ... }`. Update the gain and mirror it.
            // Why:      Volume slider.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "setVolume": { this.volume = command.volume; this.emit({ kind: "volume", v: command.volume }); break; }
            // ```
            Command::SetVolume(v) => {
                // What:     `self.volume = v;`. Store the new gain.
                // Why:      Applied to subsequently decoded samples.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.volume = v;
                // ```
                self.volume = v;
                // What:     `self.emit(Update::Volume(v));`. Mirror to the UI.
                // Why:      Keep the slider in sync.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "volume", v });
                // ```
                self.emit(Update::Volume(v));
            }
            // What:     `Command::SetShuffle(mode) => { ... }`. Set the shuffle mode.
            // Why:      Shuffle radio group.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "setShuffle": { this.queue.setShuffle(command.mode); this.emit({ kind: "shuffle", mode: command.mode }); break; }
            // ```
            Command::SetShuffle(mode) => {
                // What:     `self.queue.set_shuffle(mode);`. Rebuild the playback
                //           scope/order for the new mode, keeping the current track.
                // Why:      Apply the shuffle mode (off / within-page / all).
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.queue.setShuffle(mode);
                // ```
                self.queue.set_shuffle(mode);
                // What:     `self.emit(Update::Shuffle(mode));`. Mirror state. `mode` is
                //           `Copy`, so using it twice is fine.
                // Why:      Radio-group visual.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "shuffle", mode });
                // ```
                self.emit(Update::Shuffle(mode));
            }
            // What:     `Command::SetRepeatTrack(on) => { ... }`. Toggle "repeat track".
            // Why:      Repeat-track checkbox.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "setRepeatTrack": { this.queue.setRepeatTrack(command.on); this.emit({ kind: "repeatTrack", on: command.on }); break; }
            // ```
            Command::SetRepeatTrack(on) => {
                // What:     `self.queue.set_repeat_track(on);`. Apply it.
                // Why:      Affects natural-end behaviour (replay current track).
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.queue.setRepeatTrack(on);
                // ```
                self.queue.set_repeat_track(on);
                // What:     `self.emit(Update::RepeatTrack(on));`. Mirror state.
                // Why:      Checkbox visual.
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
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "restore": { const { tracks, current, position, volume, shuffle, repeatTrack } = command; ... }
            // ```
            Command::Restore {
                root,
                selected,
                position,
                volume,
                shuffle,
                repeat_track,
            } => {
                // What:     `self.volume = volume;`. Restore the saved gain.
                // Why:      Applied to decoded samples.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.volume = volume;
                // ```
                self.volume = volume;
                // What:     `self.queue.set_repeat_track(repeat_track);`. Restore the
                //           "repeat track" flag.
                // Why:      Affects auto-advance (replay current on natural end).
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.queue.setRepeatTrack(repeatTrack);
                // ```
                self.queue.set_repeat_track(repeat_track);
                // What:     `self.scan_root_into_queue(root);`. Remember `root` as the Source
                //           Root, re-point the watcher at it, and rebuild the queue by SCANNING
                //           it fresh from disk (defined in `controller_audio.rs`), not from a
                //           saved track list. Consumes the owned `root`.
                // Why:      The queue is a projection of the Source Root; re-scanning is the
                //           restore auto-correction (added/removed/renamed files sort themselves
                //           out), and it is the very same projection a normal open performs.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.scanRootIntoQueue(root);
                // ```
                self.scan_root_into_queue(root);
                // What:     `self.queue.set_shuffle(shuffle);`. Restore shuffle ordering.
                // Why:      Restore shuffle state.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.queue.setShuffle(shuffle);
                // ```
                self.queue.set_shuffle(shuffle);
                // What:     `match selected { Some(sel) => ..., None => ... }`. Re-select the
                //           saved track BY PATH: `Some(sel)` looks it up in the fresh scan,
                //           `None` (nothing was cued) clears the anchored selection.
                // Why:      Resume on the saved track when the scan still contains it; if it
                //           moved or vanished, clear the cue (the "selected track missing"
                //           rule). Done before the background sweep so it skips the current.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const idx = selected ? tracks.indexOf(selected) : -1;
                // if (idx >= 0) this.queue.playIndex(idx); else this.queue.clearSelection();
                // ```
                match selected.and_then(|sel| self.queue.tracks().iter().position(|p| *p == sel)) {
                    // What:     `Some(idx) => { self.queue.play_index(idx); }`. The saved track
                    //           is present: select it (rebuilding the scope around it).
                    // Why:      Resume where the user left off.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // this.queue.playIndex(idx);
                    // ```
                    Some(idx) => {
                        self.queue.play_index(idx);
                    }
                    // What:     `None => { self.queue.clear_selection(); }`. No saved track, or
                    //           it is absent from the fresh scan: deselect.
                    // Why:      A never-cued or moved-away selection reopens with nothing
                    //           selected, not auto-selecting the first track.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // this.queue.clearSelection();
                    // ```
                    None => {
                        self.queue.clear_selection();
                    }
                }
                // What:     `self.start_queue_measurement();`. Pre-measure the restored
                //           queue in the background, like any other queue load.
                // Why:      Warm the peak cache for restored tracks while leaving the
                //           current track to its dedicated swap measurement.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.startQueueMeasurement();
                // ```
                self.start_queue_measurement();
                // What:     `self.emit(Update::Queue(self.queue.display_paths()));`. Push the
                //           relative-path list to the UI.
                // Why:      Render the restored queue (grouped by folder / first letter).
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "queue", names: this.queue.displayPaths() });
                // ```
                self.emit(Update::Queue(self.queue.display_paths()));
                // What:     `self.emit(Update::Volume(volume));`. Mirror volume.
                // Why:      Sync the slider.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "volume", volume });
                // ```
                self.emit(Update::Volume(volume));
                // What:     `self.emit(Update::Shuffle(self.queue.shuffle_mode()));`. Mirror
                //           the shuffle mode.
                // Why:      Sync the radio group.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "shuffle", mode: this.queue.shuffleMode() });
                // ```
                self.emit(Update::Shuffle(self.queue.shuffle_mode()));
                // What:     `self.emit(Update::RepeatTrack(self.queue.repeat_track()));`.
                //           Mirror the "repeat track" flag.
                // Why:      Sync the checkbox.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "repeatTrack", on: this.queue.repeatTrack() });
                // ```
                self.emit(Update::RepeatTrack(self.queue.repeat_track()));
                // What:     `self.playing = false;`. Restore PAUSED.
                // Why:      Resuming should not blast audio on launch.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.playing = false;
                // ```
                self.playing = false;
                // What:     `let loaded = self.load_current();`. Load the current track.
                // Why:      Make it ready to play from the saved position.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const loaded = this.loadCurrent();
                // ```
                let loaded = self.load_current();
                // What:     `if !loaded { self.emit_no_track(); }`. When NO track loaded (the
                //           session had no current track, or every saved file was unreadable),
                //           push the cleared now-playing view. `!` negates the bool.
                // Why:      `load_current` emits `NowPlaying` only when it actually loads a
                //           track, so a no-current restore would otherwise leave a stale label
                //           and row highlight on screen.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (!loaded) this.emitNoTrack();
                // ```
                if !loaded {
                    self.emit_no_track();
                }
                // What:     `self.emit(Update::Playing(false));`. Mirror paused state.
                // Why:      Show the Play button.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.emit({ kind: "playing", on: false });
                // ```
                self.emit(Update::Playing(false));
                // What:     `if loaded && position > 0.0 { self.seek(position); }`. Jump to
                //           the saved position if a track loaded. `&&` short-circuits.
                // Why:      Resume mid-track.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (loaded && position > 0) this.seek(position);
                // ```
                if loaded && position > 0.0 {
                    self.seek(position);
                }
            }
            // What:     `Command::Rescan => { ... }`. Re-scan the current Source Root and
            //           reconcile the queue with disk, preserving the Selected Track by path.
            // Why:      The single live-update projection (queue = scan of the root), driven by
            //           the file watcher and any "rescan required" signal.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "rescan": { /* re-scan root, diff, preserve selection */ break; }
            // ```
            Command::Rescan => {
                // What:     `if let Some(root) = self.source_root.clone() { ... }`. Rescan only
                //           when a root is set; clone so the scan owns its path while the queue
                //           is mutated.
                // Why:      With no root there is nothing to project from.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (this.sourceRoot) { ... }
                // ```
                if let Some(root) = self.source_root.clone() {
                    // What:     `let fresh = expand_paths(vec![root]);`. Scan the root into its
                    //           sorted file list WITHOUT replacing the queue yet.
                    // Why:      Diff it against the current queue first; the projection is "scan
                    //           DIFFED against the current Queue", and an empty diff must not act.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // const fresh = expandPaths([root]);
                    // ```
                    let fresh = expand_paths(vec![root]);
                    // What:     `if fresh.as_slice() == self.queue.tracks() { return; }`. When the
                    //           scan equals the current queue the diff is EMPTY, so bail out of
                    //           `handle_command` doing nothing.
                    // Why:      The watcher also fires on the app's OWN reads: on Linux, inotify
                    //           reports access events for the peak-measurement and decoder reads
                    //           UNDER the watched root. Re-emitting `Update::Queue` (which snaps
                    //           the UI back to the first page) and re-running
                    //           `start_queue_measurement` (which re-reads those files and so
                    //           re-arms the watcher) on an empty diff spins a ~500ms feedback
                    //           loop. A pure content modify (same paths) is likewise a no-op
                    //           here; its peak fingerprint changes, so it self-heals as a cache
                    //           miss on the next decode, not via a rescan sweep.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // if (arraysEqual(fresh, this.queue.tracks())) return;
                    // ```
                    if fresh.as_slice() == self.queue.tracks() {
                        return;
                    }
                    // What:     `let selected_path = self.queue.current_path().cloned();`. The
                    //           Selected Track's path BEFORE the queue is replaced.
                    // Why:      Re-select the same track by path after the rescan.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // const selectedPath = this.queue.currentPath();
                    // ```
                    let selected_path = self.queue.current_path().cloned();
                    // What:     `self.queue.set_tracks(fresh);`. Replace the queue with the fresh
                    //           scan (the diff was non-empty, so something on disk changed).
                    // Why:      Added files appear, removed files drop, all in sorted order.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // this.queue.setTracks(fresh);
                    // ```
                    self.queue.set_tracks(fresh);
                    // What:     `match selected_path.and_then(|p| ...position(|t| *t == p)) { ... }`.
                    //           Find the previously-selected path in the fresh scan.
                    // Why:      Preserve the selection across the rescan, or detect its loss.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // const idx = selectedPath ? tracks.indexOf(selectedPath) : -1;
                    // ```
                    match selected_path
                        .and_then(|p| self.queue.tracks().iter().position(|t| *t == p))
                    {
                        // What:     `Some(idx) => { ... }`. The Selected Track survived: re-anchor
                        //           the cursor at its new index (audio is decoder-owned, so it is
                        //           NOT interrupted) and emit ONE `Reconciled` (list + highlight).
                        // Why:      A live change to other files must not disturb playback NOR the
                        //           user's selected tab; `Reconciled` keeps the current page,
                        //           unlike the `Queue` + `NowPlaying` pair which reset/follow it.
                        //
                        // In TS you'd write (pseudocode):
                        // ```ts
                        // this.queue.playIndex(idx); this.emitReconciled();
                        // ```
                        Some(idx) => {
                            self.queue.play_index(idx);
                            self.emit_reconciled();
                        }
                        // What:     `None => { ... }`. The Selected Track is gone (or there was
                        //           none): clear the selection, emit `Reconciled` (keeping the
                        //           page), reset the seek bar, and STOP if it was playing (its file
                        //           left the root).
                        // Why:      The "playing file gone -> stop + clear" rule, still without
                        //           moving the user's tab. `Reconciled` carries `index: None`, and
                        //           a separate `Position(0)` resets the seek bar (page-safe).
                        //
                        // In TS you'd write (pseudocode):
                        // ```ts
                        // this.queue.clearSelection(); this.emitReconciled();
                        // this.emit({ kind: "position", secs: 0 }); if (this.playing) this.setPlaying(false);
                        // ```
                        None => {
                            self.queue.clear_selection();
                            self.emit_reconciled();
                            self.emit(Update::Position(0.0));
                            if self.playing {
                                self.set_playing(false);
                            }
                        }
                    }
                    // What:     `self.start_queue_measurement();`. Warm the peak cache for any
                    //           newly added tracks (cached ones are skipped by fingerprint).
                    // Why:      New files need true-peak measurement like any queue load.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // this.startQueueMeasurement();
                    // ```
                    self.start_queue_measurement();
                }
            }
            // What:     `Command::Quit => {}`. Empty arm: handled in `run`'s drain loop;
            //           this keeps the match exhaustive.
            // Why:      Rust requires every variant to be matched.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // case "quit": break; // handled in run()'s drain loop
            // ```
            Command::Quit => {}
        }
    }

    /// What:     `pub(crate) fn after_move(&mut self, moved: Option<usize>)`. Shared
    ///           follow-up for Next/Prev/natural-end: load the new current track, or stop at
    ///           the end. `pub(crate)` so `on_track_end` (in `controller_audio.rs`) can call
    ///           it.
    /// Why:      Avoid duplicating the load-or-stop logic.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// afterMove(moved: number | null): void { ... }
    /// ```
    pub(crate) fn after_move(&mut self, moved: Option<usize>) {
        // What:     `match moved { ... }`. `Some` = a track to load; `None` = end.
        // Why:      Two outcomes.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (moved != null) { ... } else { ... }
        // ```
        match moved {
            // What:     `Some(_) => { if !self.load_current() { self.set_playing(false); } }`.
            //           Load it; stop if loading failed. `_` ignores the index.
            // Why:      Keep the current playing state when a track loads.
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
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // else this.setPlaying(false);
            // ```
            None => self.set_playing(false),
        }
    }
}

/// What:     `#[cfg(test)] #[path = "controller_tests.rs"] mod tests;` declares a
///           test-only child module loaded from the sibling file.
/// Why:      Keep controller peak-swap tests beside the controller without adding
///           production code.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // test runner imports controller.unit.test.ts only for tests
/// ```
#[cfg(test)]
#[path = "controller_tests.rs"]
mod tests;
