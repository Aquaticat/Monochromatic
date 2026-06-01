//! Persistent memoization of measured true peaks.
//!
//! Measuring a track's true peak means decoding the whole file, which is slow, so
//! each result is cached on disk keyed by an opaque fingerprint. Privacy: the file
//! stores only `fingerprint -> peak` pairs, where the fingerprint is a one-way hash
//! of (path, size, mtime). No filename, path, or tag ever lands on disk, so the
//! cache reveals nothing about which tracks the user has.

// What:     `use std::collections::HashMap;`. A hash map (key -> value). Sibling:
//           `BTreeMap` (ordered, slower lookups); we do not need ordering.
// Why:      Maps a track fingerprint to its measured true peak.
// TS map:   `type HashMap<K, V> = Map<K, V>;` (here `Record<string, number>`).
use std::collections::HashMap;

// What:     `use std::path::{Path, PathBuf};`. Borrowed and owned filesystem paths.
// Why:      `fingerprint` borrows a path; the cache stores its file path owned.
// TS map:   both are `string`.
use std::path::{Path, PathBuf};

// What:     `use std::time::UNIX_EPOCH;`. The 1970 reference instant.
// Why:      Convert a file's modified-time into a number for the fingerprint.
// TS map:   `const UNIX_EPOCH = 0; // ms since 1970 baseline`
use std::time::UNIX_EPOCH;

// What:     `const FNV_OFFSET: u64 = 14695981039346656037;`. The 64-bit FNV-1a
//           offset basis (the hash's starting value). `u64` (sibling: `u32` for the
//           32-bit FNV variant) because we want a 64-bit fingerprint.
// Why:      Standard FNV-1a seed; using the published constant keeps the hash stable.
// TS map:   `const FNV_OFFSET = 14695981039346656037n; // BigInt`
const FNV_OFFSET: u64 = 14695981039346656037;

// What:     `const FNV_PRIME: u64 = 1099511628211;`. The 64-bit FNV-1a prime
//           multiplier.
// Why:      The other half of the FNV-1a definition.
// TS map:   `const FNV_PRIME = 1099511628211n;`
const FNV_PRIME: u64 = 1099511628211;

// What:     `fn fnv1a(bytes: &[u8]) -> u64`. Hash a byte slice with FNV-1a, a small
//           fast non-cryptographic hash. `&[u8]` is a borrowed read-only byte slice.
// Why:      Produce a compact, stable, opaque fingerprint from the key material.
// TS map:   `function fnv1a(bytes: Uint8Array): bigint`
fn fnv1a(bytes: &[u8]) -> u64 {
    // What:     `bytes.iter().fold(FNV_OFFSET, |hash, &b| (hash ^ b as u64).wrapping_mul(FNV_PRIME))`.
    //           Fold over the bytes: start at the offset basis, and for each byte XOR
    //           it in then multiply by the prime. `&b` copies the byte; `b as u64`
    //           widens it; `.wrapping_mul` multiplies with intentional overflow wrap
    //           (no panic), which is exactly how FNV is defined. Tail -> return.
    // Why:      FNV-1a = for each byte: hash = (hash XOR byte) * prime.
    // TS map:   `return bytes.reduce((h, b) => BigInt.asUintN(64, (h ^ BigInt(b)) * FNV_PRIME), FNV_OFFSET);`
    bytes
        .iter()
        .fold(FNV_OFFSET, |hash, &b| (hash ^ b as u64).wrapping_mul(FNV_PRIME))
}

