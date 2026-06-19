//! Persistent memoization of measured true peaks.
//!
//! Measuring a track's true peak means decoding the whole file, which is slow, so
//! each result is cached on disk keyed by an opaque fingerprint. Privacy: the file
//! stores only `fingerprint -> peak` pairs, where the fingerprint is a one-way hash
//! of (path, size, mtime). No filename, path, or tag ever lands on disk, so the
//! cache reveals nothing about which tracks the user has.

/// What:     `use std::collections::HashMap;`. A hash map (key -> value). Sibling:
///           `BTreeMap` (ordered, slower lookups); we do not need ordering.
/// Why:      Maps a track fingerprint to its measured true peak.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type HashMap = Record<string, number>;
/// ```
use std::collections::HashMap;

/// What:     `use std::path::{Path, PathBuf};`. Borrowed and owned filesystem paths.
/// Why:      `fingerprint` borrows a path; the cache stores its file path owned.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // both are just `string` in TS
/// ```
use std::path::{Path, PathBuf};

/// What:     `use std::time::UNIX_EPOCH;`. The 1970 reference instant.
/// Why:      Convert a file's modified-time into a number for the fingerprint.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const UNIX_EPOCH = 0; // ms-since-1970 baseline
/// ```
use std::time::UNIX_EPOCH;

/// What:     `use std::sync::{Arc, Mutex};`. The atomically reference-counted shared
///           pointer and the mutual-exclusion lock.
/// Why:      `flush` below takes the cache as the same `Arc<Mutex<PeakCache>>` the
///           worker threads share, so it must name both types.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // no direct equivalent: a shared, lock-guarded handle
/// ```
use std::sync::{Arc, Mutex};

/// What:     `use gxhash::gxhash64;` pulls in ONE free function from the external
///           `gxhash` crate: `gxhash64(input: &[u8], seed: i64) -> u64`. It is a
///           fast NON-cryptographic hash; siblings in the same crate are
///           `gxhash32` (32-bit output) and `gxhash128` (128-bit), plus a
///           `GxHasher` type that plugs into `std::collections::HashMap`. We import
///           only the one-shot 64-bit function.
/// Why:      It replaces the hand-rolled FNV-1a as the fingerprint hash. The
///           one-shot `gxhash64` (not the `GxHasher`/`HashMap` path) is the only
///           form whose output is fully determined by `(bytes, seed)` with no
///           per-process randomness, which is what a stable-within-a-run cache key
///           needs.
/// Gotcha:   `gxhash` compiles a hardware-AES code path with no software fallback,
///           so the crate only builds when the target enables the `aes` CPU feature
///           (set in .cargo/config.toml) and the resulting binary SIGILLs on a CPU
///           without AES. FNV-1a had no such hardware requirement.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { gxhash64 } from "gxhash"; // hypothetical; no real JVM/JS port exists
/// ```
use gxhash::gxhash64;

/// What:     `use crate::identity;` imports the shared identity-strings module
///           (importing the MODULE, so reads stay qualified as
///           `identity::CONFIG_APPLICATION`, keeping the origin obvious).
/// Why:      `cache_path` builds the config dir from the same reverse-DNS triple
///           `session.rs` uses, so the cache and the session always share a directory
///           and the literals cannot drift.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as identity from "./identity";
/// ```
use crate::identity;

/// What:     `const FINGERPRINT_SEED: i64 = 0;`. The fixed seed handed to
///           `gxhash64`. `i64` (a signed 64-bit integer; the sibling `u64` is what
///           you might expect, but gxhash's API takes `i64`) because that is the
///           exact parameter type of `gxhash64(input, seed)`.
/// Why:      gxhash64 is fully deterministic given `(bytes, seed)`, so pinning a
///           single constant seed makes the fingerprint reproducible across runs of
///           the SAME binary, which is all a cache key needs. The value itself is
///           arbitrary (0 is fine); what matters is that it never changes within a
///           build. We do NOT use gxhash's `GxHasher`/`HashMap` path, which seeds
///           itself randomly per process and would make the key unstable.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const FINGERPRINT_SEED = 0n; // bigint: the API wants a 64-bit integer
/// ```
const FINGERPRINT_SEED: i64 = 0;

