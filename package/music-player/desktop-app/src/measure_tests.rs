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
// Why:      Tests use `spawn_queue_measurement`, `CacheHandle`, `thread`, and helpers.
use super::*;
// What:     `use truepeak_core::Decision;`. The cached value the sweep stores.
// Why:      The poll collects a `Decision` and asserts on its measured peak.
use truepeak_core::Decision;
// What:     `use std::time::{Duration, SystemTime, UNIX_EPOCH};`. `Duration` for the poll
//           sleep (measure.rs no longer imports it), clock + epoch for unique names.
// Why:      Wait for the async sweep, and build a collision-free throwaway cache path.
use std::time::{Duration, SystemTime, UNIX_EPOCH};

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
        "mp-measure-{}-{}-{}.db",
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
    // What:     cache handle backed by the temp database.
    // Why:      The sweep writes here.
    let cache = CacheHandle::open_at(path.clone());
    // What:     `let fixture = PathBuf::from("fixture/tone.flac");`. The track to sweep.
    // Why:      A real file the sweep can measure.
    let fixture = PathBuf::from("fixture/tone.flac");

    // What:     `spawn_queue_measurement(vec![fixture.clone()], Arc::clone(&cache));`.
    //           Start the detached sweep over a one-track queue.
    // Why:      The behaviour under test.
    spawn_queue_measurement(vec![fixture.clone()], cache.clone());

    // What:     `let key = peakcache::fingerprint(&fixture).unwrap();`. The cache key.
    // Why:      Poll for it.
    let key = peakcache::fingerprint(&fixture).unwrap();
    // What:     `let mut found: Option<Decision> = None;`. The decision once the sweep stores
    //           it.
    // Why:      Collected by polling.
    let mut found: Option<Decision> = None;
    // What:     `for _ in 0..100 { ... }`. Poll up to 100 times (~5s) for the entry.
    //           `_` ignores the loop counter.
    // Why:      The sweep runs on another thread; wait for it without hanging forever.
    for _ in 0..100 {
        // What:     `if let Some(decision) = cache.get(key) { found = Some(decision); break; }`.
        //           Check the shared cache; stop once present.
        // Why:      Detect completion.
        if let Some(decision) = cache.get(key) {
            found = Some(decision);
            break;
        }
        // What:     `thread::sleep(Duration::from_millis(50));`. Wait before re-checking.
        // Why:      Give the sweep time without busy-spinning.
        thread::sleep(Duration::from_millis(50));
    }

    // What:     `let decision = found.expect("background sweep did not populate the cache");`.
    //           Unwrap the polled value or fail with a message.
    // Why:      The sweep must have measured the fixture.
    let decision = found.expect("background sweep did not populate the cache");
    // What:     `assert!(decision.measured_peak > 0.05 && decision.measured_peak < 0.2, ...)`.
    //           The fixture's real level; warming full-scans, so it is the exact true peak.
    // Why:      Confirm a sane measured value, not garbage.
    assert!(
        decision.measured_peak > 0.05 && decision.measured_peak < 0.2,
        "peak was {}",
        decision.measured_peak
    );
    // What:     `assert_eq!(decision.kind, DecisionKind::ShortFullScan);`. The fixture is
    //           short, so warming's exact scan tags it short.
    // Why:      Confirm the warming path resolves an exact short decision.
    assert_eq!(decision.kind, truepeak_core::DecisionKind::ShortFullScan);

    // What:     clean up the temp cache file.
    // Why:      No droppings.
    let _ = std::fs::remove_file(&path);
}

// What:     `#[test]` parallel sweep over many tracks across codecs.
// Why:      Exercise the N-worker fan-out and the concurrent upsert path: every fingerprint
//           must land, with no worker dropping or duplicating a track.
#[test]
fn parallel_sweep_measures_every_track() {
    // What:     a throwaway cache database.
    // Why:      Disposable state.
    let path = temp_cache("parallel");
    // What:     cache handle backed by the temp database.
    // Why:      The sweep writes here.
    let cache = CacheHandle::open_at(path.clone());
    // What:     several real, decodable fixtures across codecs.
    // Why:      Give the workers enough distinct tracks to run concurrently.
    let tracks = vec![
        PathBuf::from("fixture/tone.flac"),
        PathBuf::from("fixture/tone.mp3"),
        PathBuf::from("fixture/tone.ogg"),
        PathBuf::from("fixture/tone.wav"),
        PathBuf::from("fixture/tone.opus"),
        PathBuf::from("fixture/tone.aac.m4a"),
        PathBuf::from("fixture/tone.alac.m4a"),
    ];

    // What:     run the parallel sweep over all tracks.
    // Why:      The behaviour under test.
    spawn_queue_measurement(tracks.clone(), cache.clone());

    // What:     every track's fingerprint must become cached within the poll window.
    // Why:      Confirm no worker dropped a track and every upsert landed.
    for track in &tracks {
        let key = peakcache::fingerprint(track).unwrap();
        let mut found = false;
        for _ in 0..200 {
            if cache.get(key).is_some() {
                found = true;
                break;
            }
            thread::sleep(Duration::from_millis(25));
        }
        assert!(found, "track not measured: {}", track.display());
    }

    // What:     clean up the temp database + Turso sidecars.
    // Why:      No droppings.
    let _ = std::fs::remove_file(&path);
    let _ = std::fs::remove_file(path.with_extension("db-wal"));
    let _ = std::fs::remove_file(path.with_extension("db-shm"));
}