// What:     `pub(crate) fn fingerprint(path: &Path) -> Option<String>`. Build the
//           opaque cache key for a file from its path, size, and modified-time.
//           Returns `None` if the file cannot be stat'd. `pub(crate)` for the
//           controller and background worker.
// Why:      Identify a track without storing anything identifying; size+mtime make
//           the key change when the file is replaced or edited in place.
// TS map:   `function fingerprint(path: string): string | null`
pub(crate) fn fingerprint(path: &Path) -> Option<String> {
    // What:     `let meta = std::fs::metadata(path).ok()?;`. Read filesystem metadata.
    //           `.ok()` turns the `Result` into an `Option` (dropping the error);
    //           `?` returns `None` from this function if it was an error.
    // Why:      We need the size and modified time; bail to "no fingerprint" if absent.
    // TS map:   `let meta; try { meta = statSync(path); } catch { return null; }`
    let meta = std::fs::metadata(path).ok()?;
    // What:     `let modified = meta.modified().ok()?;`. The file's last-modified
    //           `SystemTime`; `?` bails if the platform cannot report it.
    // Why:      Part of the key so editing a file in place invalidates its entry.
    // TS map:   `const modified = meta.mtime;`
    let modified = meta.modified().ok()?;
    // What:     `let mtime_nanos = modified.duration_since(UNIX_EPOCH).ok()?.as_nanos();`.
    //           Time since 1970 as a `u128` nanosecond count. `.ok()?` bails if the
    //           file's time predates 1970.
    // Why:      A plain number to hash.
    // TS map:   `const mtimeNanos = BigInt(modified) * 1_000_000n;`
    let mtime_nanos = modified.duration_since(UNIX_EPOCH).ok()?.as_nanos();
    // What:     `let path_text = path.to_string_lossy();`. The path as text, with any
    //           non-UTF-8 bytes replaced. Returns a `Cow<str>` (borrowed-or-owned string).
    // Why:      Stable bytes to feed the hash; lossy is fine since we only hash it.
    // TS map:   `const pathText = String(path);`
    let path_text = path.to_string_lossy();
    // What:     `let mut material: Vec<u8> = Vec::new();`. A growable byte buffer for
    //           the key material. `let mut` because we append to it.
    // Why:      Concatenate path + size + mtime before hashing.
    // TS map:   `const material: number[] = [];`
    let mut material: Vec<u8> = Vec::new();
    // What:     `material.extend_from_slice(path_text.as_bytes());`. Append the path
    //           bytes. `.as_bytes()` views the string as `&[u8]`.
    // Why:      Distinguish tracks at different paths.
    // TS map:   `material.push(...encode(pathText));`
    material.extend_from_slice(path_text.as_bytes());
    // What:     `material.extend_from_slice(&meta.len().to_le_bytes());`. Append the
    //           file size as little-endian bytes. `meta.len()` is a `u64`;
    //           `.to_le_bytes()` gives a `[u8; 8]`.
    // Why:      Size change (re-encode) invalidates the key.
    // TS map:   `material.push(...u64le(meta.size));`
    material.extend_from_slice(&meta.len().to_le_bytes());
    // What:     `material.extend_from_slice(&mtime_nanos.to_le_bytes());`. Append the
    //           mtime as little-endian bytes (`u128` -> `[u8; 16]`).
    // Why:      In-place edits (same size) still change the key via mtime.
    // TS map:   `material.push(...u128le(mtimeNanos));`
    material.extend_from_slice(&mtime_nanos.to_le_bytes());
    // What:     `Some(format!("{:016x}", fnv1a(&material)))`. Hash the material and
    //           format it as a zero-padded 16-digit lowercase hex string, wrapped in
    //           `Some`. Tail -> return.
    // Why:      The opaque key stored on disk; reversing it to the path is infeasible.
    // TS map:   `return fnv1a(material).toString(16).padStart(16, "0");`
    Some(format!("{:016x}", fnv1a(&material)))
}

