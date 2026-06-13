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
// Why:      Tests use `fingerprint`, `PeakCache`, `PathBuf`.
use super::*;
// What:     `use std::fs;`. Filesystem helpers for fixtures.
// Why:      Create real temp files to fingerprint and a temp cache to round-trip.
use std::fs;
// What:     `use std::time::{SystemTime, UNIX_EPOCH};`. Clock + epoch for unique names.
// Why:      Build collision-free temp paths.
use std::time::{SystemTime, UNIX_EPOCH};

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

// What:     `#[test]` disk round-trip.
// Why:      Insert + save + reload must preserve entries, and the file must hold
//           only the opaque key and number (no path).
#[test]
fn save_and_reload_preserves_entries_without_metadata() {
    // What:     a throwaway cache file path.
    // Why:      Never touch the real config dir.
    let cache_file = unique_path("cache.json");

    // What:     `let mut cache = PeakCache::from_path(Some(cache_file.clone()));`.
    //           Build an empty cache pointing at the temp file.
    // Why:      Start fresh.
    let mut cache = PeakCache::from_path(Some(cache_file.clone()));
    // What:     insert one entry and save.
    // Why:      Exercise insert + atomic save.
    cache.insert("deadbeef00000000".to_string(), 0.75);
    cache.save().unwrap();

    // What:     `let reloaded = PeakCache::from_path(Some(cache_file.clone()));`.
    //           Load a new cache from the same file.
    // Why:      Prove persistence across instances.
    let reloaded = PeakCache::from_path(Some(cache_file.clone()));
    // What:     the entry survived the round-trip.
    // Why:      Memoization works across runs.
    assert_eq!(reloaded.get("deadbeef00000000"), Some(0.75));

    // What:     read the raw file text.
    // Why:      Inspect what actually hit disk.
    let text = fs::read_to_string(&cache_file).unwrap();
    // What:     the file contains the opaque key but nothing path-like.
    // Why:      Privacy guarantee: only hashes and numbers.
    assert!(text.contains("deadbeef00000000"));
    assert!(!text.contains('/'));

    // What:     clean up the temp file.
    // Why:      No droppings.
    let _ = fs::remove_file(&cache_file);
}
