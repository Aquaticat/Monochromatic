//! Parallel background queue true-peak measurement.
//!
//! On every queue load the controller starts a background sweep over the queue's
//! non-current tracks. The sweep fans out one worker per logical core; each worker
//! claims tracks from a shared atomic cursor, skips the ones already cached, and
//! decodes the rest to measure their true peak, storing each result through the
//! `CacheHandle`. Workers run at idle OS scheduling priority, so they saturate every
//! core when the machine is otherwise free yet yield to the realtime audio thread
//! and the UI. There is no inter-track sleep (the old throttle that fought "finish
//! as fast as possible") and no flush bookkeeping: the cache actor commits each
//! write durably. Sweeps are never cancelled: re-opening a directory finds most
//! peaks already cached (via the one key-set snapshot) and returns quickly. The
//! current track is handled by `peak_swap`, because playback may wait briefly for
//! that one visible result.

/// What:     `use std::collections::HashSet;`. A set of `u64` fingerprints.
/// Why:      The skip-check reads one snapshot of every already-exact fingerprint.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type HashSet = Set<string>;
/// ```
use std::collections::HashSet;

/// What:     `use std::path::PathBuf;`. Owned filesystem path buffer.
/// Why:      The detached workers need paths that outlive the caller.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PathBuf = string;
/// ```
use std::path::PathBuf;

/// What:     `use std::sync::Arc;`. Thread-safe shared owner (atomic refcount).
/// Why:      Workers share the track list, the cursor, and the key-set snapshot.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // Arc<T> ~ a shared, cloneable handle to one T
/// ```
use std::sync::Arc;

/// What:     `use std::sync::atomic::{AtomicUsize, Ordering};`. A shared integer with
///           atomic operations, plus the memory-ordering selector.
/// Why:      The cursor is a lock-free counter workers `fetch_add` to claim work.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // AtomicUsize ~ an integer with atomic fetchAdd
/// ```
use std::sync::atomic::{AtomicUsize, Ordering};

/// What:     `use std::thread;`. Thread spawning and `available_parallelism`.
/// Why:      The coordinator spawns one worker per logical core.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // std::thread ~ Web Workers
/// ```
use std::thread;

/// What:     `use crate::peakcache::{self, CacheHandle};`. The cache module (for
///           `peakcache::fingerprint`) and the synchronous handle type.
/// Why:      Compute keys and store measured peaks.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as peakcache from "./peakcache";
/// import { CacheHandle } from "./peakcache";
/// ```
use crate::peakcache::{self, CacheHandle};

/// What:     `use crate::truepeak::resolve_full;`. The always-exact full-scan resolver.
/// Why:      Warming workers upgrade uncached-or-probe tracks to an EXACT decision, which the
///           cache's exact-over-probe precedence then keeps.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { resolveFull } from "./truepeak";
/// ```
use crate::truepeak::resolve_full;

/// What:     `pub(crate) fn spawn_queue_measurement(tracks: Vec<PathBuf>, cache: CacheHandle)`.
///           Start a detached coordinator that measures every uncached track in `tracks`
///           in parallel, storing results through `cache`. Takes ownership of both
///           arguments. `pub(crate)` for the controller.
/// Why:      Pre-warm the cache for the whole queue so later track changes are instant.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function spawnQueueMeasurement(tracks: string[], cache: CacheHandle): void { ... }
/// ```
pub(crate) fn spawn_queue_measurement(tracks: Vec<PathBuf>, cache: CacheHandle) {
    // What:     `thread::spawn(move || run_sweep(tracks, cache));`. Spawn the detached
    //           coordinator; the closure TAKES OWNERSHIP of both arguments. We drop the
    //           `JoinHandle`: the coordinator runs to completion on its own and is killed
    //           at process exit (each cache write already committed durably).
    // Why:      Background work that does not block the engine and needs no join/cancel.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // startWorker(() => runSweep(tracks, cache)); // fire and forget
    // ```
    thread::spawn(move || run_sweep(tracks, cache));
}

