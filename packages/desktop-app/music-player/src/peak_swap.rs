//! Current-track true-peak swap strategy.
//!
//! Cache hits keep the old zero-delay path: the measured gain is available before
//! any samples are decoded. Cache misses start a dedicated measurement thread for
//! the current track, immediately use the safe -1 dBTP ceiling gain, and let the
//! controller wait up to one second when playback is about to start. If the
//! measurement finishes later, the controller swaps future decoded samples to the
//! measured gain while already-buffered fallback samples drain unchanged.

// What:     `use std::path::{Path, PathBuf};`. `Path` is a borrowed filesystem
//           path view; `PathBuf` is the owned, growable path buffer sibling.
// Why:      Public helpers borrow the loaded track path, while the worker thread
//           must own its path after the caller returns.
// TS map:   both are just `string` in TypeScript, with Rust splitting borrowed
//           and owned forms.
//
// In TS you'd write (pseudocode):
// ```ts
// type Path = string;
// ```
use std::path::{Path, PathBuf};

// What:     `use std::sync::mpsc::{self, Receiver, RecvTimeoutError, TryRecvError};`.
//           Rust's multi-producer/single-consumer channel module plus the receive
//           half and two error enums. `Receiver<T>` is the owned read end;
//           `TryRecvError` reports non-blocking empty/disconnected states;
//           `RecvTimeoutError` reports timeout/disconnected states.
// Why:      The measurement worker sends exactly one result back to the controller
//           without blocking the audio thread.
// TS map:   closest mental model is an async queue with `tryRead()` and
//           `readWithTimeout()`.
//
// In TS you'd write (pseudocode):
// ```ts
// const channel = makeOneShotChannel<PeakGainResult>();
// ```
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, TryRecvError};

// What:     `use std::sync::{Arc, Mutex};`. `Arc<T>` is a thread-safe shared owner
//           (sibling: single-thread `Rc<T>`); `Mutex<T>` guards mutable data so
//           one thread uses it at a time.
// Why:      The dedicated current-track worker and the controller share the same
//           peak cache safely.
// TS map:   no exact equivalent; picture a shared object you must lock before
//           reading or writing.
//
// In TS you'd write (pseudocode):
// ```ts
// const cache = new LockedSharedObject(new PeakCache());
// ```
use std::sync::{Arc, Mutex};

// What:     `use std::thread;`. Rust's standard OS-thread API.
// Why:      Current-track measurement decodes the whole file away from the
//           controller thread.
// TS map:   closest equivalent is `new Worker(...)`.
//
// In TS you'd write (pseudocode):
// ```ts
// const worker = new Worker("measure-current-track.js");
// ```
use std::thread;

// What:     `use std::time::Duration;`. A monotonic span of time.
// Why:      The controller waits for at most the CSS-font-style swap window.
// TS map:   a number of milliseconds passed to `setTimeout`.
//
// In TS you'd write (pseudocode):
// ```ts
// type Duration = number;
// ```
use std::time::Duration;

// What:     `use crate::peakcache::{self, PeakCache};`. Import the peak-cache
//           module itself for `peakcache::fingerprint`, plus the `PeakCache` type.
// Why:      The strategy checks cached peaks before spawning and stores fresh
//           measurements after decoding.
// TS map:   `import * as peakcache from "./peakcache"; import { PeakCache } from "./peakcache";`
//
// In TS you'd write (pseudocode):
// ```ts
// import * as peakcache from "./peakcache";
// import { PeakCache } from "./peakcache";
// ```
use crate::peakcache::{self, PeakCache};

// What:     `use crate::truepeak::{measure_true_peak, normalization_gain};`. The
//           whole-track true-peak scanner and its peak-to-gain conversion.
// Why:      Cache misses need to decode a track and turn its measured peak into
//           the constant playback gain.
// TS map:   `import { measureTruePeak, normalizationGain } from "./truepeak";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { measureTruePeak, normalizationGain } from "./truepeak";
// ```
use crate::truepeak::{measure_true_peak, normalization_gain};

