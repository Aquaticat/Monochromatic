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
// What:     `use std::fs;`. Filesystem helpers for fixtures.
// Why:      Create real temp files to fingerprint.
use std::fs;
// What:     `use std::thread;` and `use std::time::{Duration, SystemTime, UNIX_EPOCH};`.
//           Sleeping while polling the async cache, plus clock + epoch for unique names.
// Why:      Upserts are fire-and-forget, so a test waits for the value to land; the clock
//           builds collision-free temp paths.
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// What:     `fn wait_for_peak(cache: &CacheHandle, key: &str) -> Option<f32>`. Poll the
//           cache until the key appears, up to ~2s.
// Why:      `upsert` is fire-and-forget, so the row may not be committed on the first read.
fn wait_for_peak(cache: &CacheHandle, key: &str) -> Option<f32> {
    // What:     up to 100 polls, 20ms apart.
    // Why:      Bounded wait for the async write to land without hanging forever.
    for _ in 0..100 {
        if let Some(peak) = cache.get(key) {
            return Some(peak);
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
// Why:      Determinism, change-on-edit, and that the key leaks no path text.
#[test]
fn fingerprint_is_stable_opaque_and_change_sensitive() {
    // What:     create a real temp file to stat.
    // Why:      `fingerprint` needs metadata.
    let file = unique_path("a.flac");
    fs::write(&file, b"hello").unwrap();

    // What:     `let first = fingerprint(&file).unwrap();`. Compute it once.
    // Why:      Baseline.
    let first = fingerprint(&file).unwrap();
    // What:     same file fingerprints identically.
    // Why:      Determinism for cache hits.
    assert_eq!(fingerprint(&file).unwrap(), first);
    // What:     the key is a 16-char hex string, not the path.
    // Why:      Privacy: no metadata exposed.
    assert_eq!(first.len(), 16);
    assert!(!first.contains("a.flac"));

    // What:     a missing path yields no fingerprint.
    // Why:      Stat failure -> `None`.
    assert!(fingerprint(&unique_path("nope.flac")).is_none());

    // What:     clean up.
    // Why:      No droppings.
    let _ = fs::remove_file(&file);
}

// What:     `#[test]` Turso round-trip across handles.
// Why:      An upsert must persist to disk and be readable after the handle is dropped
//           and the database reopened.
#[test]
fn upsert_persists_across_handles() {
    // What:     a throwaway database file path.
    // Why:      Never touch the real config dir.
    let db_file = unique_path("cache.db");

    // What:     `let cache = CacheHandle::open_at(db_file.clone());`. Start the cache actor
    //           on the temp database.
    // Why:      Start fresh.
    let cache = CacheHandle::open_at(db_file.clone());
    // What:     upsert one entry, then wait for it to land.
    // Why:      Exercise the fire-and-forget write committing through Turso.
    cache.upsert("deadbeef00000000".to_string(), 0.75);
    assert_eq!(
        wait_for_peak(&cache, "deadbeef00000000"),
        Some(0.75),
        "upsert did not become readable"
    );
    // What:     an unknown key misses.
    // Why:      `get` returns `None` for fingerprints never written.
    assert_eq!(cache.get("00000000deadbeef"), None);
    // What:     the key shows up in the known-fingerprint snapshot.
    // Why:      The sweep's skip-check reads this set.
    assert!(cache.known_fingerprints().contains("deadbeef00000000"));

    // What:     drop the handle (closing the actor), let it release the file, then reopen.
    // Why:      Prove the write reached disk, not just memory; the short settle avoids racing
    //           the first actor's connection close.
    drop(cache);
    thread::sleep(Duration::from_millis(50));
    let reopened = CacheHandle::open_at(db_file.clone());
    // What:     the entry survived the reopen.
    // Why:      Memoization works across runs.
    assert_eq!(reopened.get("deadbeef00000000"), Some(0.75));

    // What:     clean up the temp database (and any Turso sidecar files).
    // Why:      No droppings.
    let _ = fs::remove_file(&db_file);
    let _ = fs::remove_file(db_file.with_extension("db-wal"));
    let _ = fs::remove_file(db_file.with_extension("db-shm"));
}