/// What:     `#[cfg(target_os = "linux")] fn lower_current_thread_to_idle()`. Move the
///           CALLING thread into the Linux `SCHED_IDLE` scheduling class. The `#[cfg(...)]`
///           attribute compiles this version ONLY on Linux.
/// Why:      The sweep decodes whole files back-to-back (CPU-bound). `SCHED_IDLE` threads
///           run only when no normal-priority thread wants the CPU, on ANY core, so the
///           sweep never competes with the realtime audio thread, the UI, or other
///           applications. It still finishes when the machine is otherwise idle.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // no equivalent: JS runtimes expose no per-thread scheduling class
/// ```
#[cfg(target_os = "linux")]
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
    //           Call the C function. `unsafe { ... }` is required for ANY raw FFI call. The
    //           first arg `0` means "the calling thread"; `libc::SCHED_IDLE` selects the idle
    //           class; `&param` lends the struct as a raw pointer. Returns `0` on success,
    //           `-1` on error.
    // Why:      Actually change this thread's scheduling class.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const result = schedSetscheduler(0, SCHED_IDLE, param);
    // ```
    let result = unsafe { libc::sched_setscheduler(0, libc::SCHED_IDLE, &param) };
    // What:     `if result != 0 { eprintln!(...); }`. On failure, log and carry on.
    // Why:      Best-effort: a failure just means the sweep runs at normal priority, which
    //           is still correct, only less polite. Never abort the sweep.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (result !== 0) console.error("music-player: could not lower sweep thread");
    // ```
    if result != 0 {
        tracing::warn!("could not lower sweep thread to SCHED_IDLE; running at normal priority");
    }
}

/// What:     `#[cfg(target_os = "macos")] fn lower_current_thread_to_idle()`. The macOS
///           version: drop the CALLING thread into the BACKGROUND Quality of Service (QoS)
///           class. `#[cfg(target_os = "macos")]` compiles it only on macOS.
/// Why:      macOS schedules threads by QoS class, not the POSIX scheduling classes Linux
///           uses, so the Linux SCHED_IDLE call does not exist here. `QOS_CLASS_BACKGROUND`
///           is the lowest tier: the sweep's CPU-bound decoding yields to the realtime audio
///           thread, the UI, and foreground apps, the same intent as the Linux path.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // no equivalent: JS runtimes expose no per-thread QoS class
/// ```
#[cfg(target_os = "macos")]
fn lower_current_thread_to_idle() {
    // What:     `let result = unsafe { libc::pthread_set_qos_class_self_np(libc::qos_class_t::QOS_CLASS_BACKGROUND, 0) };`.
    //           Call the Apple-specific libc function that sets the CURRENT thread's QoS
    //           class. `unsafe { ... }` is required for ANY raw FFI call.
    //           `libc::qos_class_t::QOS_CLASS_BACKGROUND` is a VARIANT of the `qos_class_t`
    //           C enum and is the lowest QoS tier; the second argument is a relative-priority
    //           offset WITHIN that class (`0` = no offset). Returns `0` on success, a nonzero
    //           errno on failure.
    // Why:      Actually lower this thread's scheduling tier.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const result = pthreadSetQosClassSelfNp(QOS_CLASS_BACKGROUND, 0);
    // ```
    let result =
        unsafe { libc::pthread_set_qos_class_self_np(libc::qos_class_t::QOS_CLASS_BACKGROUND, 0) };
    // What:     `if result != 0 { eprintln!(...); }`. On failure, log and carry on.
    // Why:      Best-effort, exactly like the Linux path: a failure just means the sweep
    //           runs at normal priority, which is still correct.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (result !== 0) console.error("music-player: could not lower sweep thread");
    // ```
    if result != 0 {
        tracing::warn!("could not lower sweep thread to background QoS; running at normal priority");
    }
}

