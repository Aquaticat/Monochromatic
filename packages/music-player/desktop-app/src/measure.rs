//! Background queue true-peak measurement.
//!
//! On every queue load the controller starts a background sweep over the queue's
//! non-current tracks; it measures only the ones not already cached, gently (a
//! short sleep between measurements) so it does not starve the audio thread.
//! Sweeps are never cancelled: re-opening a directory just finds most peaks
//! already cached and returns quickly. The current track is handled by
//! `peak_swap`, because playback may wait briefly for that one visible result.

// What:     `use std::path::PathBuf;`. Owned filesystem path buffer. Sibling:
//           `&Path`, a borrowed path view, is not needed here because the sweep
//           owns a list of paths.
// Why:      The detached sweep thread needs paths that outlive the caller.
//
// In TS you'd write (pseudocode):
// ```ts
// type PathBuf = string;
// ```
/// Imports.
use std::path::PathBuf;

// What:     `use std::sync::{Arc, Mutex};`. `Arc<T>` is a thread-safe shared owner
//           (atomic reference count; sibling: `Rc<T>`, single-thread only). `Mutex<T>`
//           guards `T` so only one thread touches it at a time.
// Why:      The cache is shared between the engine thread and background sweeps.
//
// In TS you'd write (pseudocode):
// ```ts
// // Arc<Mutex<T>> ~ a shared object you must lock() before touching
// ```
/// Imports.
use std::sync::{Arc, Mutex};

// What:     `use std::thread;`. Thread spawning.
// Why:      The background sweep runs on its own thread.
//
// In TS you'd write (pseudocode):
// ```ts
// // std::thread ~ Web Workers
// ```
/// Imports.
use std::thread;

// What:     `use std::time::{Duration, Instant};`. `Duration` is a span of time;
//           `Instant` is a monotonic clock reading (a point in time you can measure
//           elapsed time from). Sibling you might expect: `SystemTime` (wall clock, can
//           jump backwards); `Instant` is the right one for "how long since X".
// Why:      `Duration` for the gentle sleep and the save interval; `Instant` to know when
//           the last save happened so we can flush on a time bound.
//
// In TS you'd write (pseudocode):
// ```ts
// // Duration ~ ms number; Instant ~ performance.now()
// ```
/// Imports.
use std::time::{Duration, Instant};

// What:     `use crate::peakcache::{self, PeakCache};`. The cache module (for
//           `peakcache::fingerprint`) and the `PeakCache` type.
// Why:      Look up and store measured peaks.
//
// In TS you'd write (pseudocode):
// ```ts
// import * as peakcache from "./peakcache";
// import { PeakCache } from "./peakcache";
// ```
/// Imports.
use crate::peakcache::{self, PeakCache};

// What:     `use crate::truepeak::measure_true_peak;`. The whole-file true-peak
//           scanner.
// Why:      Background sweeps decode uncached tracks and cache their raw peaks.
//
// In TS you'd write (pseudocode):
// ```ts
// import { measureTruePeak } from "./truepeak";
// ```
/// Imports.
use crate::truepeak::measure_true_peak;

// What:     `const SAVE_BATCH: usize = 16;`. Persist the cache after this many new
//           measurements during a sweep. `usize` to compare with the unsaved count.
// Why:      Avoid rewriting the file once per track over a long queue.
//
// In TS you'd write (pseudocode):
// ```ts
// const SAVE_BATCH = 16;
// ```
/// Save batch.
const SAVE_BATCH: usize = 16;

// What:     `const MEASURE_GAP_MS: u64 = 20;`. Milliseconds to sleep after measuring one
//           track. `u64` is what `Duration::from_millis` wants.
// Why:      Yield CPU so the background scan does not starve the realtime audio path.
//
// In TS you'd write (pseudocode):
// ```ts
// const MEASURE_GAP_MS = 20;
// ```
/// Measure gap ms.
const MEASURE_GAP_MS: u64 = 20;

// What:     `const SAVE_INTERVAL_SECS: u64 = 10;`. Maximum seconds between cache flushes
//           during a sweep, independent of how many tracks were measured. `u64` is what
//           `Duration::from_secs` wants.
// Why:      The sweep is detached and dies at process exit, so anything unsaved when the
//           user quits is lost and re-measured next launch. Flushing at least this often
//           bounds that loss to ~10 seconds of work, so a large library actually finishes
//           caching across short sessions instead of restarting.
//
// In TS you'd write (pseudocode):
// ```ts
// const SAVE_INTERVAL_SECS = 10;
// ```
/// Save interval secs.
const SAVE_INTERVAL_SECS: u64 = 10;

