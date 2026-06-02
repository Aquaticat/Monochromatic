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

// What:     `use std::time::{Duration, Instant};`. `Duration` is a span of time;
//           `Instant` is a monotonic clock reading (a point in time you can measure
//           elapsed time from). Sibling you might expect: `SystemTime` (wall clock,
//           can jump backwards); `Instant` is the right one for "how long since X".
// Why:      `Duration` for the gentle sleep and the save interval; `Instant` to know
//           when the last save happened so we can flush on a time bound.
// TS map:   `Duration` ~ a number of ms; `Instant` ~ `performance.now()`.
use std::time::{Duration, Instant};

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

// What:     `const SAVE_INTERVAL_SECS: u64 = 10;`. Maximum seconds between cache
//           flushes during a sweep, independent of how many tracks were measured.
//           `u64` is what `Duration::from_secs` wants.
// Why:      The sweep is detached and dies at process exit, so anything unsaved when
//           the user quits is lost and re-measured next launch. Flushing at least
//           this often bounds that loss to ~10 seconds of work, so a large library
//           actually finishes caching across short sessions instead of restarting.
// TS map:   `const SAVE_INTERVAL_SECS = 10;`
const SAVE_INTERVAL_SECS: u64 = 10;

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

// What:     `#[cfg(target_os = "linux")] fn lower_current_thread_to_idle()`. Move the
//           CALLING thread into the Linux `SCHED_IDLE` scheduling class. The
//           `#[cfg(...)]` attribute compiles this version ONLY on Linux.
// Why:      The sweep decodes whole files back-to-back (CPU-bound). `SCHED_IDLE`
//           threads run only when no normal-priority thread wants the CPU, on ANY
//           core, so the sweep never competes with the realtime audio thread, the UI,
//           or other applications. It still finishes when the machine is otherwise
//           idle.
// TS map:   no equivalent; Node/browsers expose no thread scheduling class.
#[cfg(target_os = "linux")]
fn lower_current_thread_to_idle() {
    // What:     `let param = libc::sched_param { sched_priority: 0 };`. The scheduler
    //           parameter struct; `SCHED_IDLE` ignores the priority, so 0 is the only
    //           valid value. `libc::` names the raw C library bindings.
    // Why:      `sched_setscheduler` requires a `*const sched_param` argument.
    // TS map:   `const param = { sched_priority: 0 };`
    let param = libc::sched_param { sched_priority: 0 };
    // What:     `let result = unsafe { libc::sched_setscheduler(0, libc::SCHED_IDLE, &param) };`.
    //           Call the C function. `unsafe { ... }` is required for ANY raw FFI call
    //           (Rust cannot verify the C contract). The first arg `0` means "the
    //           calling thread"; `libc::SCHED_IDLE` selects the idle class; `&param`
    //           lends the struct as a raw pointer. Returns `0` on success, `-1` on
    //           error (a `c_int`).
    // Why:      Actually change this thread's scheduling class.
    // TS map:   `const result = schedSetscheduler(0, SCHED_IDLE, param);`
    let result = unsafe { libc::sched_setscheduler(0, libc::SCHED_IDLE, &param) };
    // What:     `if result != 0 { eprintln!(...); }`. On failure, log to stderr and
    //           carry on. `result` is `-1` on error.
    // Why:      Best-effort: a failure just means the sweep runs at normal priority,
    //           which is still correct, only less polite. Never abort the sweep.
    // TS map:   `if (result !== 0) console.error("...");`
    if result != 0 {
        eprintln!("music-player: could not lower sweep thread to SCHED_IDLE");
    }
}

// What:     `#[cfg(not(target_os = "linux"))] fn lower_current_thread_to_idle()`. The
//           no-op fallback compiled on every NON-Linux target.
// Why:      Keep `run_sweep` portable: the call site stays the same and simply does
//           nothing where the syscall is unavailable.
// TS map:   `function lowerCurrentThreadToIdle() {}`
#[cfg(not(target_os = "linux"))]
fn lower_current_thread_to_idle() {}