/// What:     `#[cfg(windows)] fn lower_current_thread_to_idle()`. The Windows version: set
///           the CALLING thread to the IDLE priority level. `#[cfg(windows)]` compiles it
///           only on Windows.
/// Why:      Windows schedules by per-thread priority level, not POSIX classes or QoS.
///           `THREAD_PRIORITY_IDLE` is the lowest level: the sweep runs only when no
///           higher-priority thread wants the CPU, the same intent as Linux SCHED_IDLE and
///           macOS background QoS.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // no equivalent: JS runtimes expose no per-thread priority level
/// ```
#[cfg(windows)]
fn lower_current_thread_to_idle() {
    /// What:     `use windows::Win32::System::Threading::{GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_IDLE};`.
    ///           Import the Win32 thread-priority bindings. A function-local `use` keeps these
    ///           Windows-only names out of the module's top scope.
    /// Why:      Name the three Win32 items the call below needs.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// import { GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_IDLE } from "windows";
    /// ```
    use windows::Win32::System::Threading::{
        GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_IDLE,
    };
    // What:     `let handle = unsafe { GetCurrentThread() };`. Get a PSEUDO-HANDLE to the
    //           current thread: a special constant that always means "this thread" and never
    //           needs closing. `unsafe` because it is a raw Win32 FFI call.
    // Why:      `SetThreadPriority` needs a thread handle to act on.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const handle = getCurrentThread();
    // ```
    let handle = unsafe { GetCurrentThread() };
    // What:     `let result = unsafe { SetThreadPriority(handle, THREAD_PRIORITY_IDLE) };`.
    //           Set this thread's priority to the idle level. In the high-level `windows`
    //           crate this returns `windows::core::Result<()>`.
    // Why:      Actually lower this thread's priority.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const result = setThreadPriority(handle, THREAD_PRIORITY_IDLE);
    // ```
    let result = unsafe { SetThreadPriority(handle, THREAD_PRIORITY_IDLE) };
    // What:     `if result.is_err() { eprintln!(...); }`. On failure, log and carry on.
    // Why:      Best-effort, exactly like the other platforms.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!ok) console.error("music-player: could not lower sweep thread");
    // ```
    if result.is_err() {
        tracing::warn!("could not lower sweep thread to idle priority; running at normal priority");
    }
}

/// What:     `#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))] fn lower_current_thread_to_idle() {}`.
///           The no-op fallback compiled on every OTHER target (for example the BSDs) where
///           no scheduling call is wired up. Empty body `{}`.
/// Why:      Keep the workers portable: the call site stays the same and simply does nothing
///           where we have not implemented a scheduling tweak.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function lowerCurrentThreadToIdle() {} // fallback no-op
/// ```
#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
fn lower_current_thread_to_idle() {}