// What:     `fn cache_path() -> Option<PathBuf>`. The on-disk location of the peak
//           cache file, or `None` if no config directory is available. Module-private.
// Why:      One place decides where the cache lives (alongside the session file).
// TS map:   `function cachePath(): string | null`
fn cache_path() -> Option<PathBuf> {
    // What:     `directories::ProjectDirs::from("dev", "Monochromatic", "music-player")`
    //           asks for the standard per-app config dir (Linux: `$XDG_CONFIG_HOME/
    //           music-player`); returns `Option<ProjectDirs>`.
    // Why:      Same directory the session uses, so the containerized run's config
    //           volume persists it and it never pollutes the source tree.
    // TS map:   `const dirs = projectDirs("dev","Monochromatic","music-player");`
    directories::ProjectDirs::from("dev", "Monochromatic", "music-player")
        // What:     `.map(|dirs| dirs.config_dir().join("peaks.json"))`. When present,
        //           join the cache filename onto the config dir. `config_dir()` is a
        //           `&Path`; `.join(...)` returns an owned `PathBuf`.
        // Why:      Turn the directory into the full file path.
        // TS map:   `dirs ? join(dirs.configDir, "peaks.json") : null`
        .map(|dirs| dirs.config_dir().join("peaks.json"))
}

// What:     `pub(crate) struct PeakCache { ... }`. The in-memory cache plus where it
//           persists and how many inserts are unsaved. `pub(crate)` so the controller
//           and worker share it (behind an `Arc<Mutex<...>>`).
// Why:      Hold the fingerprint -> peak map and batch writes to disk.
// TS map:   `class PeakCache { map; path; unsaved; }`
pub(crate) struct PeakCache {
    // What:     `map: HashMap<String, f32>`. Fingerprint hex -> measured true peak.
    // Why:      The actual memoized data.
    // TS map:   `map: Record<string, number>;`
    map: HashMap<String, f32>,
    // What:     `path: Option<PathBuf>`. Where to persist, or `None` (no config dir).
    // Why:      Save/load target; `None` means run in-memory only.
    // TS map:   `path: string | null;`
    path: Option<PathBuf>,
    // What:     `unsaved: usize`. Count of inserts not yet flushed to disk.
    // Why:      Lets the background worker batch saves instead of writing per track.
    // TS map:   `unsaved: number;`
    unsaved: usize,
}

// What:     `impl PeakCache { ... }`. The cache's behaviour.
// Why:      Load, query, insert, and persist.
// TS map:   the class body.
impl PeakCache {
    // What:     `pub(crate) fn load() -> PeakCache`. Read the cache from its standard
    //           location, or start empty if absent/corrupt.
    // Why:      Called once at startup.
    // TS map:   `static load(): PeakCache`
    pub(crate) fn load() -> PeakCache {
        // What:     `PeakCache::from_path(cache_path())`. Delegate to the path-taking
        //           constructor with the standard location. Tail -> return.
        // Why:      Share one code path with the test constructor.
        // TS map:   `return PeakCache.fromPath(cachePath());`
        PeakCache::from_path(cache_path())
    }

    // What:     `pub(crate) fn from_path(path: Option<PathBuf>) -> PeakCache`. Build a
    //           cache that persists to `path`, pre-loading any existing entries.
    //           `pub(crate)` so `measure`'s tests can point it at a throwaway file.
    // Why:      One place to parse the on-disk map, reusable by `load` and tests.
    // TS map:   `static fromPath(path: string | null): PeakCache`
    pub(crate) fn from_path(path: Option<PathBuf>) -> PeakCache {
        // What:     `let map = path.as_ref().and_then(...).and_then(...).unwrap_or_default();`.
        //           Read the file to a string then parse it as a `HashMap<String, f32>`;
        //           any missing/unreadable/corrupt step yields an empty map.
        //           `.as_ref()` borrows the `Option<PathBuf>` as `Option<&PathBuf>`;
        //           `.and_then` chains steps that may produce `None`;
        //           `serde_json::from_str::<HashMap<String, f32>>` parses the JSON;
        //           `.unwrap_or_default()` substitutes an empty map on `None`.
        // Why:      Start from saved data when possible, empty otherwise; never fail.
        // TS map:   `let map; try { map = JSON.parse(readFileSync(path,"utf8")); } catch { map = {}; }`
        let map = path
            .as_ref()
            .and_then(|p| std::fs::read_to_string(p).ok())
            .and_then(|text| serde_json::from_str::<HashMap<String, f32>>(&text).ok())
            .unwrap_or_default();
        // What:     `PeakCache { map, path, unsaved: 0 }`. Build the cache; nothing is
        //           unsaved yet. Tail -> return.
        // Why:      Ready to query and extend.
        // TS map:   `return { map, path, unsaved: 0 };`
        PeakCache {
            map,
            path,
            unsaved: 0,
        }
    }