/// What:     `pub(crate) fn fingerprint(path: &Path) -> Option<String>`. Build the opaque
///           cache key for a file from its path, size, and modified-time. Returns `None`
///           if the file cannot be stat'd. `pub(crate)` for the controller and background
///           worker.
/// Why:      Identify a track without storing anything identifying; size+mtime make the
///           key change when the file is replaced or edited in place.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function fingerprint(path: string): string | null {
///   let meta; try { meta = statSync(path); } catch { return null; }
///   const material = encode(path) + u64le(meta.size) + u128le(meta.mtimeNanos);
///   return gxhash64(material, FINGERPRINT_SEED).toString(16).padStart(16, "0");
/// }
/// ```
pub(crate) fn fingerprint(path: &Path) -> Option<String> {
    // What:     `let meta = std::fs::metadata(path).ok()?;`. Read filesystem metadata.
    //           `.ok()` turns the `Result` into an `Option` (dropping the error); `?`
    //           returns `None` from this function if it was an error.
    // Why:      We need the size and modified time; bail to "no fingerprint" if absent.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let meta; try { meta = statSync(path); } catch { return null; }
    // ```
    let meta = std::fs::metadata(path).ok()?;
    // What:     `let modified = meta.modified().ok()?;`. The file's last-modified
    //           `SystemTime`; `?` bails if the platform cannot report it.
    // Why:      Part of the key so editing a file in place invalidates its entry.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const modified = meta.mtime;
    // ```
    let modified = meta.modified().ok()?;
    // What:     `let mtime_nanos = modified.duration_since(UNIX_EPOCH).ok()?.as_nanos();`.
    //           `duration_since(UNIX_EPOCH)` is the span from 1970; `.as_nanos()` gives a
    //           `u128` nanosecond count. `.ok()?` bails if the file's time predates 1970.
    // Why:      A plain number to hash.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const mtimeNanos = BigInt(modified) * 1_000_000n;
    // ```
    let mtime_nanos = modified.duration_since(UNIX_EPOCH).ok()?.as_nanos();
    // What:     `let path_text = path.to_string_lossy();`. The path as text, with any
    //           non-UTF-8 bytes replaced. Returns a `Cow<str>` (borrowed-or-owned string).
    // Why:      Stable bytes to feed the hash; lossy is fine since we only hash it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const pathText = String(path);
    // ```
    let path_text = path.to_string_lossy();
    // What:     `let mut material: Vec<u8> = Vec::new();`. A growable byte buffer for the
    //           key material. `let mut` because we append to it.
    // Why:      Concatenate path + size + mtime before hashing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const material: number[] = [];
    // ```
    let mut material: Vec<u8> = Vec::new();
    // What:     `material.extend_from_slice(path_text.as_bytes());`. Append the path
    //           bytes. `.as_bytes()` views the string as `&[u8]`.
    // Why:      Distinguish tracks at different paths.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // material.push(...encode(pathText));
    // ```
    material.extend_from_slice(path_text.as_bytes());
    // What:     `material.extend_from_slice(&meta.len().to_le_bytes());`. Append the file
    //           size as little-endian bytes. `meta.len()` is a `u64`; `.to_le_bytes()`
    //           gives a `[u8; 8]`.
    // Why:      Size change (re-encode) invalidates the key.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // material.push(...u64le(meta.size));
    // ```
    material.extend_from_slice(&meta.len().to_le_bytes());
    // What:     `material.extend_from_slice(&mtime_nanos.to_le_bytes());`. Append the
    //           mtime as little-endian bytes (`u128` -> `[u8; 16]`).
    // Why:      In-place edits (same size) still change the key via mtime.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // material.push(...u128le(mtimeNanos));
    // ```
    material.extend_from_slice(&mtime_nanos.to_le_bytes());
    // What:     `Some(format!("{:016x}", gxhash64(&material, FINGERPRINT_SEED)))`.
    //           `gxhash64(&material, FINGERPRINT_SEED)` hashes the borrowed byte slice
    //           `&material` with the fixed seed and returns a `u64`; `&material` lends
    //           the buffer read-only (gxhash does not take ownership). `format!` then
    //           renders that `u64` as a zero-padded 16-digit lowercase hex string
    //           (`{:016x}`), and `Some(...)` wraps it as the present variant of
    //           `Option`. No trailing `;`, so this tail expression is the return value.
    // Why:      The opaque key stored on disk; a 64-bit non-cryptographic hash is not
    //           reversible to the path in practice, preserving the privacy guarantee.
    // Gotcha:   gxhash output is stable only WITHIN a gxhash major version; a future
    //           major bump changes these keys, which just re-measures every track once
    //           (the cache treats a miss as "not measured yet"). FNV-1a was stable
    //           forever; we accept the trade for the shared hash implementation.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return gxhash64(material, FINGERPRINT_SEED).toString(16).padStart(16, "0");
    // ```
    Some(format!("{:016x}", gxhash64(&material, FINGERPRINT_SEED)))
}