/// What:     `fn run_sweep(tracks: Vec<PathBuf>, cache: CacheHandle)`. The detached
///           coordinator: take one key-set snapshot, fan out workers over a shared cursor,
///           and join them. Takes ownership of both args. Module-private.
/// Why:      One place owns the fan-out and the shared state the workers read.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function runSweep(tracks: string[], cache: CacheHandle): void { ... }
/// ```
fn run_sweep(tracks: Vec<PathBuf>, cache: CacheHandle) {
    // What:     `let known = Arc::new(cache.known_fingerprints());`. One snapshot of every
    //           already-EXACT fingerprint, shared read-only with all workers.
    // Why:      The skip-check reads this instead of querying the cache per track; within a
    //           sweep each track is unique, so a single snapshot is enough. Probe-only tracks
    //           are absent, so warming re-scans and upgrades them to exact.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const known = cache.knownFingerprints();
    // ```
    let known = Arc::new(cache.known_fingerprints());
    // What:     `let tracks: Arc<[PathBuf]> = tracks.into();`. Move the list into a shared,
    //           immutable slice the workers index by position.
    // Why:      Share the paths without cloning the whole vec per worker.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const tracks = Object.freeze(tracksArray);
    // ```
    let tracks: Arc<[PathBuf]> = tracks.into();
    // What:     `let cursor = Arc::new(AtomicUsize::new(0));`. The shared next-index counter.
    // Why:      Workers `fetch_add` it to claim the next track, lock-free and load-balanced.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const cursor = new AtomicUsize(0);
    // ```
    let cursor = Arc::new(AtomicUsize::new(0));
    // What:     `let workers = worker_count(tracks.len());`. How many threads to spawn.
    // Why:      One per logical core, never more than there are tracks.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const workers = workerCount(tracks.length);
    // ```
    let workers = worker_count(tracks.len());
    // The sweep is fanning out; log its size and worker count.
    tracing::info!(tracks = tracks.len(), workers, "warming sweep started");
    // What:     `let handles: Vec<_> = (0..workers).map(|_| { ... }).collect();`. Spawn the
    //           workers, each with its own clones of the shared handles.
    // Why:      Run decodes in parallel across every core.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const handles = range(workers).map(() => startWorker(...));
    // ```
    let handles: Vec<_> = (0..workers)
        .map(|_| {
            // What:     Clone the four shared handles for this worker's closure.
            // Why:      Each `Arc::clone` bumps a refcount; `cache.clone()` copies the senders.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const [t, c, ca, k] = [tracks, cursor, cache, known];
            // ```
            let tracks = Arc::clone(&tracks);
            let cursor = Arc::clone(&cursor);
            let cache = cache.clone();
            let known = Arc::clone(&known);
            // What:     Spawn the worker thread. Tail of the closure -> its `JoinHandle`.
            // Why:      Collected so the coordinator can join them.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return startWorker(() => runWorker(t, c, ca, k));
            // ```
            thread::spawn(move || run_worker(tracks, cursor, cache, known))
        })
        .collect();
    // What:     `for handle in handles { let _ = handle.join(); }`. Wait for every worker;
    //           ignore a worker panic (one bad thread must not poison the coordinator).
    // Why:      Keep the coordinator alive until the sweep is fully done.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const handle of handles) await handle;
    // ```
    for handle in handles {
        // Ignore a worker panic (one bad thread must not poison the sweep), but log it.
        if handle.join().is_err() {
            tracing::error!("a warming worker panicked");
        }
    }
    // Every worker joined; the sweep is complete.
    tracing::info!("warming sweep finished");
}

/// What:     `fn worker_count(track_count: usize) -> usize`. The number of decode workers to
///           spawn: one per logical core, clamped to the track count, `0` for none.
/// Why:      Saturate the CPU without spawning idle threads for a short queue.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function workerCount(trackCount: number): number {
///   if (trackCount === 0) return 0;
///   return Math.min(navigator.hardwareConcurrency ?? 1, trackCount);
/// }
/// ```
fn worker_count(track_count: usize) -> usize {
    // What:     `if track_count == 0 { return 0; }`. Nothing to sweep.
    // Why:      Spawn no threads for an empty queue.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (trackCount === 0) return 0;
    // ```
    if track_count == 0 {
        return 0;
    }
    // What:     `let cores = thread::available_parallelism().map(|n| n.get()).unwrap_or(1);`.
    //           Logical core count; fall back to 1 if the platform cannot report it.
    // Why:      The degree of parallelism for CPU-bound decoding.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const cores = navigator.hardwareConcurrency ?? 1;
    // ```
    let cores = thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);
    // What:     `cores.min(track_count)`. Never more workers than tracks. Tail -> return.
    // Why:      Extra threads beyond the work would just exit immediately.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return Math.min(cores, trackCount);
    // ```
    cores.min(track_count)
}

