//! Wiring measurement to the cache: a synchronous gain lookup for the track about
//! to play, and a detached background sweep that pre-measures the rest of a queue.
//!
//! On every queue load the controller starts a background sweep over all the
//! tracks; it measures only the ones not already cached, gently (a short sleep
//! between measurements) so it does not starve the audio thread. Sweeps are never
//! cancelled: re-opening a directory just finds most peaks already cached and
//! returns quickly. The shared cache (an `Arc<Mutex<PeakCache>>`) is the single
//! source of truth all sweeps and the playing track read and write.

// What:     `use std::path::{Path, PathBuf};`. Borrowed and owned filesystem paths.
// Why:      `resolve_track_gain` borrows one path; the sweep owns a list of paths.
// TS map:   both are `string`.
use std::path::{Path, PathBuf};

// What:     `use std::sync::{Arc, Mutex};`. `Arc<T>` is a thread-safe shared owner
//           (atomic reference count; sibling: `Rc<T>`, single-thread only). `Mutex<T>`
//           guards `T` so only one thread touches it at a time.
// Why:      The cache is shared between the engine thread and background sweeps.
// TS map:   no real equivalent; `Arc<Mutex<T>>` ~ "a shared object with a lock".
use std::sync::{Arc, Mutex};

// What:     `use std::thread;`. Thread spawning.
// Why:      The background sweep runs on its own thread.
// TS map:   a Worker.
use std::thread;

// What:     `use std::time::Duration;`. A span of time.
// Why:      The gentle sleep between measurements.
// TS map:   milliseconds for `setTimeout`.
use std::time::Duration;

// What:     `use crate::peakcache::{self, PeakCache};`. The cache module (for
//           `peakcache::fingerprint`) and the `PeakCache` type.
// Why:      Look up and store measured peaks.
// TS map:   `import * as peakcache from "./peakcache"; import { PeakCache } from "./peakcache";`
use crate::peakcache::{self, PeakCache};

// What:     `use crate::truepeak::{measure_true_peak, normalization_gain};`. The
//           measurement and the gain it feeds.
// Why:      Measure a track and convert the peak to a playback gain.
// TS map:   `import { measureTruePeak, normalizationGain } from "./truepeak";`
use crate::truepeak::{measure_true_peak, normalization_gain};

// What:     `const SAVE_BATCH: usize = 16;`. Persist the cache after this many new
//           measurements during a sweep. `usize` to compare with the unsaved count.
// Why:      Avoid rewriting the file once per track over a long queue.
// TS map:   `const SAVE_BATCH = 16;`
const SAVE_BATCH: usize = 16;

// What:     `const MEASURE_GAP_MS: u64 = 20;`. Milliseconds to sleep after measuring
//           one track. `u64` is what `Duration::from_millis` wants.
// Why:      Yield CPU so the background scan does not starve the realtime audio path.
// TS map:   `const MEASURE_GAP_MS = 20;`
const MEASURE_GAP_MS: u64 = 20;