// What:     `fn flush_pending(cache: &Arc<Mutex<PeakCache>>)`. Persist any unsaved
//           cache entries to disk WITHOUT holding the cache lock during the file
//           write. `&Arc<...>` borrows the shared handle (we do not take ownership).
//           Module-private.
// Why:      The sweep runs at idle priority; if it held the mutex across the disk
//           write and got starved, the engine thread (which locks the cache on track
//           load) would block. So we snapshot under the lock, release it, write, then
//           briefly re-lock only to update the counter.
// TS map:   `function flushPending(cache: SharedPeakCache): void`
fn flush_pending(cache: &Arc<Mutex<PeakCache>>) {
    // What:     `let snapshot = { let guard = cache.lock().unwrap(); guard.pending_save() };`.
    //           Lock the cache, take an owned `(path, json, count)` snapshot (or
    //           `None`), and release the lock at the end of the block. `.lock()`
    //           returns a `Result` (poisoned if a holder panicked); `.unwrap()` takes
    //           the guard or panics.
    // Why:      Serialize while locked (fast, in-memory); write while unlocked.
    // TS map:   `const snapshot = withLock(cache, c => c.pendingSave());`
    let snapshot = {
        let guard = cache.lock().unwrap();
        guard.pending_save()
    };
    // What:     `if let Some((path, json, count)) = snapshot { ... }`. Only write when
    //           there was something to save. Destructures the owned tuple.
    // Why:      Skip the disk entirely when nothing changed.
    // TS map:   `if (snapshot) { const [path, json, count] = snapshot; ... }`
    if let Some((path, json, count)) = snapshot {
        // What:     `if peakcache::write_atomic(&path, &json).is_ok() { ... }`. Do the
        //           file write with NO lock held; `.is_ok()` checks the `Result`
        //           without unwrapping (an IO error just means we retry next interval).
        // Why:      The slow part happens off the lock; only update the counter if the
        //           write actually landed.
        // TS map:   `let ok = true; try { writeAtomic(path, json); } catch { ok = false; } if (ok) {...}`
        if peakcache::write_atomic(&path, &json).is_ok() {
            // What:     `cache.lock().unwrap().mark_saved(count);`. Re-lock briefly and
            //           subtract the snapshot's entry count from the unsaved counter.
            // Why:      Record that these entries are now on disk.
            // TS map:   `withLock(cache, c => c.markSaved(count));`
            cache.lock().unwrap().mark_saved(count);
        }
    }
}

// What:     `fn run_sweep(tracks: Vec<PathBuf>, cache: Arc<Mutex<PeakCache>>)`. The
//           background body: measure each uncached track, batching saves, sleeping
//           briefly after each real measurement. Module-private.
// Why:      Keep the thread logic in one place.
// TS map:   `function runSweep(tracks: string[], cache: SharedPeakCache): void`
fn run_sweep(tracks: Vec<PathBuf>, cache: Arc<Mutex<PeakCache>>) {
    // What:     `lower_current_thread_to_idle();`. Drop this thread to idle scheduling
    //           priority before any decoding (no-op off Linux).
    // Why:      Make the whole sweep non-disruptive: its CPU-heavy decoding yields to
    //           audio, UI, and everything else.
    // TS map:   `lowerCurrentThreadToIdle();`
    lower_current_thread_to_idle();
    // What:     `let mut last_save = Instant::now();`. Remember when we last flushed the
    //           cache to disk. `let mut` because we update it after each save.
    // Why:      Drive the time-based flush (every `SAVE_INTERVAL_SECS`) so progress
    //           survives an early quit.
    // TS map:   `let lastSave = performance.now();`
    let mut last_save = Instant::now();
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
        // What:     `let unsaved = { let mut guard = cache.lock().unwrap(); guard.insert(key, peak); guard.unsaved() };`.
        //           Lock the cache, record the measurement, read the unsaved count, and
        //           release the lock at the end of the block.
        // Why:      Memoize the peak; the count decides whether a batch flush is due.
        // TS map:   `const unsaved = withLock(cache, c => { c.insert(key, peak); return c.unsaved(); });`
        let unsaved = {
            // What:     `let mut guard = cache.lock().unwrap();`. Take the lock to mutate.
            // Why:      Insert under the lock.
            // TS map:   `const guard = lock(cache);`
            let mut guard = cache.lock().unwrap();
            // What:     `guard.insert(key, peak);`. Record the measurement.
            // Why:      Memoize.
            // TS map:   `guard.insert(key, peak);`
            guard.insert(key, peak);
            // What:     `guard.unsaved()`. Tail of the block -> the count value.
            // Why:      Hand the count out of the locked scope.
            // TS map:   `return guard.unsaved();`
            guard.unsaved()
        };
        // What:     `if unsaved >= SAVE_BATCH || last_save.elapsed() >= Duration::from_secs(SAVE_INTERVAL_SECS) { ... }`.
        //           Flush when a batch has accumulated OR enough time has passed.
        //           `last_save.elapsed()` is the `Duration` since the last flush.
        // Why:      The batch bound amortizes writes when measuring many tracks fast
        //           (warm restart); the time bound guarantees progress is saved even
        //           when each decode is slow at idle priority.
        // TS map:   `if (unsaved >= SAVE_BATCH || (now - lastSave) >= SAVE_INTERVAL) { ... }`
        if unsaved >= SAVE_BATCH
            || last_save.elapsed() >= Duration::from_secs(SAVE_INTERVAL_SECS)
        {
            // What:     `flush_pending(&cache);`. Persist out-of-lock.
            // Why:      Write the accumulated measurements without blocking the engine.
            // TS map:   `flushPending(cache);`
            flush_pending(&cache);
            // What:     `last_save = Instant::now();`. Reset the flush timer.
            // Why:      Start the next interval from now.
            // TS map:   `lastSave = performance.now();`
            last_save = Instant::now();
        }
        // What:     `thread::sleep(Duration::from_millis(MEASURE_GAP_MS));`. Pause after a
        //           real measurement.
        // Why:      Extra politeness on top of idle priority: a fixed gap between tracks.
        // TS map:   `await sleep(MEASURE_GAP_MS);`
        thread::sleep(Duration::from_millis(MEASURE_GAP_MS));
    }
    // What:     `flush_pending(&cache);`. Final flush of any entries left below the
    //           batch threshold, out-of-lock.
    // Why:      Do not lose the tail of the queue's measurements.
    // TS map:   `flushPending(cache);`
    flush_pending(&cache);
}