/// What:     `fn cache_path() -> Option<PathBuf>`. The on-disk location of the peak cache
///           file, or `None` if no config directory is available. Module-private.
/// Why:      One place decides where the cache lives (the same `identity::config_dir` the
///           session file uses, so they never drift apart).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function cachePath(): string | null {
///   const dir = configDir();
///   return dir ? join(dir, "peaks.json") : null;
/// }
/// ```
fn cache_path() -> Option<PathBuf> {
    // What:     `identity::config_dir().map(|dir| dir.join("peaks.json"))`. Take the shared
    //           config directory (`Option<PathBuf>`, Linux: `$XDG_CONFIG_HOME/musicplayer`)
    //           and, when present, append the cache filename; `.join(...)` returns an owned
    //           `PathBuf`. Tail -> return.
    // Why:      Same directory the session uses, so the containerized run's config volume
    //           persists it and it never pollutes the source tree.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const dir = configDir();
    // return dir ? join(dir, "peaks.json") : null;
    // ```
    identity::config_dir().map(|dir| dir.join("peaks.json"))
}

/// What:     `pub(crate) struct PeakCache { ... }`. The in-memory cache plus where it
///           persists and how many inserts are unsaved. `pub(crate)` so the controller
///           and worker share it (behind an `Arc<Mutex<...>>`).
/// Why:      Hold the fingerprint -> peak map and batch writes to disk.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class PeakCache { map: Record<string, number>; path: string | null; unsaved: number; }
/// ```
pub(crate) struct PeakCache {
    /// What:     `map: HashMap<String, f32>`. Fingerprint hex -> measured true peak.
    /// Why:      The actual memoized data.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// map: Record<string, number>;
    /// ```
    map: HashMap<String, f32>,
    /// What:     `path: Option<PathBuf>`. Where to persist, or `None` (no config dir).
    /// Why:      Save/load target; `None` means run in-memory only.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// path: string | null;
    /// ```
    path: Option<PathBuf>,
    /// What:     `unsaved: usize`. Count of inserts not yet flushed to disk.
    /// Why:      Lets the background worker batch saves instead of writing per track.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// unsaved: number;
    /// ```
    unsaved: usize,
}