    // What:     `pub(crate) fn get(&self, fingerprint: &str) -> Option<f32>`. Look up a
    //           cached peak. `&str` borrows the key; `Option<f32>` is the maybe-result.
    // Why:      Callers check the cache before measuring.
    // TS map:   `get(fingerprint: string): number | undefined`
    pub(crate) fn get(&self, fingerprint: &str) -> Option<f32> {
        // What:     `self.map.get(fingerprint).copied()`. `.get` returns `Option<&f32>`
        //           (a borrow); `.copied()` turns it into `Option<f32>` (an owned copy).
        //           Tail -> return.
        // Why:      Hand back the value, not a borrow into the map.
        // TS map:   `return this.map[fingerprint];`
        self.map.get(fingerprint).copied()
    }

    // What:     `pub(crate) fn unsaved(&self) -> usize`. How many inserts are pending a
    //           save.
    // Why:      The background worker uses it to decide when to flush a batch.
    // TS map:   `unsaved(): number`
    pub(crate) fn unsaved(&self) -> usize {
        // What:     `self.unsaved`. Tail -> return the counter.
        // Why:      Expose the private field read-only.
        // TS map:   `return this.unsaved;`
        self.unsaved
    }

    // What:     `pub(crate) fn insert(&mut self, fingerprint: String, peak: f32)`. Add
    //           or replace an entry and bump the unsaved counter. Takes an OWNED
    //           `String` key (the map stores it).
    // Why:      Record a freshly measured peak.
    // TS map:   `insert(fingerprint: string, peak: number): void`
    pub(crate) fn insert(&mut self, fingerprint: String, peak: f32) {
        // What:     `self.map.insert(fingerprint, peak);`. Store the pair.
        // Why:      Memoize the measurement.
        // TS map:   `this.map[fingerprint] = peak;`
        self.map.insert(fingerprint, peak);
        // What:     `self.unsaved += 1;`. One more entry awaiting persistence.
        // Why:      Track batch size.
        // TS map:   `this.unsaved += 1;`
        self.unsaved += 1;
    }