// What:     `pub(crate) fn spawn_queue_measurement(tracks: Vec<PathBuf>, cache: Arc<Mutex<PeakCache>>)`.
//           Start a detached background thread that measures every uncached track in
//           `tracks` into the shared cache. Takes ownership of both arguments (moved into
//           the thread). `pub(crate)` for the controller.
// Why:      Pre-warm the cache for the whole queue so later track changes are instant.
//
// In TS you'd write (pseudocode):
// ```ts
// function spawnQueueMeasurement(tracks: string[], cache: SharedPeakCache): void { ... }
// ```
/// Spawn queue measurement.
pub(crate) fn spawn_queue_measurement(tracks: Vec<PathBuf>, cache: Arc<Mutex<PeakCache>>) {
    // What:     `thread::spawn(move || run_sweep(tracks, cache));`. Spawn a worker. The
    //           `move ||` closure TAKES OWNERSHIP of `tracks` and `cache`. We drop the
    //           returned `JoinHandle` (detached): the thread runs to completion on its own,
    //           and is killed at process exit (atomic saves keep the file intact).
    // Why:      Background work that does not block the engine and needs no join/cancel.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // startWorker(() => runSweep(tracks, cache)); // fire and forget
    // ```
    thread::spawn(move || run_sweep(tracks, cache));
}

// What:     `#[cfg(target_os = "linux")] fn lower_current_thread_to_idle()`. Move the
//           CALLING thread into the Linux `SCHED_IDLE` scheduling class. The `#[cfg(...)]`
//           attribute compiles this version ONLY on Linux.
// Why:      The sweep decodes whole files back-to-back (CPU-bound). `SCHED_IDLE` threads
//           run only when no normal-priority thread wants the CPU, on ANY core, so the
//           sweep never competes with the realtime audio thread, the UI, or other
//           applications. It still finishes when the machine is otherwise idle.
//
// In TS you'd write (pseudocode):
// ```ts
// // no equivalent: JS runtimes expose no per-thread scheduling class
// ```
#[cfg(target_os = "linux")]
/// Lower current thread to idle.
fn lower_current_thread_to_idle() {
    // What:     `let param = libc::sched_param { sched_priority: 0 };`. The scheduler
    //           parameter struct; `SCHED_IDLE` ignores the priority, so 0 is the only valid
    //           value. `libc::` names the raw C library bindings.
    // Why:      `sched_setscheduler` requires a `*const sched_param` argument.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const param = { sched_priority: 0 };
    // ```
    let param = libc::sched_param { sched_priority: 0 };
    // What:     `let result = unsafe { libc::sched_setscheduler(0, libc::SCHED_IDLE, &param) };`.
    //           Call the C function. `unsafe { ... }` is required for ANY raw FFI call (Rust
    //           cannot verify the C contract). The first arg `0` means "the calling thread";
    //           `libc::SCHED_IDLE` selects the idle class; `&param` lends the struct as a
    //           raw pointer. Returns `0` on success, `-1` on error (a `c_int`).
    // Why:      Actually change this thread's scheduling class.
    // Gotcha:   `unsafe` here does NOT mean "dangerous"; it means "the compiler trusts ME
    //           that this C call's contract is upheld". TS has no such opt-out.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const result = schedSetscheduler(0, SCHED_IDLE, param);
    // ```
    let result = unsafe { libc::sched_setscheduler(0, libc::SCHED_IDLE, &param) };
    // What:     `if result != 0 { eprintln!(...); }`. On failure, log to stderr and carry
    //           on. `result` is `-1` on error.
    // Why:      Best-effort: a failure just means the sweep runs at normal priority, which
    //           is still correct, only less polite. Never abort the sweep.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (result !== 0) console.error("music-player: could not lower sweep thread");
    // ```
    if result != 0 {
        eprintln!("music-player: could not lower sweep thread to SCHED_IDLE");
    }
}

