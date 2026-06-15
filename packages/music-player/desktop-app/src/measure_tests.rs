// What:     Unit tests for `measure.rs`, pulled in by
//           `#[cfg(test)] #[path = "measure_tests.rs"] mod tests;` at
//           the bottom of `measure.rs`. Compiles only under
//           `cargo nextest run` / `cargo test`; reaches the module items
//           (including private ones) via `use super::*` because this file is
//           the `tests` CHILD of measure.
// Why:      Keep the tests beside the code without inflating
//           `measure.rs` or its max-lines budget (sibling
//           `*_tests.rs` files are exempt from the linter).

// What:     `use super::*;`. Bring the module's items into the test scope.
// Why:      Tests use `spawn_queue_measurement`, `PeakCache`, and helpers.
use super::*;
// What:     `use std::time::{SystemTime, UNIX_EPOCH};`. Clock + epoch for unique names.
// Why:      Build a collision-free throwaway cache path.
use std::time::{SystemTime, UNIX_EPOCH};

// What:     `fn temp_cache(tag: &str) -> PathBuf`. A fresh throwaway cache-file path.
// Why:      Point the cache at disposable state, never the real config dir.
fn temp_cache(tag: &str) -> PathBuf {
    // What:     `let nanos = ...as_nanos();`. Nanoseconds since 1970 for uniqueness.
    // Why:      Avoid collisions across tests/runs.
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    // What:     build the path under the system temp dir. Tail -> return.
    // Why:      Disposable location.
    std::env::temp_dir().join(format!(
        "mp-measure-{}-{}-{}.json",
        std::process::id(),
        nanos,
        tag
    ))
}

// What:     `#[test]` for the background sweep.
// Why:      Spawning over a track must populate the shared cache.
#[test]
fn spawn_queue_measurement_populates_cache() {
    // What:     `let path = temp_cache("sweep");`. Throwaway cache file.
    // Why:      Disposable state.
    let path = temp_cache("sweep");
    // What:     shared empty cache at the temp file.
    // Why:      The sweep writes here.
    let cache = Arc::new(Mutex::new(PeakCache::from_path(Some(path.clone()))));
    // What:     `let fixture = PathBuf::from("fixtures/tone.flac");`. The track to sweep.
    // Why:      A real file the sweep can measure.
    let fixture = PathBuf::from("fixtures/tone.flac");

    // What:     `spawn_queue_measurement(vec![fixture.clone()], Arc::clone(&cache));`.
    //           Start the detached sweep over a one-track queue.
    // Why:      The behaviour under test.
    spawn_queue_measurement(vec![fixture.clone()], Arc::clone(&cache));

    // What:     `let key = peakcache::fingerprint(&fixture).unwrap();`. The cache key.
    // Why:      Poll for it.
    let key = peakcache::fingerprint(&fixture).unwrap();
    // What:     `let mut found: Option<f32> = None;`. The peak once the sweep stores it.
    // Why:      Collected by polling.
    let mut found: Option<f32> = None;
    // What:     `for _ in 0..100 { ... }`. Poll up to 100 times (~5s) for the entry.
    //           `_` ignores the loop counter.
    // Why:      The sweep runs on another thread; wait for it without hanging forever.
    for _ in 0..100 {
        // What:     `if let Some(peak) = cache.lock().unwrap().get(&key) { found = Some(peak); break; }`.
        //           Check the shared cache; stop once present.
        // Why:      Detect completion.
        if let Some(peak) = cache.lock().unwrap().get(&key) {
            found = Some(peak);
            break;
        }
        // What:     `thread::sleep(Duration::from_millis(50));`. Wait before re-checking.
        // Why:      Give the sweep time without busy-spinning.
        thread::sleep(Duration::from_millis(50));
    }

    // What:     `let peak = found.expect("background sweep did not populate the cache");`.
    //           Unwrap the polled value or fail with a message.
    // Why:      The sweep must have measured the fixture.
    let peak = found.expect("background sweep did not populate the cache");
    // What:     `assert!(peak > 0.05 && peak < 0.2, ...)`. The fixture's real level.
    // Why:      Confirm a sane measured value, not garbage.
    assert!(peak > 0.05 && peak < 0.2, "peak was {peak}");

    // What:     clean up the temp cache file.
    // Why:      No droppings.
    let _ = std::fs::remove_file(&path);
}