// What:     `const PEAK_SWAP_WAIT_SECS: u64 = 1;`. One second, stored as the
//           unsigned integer width `Duration::from_secs` expects. Siblings would
//           be `u32` or `usize`, but the constructor takes `u64`.
// Why:      This is the borrowed-from-CSS-fonts swap window: wait briefly for the
//           measured peak, then play with the fallback gain if it is still absent.
// TS map:   `const PEAK_SWAP_WAIT_SECS = 1;`
//
// In TS you'd write (pseudocode):
// ```ts
// const PEAK_SWAP_WAIT_SECS = 1;
// ```
const PEAK_SWAP_WAIT_SECS: u64 = 1;

// What:     `#[derive(Clone, Copy, Debug)]` auto-generates cheap copying and debug
//           formatting for `PeakGainResult`. `Copy` is valid because both fields
//           are plain numbers.
// Why:      Tests can print the result, and the controller can pass it around
//           without ownership ceremony.
// TS map:   no annotation needed for a small object type.
//
// In TS you'd write (pseudocode):
// ```ts
// type PeakGainResult = { generation: number; gain: number };
// ```
#[derive(Clone, Copy, Debug)]
// What:     `pub(crate) struct PeakGainResult { ... }`. A crate-visible result
//           from one current-track measurement. It carries the generation that
//           was current when the worker spawned plus the measured gain.
// Why:      Generation lets the controller ignore stale results from tracks that
//           are no longer current while still allowing those workers to warm the cache.
// TS map:   `type PeakGainResult = { generation: number; gain: number }`.
//
// In TS you'd write (pseudocode):
// ```ts
// type PeakGainResult = { generation: number; gain: number };
// ```
pub(crate) struct PeakGainResult {
    // What:     `pub(crate) generation: u64`. Monotonic track-load generation,
    //           visible inside the crate. `u64` is used instead of `usize` so the
    //           value is platform-independent and effectively never wraps.
    // Why:      Identify which loaded track this result belongs to.
    // TS map:   `generation: number`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // generation: number;
    // ```
    pub(crate) generation: u64,
    // What:     `pub(crate) gain: f32`. Linear playback gain from true-peak
    //           normalization. Sibling `f64` would add precision the PCM path does
    //           not use.
    // Why:      The controller multiplies future decoded samples by this value.
    // TS map:   `gain: number`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // gain: number;
    // ```
    pub(crate) gain: f32,
}

// What:     `pub(crate) enum PendingPeakStatus { ... }`. The three states a
//           non-blocking or timed receive can report: result ready, still pending,
//           or the worker ended without sending.
// Why:      The controller needs the same state machine for polling and for the
//           one-second start wait.
// TS map:   discriminated union of `{ kind: "ready" | "pending" | "closed" }`.
//
// In TS you'd write (pseudocode):
// ```ts
// type PendingPeakStatus =
//   | { kind: "ready"; result: PeakGainResult }
//   | { kind: "pending" }
//   | { kind: "closed" };
// ```
pub(crate) enum PendingPeakStatus {
    // What:     `Ready(PeakGainResult)` wraps the measured result.
    // Why:      Hand the generation and gain to the controller.
    // TS map:   `{ kind: "ready", result }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "ready", result }
    // ```
    Ready(PeakGainResult),
    // What:     `Pending` has no payload.
    // Why:      The worker is still running, so fallback gain remains active.
    // TS map:   `{ kind: "pending" }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "pending" }
    // ```
    Pending,
    // What:     `Closed` has no payload.
    // Why:      Measurement failed or the worker exited without a result, so the
    //           controller can stop polling and keep the fallback gain.
    // TS map:   `{ kind: "closed" }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "closed" }
    // ```
    Closed,
}