// What:     `#[cfg(test)] mod tests { ... }`. Test-only submodule.
// Why:      Cover the synchronous gain resolution and the background sweep.
// TS map:   a `measure.test.ts`.
#[cfg(test)]
mod tests {
    // What:     `use super::*;`. Bring the module's items into the test scope.
    // Why:      Tests use `resolve_track_gain`, `spawn_queue_measurement`, `PeakCache`, etc.
    // TS map:   `import * as parent from "./measure";`
    use super::*;
    // What:     `use std::time::{SystemTime, UNIX_EPOCH};`. Clock + epoch for unique names.
    // Why:      Build a collision-free throwaway cache path.
    // TS map:   `Date.now()`.
    use std::time::{SystemTime, UNIX_EPOCH};

    // What:     `fn temp_cache(tag: &str) -> PathBuf`. A fresh throwaway cache-file path.
    // Why:      Point the cache at disposable state, never the real config dir.
    // TS map:   `function tempCache(tag: string): string`
    fn temp_cache(tag: &str) -> PathBuf {
        // What:     `let nanos = ...as_nanos();`. Nanoseconds since 1970 for uniqueness.
        // Why:      Avoid collisions across tests/runs.
        // TS map:   `const nanos = BigInt(Date.now()) * 1_000_000n;`
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        // What:     build the path under the system temp dir. Tail -> return.
        // Why:      Disposable location.
        // TS map:   `return join(os.tmpdir(), `mp-measure-${pid}-${nanos}-${tag}.json`);`
        std::env::temp_dir().join(format!(
            "mp-measure-{}-{}-{}.json",
            std::process::id(),
            nanos,
            tag
        ))
    }

    // What:     `#[test]` for the synchronous path.
    // Why:      A cache miss measures and caches; the quiet fixture (sub-ceiling) yields
    //           unity gain (attenuate-only leaves it unchanged).
    // TS map:   `test("resolve_track_gain ...", () => {...})`
    #[test]
    fn resolve_track_gain_measures_caches_and_leaves_quiet_track_unchanged() {
        // What:     `let path = temp_cache("resolve");`. Throwaway cache file.
        // Why:      No real-config pollution.
        // TS map:   `const path = tempCache("resolve");`
        let path = temp_cache("resolve");
        // What:     `let cache = Arc::new(Mutex::new(PeakCache::from_path(Some(path.clone()))));`.
        //           Shared empty cache pointing at the temp file.
        // Why:      The shape `resolve_track_gain` expects.
        // TS map:   `const cache = shared(PeakCache.fromPath(path));`
        let cache = Arc::new(Mutex::new(PeakCache::from_path(Some(path.clone()))));

        // What:     `let gain = resolve_track_gain(Path::new("fixtures/tone.flac"), &cache);`.
        //           Cache miss -> measures the fixture, stores it, returns the gain.
        // Why:      Exercise the miss path end-to-end.
        // TS map:   `const gain = resolveTrackGain("fixtures/tone.flac", cache);`
        let gain = resolve_track_gain(Path::new("fixtures/tone.flac"), &cache);
        // What:     `assert!((gain - 1.0).abs() < 1e-4, ...)`. The fixture peaks ~0.088,
        //           below the -1 dBTP ceiling, so attenuate-only normalization returns 1.0.
        // Why:      Quiet tracks must not be boosted.
        // TS map:   `expect(Math.abs(gain - 1) < 1e-4).toBe(true);`
        assert!((gain - 1.0).abs() < 1e-4, "gain was {gain}");

        // What:     `let key = peakcache::fingerprint(Path::new("fixtures/tone.flac")).unwrap();`.
        //           The cache key for the fixture.
        // Why:      Confirm the measurement was memoized.
        // TS map:   `const key = fingerprint("fixtures/tone.flac");`
        let key = peakcache::fingerprint(Path::new("fixtures/tone.flac")).unwrap();
        // What:     `assert!(cache.lock().unwrap().get(&key).is_some());`. The peak is cached.
        // Why:      A second load would hit the cache.
        // TS map:   `expect(cache.get(key)).toBeDefined();`
        assert!(cache.lock().unwrap().get(&key).is_some());

        // What:     clean up the temp cache file.
        // Why:      No droppings.
        // TS map:   `try { unlinkSync(path); } catch {}`
        let _ = std::fs::remove_file(&path);
    }