/// What:     `pub(crate) fn write_atomic(path: &Path, json: &str) -> std::io::Result<()>`.
///           Write `json` to `path` atomically: stage it in a sibling `.tmp` file, then
///           rename over the real file. `&Path`/`&str` borrow the inputs read-only (we do
///           not take ownership). `pub(crate)` so the background sweep can call it WITHOUT
///           holding the cache lock.
/// Why:      Saving is the only part of persistence that touches the disk; pulling it out
///           as a free function lets a caller serialize under the lock, then release the
///           lock and do the slow file I/O here. That matters because the sweep runs at
///           idle scheduling priority: holding the shared cache mutex across a disk write
///           could stall the engine thread (which also locks the cache on track load) if
///           the idle sweep is starved mid-write.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function writeAtomic(path: string, json: string): void {
///   mkdirSync(dirname(path), { recursive: true });
///   const tmp = path.replace(/\.json$/, ".tmp");
///   writeFileSync(tmp, json);
///   renameSync(tmp, path);
/// }
/// ```
pub(crate) fn write_atomic(path: &Path, json: &str) -> std::io::Result<()> {
    // What:     `if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }`.
    //           Ensure the directory exists; `?` propagates an IO error.
    // Why:      First save has no config dir yet.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // mkdirSync(dirname(path), { recursive: true });
    // ```
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    // What:     `let tmp = path.with_extension("tmp");`. A sibling temp path (`peaks.json`
    //           -> `peaks.tmp`); `with_extension` returns an owned `PathBuf`.
    // Why:      Write here first, then atomically rename onto the real file.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const tmp = path.replace(/\.json$/, ".tmp");
    // ```
    let tmp = path.with_extension("tmp");
    // What:     `std::fs::write(&tmp, json)?;`. Write the bytes to the temp file. `&tmp`/
    //           `json` lend the path and contents.
    // Why:      Stage the new contents.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // writeFileSync(tmp, json);
    // ```
    std::fs::write(&tmp, json)?;
    // What:     `std::fs::rename(&tmp, path)?;`. Atomically replace the real file
    //           (same-filesystem rename is atomic on POSIX).
    // Why:      Readers always see a complete file, never a half-written one.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // renameSync(tmp, path);
    // ```
    std::fs::rename(&tmp, path)?;
    // What:     `Ok(())`. Success with no value. Tail -> return.
    // Why:      Signal the write succeeded.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return;
    // ```
    Ok(())
}

/// What:     `impl PeakCache { ... }`. The cache's behaviour.
/// Why:      Load, query, insert, and persist.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class PeakCache { /* load, from_path, get, unsaved, insert, save, pending_save, mark_saved */ }
/// ```
impl PeakCache {
    /// What:     `pub(crate) fn load() -> PeakCache`. Read the cache from its standard
    ///           location, or start empty if absent/corrupt.
    /// Why:      Called once at startup.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static load(): PeakCache { return PeakCache.fromPath(cachePath()); }
    /// ```
    pub(crate) fn load() -> PeakCache {
        // What:     `PeakCache::from_path(cache_path())`. Delegate to the path-taking
        //           constructor with the standard location. Tail -> return.
        // Why:      Share one code path with the test constructor.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return PeakCache.fromPath(cachePath());
        // ```
        PeakCache::from_path(cache_path())
    }

    /// What:     `pub(crate) fn from_path(path: Option<PathBuf>) -> PeakCache`. Build a
    ///           cache that persists to `path`, pre-loading any existing entries.
    ///           `pub(crate)` so `measure`'s tests can point it at a throwaway file.
    /// Why:      One place to parse the on-disk map, reusable by `load` and tests.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static fromPath(path: string | null): PeakCache { ... }
    /// ```
    pub(crate) fn from_path(path: Option<PathBuf>) -> PeakCache {
        // What:     `let map = path.as_ref().and_then(...).and_then(...).unwrap_or_default();`.
        //           Read the file to a string then parse it as a `HashMap<String, f32>`;
        //           any missing/unreadable/corrupt step yields an empty map. `.as_ref()`
        //           borrows the `Option<PathBuf>` as `Option<&PathBuf>`; `.and_then`
        //           chains steps that may produce `None`;
        //           `serde_json::from_str::<HashMap<String, f32>>` (turbofish) parses the
        //           JSON; `.unwrap_or_default()` substitutes an empty map on `None`.
        // Why:      Start from saved data when possible, empty otherwise; never fail.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let map = {}; try { map = JSON.parse(readFileSync(path, "utf8")); } catch {}
        // ```
        let map = path
            .as_ref()
            .and_then(|p| std::fs::read_to_string(p).ok())
            .and_then(|text| serde_json::from_str::<HashMap<String, f32>>(&text).ok())
            .unwrap_or_default();
        // What:     `PeakCache { map, path, unsaved: 0 }`. Build the cache (field
        //           shorthand for `map`/`path`); nothing is unsaved yet. Tail -> return.
        // Why:      Ready to query and extend.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { map, path, unsaved: 0 };
        // ```
        PeakCache {
            map,
            path,
            unsaved: 0,
        }
    }