/// What:     `fn run_worker(tracks: Arc<[PathBuf]>, cursor: Arc<AtomicUsize>, cache: CacheHandle, known: Arc<HashSet<u64>>)`.
///           One worker: drop to idle priority, then claim and full-scan tracks until the
///           cursor passes the end. Module-private.
/// Why:      The per-thread decode loop, shared by every spawned worker.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function runWorker(tracks, cursor, cache, known) { ... }
/// ```
fn run_worker(
    tracks: Arc<[PathBuf]>,
    cursor: Arc<AtomicUsize>,
    cache: CacheHandle,
    known: Arc<HashSet<u64>>,
) {
    // What:     `lower_current_thread_to_idle();`. Drop this worker to idle scheduling
    //           priority before any decoding (no-op off Linux/macOS/Windows).
    // Why:      Keep the whole sweep non-disruptive: its CPU-heavy decoding yields to audio,
    //           the UI, and everything else, even with every core busy.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // lowerCurrentThreadToIdle();
    // ```
    lower_current_thread_to_idle();
    // What:     `loop { ... }`. Claim-and-measure until the cursor is past the end.
    // Why:      Pull work dynamically so fast and slow files balance across workers.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (true) { ... }
    // ```
    loop {
        // What:     `let index = cursor.fetch_add(1, Ordering::Relaxed);`. Atomically claim
        //           the next index and advance the cursor. `Relaxed` is enough: only the
        //           counter's atomicity matters; the cache actor handles any cross-thread
        //           visibility of stored peaks.
        // Why:      Lock-free, load-balanced work distribution.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const index = cursor.fetchAdd(1);
        // ```
        let index = cursor.fetch_add(1, Ordering::Relaxed);
        // What:     `let Some(path) = tracks.get(index) else { break };`. Stop once the cursor
        //           runs past the slice.
        // Why:      End the worker when there is no more work.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const path = tracks[index]; if (!path) break;
        // ```
        let Some(path) = tracks.get(index) else {
            break;
        };
        // What:     `let Some(key) = peakcache::fingerprint(path) else { continue };`. Compute
        //           the cache key, or skip a file that cannot be stat'd.
        // Why:      No key -> cannot cache it; move on.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const key = fingerprint(path); if (!key) continue;
        // ```
        let Some(key) = peakcache::fingerprint(path) else {
            tracing::debug!(path = %path.display(), "skip: no fingerprint");
            continue;
        };
        // What:     `if known.contains(&key) { continue; }`. Skip tracks that ALREADY carry an
        //           exact decision when the sweep started (the warm-restart fast path); a probe
        //           estimate or no row is NOT in `known`, so it gets re-scanned and upgraded.
        // Why:      Avoid redundant exact scans; still upgrade probe estimates to exact.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (known.has(key)) continue;
        // ```
        if known.contains(&key) {
            tracing::debug!(key, "skip: already exact");
            continue;
        }
        // What:     `let decision = match resolve_full(path) { Ok(d) => d, Err(error) => { ...;
        //           continue; } };`. Full-scan to an exact decision; log and skip files that
        //           fail to decode (the cause was previously discarded by the `let Ok ... else`).
        // Why:      One bad file must not stop the worker; warming produces exact decisions.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let decision; try { decision = resolveFull(path); } catch (error) { logger.debug(error); continue; }
        // ```
        let decision = match resolve_full(path) {
            Ok(decision) => decision,
            Err(error) => {
                tracing::debug!(path = %path.display(), cause = %error, "skip: decode failed");
                continue;
            }
        };
        // What:     `cache.upsert(key, decision);`. Fire-and-forget the exact decision to the
        //           cache actor, which commits it durably (upgrading any prior probe estimate).
        // Why:      Memoize the exact gain without blocking this worker on persistence.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // cache.upsert(key, decision);
        // ```
        cache.upsert(key, decision);
        // The exact decision is queued to the cache actor.
        tracing::debug!(key, "measured; upsert queued");
    }
}

/// What:     `#[cfg(test)] #[path = "measure_tests.rs"] mod tests;` declares a test-only
///           submodule whose code lives in the sibling file `measure_tests.rs`.
/// Why:      Keep `measure.rs` to production code; the tests live beside it without inflating
///           this file or its max-lines budget (sibling `*_tests.rs` files are exempt).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // measure.unit.test.ts, run only by the test runner
/// ```
#[cfg(test)]
#[path = "measure_tests.rs"]
mod tests;