// What:     `pub(crate) struct PendingPeakMeasurement { ... }`. The controller's
//           handle to one in-flight current-track measurement.
// Why:      Encapsulates the channel receiver so command handling can poll or wait
//           without knowing mpsc error details.
// TS map:   `class PendingPeakMeasurement { receiver }`.
//
// In TS you'd write (pseudocode):
// ```ts
// class PendingPeakMeasurement { constructor(private receiver: Receiver<PeakGainResult>) {} }
// ```
pub(crate) struct PendingPeakMeasurement {
    // What:     `receiver: Receiver<PeakGainResult>`. The owned read end of the
    //           one-shot channel. The sibling write end lives in the measurement thread.
    // Why:      Poll or wait for the measured gain.
    // TS map:   `receiver: Receiver<PeakGainResult>`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // receiver: Receiver<PeakGainResult>;
    // ```
    receiver: Receiver<PeakGainResult>,
}

// What:     `impl PendingPeakMeasurement { ... }`. Methods for the pending
//           measurement wrapper.
// Why:      Keep raw channel details local to this module.
// TS map:   methods on the class above.
//
// In TS you'd write (pseudocode):
// ```ts
// class PendingPeakMeasurement { /* fromReceiver, tryResult, waitResult */ }
// ```
impl PendingPeakMeasurement {
    // What:     `pub(crate) fn from_receiver(receiver: Receiver<PeakGainResult>) -> PendingPeakMeasurement`.
    //           Build a wrapper from an owned channel receiver.
    // Why:      Production spawn and unit tests both need to construct pending handles.
    // TS map:   `static fromReceiver(receiver): PendingPeakMeasurement`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static fromReceiver(receiver: Receiver<PeakGainResult>): PendingPeakMeasurement {
    //   return new PendingPeakMeasurement(receiver);
    // }
    // ```
    pub(crate) fn from_receiver(receiver: Receiver<PeakGainResult>) -> PendingPeakMeasurement {
        // What:     `PendingPeakMeasurement { receiver }`. Struct literal using field
        //           shorthand. Tail expression returns the wrapper.
        // Why:      Store the receiver.
        // TS map:   `return { receiver };`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { receiver };
        // ```
        PendingPeakMeasurement { receiver }
    }

    // What:     `pub(crate) fn try_result(&self) -> PendingPeakStatus`. Poll once
    //           without blocking.
    // Why:      The engine loop checks whether a measured gain landed before
    //           decoding another chunk.
    // TS map:   `tryResult(): PendingPeakStatus`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // tryResult(): PendingPeakStatus { return this.receiver.tryRead(); }
    // ```
    pub(crate) fn try_result(&self) -> PendingPeakStatus {
        // What:     `match self.receiver.try_recv() { ... }`. Non-blocking channel
        //           receive, mapped into the simpler status enum.
        // Why:      Avoid parking the engine while audio should keep flowing.
        // TS map:   `switch (receiver.tryRead()) { ... }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // switch (this.receiver.tryRead()) { /* value, empty, closed */ }
        // ```
        match self.receiver.try_recv() {
            // What:     `Ok(result) => PendingPeakStatus::Ready(result)`. Channel had
            //           a result, so wrap it in the ready status.
            // Why:      Hand the measured gain upward.
            // TS map:   `return { kind: "ready", result };`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return { kind: "ready", result };
            // ```
            Ok(result) => PendingPeakStatus::Ready(result),
            // What:     `Err(TryRecvError::Empty) => PendingPeakStatus::Pending`.
            //           The worker has not sent yet.
            // Why:      Keep the fallback active and poll later.
            // TS map:   `return { kind: "pending" };`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return { kind: "pending" };
            // ```
            Err(TryRecvError::Empty) => PendingPeakStatus::Pending,
            // What:     `Err(TryRecvError::Disconnected) => PendingPeakStatus::Closed`.
            //           The sender disappeared without a value.
            // Why:      Measurement failed, so there is nothing left to wait for.
            // TS map:   `return { kind: "closed" };`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return { kind: "closed" };
            // ```
            Err(TryRecvError::Disconnected) => PendingPeakStatus::Closed,
        }
    }