    /// What:     `pub(crate) fn get(&self, fingerprint: &str) -> Option<f32>`. Look up a
    ///           cached peak. `&str` borrows the key; `Option<f32>` is the maybe-result.
    /// Why:      Callers check the cache before measuring.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// get(fingerprint: string): number | undefined { return this.map[fingerprint]; }
    /// ```
    pub(crate) fn get(&self, fingerprint: &str) -> Option<f32> {
        // What:     `self.map.get(fingerprint).copied()`. `.get` returns `Option<&f32>` (a
        //           borrow); `.copied()` turns it into `Option<f32>` (an owned copy). Tail
        //           -> return.
        // Why:      Hand back the value, not a borrow into the map.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.map[fingerprint];
        // ```
        self.map.get(fingerprint).copied()
    }

    /// What:     `pub(crate) fn unsaved(&self) -> usize`. How many inserts are pending a
    ///           save.
    /// Why:      The background worker uses it to decide when to flush a batch.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// unsaved(): number { return this.unsaved; }
    /// ```
    pub(crate) fn unsaved(&self) -> usize {
        // What:     `self.unsaved`. Tail -> return the counter.
        // Why:      Expose the private field read-only.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.unsaved;
        // ```
        self.unsaved
    }

    /// What:     `pub(crate) fn insert(&mut self, fingerprint: String, peak: f32)`. Add or
    ///           replace an entry and bump the unsaved counter. Takes an OWNED `String`
    ///           key (the map stores it).
    /// Why:      Record a freshly measured peak.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// insert(fingerprint: string, peak: number): void { this.map[fingerprint] = peak; this.unsaved++; }
    /// ```
    pub(crate) fn insert(&mut self, fingerprint: String, peak: f32) {
        // What:     `self.map.insert(fingerprint, peak);`. Store the pair (consumes the
        //           owned key).
        // Why:      Memoize the measurement.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.map[fingerprint] = peak;
        // ```
        self.map.insert(fingerprint, peak);
        // What:     `self.unsaved += 1;`. One more entry awaiting persistence.
        // Why:      Track batch size.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.unsaved += 1;
        // ```
        self.unsaved += 1;
    }

    /// What:     `pub(crate) fn save(&mut self) -> std::io::Result<()>`. Write the map to
    ///           disk atomically (write a temp file, then rename over the real one) and
    ///           reset the unsaved counter.
    /// Why:      Persist memoized peaks; atomic rename means a crash/kill mid-write cannot
    ///           corrupt the real cache file.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// save(): void { if (!this.path) return; writeAtomic(this.path, JSON.stringify(this.map)); this.unsaved = 0; }
    /// ```
    /// What:     `#[cfg(test)]` compiles the next method only for test builds.
    /// Why:      Production callers use `pending_save` plus `write_atomic` so disk I/O
    ///           happens outside the mutex; tests keep this direct helper for round-trip assertions.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// // only exported in test builds
    /// ```
    #[cfg(test)]
    pub(crate) fn save(&mut self) -> std::io::Result<()> {
        // What:     `let path = match &self.path { Some(p) => p, None => return Ok(()) };`.
        //           Borrow the target path, or quietly succeed if there is none.
        // Why:      In-memory-only mode (no config dir) is not an error.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const path = this.path; if (!path) return;
        // ```
        let path = match &self.path {
            // What:     `Some(p) => p`. Borrow the present path.
            // Why:      Continue to writing.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // path = p;
            // ```
            Some(p) => p,
            // What:     `None => return Ok(())`. No path: succeed without writing.
            // Why:      In-memory mode.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return;
            // ```
            None => return Ok(()),
        };
        // What:     `let json = serde_json::to_string(&self.map).map_err(std::io::Error::other)?;`.
        //           Serialize the map to JSON; `.map_err(std::io::Error::other)` converts
        //           any serde error into an `io::Error` so `?` can propagate it through our
        //           `io::Result`.
        // Why:      Produce the bytes; unify error types for `?`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const json = JSON.stringify(this.map);
        // ```
        let json = serde_json::to_string(&self.map).map_err(std::io::Error::other)?;
        // What:     `write_atomic(path, &json)?;`. Stage-and-rename the bytes to disk via
        //           the shared free function; `?` propagates an IO error.
        // Why:      One place owns the atomic-write dance.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // writeAtomic(path, json);
        // ```
        write_atomic(path, &json)?;
        // What:     `self.unsaved = 0;`. Everything is now on disk.
        // Why:      Reset the batch counter.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.unsaved = 0;
        // ```
        self.unsaved = 0;
        // What:     `Ok(())`. Success with no value. Tail -> return.
        // Why:      Signal the save succeeded.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return;
        // ```
        Ok(())
    }

