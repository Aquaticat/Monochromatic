// What:     Unit tests for `peak_swap.rs`, pulled in by
//           `#[cfg(test)] #[path = "peak_swap_tests.rs"] mod tests;` at the
//           bottom of `peak_swap.rs`.
// Why:      Keep current-track peak swap tests beside the code they exercise.
// TS map:   `peak_swap.unit.test.ts` beside `peak_swap.ts`.

// What:     `use super::*;`. Import the parent module's items into the test scope.
// Why:      Tests exercise crate-visible and private helpers.
// TS map:   `import * as peakSwap from "./peak_swap";`
use super::*;

// What:     `use std::path::{Path, PathBuf};`. Borrowed and owned path types.
// Why:      Tests borrow fixture paths and create owned temp cache paths.
// TS map:   both are `string` in TypeScript.
use std::path::{Path, PathBuf};

// What:     `use std::sync::{Arc, Mutex};`. Thread-safe shared owner plus lock.
// Why:      Peak-swap helpers take the same shared cache shape as production.
// TS map:   a shared locked object.
use std::sync::{Arc, Mutex};

// What:     `use std::thread;`. Rust's standard OS-thread API.
// Why:      Tests pass the current test thread handle into the peak worker.
// TS map:   closest equivalent is a `WorkerRef` for the current worker.
use std::thread;

// What:     `use std::time::{Duration, SystemTime, UNIX_EPOCH};`. `Duration` is a
//           timeout span; `SystemTime` and `UNIX_EPOCH` build unique temp names.
// Why:      Async tests wait for worker results and isolate cache files.
// TS map:   `Date.now()` plus millisecond timeout numbers.
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// What:     `fn temp_cache(tag: &str) -> PathBuf`. Build a fresh disposable cache path.
// Why:      Tests must never touch the user's real peak cache.
// TS map:   `function tempCache(tag: string): string`.
fn temp_cache(tag: &str) -> PathBuf {
    // What:     `let nanos = ...as_nanos();`. Current time since 1970 in nanoseconds.
    // Why:      Make a collision-resistant filename for parallel test runs.
    // TS map:   `const nanos = BigInt(Date.now()) * 1_000_000n;`
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    // What:     `std::env::temp_dir().join(format!(...))`. Join a formatted filename
    //           under the system temp directory. Tail expression returns it.
    // Why:      Keep disposable cache state out of the repo and real config dir.
    // TS map:   `return join(tmpdir(), `mp-peak-swap-${pid}-${nanos}-${tag}.json`);`
    std::env::temp_dir().join(format!(
        "mp-peak-swap-{}-{}-{}.json",
        std::process::id(),
        nanos,
        tag
    ))
}

// What:     `fn fixture() -> &'static Path`. Return the committed FLAC fixture path.
// Why:      Multiple tests need a real decodable file.
// TS map:   `function fixture(): string`.
fn fixture() -> &'static Path {
    // What:     `Path::new("fixtures/tone.flac")`. Borrow a static string as a path.
    //           Tail expression returns it.
    // Why:      Existing true-peak tests already use this quiet fixture.
    // TS map:   `return "fixtures/tone.flac";`
    Path::new("fixtures/tone.flac")
}

// What:     `fn test_cache(path: &Path) -> Arc<Mutex<PeakCache>>`. Build a shared
//           cache backed by a disposable path.
// Why:      Match production helper signatures while isolating persistence.
// TS map:   `function testCache(path: string): SharedPeakCache`.
fn test_cache(path: &Path) -> Arc<Mutex<PeakCache>> {
    // What:     `Arc::new(Mutex::new(PeakCache::from_path(Some(path.to_path_buf()))))`.
    //           Clone the borrowed path into `PathBuf`, wrap it in `Some`, construct
    //           a cache, guard it with `Mutex`, and share it with `Arc`.
    // Why:      The measurement worker and test thread use the same cache shape.
    // TS map:   `return shared(lock(PeakCache.fromPath(path)));`
    Arc::new(Mutex::new(PeakCache::from_path(Some(path.to_path_buf()))))
}

// What:     `fn approx_eq(a: f32, b: f32) -> bool`. Float comparison helper.
// Why:      Gains are f32 values and should be compared with tolerance.
// TS map:   `function approxEq(a: number, b: number): boolean`.
fn approx_eq(a: f32, b: f32) -> bool {
    // What:     `const TOLERANCE: f32 = 1e-4;`. Allowed float difference.
    // Why:      Fixture decode and f32 math can vary in tiny low-order bits.
    // TS map:   `const TOLERANCE = 1e-4;`
    const TOLERANCE: f32 = 1e-4;
    // What:     `(a - b).abs() < TOLERANCE`. Difference-based comparison. Tail
    //           expression returns the boolean.
    // Why:      Avoid brittle exact float equality.
    // TS map:   `return Math.abs(a - b) < TOLERANCE;`
    (a - b).abs() < TOLERANCE
}