    // What:     `pub(crate) fn wait_result(&self, timeout: Duration) -> PendingPeakStatus`.
    //           Wait for a result until the timeout expires.
    // Why:      The start path gives the current-track measurement a one-second chance
    //           before swapping to fallback playback.
    // TS map:   `waitResult(timeoutMs): PendingPeakStatus`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // waitResult(timeoutMs: number): PendingPeakStatus { return this.receiver.readWithTimeout(timeoutMs); }
    // ```
    pub(crate) fn wait_result(&self, timeout: Duration) -> PendingPeakStatus {
        // What:     `match self.receiver.recv_timeout(timeout) { ... }`. Blocking
        //           receive with a maximum duration.
        // Why:      Wait briefly without risking an indefinite playback stall.
        // TS map:   `switch (await receiver.readWithTimeout(timeoutMs)) { ... }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // switch (await this.receiver.readWithTimeout(timeoutMs)) { /* value, timeout, closed */ }
        // ```
        match self.receiver.recv_timeout(timeout) {
            // What:     `Ok(result) => PendingPeakStatus::Ready(result)`. The worker
            //           finished inside the swap window.
            // Why:      The track can start with its exact measured gain.
            // TS map:   `return { kind: "ready", result };`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return { kind: "ready", result };
            // ```
            Ok(result) => PendingPeakStatus::Ready(result),
            // What:     `Err(RecvTimeoutError::Timeout) => PendingPeakStatus::Pending`.
            //           The one-second window expired.
            // Why:      Start with fallback now and keep polling for the later swap.
            // TS map:   `return { kind: "pending" };`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return { kind: "pending" };
            // ```
            Err(RecvTimeoutError::Timeout) => PendingPeakStatus::Pending,
            // What:     `Err(RecvTimeoutError::Disconnected) => PendingPeakStatus::Closed`.
            //           The worker ended without sending a result.
            // Why:      Clear the pending handle and keep the fallback gain.
            // TS map:   `return { kind: "closed" };`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return { kind: "closed" };
            // ```
            Err(RecvTimeoutError::Disconnected) => PendingPeakStatus::Closed,
        }
    }
}

// What:     `pub(crate) enum TrackGainResolution { ... }`. Result of preparing a
//           loaded track's gain: either immediately ready from cache, or pending
//           on an async measurement.
// Why:      `install_source` can set `track_gain` without blocking on a cache miss.
// TS map:   discriminated union of ready gain or pending measurement.
//
// In TS you'd write (pseudocode):
// ```ts
// type TrackGainResolution =
//   | { kind: "ready"; gain: number }
//   | { kind: "pending"; pending: PendingPeakMeasurement };
// ```
pub(crate) enum TrackGainResolution {
    // What:     `Ready(f32)` carries an already-known gain.
    // Why:      Cache hit path keeps exact normalization from the first sample.
    // TS map:   `{ kind: "ready", gain }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "ready", gain }
    // ```
    Ready(f32),
    // What:     `Pending(PendingPeakMeasurement)` carries a measurement handle.
    // Why:      Cache miss path can start with fallback while the worker decodes.
    // TS map:   `{ kind: "pending", pending }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "pending", pending }
    // ```
    Pending(PendingPeakMeasurement),
}

// What:     `pub(crate) fn peak_swap_wait() -> Duration`. Return the configured
//           one-second swap window as a `Duration` value.
// Why:      The controller calls this at every playback-start boundary.
// TS map:   `function peakSwapWait(): number`.
//
// In TS you'd write (pseudocode):
// ```ts
// function peakSwapWait(): number { return PEAK_SWAP_WAIT_SECS * 1000; }
// ```
pub(crate) fn peak_swap_wait() -> Duration {
    // What:     `Duration::from_secs(PEAK_SWAP_WAIT_SECS)`. Build a `Duration` from
    //           an integer second count. Tail expression returns it.
    // Why:      Avoid repeating the conversion at call sites.
    // TS map:   `return PEAK_SWAP_WAIT_SECS * 1000;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return PEAK_SWAP_WAIT_SECS * 1000;
    // ```
    Duration::from_secs(PEAK_SWAP_WAIT_SECS)
}