    /// What:     `pub(crate) fn pending_save(&self) -> Option<(PathBuf, String, usize)>`.
    ///           Take a SNAPSHOT for an out-of-lock write: if there is a path and at least
    ///           one unsaved insert, serialize the map now (under the caller's lock) and
    ///           return the owned `(path, json, count)` tuple. `None` means nothing to
    ///           write. Read-only borrow of self.
    /// Why:      Lets the background sweep do the slow disk write WITHOUT holding the cache
    ///           mutex: it calls this under the lock (fast, in-memory), releases the lock,
    ///           writes with `write_atomic`, then calls `mark_saved(count)`.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// pendingSave(): [string, string, number] | null {
    ///   if (this.unsaved === 0 || !this.path) return null;
    ///   return [this.path, JSON.stringify(this.map), this.unsaved];
    /// }
    /// ```
    pub(crate) fn pending_save(&self) -> Option<(PathBuf, String, usize)> {
        // What:     `if self.unsaved == 0 { return None; }`. Nothing new to persist.
        // Why:      Skip redundant writes.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.unsaved === 0) return null;
        // ```
        if self.unsaved == 0 {
            return None;
        }
        // What:     `let path = self.path.clone()?;`. Clone the target path (owned
        //           `PathBuf`); `?` returns `None` if there is no path (in-memory mode).
        // Why:      The caller writes after releasing the lock, so it needs an owned path.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const path = this.path; if (!path) return null;
        // ```
        let path = self.path.clone()?;
        // What:     `let json = serde_json::to_string(&self.map).ok()?;`. Serialize the
        //           map; `.ok()` drops a serde error into `None`; `?` then returns `None`.
        // Why:      Capture the bytes while the lock is held, so the later write is a pure
        //           file operation.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let json; try { json = JSON.stringify(this.map); } catch { return null; }
        // ```
        let json = serde_json::to_string(&self.map).ok()?;
        // What:     `Some((path, json, self.unsaved))`. Hand back the snapshot plus the
        //           number of unsaved entries it covers. Tail -> return.
        // Why:      `mark_saved` will subtract this exact count later.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return [path, json, this.unsaved];
        // ```
        Some((path, json, self.unsaved))
    }

    /// What:     `pub(crate) fn mark_saved(&mut self, count: usize)`. After a successful
    ///           out-of-lock write of a `pending_save` snapshot, subtract the snapshot's
    ///           entry count from the unsaved counter.
    /// Why:      Inserts that happened AFTER the snapshot (e.g. the engine thread measuring
    ///           a just-loaded track) must stay counted as unsaved, so we subtract `count`
    ///           rather than resetting to zero.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// markSaved(count: number): void { this.unsaved = Math.max(0, this.unsaved - count); }
    /// ```
    pub(crate) fn mark_saved(&mut self, count: usize) {
        // What:     `self.unsaved = self.unsaved.saturating_sub(count);`. Subtract, but
        //           clamp at 0 instead of underflowing (a concurrent `save()` may have
        //           already reset the counter). `saturating_sub` never wraps below 0.
        // Why:      Keep the counter non-negative and correct under concurrent saves.
        // Gotcha:   on `usize` a plain `-` underflow PANICS; `saturating_sub` clamps to 0.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.unsaved = Math.max(0, this.unsaved - count);
        // ```
        self.unsaved = self.unsaved.saturating_sub(count);
    }
}