// What:     `#[cfg(target_os = "macos")] fn lower_current_thread_to_idle()`. The macOS
//           version: drop the CALLING thread into the BACKGROUND Quality of Service (QoS)
//           class. `#[cfg(target_os = "macos")]` compiles it only on macOS (siblings:
//           `target_os = "linux"`, `windows`).
// Why:      macOS schedules threads by QoS class, not by the POSIX scheduling classes
//           Linux uses, so the Linux SCHED_IDLE call does not exist here.
//           `QOS_CLASS_BACKGROUND` is the lowest tier: the sweep's CPU-bound decoding
//           yields to the realtime audio thread, the UI, and foreground apps, the same
//           intent as the Linux path.
//
// In TS you'd write (pseudocode):
// ```ts
// // no equivalent: JS runtimes expose no per-thread QoS class
// ```
#[cfg(target_os = "macos")]
/// Lower current thread to idle.
fn lower_current_thread_to_idle() {
    // What:     `let result = unsafe { libc::pthread_set_qos_class_self_np(libc::qos_class_t::QOS_CLASS_BACKGROUND, 0) };`.
    //           Call the Apple-specific libc function that sets the CURRENT thread's QoS
    //           class. `unsafe { ... }` is required for ANY raw FFI call (Rust cannot verify
    //           the C contract). `libc::qos_class_t::QOS_CLASS_BACKGROUND` is a VARIANT of
    //           the `qos_class_t` C enum (NOT a top-level `libc::` constant), and it is the
    //           lowest QoS tier; the function's first parameter is typed `qos_class_t`, so
    //           the variant is passed directly. The second argument is a relative-priority
    //           offset WITHIN that class (`0` = no offset). Returns `0` on success, a
    //           nonzero errno on failure.
    // Why:      Actually lower this thread's scheduling tier.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const result = pthreadSetQosClassSelfNp(QOS_CLASS_BACKGROUND, 0);
    // ```
    let result =
        unsafe { libc::pthread_set_qos_class_self_np(libc::qos_class_t::QOS_CLASS_BACKGROUND, 0) };
    // What:     `if result != 0 { eprintln!(...); }`. On failure, log to stderr and carry
    //           on. `result` is a nonzero errno on error.
    // Why:      Best-effort, exactly like the Linux path: a failure just means the sweep
    //           runs at normal priority, which is still correct.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (result !== 0) console.error("music-player: could not lower sweep thread");
    // ```
    if result != 0 {
        eprintln!("music-player: could not lower sweep thread to background QoS");
    }
}

// What:     `#[cfg(windows)] fn lower_current_thread_to_idle()`. The Windows version: set
//           the CALLING thread to the IDLE priority level. `#[cfg(windows)]` compiles it
//           only on Windows.
// Why:      Windows schedules by per-thread priority level, not POSIX classes or QoS.
//           `THREAD_PRIORITY_IDLE` is the lowest level: the sweep runs only when no
//           higher-priority thread wants the CPU, the same intent as Linux SCHED_IDLE and
//           macOS background QoS.
//
// In TS you'd write (pseudocode):
// ```ts
// // no equivalent: JS runtimes expose no per-thread priority level
// ```
#[cfg(windows)]
/// Lower current thread to idle.
fn lower_current_thread_to_idle() {
    // What:     `use windows::Win32::System::Threading::{GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_IDLE};`.
    //           Import the Win32 thread-priority bindings from the `windows` crate. A
    //           function-local `use` keeps these Windows-only names out of the module's top
    //           scope (they exist only in a Windows build).
    // Why:      Name the three Win32 items the call below needs.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // import { GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_IDLE } from "windows";
    // ```
    /// Imports.
    use windows::Win32::System::Threading::{
        GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_IDLE,
    };
    // What:     `let handle = unsafe { GetCurrentThread() };`. Get a PSEUDO-HANDLE to the
    //           current thread: a special constant that always means "this thread" and never
    //           needs closing. `unsafe` because it is a raw Win32 FFI call. Returns a
    //           `HANDLE`.
    // Why:      `SetThreadPriority` needs a thread handle to act on.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const handle = getCurrentThread();
    // ```
    let handle = unsafe { GetCurrentThread() };
    // What:     `let result = unsafe { SetThreadPriority(handle, THREAD_PRIORITY_IDLE) };`.
    //           Set this thread's priority to the idle level. In the high-level `windows`
    //           crate this returns `windows::core::Result<()>` (`Ok(())` on success, `Err`
    //           carrying the Win32 error), NOT the raw `BOOL` the C API returns.
    // Why:      Actually lower this thread's priority.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const result = setThreadPriority(handle, THREAD_PRIORITY_IDLE);
    // ```
    let result = unsafe { SetThreadPriority(handle, THREAD_PRIORITY_IDLE) };
    // What:     `if result.is_err() { eprintln!(...); }`. `.is_err()` is true when the
    //           `Result` is the error variant. On failure, log and carry on.
    // Why:      Best-effort, exactly like the other platforms.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!ok) console.error("music-player: could not lower sweep thread");
    // ```
    if result.is_err() {
        eprintln!("music-player: could not lower sweep thread to idle priority");
    }
}