// What:     `pub(crate) fn resolve_track_gain(path: &Path, cache: &Arc<Mutex<PeakCache>>) -> f32`.
//           Return the normalization gain for the track at `path`: a cache hit returns
//           immediately; a miss measures the track now (decoding it fully), stores the
//           result, and returns the gain. `pub(crate)` for the controller.
// Why:      The currently loading track must play at its correct constant gain from the
//           first sample, so it cannot wait for the background sweep.
// TS map:   `function resolveTrackGain(path: string, cache: SharedPeakCache): number`
pub(crate) fn resolve_track_gain(path: &Path, cache: &Arc<Mutex<PeakCache>>) -> f32 {
    // What:     `let fingerprint = peakcache::fingerprint(path);`. Opaque key, or `None`
    //           if the file cannot be stat'd.
    // Why:      Both the lookup and the store key off it.
    // TS map:   `const fingerprint = peakcache.fingerprint(path);`
    let fingerprint = peakcache::fingerprint(path);

    // What:     `if let Some(key) = &fingerprint { ... }`. When we have a key, try the
    //           cache. `&fingerprint` borrows the `Option` so we can still use it later.
    // Why:      A hit avoids the expensive decode.
    // TS map:   `if (fingerprint) { ... }`
    if let Some(key) = &fingerprint {
        // What:     `let cached = cache.lock().unwrap().get(key);`. Lock the cache, look
        //           up the key, release the lock at the end of the statement.
        //           `.lock()` returns a `Result` (poisoned if a holder panicked);
        //           `.unwrap()` takes the guard or panics. We do NOT hold the lock while
        //           decoding below.
        // Why:      Read the memoized peak under the lock, briefly.
        // TS map:   `const cached = withLock(cache, c => c.get(key));`
        let cached = cache.lock().unwrap().get(key);
        // What:     `if let Some(peak) = cached { return normalization_gain(peak); }`.
        //           Cache hit -> compute and return the gain.
        // Why:      Fast path; no decoding needed.
        // TS map:   `if (cached !== undefined) return normalizationGain(cached);`
        if let Some(peak) = cached {
            return normalization_gain(peak);
        }
    }

    // What:     `let peak = match measure_true_peak(path) { Ok(p) => p, Err(_) => return 1.0 };`.
    //           Cache miss: measure now. A decode failure falls back to unity gain (the
    //           clamp downstream still guards clipping).
    // Why:      Guarantee a correct constant gain for the track that is about to play.
    // TS map:   `let peak; try { peak = measureTruePeak(path); } catch { return 1; }`
    let peak = match measure_true_peak(path) {
        Ok(p) => p,
        Err(_) => return 1.0,
    };

    // What:     `if let Some(key) = fingerprint { ... }`. Store the fresh measurement
    //           when we have a key (consumes the `Option` now; we are done with it).
    // Why:      Memoize so future loads and the sweep skip this track.
    // TS map:   `if (fingerprint) { ... }`
    if let Some(key) = fingerprint {
        // What:     `let mut guard = cache.lock().unwrap();`. Take the lock to mutate.
        // Why:      Insert and persist under the lock.
        // TS map:   `const guard = lock(cache);`
        let mut guard = cache.lock().unwrap();
        // What:     `guard.insert(key, peak);`. Record it.
        // Why:      Memoize.
        // TS map:   `guard.insert(key, peak);`
        guard.insert(key, peak);
        // What:     `let _ = guard.save();`. Persist immediately; ignore IO errors
        //           (`let _ =` discards the `Result`).
        // Why:      A single-entry save is cheap and keeps the current track durable.
        // TS map:   `try { guard.save(); } catch {}`
        let _ = guard.save();
    }

    // What:     `normalization_gain(peak)`. Convert the measured peak to a gain. Tail
    //           expression -> return.
    // Why:      The value the caller applies.
    // TS map:   `return normalizationGain(peak);`
    normalization_gain(peak)
}

// What:     `pub(crate) fn spawn_queue_measurement(tracks: Vec<PathBuf>, cache: Arc<Mutex<PeakCache>>)`.
//           Start a detached background thread that measures every uncached track in
//           `tracks` into the shared cache. Takes ownership of both arguments (moved
//           into the thread). `pub(crate)` for the controller.
// Why:      Pre-warm the cache for the whole queue so later track changes are instant.
// TS map:   `function spawnQueueMeasurement(tracks: string[], cache: SharedPeakCache): void`
pub(crate) fn spawn_queue_measurement(tracks: Vec<PathBuf>, cache: Arc<Mutex<PeakCache>>) {
    // What:     `thread::spawn(move || run_sweep(tracks, cache));`. Spawn a worker. The
    //           `move ||` closure TAKES OWNERSHIP of `tracks` and `cache`. We drop the
    //           returned `JoinHandle` (detached): the thread runs to completion on its
    //           own, and is killed at process exit (atomic saves keep the file intact).
    // Why:      Background work that does not block the engine and needs no join/cancel.
    // TS map:   `startWorker(() => runSweep(tracks, cache)); // fire and forget`
    thread::spawn(move || run_sweep(tracks, cache));
}