// What:     `pub(crate) fn fallback_track_gain() -> f32`. Return the temporary
//           gain used while an uncached true peak is still measuring.
// Why:      `normalization_gain(1.0)` is exactly the existing -1 dBTP ceiling value,
//           so fallback keeps a clipping-safety bias without waiting forever.
// TS map:   `function fallbackTrackGain(): number`.
//
// In TS you'd write (pseudocode):
// ```ts
// function fallbackTrackGain(): number { return normalizationGain(1); }
// ```
pub(crate) fn fallback_track_gain() -> f32 {
    // What:     `normalization_gain(1.0)`. Convert a full-scale peak into its
    //           attenuate-only gain, which is the -1 dBTP ceiling.
    // Why:      Reuse the true-peak module's canonical constant without duplicating it.
    // TS map:   `return normalizationGain(1);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return normalizationGain(1);
    // ```
    normalization_gain(1.0)
}

// What:     `pub(crate) fn cached_track_gain(path: &Path, cache: &Arc<Mutex<PeakCache>>) -> Option<f32>`.
//           Try to read a measured peak from the cache and convert it to gain.
// Why:      Cache hits must avoid spawning a redundant current-track worker.
// TS map:   `function cachedTrackGain(path: string, cache: SharedPeakCache): number | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function cachedTrackGain(path: string, cache: SharedPeakCache): number | null { ... }
// ```
pub(crate) fn cached_track_gain(path: &Path, cache: &Arc<Mutex<PeakCache>>) -> Option<f32> {
    // What:     `let key = peakcache::fingerprint(path)?;`. Compute the opaque cache
    //           key; `?` returns `None` if the file cannot be stat'd.
    // Why:      No key means there can be no cache hit.
    // TS map:   `const key = fingerprint(path); if (!key) return null;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const key = fingerprint(path); if (!key) return null;
    // ```
    let key = peakcache::fingerprint(path)?;
    // What:     `let peak = cache.lock().unwrap().get(&key)?;`. Lock the shared cache,
    //           read the peak, and use `?` to return `None` on a miss. `&key` lends
    //           the owned key string.
    // Why:      Convert only real cache hits.
    // TS map:   `const peak = withLock(cache, c => c.get(key)); if (peak == null) return null;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const peak = withLock(cache, c => c.get(key)); if (peak == null) return null;
    // ```
    let peak = cache.lock().unwrap().get(&key)?;
    // What:     `Some(normalization_gain(peak))`. Convert the peak and wrap it in
    //           `Some`. Tail expression returns the cache-hit gain.
    // Why:      Callers need gain, not raw true peak.
    // TS map:   `return normalizationGain(peak);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return normalizationGain(peak);
    // ```
    Some(normalization_gain(peak))
}