// What:     `#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))] fn lower_current_thread_to_idle() {}`.
//           The no-op fallback compiled on every OTHER target (for example the BSDs) where
//           no scheduling call is wired up. `not(any(...))` is true only when NONE of the
//           listed cfg predicates hold. Empty body `{}`.
// Why:      Keep `run_sweep` portable: the call site stays the same and simply does nothing
//           where we have not implemented a scheduling tweak.
//
// In TS you'd write (pseudocode):
// ```ts
// function lowerCurrentThreadToIdle() {} // fallback no-op
// ```
#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
/// Lower current thread to idle.
fn lower_current_thread_to_idle() {}

// What:     `fn run_sweep(tracks: Vec<PathBuf>, cache: Arc<Mutex<PeakCache>>)`. The
//           background body: measure each uncached track, batching saves, sleeping briefly
//           after each real measurement. Takes ownership of both args. Module-private.
// Why:      Keep the thread logic in one place.
//
// In TS you'd write (pseudocode):
// ```ts
// function runSweep(tracks: string[], cache: SharedPeakCache): void { ... }
// ```
/// Run sweep.
fn run_sweep(tracks: Vec<PathBuf>, cache: Arc<Mutex<PeakCache>>) {
    // What:     `lower_current_thread_to_idle();`. Drop this thread to idle scheduling
    //           priority before any decoding (no-op off Linux/macOS/Windows).
    // Why:      Make the whole sweep non-disruptive: its CPU-heavy decoding yields to audio,
    //           UI, and everything else.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // lowerCurrentThreadToIdle();
    // ```
    lower_current_thread_to_idle();
    // What:     `let mut last_save = Instant::now();`. Remember when we last flushed the
    //           cache to disk. `let mut` because we update it after each save.
    // Why:      Drive the time-based flush (every `SAVE_INTERVAL_SECS`) so progress survives
    //           an early quit.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let lastSave = performance.now();
    // ```
    let mut last_save = Instant::now();
    // What:     `for path in tracks { ... }`. Consume each path by value.
    // Why:      Visit every queue entry.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const path of tracks) { ... }
    // ```
    for path in tracks {
        // What:     `let key = match peakcache::fingerprint(&path) { Some(k) => k, None => continue };`.
        //           Compute the key, or skip this file if it cannot be stat'd.
        // Why:      No key -> cannot cache it; move on.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const key = fingerprint(path); if (!key) continue;
        // ```
        let key = match peakcache::fingerprint(&path) {
            // What:     `Some(k) => k`. Unwrap the key.
            // Why:      Use it for the cache.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // key = k;
            // ```
            Some(k) => k,
            // What:     `None => continue`. No key: skip this track.
            // Why:      Cannot cache an un-stat'able file.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // continue;
            // ```
            None => continue,
        };
        // What:     `let already = cache.lock().unwrap().get(&key).is_some();`. Is it already
        //           measured? Lock briefly, check, release. `.is_some()` is true when the
        //           `Option` has a value.
        // Why:      Skip cached tracks (the re-open-a-known-dir fast path).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const already = withLock(cache, (c) => c.get(key) !== undefined);
        // ```
        let already = cache.lock().unwrap().get(&key).is_some();
        // What:     `if already { continue; }`. Nothing to do; no sleep, so warm directories
        //           sweep through quickly.
        // Why:      Avoid redundant decoding.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (already) continue;
        // ```
        if already {
            continue;
        }
        // What:     `let peak = match measure_true_peak(&path) { Ok(p) => p, Err(_) => continue };`.
        //           Measure; skip files that fail to decode.
        // Why:      One bad file must not abort the sweep.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let peak; try { peak = measureTruePeak(path); } catch { continue; }
        // ```
        let peak = match measure_true_peak(&path) {
            // What:     `Ok(p) => p`. Unwrap the measured peak.
            // Why:      Cache it below.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // peak = p;
            // ```
            Ok(p) => p,
            // What:     `Err(_) => continue`. Decode failed: skip, discard the error.
            // Why:      Be robust to one bad file.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // continue;
            // ```
            Err(_) => continue,
        };
        // What:     `let unsaved = { let mut guard = cache.lock().unwrap(); guard.insert(key, peak); guard.unsaved() };`.
        //           A BLOCK EXPRESSION: lock the cache, record the measurement, read the
        //           unsaved count, and release the lock at the end of the block.
        // Why:      Memoize the peak; the count decides whether a batch flush is due.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const unsaved = withLock(cache, (c) => { c.insert(key, peak); return c.unsaved(); });
        // ```
        let unsaved = {
            // What:     `let mut guard = cache.lock().unwrap();`. Take the lock to mutate.
            // Why:      Insert under the lock.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const guard = lock(cache);
            // ```
            let mut guard = cache.lock().unwrap();
            // What:     `guard.insert(key, peak);`. Record the measurement.
            // Why:      Memoize.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // guard.insert(key, peak);
            // ```
            guard.insert(key, peak);
            // What:     `guard.unsaved()`. Tail of the block -> the count value.
            // Why:      Hand the count out of the locked scope.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return guard.unsaved();
            // ```
            guard.unsaved()
        };
        // What:     `if unsaved >= SAVE_BATCH || last_save.elapsed() >= Duration::from_secs(SAVE_INTERVAL_SECS) { ... }`.
        //           Flush when a batch has accumulated OR enough time has passed.
        //           `last_save.elapsed()` is the `Duration` since the last flush. `||`
        //           short-circuits.
        // Why:      The batch bound amortizes writes when measuring many tracks fast (warm
        //           restart); the time bound guarantees progress is saved even when each
        //           decode is slow at idle priority.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (unsaved >= SAVE_BATCH || (performance.now() - lastSave) >= SAVE_INTERVAL_SECS * 1000) { ... }
        // ```
        if unsaved >= SAVE_BATCH
            || last_save.elapsed() >= Duration::from_secs(SAVE_INTERVAL_SECS)
        {
            // What:     `peakcache::flush(&cache);`. Persist out-of-lock.
            // Why:      Write the accumulated measurements without blocking the engine.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // flush(cache);
            // ```
            peakcache::flush(&cache);
            // What:     `last_save = Instant::now();`. Reset the flush timer.
            // Why:      Start the next interval from now.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // lastSave = performance.now();
            // ```
            last_save = Instant::now();
        }
        // What:     `thread::sleep(Duration::from_millis(MEASURE_GAP_MS));`. Pause after a
        //           real measurement (blocks this thread for the gap).
        // Why:      Extra politeness on top of idle priority: a fixed gap between tracks.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // await sleep(MEASURE_GAP_MS);
        // ```
        thread::sleep(Duration::from_millis(MEASURE_GAP_MS));
    }
    // What:     `peakcache::flush(&cache);`. Final flush of any entries left below the batch
    //           threshold, out-of-lock.
    // Why:      Do not lose the tail of the queue's measurements.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // flush(cache);
    // ```
    peakcache::flush(&cache);
}

// What:     `#[cfg(test)] #[path = "measure_tests.rs"] mod tests;` declares a test-only
//           submodule whose code lives in the sibling file `measure_tests.rs`.
//           `#[cfg(test)]` gates it to test builds only; `#[path = "..."]` aims the module
//           at a flat sibling file instead of the default `measure/tests.rs` subdirectory
//           lookup. The file stays the `tests` CHILD of measure, so its `use super::*`
//           reaches the module items (including private ones) unchanged.
// Why:      Keep `measure.rs` to production code; the tests live beside it without
//           inflating this file or its max-lines budget (sibling `*_tests.rs` files are
//           exempt from the linter).
//
// In TS you'd write (pseudocode):
// ```ts
// // measure.unit.test.ts, run only by the test runner
// ```
#[cfg(test)]
#[path = "measure_tests.rs"]
/// Tests module.
mod tests;