// What:     `#[test]` marks the next function as a unit test.
// Why:      The test runner discovers and runs it.
// TS map:   `test("cached gain", () => { ... })`.
#[test]
fn cached_track_gain_returns_measured_gain() {
    // What:     `let cache_path = temp_cache("hit");`. Disposable cache file path.
    // Why:      Keep test state isolated.
    // TS map:   `const cachePath = tempCache("hit");`
    let cache_path = temp_cache("hit");
    // What:     `let cache = test_cache(&cache_path);`. Shared cache at the temp path.
    // Why:      Match production cache ownership.
    // TS map:   `const cache = testCache(cachePath);`
    let cache = test_cache(&cache_path);
    // What:     `let key = peakcache::fingerprint(fixture()).unwrap();`. Compute the
    //           fixture's opaque cache key and unwrap it.
    // Why:      Seed a known cache hit without decoding the fixture.
    // TS map:   `const key = fingerprint(fixture());`
    let key = peakcache::fingerprint(fixture()).unwrap();
    // What:     `{ let mut guard = cache.lock().unwrap(); guard.insert(key, 2.0); }`.
    //           Lock the cache, insert a synthetic peak, and release the lock at block end.
    // Why:      A peak of 2.0 should normalize to half the ceiling fallback.
    // TS map:   `withLock(cache, c => c.insert(key, 2));`
    {
        let mut guard = cache.lock().unwrap();
        guard.insert(key, 2.0);
    }

    // What:     `let gain = cached_track_gain(fixture(), &cache).unwrap();`. Resolve the
    //           cached peak into a playback gain.
    // Why:      Exercise the cache-hit fast path.
    // TS map:   `const gain = cachedTrackGain(fixture(), cache);`
    let gain = cached_track_gain(fixture(), &cache).unwrap();
    // What:     `assert!(approx_eq(gain, fallback_track_gain() / 2.0));`. Compare to
    //           expected half-ceiling gain.
    // Why:      Confirms peak values are converted through `normalization_gain`.
    // TS map:   `expect(approxEq(gain, fallbackTrackGain() / 2)).toBe(true);`
    assert!(approx_eq(gain, fallback_track_gain() / 2.0));

    // What:     `let _ = std::fs::remove_file(&cache_path);`. Best-effort cleanup.
    // Why:      Leave no temp cache file behind.
    // TS map:   `try { unlinkSync(cachePath); } catch {}`
    let _ = std::fs::remove_file(&cache_path);
}

// What:     `#[test]` marks the next function as a unit test.
// Why:      The test runner discovers and runs it.
// TS map:   `test("async measurement", () => { ... })`.
#[test]
fn async_current_track_measurement_populates_cache_and_returns_gain() {
    // What:     `let cache_path = temp_cache("async");`. Disposable cache file path.
    // Why:      Keep test state isolated.
    // TS map:   `const cachePath = tempCache("async");`
    let cache_path = temp_cache("async");
    // What:     `let cache = test_cache(&cache_path);`. Shared empty cache.
    // Why:      The worker will populate this cache.
    // TS map:   `const cache = testCache(cachePath);`
    let cache = test_cache(&cache_path);
    // What:     `let generation = 7;`. Arbitrary generation id for this test.
    // Why:      The worker should echo it in the result.
    // TS map:   `const generation = 7;`
    let generation = 7;
    // What:     `let pending = match prepare_track_gain(...) { ... }`. Prepare gain for
    //           an uncached fixture and expect the pending branch.
    // Why:      Empty cache should spawn current-track measurement.
    // TS map:   `const pending = prepareTrackGain(...).pending;`
    let pending = match prepare_track_gain(fixture(), &cache, generation, thread::current()) {
        // What:     `TrackGainResolution::Pending(pending) => pending`. Extract the
        //           pending measurement handle.
        // Why:      The test waits for its result.
        // TS map:   `pending = result.pending;`
        TrackGainResolution::Pending(pending) => pending,
        // What:     `TrackGainResolution::Ready(_) => panic!(...)`. Unexpected cache hit.
        // Why:      A fresh temp cache should not have an entry.
        // TS map:   `throw new Error("expected pending measurement");`
        TrackGainResolution::Ready(_) => panic!("expected pending measurement"),
    };

    // What:     `let status = pending.wait_result(Duration::from_secs(5));`. Wait up to
    //           five seconds for the real fixture decode.
    // Why:      The worker runs on another thread and should finish quickly.
    // TS map:   `const status = pending.waitResult(5000);`
    let status = pending.wait_result(Duration::from_secs(5));
    // What:     `let result = match status { ... }`. Extract the ready result or fail.
    // Why:      The async measurement must complete and report a gain.
    // TS map:   `const result = expectReady(status);`
    let result = match status {
        // What:     `PendingPeakStatus::Ready(result) => result`. Use the measured result.
        // Why:      Continue assertions.
        // TS map:   `result = status.result;`
        PendingPeakStatus::Ready(result) => result,
        // What:     `_ => panic!(...)`. Any non-ready status is a failure.
        // Why:      Worker should not time out or close on the committed fixture.
        // TS map:   `throw new Error("measurement did not finish");`
        _ => panic!("measurement did not finish"),
    };
    // What:     `assert_eq!(result.generation, generation);`. Result generation matches.
    // Why:      Controller stale checks depend on this id round trip.
    // TS map:   `expect(result.generation).toBe(generation);`
    assert_eq!(result.generation, generation);
    // What:     `assert!(approx_eq(result.gain, 1.0));`. Quiet fixture stays unattenuated.
    // Why:      Attenuate-only normalization should not boost or cut this track.
    // TS map:   `expect(approxEq(result.gain, 1)).toBe(true);`
    assert!(approx_eq(result.gain, 1.0));
    // What:     `let key = peakcache::fingerprint(fixture()).unwrap();`. Recompute the
    //           fixture cache key.
    // Why:      Confirm the worker warmed the cache.
    // TS map:   `const key = fingerprint(fixture());`
    let key = peakcache::fingerprint(fixture()).unwrap();
    // What:     `assert!(cache.lock().unwrap().get(&key).is_some());`. Check cache entry.
    // Why:      Current-track measurement must warm the shared cache.
    // TS map:   `expect(cache.get(key)).toBeDefined();`
    assert!(cache.lock().unwrap().get(&key).is_some());

    // What:     `let _ = std::fs::remove_file(&cache_path);`. Best-effort cleanup.
    // Why:      Leave no temp cache file behind.
    // TS map:   `try { unlinkSync(cachePath); } catch {}`
    let _ = std::fs::remove_file(&cache_path);
}