/// What:     `pub(crate) fn flush(cache: &Arc<Mutex<PeakCache>>)`. Persist any unsaved
///           cache entries to disk WITHOUT holding the lock across the file write.
///           `&Arc<...>` borrows the shared handle (no ownership taken).
/// Why:      Both the background sweep (measure.rs) and the current-track measurement
///           (peak_swap.rs) need this exact off-lock save dance; owning it here, next to
///           `pending_save`/`mark_saved`/`write_atomic`, keeps the lock discipline in one
///           place instead of two copies that could drift.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function flush(cache: SharedPeakCache): void {
///   const snapshot = withLock(cache, (c) => c.pendingSave());
///   if (!snapshot) return;
///   const [path, json, count] = snapshot;
///   if (writeAtomic(path, json)) withLock(cache, (c) => c.markSaved(count));
/// }
/// ```
pub(crate) fn flush(cache: &Arc<Mutex<PeakCache>>) {
    // What:     `let snapshot = { let guard = cache.lock().unwrap(); guard.pending_save() };`.
    //           A BLOCK EXPRESSION: lock the cache, take an owned `(path, json, count)`
    //           snapshot (or `None`), and release the lock at the end of the block (the
    //           guard drops). `.lock()` returns a `Result` (poisoned if a holder panicked);
    //           `.unwrap()` takes the guard or panics.
    // Why:      Serialize while locked (fast, in-memory); write while unlocked.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const snapshot = withLock(cache, (c) => c.pendingSave());
    // ```
    let snapshot = {
        let guard = cache.lock().unwrap();
        guard.pending_save()
    };
    // What:     `if let Some((path, json, count)) = snapshot { ... }`. Only write when there
    //           was something to save. Destructures the owned tuple.
    // Why:      Skip the disk entirely when nothing changed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (snapshot) { const [path, json, count] = snapshot; ... }
    // ```
    if let Some((path, json, count)) = snapshot {
        // What:     `if write_atomic(&path, &json).is_ok() { ... }`. Do the file write with
        //           NO lock held; `.is_ok()` checks the `Result` without unwrapping (an IO
        //           error just means we retry next interval).
        // Why:      The slow part happens off the lock; only update the counter if the write
        //           actually landed.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let ok = true; try { writeAtomic(path, json); } catch { ok = false; } if (ok) { ... }
        // ```
        if write_atomic(&path, &json).is_ok() {
            // What:     `cache.lock().unwrap().mark_saved(count);`. Re-lock briefly and
            //           subtract the snapshot's entry count from the unsaved counter.
            // Why:      Record that these entries are now on disk; passing a COUNT (not a
            //           zeroing) leaves any inserts that raced the snapshot still pending.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // withLock(cache, (c) => c.markSaved(count));
            // ```
            cache.lock().unwrap().mark_saved(count);
        }
    }
}

/// What:     `#[cfg(test)] #[path = "peakcache_tests.rs"] mod tests;` declares a
///           test-only submodule whose code lives in the sibling file
///           `peakcache_tests.rs`. `#[cfg(test)]` gates it to test builds only;
///           `#[path = "..."]` aims the module at a flat sibling file instead of the
///           default `peakcache/tests.rs` subdirectory lookup. The file stays the `tests`
///           CHILD of peakcache, so its `use super::*` reaches the module items
///           (including private ones) unchanged.
/// Why:      Keep `peakcache.rs` to production code; the tests live beside it without
///           inflating this file or its max-lines budget (sibling `*_tests.rs` files are
///           exempt from the linter).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // peakcache.unit.test.ts, run only by the test runner
/// ```
#[cfg(test)]
#[path = "peakcache_tests.rs"]
mod tests;
