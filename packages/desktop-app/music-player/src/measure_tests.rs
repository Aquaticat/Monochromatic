// What:     Unit tests for `measure.rs`, pulled in by
//           `#[cfg(test)] #[path = "measure_tests.rs"] mod tests;` at
//           the bottom of `measure.rs`. Compiles only under
//           `cargo nextest run` / `cargo test`; reaches the module items
//           (including private ones) via `use super::*` because this file is
//           the `tests` CHILD of measure.
// Why:      Keep the tests beside the code without inflating
//           `measure.rs` or its max-lines budget (sibling
//           `*_tests.rs` files are exempt from the linter).
// TS map:   `measure.unit.test.ts` beside `measure.ts`.

// What:     `use super::*;`. Bring the module's items into the test scope.
// Why:      Tests use `spawn_queue_measurement`, `PeakCache`, and helpers.
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