    // What:     `pub(crate) fn save(&mut self) -> std::io::Result<()>`. Write the map to
    //           disk atomically (write a temp file, then rename over the real one) and
    //           reset the unsaved counter.
    // Why:      Persist memoized peaks; atomic rename means a crash/kill mid-write
    //           cannot corrupt the real cache file.
    // TS map:   `save(): void  // throws on IO error`
    pub(crate) fn save(&mut self) -> std::io::Result<()> {
        // What:     `let path = match &self.path { Some(p) => p, None => return Ok(()) };`.
        //           Borrow the target path, or quietly succeed if there is none.
        // Why:      In-memory-only mode (no config dir) is not an error.
        // TS map:   `const path = this.path; if (!path) return;`
        let path = match &self.path {
            Some(p) => p,
            None => return Ok(()),
        };
        // What:     `if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }`.
        //           Ensure the directory exists; `?` propagates an IO error.
        // Why:      First save has no config dir yet.
        // TS map:   `mkdirSync(dirname(path), { recursive: true });`
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        // What:     `let json = serde_json::to_string(&self.map).map_err(std::io::Error::other)?;`.
        //           Serialize the map to JSON; convert any serde error into an
        //           `io::Error` so `?` can propagate it through our `io::Result`.
        // Why:      Produce the bytes; unify error types for `?`.
        // TS map:   `const json = JSON.stringify(this.map);`
        let json = serde_json::to_string(&self.map).map_err(std::io::Error::other)?;
        // What:     `let tmp = path.with_extension("tmp");`. A sibling temp path
        //           (`peaks.json` -> `peaks.tmp`). `with_extension` replaces the
        //           extension and returns an owned `PathBuf`.
        // Why:      Write here first, then atomically rename onto the real file.
        // TS map:   `const tmp = path.replace(/\.json$/, ".tmp");`
        let tmp = path.with_extension("tmp");
        // What:     `std::fs::write(&tmp, json)?;`. Write the JSON to the temp file.
        // Why:      Stage the new contents.
        // TS map:   `writeFileSync(tmp, json);`
        std::fs::write(&tmp, json)?;
        // What:     `std::fs::rename(&tmp, path)?;`. Atomically replace the real file
        //           with the temp one (same-filesystem rename is atomic on POSIX).
        // Why:      Readers always see a complete file, never a half-written one.
        // TS map:   `renameSync(tmp, path);`
        std::fs::rename(&tmp, path)?;
        // What:     `self.unsaved = 0;`. Everything is now on disk.
        // Why:      Reset the batch counter.
        // TS map:   `this.unsaved = 0;`
        self.unsaved = 0;
        // What:     `Ok(())`. Success with no value. Tail -> return.
        // Why:      Signal the save succeeded.
        // TS map:   `return;`
        Ok(())
    }
}

// What:     `#[cfg(test)] mod tests { ... }`. Test-only submodule.
// Why:      Cover fingerprint determinism/privacy and the disk round-trip.
// TS map:   a `peakcache.test.ts`.
#[cfg(test)]
mod tests {
    // What:     `use super::*;`. Bring the module's items into the test scope.
    // Why:      Tests use `fingerprint`, `PeakCache`, `PathBuf`.
    // TS map:   `import * as parent from "./peakcache";`
    use super::*;
    // What:     `use std::fs;`. Filesystem helpers for fixtures.
    // Why:      Create real temp files to fingerprint and a temp cache to round-trip.
    // TS map:   `import * as fs from "node:fs";`
    use std::fs;
    // What:     `use std::time::{SystemTime, UNIX_EPOCH};`. Clock + epoch for unique names.
    // Why:      Build collision-free temp paths.
    // TS map:   `Date.now()`.
    use std::time::{SystemTime, UNIX_EPOCH};

    // What:     `fn unique_path(suffix: &str) -> PathBuf`. A fresh throwaway path under
    //           the system temp dir, tagged with pid + nanoseconds + `suffix`.
    // Why:      Tests must not collide or touch real state.
    // TS map:   `function uniquePath(suffix: string): string`
    fn unique_path(suffix: &str) -> PathBuf {
        // What:     `let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();`.
        //           Nanoseconds since 1970; `.unwrap()` panics only if the clock is
        //           before 1970 (fine in a test).
        // Why:      High-resolution uniqueness.
        // TS map:   `const nanos = BigInt(Date.now()) * 1_000_000n;`
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        // What:     `std::env::temp_dir().join(format!("music-player-peak-{}-{}-{}", std::process::id(), nanos, suffix))`.
        //           Build the path. Tail -> return.
        // Why:      Unique per process, call, and purpose.
        // TS map:   `return join(os.tmpdir(), `music-player-peak-${pid}-${nanos}-${suffix}`);`
        std::env::temp_dir().join(format!(
            "music-player-peak-{}-{}-{}",
            std::process::id(),
            nanos,
            suffix
        ))
    }