// What:     `pub(crate) fn prepare_track_gain(...) -> TrackGainResolution`. Prepare
//           the loaded track's gain with the swap strategy.
// Why:      A cache hit returns exact gain now; a miss starts measurement and lets
//           playback begin with fallback after the one-second start wait.
// TS map:   `function prepareTrackGain(path, cache, generation): TrackGainResolution`.
//
// In TS you'd write (pseudocode):
// ```ts
// function prepareTrackGain(path: string, cache: SharedPeakCache, generation: number): TrackGainResolution { ... }
// ```
pub(crate) fn prepare_track_gain(
    path: &Path,
    cache: &Arc<Mutex<PeakCache>>,
    generation: u64,
) -> TrackGainResolution {
    // What:     `if let Some(gain) = cached_track_gain(path, cache) { ... }`. Check
    //           the cache before spawning a worker.
    // Why:      Keep known tracks instant and exact.
    // TS map:   `const gain = cachedTrackGain(path, cache); if (gain != null) return { kind: "ready", gain };`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const gain = cachedTrackGain(path, cache); if (gain != null) return { kind: "ready", gain };
    // ```
    if let Some(gain) = cached_track_gain(path, cache) {
        // What:     `return TrackGainResolution::Ready(gain);`. Early-return the
        //           ready enum variant.
        // Why:      No async work needed.
        // TS map:   `return { kind: "ready", gain };`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { kind: "ready", gain };
        // ```
        return TrackGainResolution::Ready(gain);
    }

    // What:     `let fingerprint = peakcache::fingerprint(path);`. Compute the key
    //           once more for the worker. It may be `None`; measurement can still
    //           run, but caching will be skipped.
    // Why:      The worker owns this key and avoids repeating stat after spawn.
    // TS map:   `const fingerprint = peakcache.fingerprint(path);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const fingerprint = peakcache.fingerprint(path);
    // ```
    let fingerprint = peakcache::fingerprint(path);
    // What:     `let pending = spawn_current_track_measurement(...)`. Start the
    //           dedicated worker. `path.to_path_buf()` clones the borrowed path into
    //           owned storage; `Arc::clone(cache)` shares the same cache.
    // Why:      The thread outlives this function, so it needs owned inputs.
    // TS map:   `const pending = spawnCurrentTrackMeasurement(path, cache, fingerprint, generation);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const pending = spawnCurrentTrackMeasurement(path, cache, fingerprint, generation);
    // ```
    let pending = spawn_current_track_measurement(
        path.to_path_buf(),
        Arc::clone(cache),
        fingerprint,
        generation,
    );
    // What:     `TrackGainResolution::Pending(pending)`. Wrap the pending handle.
    //           Tail expression returns it.
    // Why:      The controller stores this and uses fallback gain until a result arrives.
    // TS map:   `return { kind: "pending", pending };`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { kind: "pending", pending };
    // ```
    TrackGainResolution::Pending(pending)
}

// What:     `fn spawn_current_track_measurement(...) -> PendingPeakMeasurement`. Spawn
//           a detached worker for one current track.
// Why:      Current-track measurement must not block load, but it should run at normal
//           priority because playback may wait briefly for it.
// TS map:   `function spawnCurrentTrackMeasurement(...): PendingPeakMeasurement`.
//
// In TS you'd write (pseudocode):
// ```ts
// function spawnCurrentTrackMeasurement(...args): PendingPeakMeasurement { ... }
// ```
fn spawn_current_track_measurement(
    path: PathBuf,
    cache: Arc<Mutex<PeakCache>>,
    fingerprint: Option<String>,
    generation: u64,
) -> PendingPeakMeasurement {
    // What:     `let (sender, receiver) = mpsc::channel::<PeakGainResult>();`. Create
    //           a typed one-shot channel and split it into write/read halves.
    // Why:      The worker sends the measured gain back to the controller.
    // TS map:   `const { sender, receiver } = makeChannel<PeakGainResult>();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { sender, receiver } = makeChannel<PeakGainResult>();
    // ```
    let (sender, receiver) = mpsc::channel::<PeakGainResult>();
    // What:     `thread::spawn(move || { ... });`. Start an OS thread. `move ||`
    //           takes ownership of `path`, `cache`, `fingerprint`, `generation`, and
    //           `sender` into the closure.
    // Why:      Decode and cache the peak without tying up the controller thread.
    // TS map:   `startWorker(() => { ... });`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // startWorker(() => { /* measure, cache, send */ });
    // ```
    thread::spawn(move || {
        // What:     `if let Some(gain) = measure_and_store_gain(&path, &cache, fingerprint) { ... }`.
        //           Measure the track, store it when possible, and continue only on
        //           success. `&path` and `&cache` lend the owned worker values.
        // Why:      A decode failure closes the channel, leaving fallback gain active.
        // TS map:   `const gain = measureAndStoreGain(path, cache, fingerprint); if (gain != null) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const gain = measureAndStoreGain(path, cache, fingerprint); if (gain != null) { ... }
        // ```
        if let Some(gain) = measure_and_store_gain(&path, &cache, fingerprint) {
            // What:     `let _ = sender.send(PeakGainResult { generation, gain });`.
            //           Send the result; `let _ =` discards the error if the controller
            //           already moved to another track and dropped the receiver.
            // Why:      Stale measurements still warm the cache, but do not need a live
            //           consumer.
            // TS map:   `try { sender.send({ generation, gain }); } catch {}`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // try { sender.send({ generation, gain }); } catch {}
            // ```
            let _ = sender.send(PeakGainResult { generation, gain });
        }
    });
    // What:     `PendingPeakMeasurement::from_receiver(receiver)`. Wrap the channel's
    //           read half. Tail expression returns the pending handle.
    // Why:      Hide raw channel details from the controller.
    // TS map:   `return PendingPeakMeasurement.fromReceiver(receiver);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return PendingPeakMeasurement.fromReceiver(receiver);
    // ```
    PendingPeakMeasurement::from_receiver(receiver)
}