// What:     `fn run_sweep(tracks: Vec<PathBuf>, cache: Arc<Mutex<PeakCache>>)`. The
//           background body: measure each uncached track, batching saves, sleeping
//           briefly after each real measurement. Module-private.
// Why:      Keep the thread logic in one place.
// TS map:   `function runSweep(tracks: string[], cache: SharedPeakCache): void`
fn run_sweep(tracks: Vec<PathBuf>, cache: Arc<Mutex<PeakCache>>) {
    // What:     `for path in tracks { ... }`. Consume each path by value.
    // Why:      Visit every queue entry.
    // TS map:   `for (const path of tracks) { ... }`
    for path in tracks {
        // What:     `let key = match peakcache::fingerprint(&path) { Some(k) => k, None => continue };`.
        //           Compute the key, or skip this file if it cannot be stat'd.
        // Why:      No key -> cannot cache it; move on.
        // TS map:   `const key = fingerprint(path); if (!key) continue;`
        let key = match peakcache::fingerprint(&path) {
            Some(k) => k,
            None => continue,
        };
        // What:     `let already = cache.lock().unwrap().get(&key).is_some();`. Is it
        //           already measured? Lock briefly, check, release.
        // Why:      Skip cached tracks (the re-open-a-known-dir fast path).
        // TS map:   `const already = withLock(cache, c => c.get(key) !== undefined);`
        let already = cache.lock().unwrap().get(&key).is_some();
        // What:     `if already { continue; }`. Nothing to do; no sleep, so warm
        //           directories sweep through quickly.
        // Why:      Avoid redundant decoding.
        // TS map:   `if (already) continue;`
        if already {
            continue;
        }
        // What:     `let peak = match measure_true_peak(&path) { Ok(p) => p, Err(_) => continue };`.
        //           Measure; skip files that fail to decode.
        // Why:      One bad file must not abort the sweep.
        // TS map:   `let peak; try { peak = measureTruePeak(path); } catch { continue; }`
        let peak = match measure_true_peak(&path) {
            Ok(p) => p,
            Err(_) => continue,
        };
        // What:     a scoped block holding the lock only as long as needed.
        // Why:      Release the lock before sleeping below.
        // TS map:   `{ const guard = lock(cache); ... }`
        {
            // What:     `let mut guard = cache.lock().unwrap();`. Take the lock to mutate.
            // Why:      Insert and maybe persist.
            // TS map:   `const guard = lock(cache);`
            let mut guard = cache.lock().unwrap();
            // What:     `guard.insert(key, peak);`. Record the measurement.
            // Why:      Memoize.
            // TS map:   `guard.insert(key, peak);`
            guard.insert(key, peak);
            // What:     `if guard.unsaved() >= SAVE_BATCH { let _ = guard.save(); }`.
            //           Flush once a batch has accumulated; ignore IO errors.
            // Why:      Amortize disk writes over many tracks.
            // TS map:   `if (guard.unsaved() >= SAVE_BATCH) try { guard.save(); } catch {}`
            if guard.unsaved() >= SAVE_BATCH {
                let _ = guard.save();
            }
        }
        // What:     `thread::sleep(Duration::from_millis(MEASURE_GAP_MS));`. Pause after a
        //           real measurement.
        // Why:      Keep CPU pressure off the realtime audio thread.
        // TS map:   `await sleep(MEASURE_GAP_MS);`
        thread::sleep(Duration::from_millis(MEASURE_GAP_MS));
    }
    // What:     `let _ = cache.lock().unwrap().save();`. Final flush of any entries left
    //           below the batch threshold; ignore IO errors.
    // Why:      Do not lose the tail of the queue's measurements.
    // TS map:   `try { withLock(cache, c => c.save()); } catch {}`
    let _ = cache.lock().unwrap().save();
}