    // What:     `#[test]` fingerprint behaviour.
    // Why:      Determinism, change-on-edit, and that the key leaks no path text.
    // TS map:   `test("fingerprint ...", () => {...})`
    #[test]
    fn fingerprint_is_stable_opaque_and_change_sensitive() {
        // What:     create a real temp file to stat.
        // Why:      `fingerprint` needs metadata.
        // TS map:   `const file = uniquePath("a.flac"); fs.writeFileSync(file, "x");`
        let file = unique_path("a.flac");
        fs::write(&file, b"hello").unwrap();

        // What:     `let first = fingerprint(&file).unwrap();`. Compute it once.
        // Why:      Baseline.
        // TS map:   `const first = fingerprint(file);`
        let first = fingerprint(&file).unwrap();
        // What:     same file fingerprints identically.
        // Why:      Determinism for cache hits.
        // TS map:   `expect(fingerprint(file)).toBe(first);`
        assert_eq!(fingerprint(&file).unwrap(), first);
        // What:     the key is a 16-char hex string, not the path.
        // Why:      Privacy: no metadata exposed.
        // TS map:   `expect(first.length).toBe(16); expect(first).not.toContain(file);`
        assert_eq!(first.len(), 16);
        assert!(!first.contains("a.flac"));

        // What:     a missing path yields no fingerprint.
        // Why:      Stat failure -> `None`.
        // TS map:   `expect(fingerprint(missing)).toBeNull();`
        assert!(fingerprint(&unique_path("nope.flac")).is_none());

        // What:     clean up.
        // Why:      No droppings.
        // TS map:   `try { unlinkSync(file); } catch {}`
        let _ = fs::remove_file(&file);
    }

    // What:     `#[test]` disk round-trip.
    // Why:      Insert + save + reload must preserve entries, and the file must hold
    //           only the opaque key and number (no path).
    // TS map:   `test("peak cache round-trip", () => {...})`
    #[test]
    fn save_and_reload_preserves_entries_without_metadata() {
        // What:     a throwaway cache file path.
        // Why:      Never touch the real config dir.
        // TS map:   `const cacheFile = uniquePath("cache.json");`
        let cache_file = unique_path("cache.json");

        // What:     `let mut cache = PeakCache::from_path(Some(cache_file.clone()));`.
        //           Build an empty cache pointing at the temp file.
        // Why:      Start fresh.
        // TS map:   `const cache = PeakCache.fromPath(cacheFile);`
        let mut cache = PeakCache::from_path(Some(cache_file.clone()));
        // What:     insert one entry and save.
        // Why:      Exercise insert + atomic save.
        // TS map:   `cache.insert("deadbeef00000000", 0.75); cache.save();`
        cache.insert("deadbeef00000000".to_string(), 0.75);
        cache.save().unwrap();

        // What:     `let reloaded = PeakCache::from_path(Some(cache_file.clone()));`.
        //           Load a new cache from the same file.
        // Why:      Prove persistence across instances.
        // TS map:   `const reloaded = PeakCache.fromPath(cacheFile);`
        let reloaded = PeakCache::from_path(Some(cache_file.clone()));
        // What:     the entry survived the round-trip.
        // Why:      Memoization works across runs.
        // TS map:   `expect(reloaded.get("deadbeef00000000")).toBe(0.75);`
        assert_eq!(reloaded.get("deadbeef00000000"), Some(0.75));

        // What:     read the raw file text.
        // Why:      Inspect what actually hit disk.
        // TS map:   `const text = readFileSync(cacheFile, "utf8");`
        let text = fs::read_to_string(&cache_file).unwrap();
        // What:     the file contains the opaque key but nothing path-like.
        // Why:      Privacy guarantee: only hashes and numbers.
        // TS map:   `expect(text).toContain("deadbeef00000000"); expect(text).not.toContain("/");`
        assert!(text.contains("deadbeef00000000"));
        assert!(!text.contains('/'));

        // What:     clean up the temp file.
        // Why:      No droppings.
        // TS map:   `try { unlinkSync(cacheFile); } catch {}`
        let _ = fs::remove_file(&cache_file);
    }
}