// What:     `fn measure_and_store_gain(...) -> Option<f32>`. Decode the whole file,
//           cache the peak if a fingerprint exists, and return the normalized gain.
// Why:      Shared worker body for the current-track async path.
// TS map:   `function measureAndStoreGain(...): number | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function measureAndStoreGain(path: string, cache: SharedPeakCache, fingerprint: string | null): number | null { ... }
// ```
fn measure_and_store_gain(
    path: &Path,
    cache: &Arc<Mutex<PeakCache>>,
    fingerprint: Option<String>,
) -> Option<f32> {
    // What:     `let peak = measure_true_peak(path).ok()?;`. Decode the file and
    //           convert `Result` to `Option`; `?` returns `None` on decode failure.
    // Why:      Failed measurement should not replace the fallback gain.
    // TS map:   `let peak; try { peak = measureTruePeak(path); } catch { return null; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let peak; try { peak = measureTruePeak(path); } catch { return null; }
    // ```
    let peak = measure_true_peak(path).ok()?;
    // What:     `if let Some(key) = fingerprint { ... }`. Cache only when a
    //           fingerprint was available; this consumes the optional owned string.
    // Why:      Unstatable files can still produce a gain for this play, but cannot be
    //           memoized safely.
    // TS map:   `if (fingerprint) { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (fingerprint) { ... }
    // ```
    if let Some(key) = fingerprint {
        // What:     `let mut guard = cache.lock().unwrap();`. Lock the shared cache for
        //           mutation. `mut` is required because insert/save change it.
        // Why:      Store and persist the measured peak.
        // TS map:   `const guard = lock(cache);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const guard = lock(cache);
        // ```
        let mut guard = cache.lock().unwrap();
        // What:     `guard.insert(key, peak);`. Insert the measured peak with the owned
        //           fingerprint key.
        // Why:      Warm the cache even if this result becomes stale for playback.
        // TS map:   `guard.insert(key, peak);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // guard.insert(key, peak);
        // ```
        guard.insert(key, peak);
        // What:     `let _ = guard.save();`. Persist immediately and discard an IO
        //           failure. The in-memory cache still holds the peak.
        // Why:      Current-track work should survive process exit when saving succeeds.
        // TS map:   `try { guard.save(); } catch {}`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // try { guard.save(); } catch {}
        // ```
        let _ = guard.save();
    }
    // What:     `Some(normalization_gain(peak))`. Convert the raw peak to gain and
    //           wrap it. Tail expression returns the worker's result.
    // Why:      The controller applies gains, not raw peak values.
    // TS map:   `return normalizationGain(peak);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return normalizationGain(peak);
    // ```
    Some(normalization_gain(peak))
}

// What:     `#[cfg(test)] #[path = "peak_swap_tests.rs"] mod tests;` declares a
//           test-only child module loaded from the sibling file.
// Why:      Keep tests beside this module without adding production code lines.
// TS map:   a colocated `peak_swap.unit.test.ts` file.
//
// In TS you'd write (pseudocode):
// ```ts
// // test runner imports peak_swap.unit.test.ts only for tests
// ```
#[cfg(test)]
#[path = "peak_swap_tests.rs"]
mod tests;
