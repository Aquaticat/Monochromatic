// What:     Unit tests for `peakcache.rs`, pulled in by
//           `#[cfg(test)] #[path = "peakcache_tests.rs"] mod tests;` at
//           the bottom of `peakcache.rs`. Compiles only under
//           `cargo nextest run` / `cargo test`; reaches the module items
//           (including private ones) via `use super::*` because this file is
//           the `tests` CHILD of peakcache.
// Why:      Keep the tests beside the code without inflating
//           `peakcache.rs` or its max-lines budget (sibling
//           `*_tests.rs` files are exempt from the linter).

// What:     `use super::*;`. Bring the module's items into the test scope.
// Why:      Tests use `fingerprint`, `CacheHandle`, `PathBuf`.
use super::*;
// What:     `use truepeak_core::{Decision, DecisionKind};`. The cached value and its tag.
// Why:      Round-trip tests build and compare `Decision`s.
use truepeak_core::{Decision, DecisionKind};
// What:     `use std::fs;`. Filesystem helpers for fixtures.
// Why:      Create real temp files to fingerprint.
use std::fs;
// What:     `use std::thread;` and `use std::time::{Duration, SystemTime, UNIX_EPOCH};`.
//           Sleeping while polling the async cache, plus clock + epoch for unique names.
// Why:      Upserts are fire-and-forget, so a test waits for the value to land; the clock
//           builds collision-free temp paths.
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// What:     `fn exact(gain: f32) -> Decision`. A full-scan-exact decision for the tests.
// Why:      An exact decision appears in the known-fingerprint (exact) snapshot.
fn exact(gain: f32) -> Decision {
    Decision { gain, kind: DecisionKind::FullScanExact, measured_peak: 1.2, duration_secs: 200.0 }
}

// What:     `fn wait_for_decision(cache: &CacheHandle, key: u64) -> Option<Decision>`. Poll the
//           cache until the key appears, up to ~2s.
// Why:      `upsert` is fire-and-forget, so the row may not be committed on the first read.
fn wait_for_decision(cache: &CacheHandle, key: u64) -> Option<Decision> {
    // What:     up to 100 polls, 20ms apart.
    // Why:      Bounded wait for the async write to land without hanging forever.
    for _ in 0..100 {
        if let Some(decision) = cache.get(key) {
            return Some(decision);
        }
        thread::sleep(Duration::from_millis(20));
    }
    None
}

// What:     `fn unique_path(suffix: &str) -> PathBuf`. A fresh throwaway path under
//           the system temp dir, tagged with pid + nanoseconds + `suffix`.
// Why:      Tests must not collide or touch real state.
fn unique_path(suffix: &str) -> PathBuf {
    // What:     `let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();`.
    //           Nanoseconds since 1970; `.unwrap()` panics only if the clock is
    //           before 1970 (fine in a test).
    // Why:      High-resolution uniqueness.
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    // What:     `std::env::temp_dir().join(format!("music-player-peak-{}-{}-{}", std::process::id(), nanos, suffix))`.
    //           Build the path. Tail -> return.
    // Why:      Unique per process, call, and purpose.
    std::env::temp_dir().join(format!(
        "music-player-peak-{}-{}-{}",
        std::process::id(),
        nanos,
        suffix
    ))
}

// What:     `#[test]` fingerprint behaviour.
// Why:      Determinism, change-on-edit, and that a missing file has no key.
#[test]
fn fingerprint_is_stable_and_change_sensitive() {
    // What:     create a real temp file to stat.
    // Why:      `fingerprint` needs metadata.
    let file = unique_path("a.flac");
    fs::write(&file, b"hello").unwrap();

    // What:     `let first = fingerprint(&file).unwrap();`. Compute it once (a `u64`).
    // Why:      Baseline.
    let first = fingerprint(&file).unwrap();
    // What:     same file fingerprints identically.
    // Why:      Determinism for cache hits.
    assert_eq!(fingerprint(&file).unwrap(), first);

    // What:     a file with different bytes (so a different size) fingerprints differently.
    // Why:      Change-sensitivity: size is part of the key, so a re-encode invalidates it.
    let other = unique_path("b.flac");
    fs::write(&other, b"hello world").unwrap();
    assert_ne!(fingerprint(&other).unwrap(), first);

    // What:     a missing path yields no fingerprint.
    // Why:      Stat failure -> `None`.
    assert!(fingerprint(&unique_path("nope.flac")).is_none());

    // What:     clean up.
    // Why:      No droppings.
    let _ = fs::remove_file(&file);
    let _ = fs::remove_file(&other);
}

// What:     `#[test]` Turso round-trip across handles.
// Why:      An upsert must persist to disk and be readable after the handle is dropped
//           and the database reopened.
#[test]
fn upsert_persists_across_handles() {
    // What:     a throwaway database file path.
    // Why:      Never touch the real config dir.
    let db_file = unique_path("cache.db");
    // What:     `let key = 0xdead_beef_0000_0000_u64;`. A fixed fingerprint for the test.
    // Why:      A stable key to write, read, and reopen.
    let key = 0xdead_beef_0000_0000_u64;

    // What:     `let cache = CacheHandle::open_at(db_file.clone());`. Start the cache actor
    //           on the temp database.
    // Why:      Start fresh.
    let cache = CacheHandle::open_at(db_file.clone());
    // What:     upsert one exact decision, then wait for it to land.
    // Why:      Exercise the fire-and-forget write committing through the shared cache.
    cache.upsert(key, exact(0.75));
    assert_eq!(
        wait_for_decision(&cache, key),
        Some(exact(0.75)),
        "upsert did not become readable"
    );
    // What:     an unknown key misses.
    // Why:      `get` returns `None` for fingerprints never written.
    assert_eq!(cache.get(0x0000_0000_dead_beef), None);
    // What:     the exact key shows up in the known-fingerprint snapshot.
    // Why:      The sweep's skip-check reads this set (exact decisions only).
    assert!(cache.known_fingerprints().contains(&key));

    // What:     drop the handle (closing the actor), let it release the file, then reopen.
    // Why:      Prove the write reached disk, not just memory; the short settle avoids racing
    //           the first actor's connection close.
    drop(cache);
    thread::sleep(Duration::from_millis(50));
    let reopened = CacheHandle::open_at(db_file.clone());
    // What:     the entry survived the reopen.
    // Why:      Memoization works across runs.
    assert_eq!(reopened.get(key), Some(exact(0.75)));

    // What:     clean up the temp database (and any Turso sidecar files).
    // Why:      No droppings.
    let _ = fs::remove_file(&db_file);
    let _ = fs::remove_file(db_file.with_extension("db-wal"));
    let _ = fs::remove_file(db_file.with_extension("db-shm"));
}