    // What:     `#[test]` for the background sweep.
    // Why:      Spawning over a track must populate the shared cache.
    // TS map:   `test("spawn_queue_measurement ...", () => {...})`
    #[test]
    fn spawn_queue_measurement_populates_cache() {
        // What:     `let path = temp_cache("sweep");`. Throwaway cache file.
        // Why:      Disposable state.
        // TS map:   `const path = tempCache("sweep");`
        let path = temp_cache("sweep");
        // What:     shared empty cache at the temp file.
        // Why:      The sweep writes here.
        // TS map:   `const cache = shared(PeakCache.fromPath(path));`
        let cache = Arc::new(Mutex::new(PeakCache::from_path(Some(path.clone()))));
        // What:     `let fixture = PathBuf::from("fixtures/tone.flac");`. The track to sweep.
        // Why:      A real file the sweep can measure.
        // TS map:   `const fixture = "fixtures/tone.flac";`
        let fixture = PathBuf::from("fixtures/tone.flac");

        // What:     `spawn_queue_measurement(vec![fixture.clone()], Arc::clone(&cache));`.
        //           Start the detached sweep over a one-track queue.
        // Why:      The behaviour under test.
        // TS map:   `spawnQueueMeasurement([fixture], cache);`
        spawn_queue_measurement(vec![fixture.clone()], Arc::clone(&cache));

        // What:     `let key = peakcache::fingerprint(&fixture).unwrap();`. The cache key.
        // Why:      Poll for it.
        // TS map:   `const key = fingerprint(fixture);`
        let key = peakcache::fingerprint(&fixture).unwrap();
        // What:     `let mut found: Option<f32> = None;`. The peak once the sweep stores it.
        // Why:      Collected by polling.
        // TS map:   `let found: number | null = null;`
        let mut found: Option<f32> = None;
        // What:     `for _ in 0..100 { ... }`. Poll up to 100 times (~5s) for the entry.
        //           `_` ignores the loop counter.
        // Why:      The sweep runs on another thread; wait for it without hanging forever.
        // TS map:   `for (let i = 0; i < 100; i++) { ... }`
        for _ in 0..100 {
            // What:     `if let Some(peak) = cache.lock().unwrap().get(&key) { found = Some(peak); break; }`.
            //           Check the shared cache; stop once present.
            // Why:      Detect completion.
            // TS map:   `const p = cache.get(key); if (p !== undefined) { found = p; break; }`
            if let Some(peak) = cache.lock().unwrap().get(&key) {
                found = Some(peak);
                break;
            }
            // What:     `thread::sleep(Duration::from_millis(50));`. Wait before re-checking.
            // Why:      Give the sweep time without busy-spinning.
            // TS map:   `await sleep(50);`
            thread::sleep(Duration::from_millis(50));
        }

        // What:     `let peak = found.expect("background sweep did not populate the cache");`.
        //           Unwrap the polled value or fail with a message.
        // Why:      The sweep must have measured the fixture.
        // TS map:   `if (found === null) throw new Error("...");`
        let peak = found.expect("background sweep did not populate the cache");
        // What:     `assert!(peak > 0.05 && peak < 0.2, ...)`. The fixture's real level.
        // Why:      Confirm a sane measured value, not garbage.
        // TS map:   `expect(peak > 0.05 && peak < 0.2).toBe(true);`
        assert!(peak > 0.05 && peak < 0.2, "peak was {peak}");

        // What:     clean up the temp cache file.
        // Why:      No droppings.
        // TS map:   `try { unlinkSync(path); } catch {}`
        let _ = std::fs::remove_file(&path);
    }
}
