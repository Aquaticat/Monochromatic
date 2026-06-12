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
//
// In TS you'd write (pseudocode):
// ```ts
// type HashMap = Record<string, number>;
// ```
use std::collections::HashMap;

// What:     `use std::path::{Path, PathBuf};`. Borrowed and owned filesystem paths.
// Why:      `fingerprint` borrows a path; the cache stores its file path owned.
// TS map:   both are `string`.
//
// In TS you'd write (pseudocode):
// ```ts
// // both are just `string` in TS
// ```
use std::path::{Path, PathBuf};

// What:     `use std::time::UNIX_EPOCH;`. The 1970 reference instant.
// Why:      Convert a file's modified-time into a number for the fingerprint.
// TS map:   `const UNIX_EPOCH = 0; // ms since 1970 baseline`
//
// In TS you'd write (pseudocode):
// ```ts
// const UNIX_EPOCH = 0; // ms-since-1970 baseline
// ```
use std::time::UNIX_EPOCH;

// What:     `use crate::identity;` imports the shared identity-strings module
//           (importing the MODULE, so reads stay qualified as
//           `identity::CONFIG_APPLICATION`, keeping the origin obvious).
// Why:      `cache_path` builds the config dir from the same reverse-DNS triple
//           `session.rs` uses, so the cache and the session always share a directory
//           and the literals cannot drift.
// TS map:   `import * as identity from "./identity";`
//
// In TS you'd write (pseudocode):
// ```ts
// import * as identity from "./identity";
// ```
use crate::identity;

// What:     `const FNV_OFFSET: u64 = 14695981039346656037;`. The 64-bit FNV-1a offset
//           basis (the hash's starting value). `u64` (sibling: `u32` for the 32-bit FNV
//           variant) because we want a 64-bit fingerprint.
// Why:      Standard FNV-1a seed; using the published constant keeps the hash stable.
// TS map:   `const FNV_OFFSET = 14695981039346656037n; // BigInt`
//
// In TS you'd write (pseudocode):
// ```ts
// const FNV_OFFSET = 14695981039346656037n; // BigInt: u64 exceeds Number
// ```
const FNV_OFFSET: u64 = 14695981039346656037;

// What:     `const FNV_PRIME: u64 = 1099511628211;`. The 64-bit FNV-1a prime multiplier.
// Why:      The other half of the FNV-1a definition.
// TS map:   `const FNV_PRIME = 1099511628211n;`
//
// In TS you'd write (pseudocode):
// ```ts
// const FNV_PRIME = 1099511628211n;
// ```
const FNV_PRIME: u64 = 1099511628211;

// What:     `fn fnv1a(bytes: &[u8]) -> u64`. Hash a byte slice with FNV-1a, a small fast
//           non-cryptographic hash. `&[u8]` is a borrowed read-only byte slice.
// Why:      Produce a compact, stable, opaque fingerprint from the key material.
// TS map:   `function fnv1a(bytes: Uint8Array): bigint`
//
// In TS you'd write (pseudocode):
// ```ts
// function fnv1a(bytes: Uint8Array): bigint {
//   return [...bytes].reduce((h, b) => BigInt.asUintN(64, (h ^ BigInt(b)) * FNV_PRIME), FNV_OFFSET);
// }
// ```
fn fnv1a(bytes: &[u8]) -> u64 {
    // What:     `bytes.iter().fold(FNV_OFFSET, |hash, &b| (hash ^ b as u64).wrapping_mul(FNV_PRIME))`.
    //           `.fold(seed, closure)` reduces the bytes: start at the offset basis, and
    //           for each byte XOR it in then multiply by the prime. `&b` copies the byte;
    //           `b as u64` widens it; `.wrapping_mul` multiplies with intentional
    //           overflow wrap (no panic), which is exactly how FNV is defined. Tail ->
    //           return.
    // Why:      FNV-1a = for each byte: hash = (hash XOR byte) * prime.
    // TS map:   `return bytes.reduce((h, b) => BigInt.asUintN(64, (h ^ BigInt(b)) * FNV_PRIME), FNV_OFFSET);`
    // Gotcha:   `.wrapping_mul` is DELIBERATE overflow wraparound; plain `*` on `u64`
    //           would PANIC on overflow in debug builds.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return bytes.reduce((h, b) => BigInt.asUintN(64, (h ^ BigInt(b)) * FNV_PRIME), FNV_OFFSET);
    // ```
    bytes
        .iter()
        .fold(FNV_OFFSET, |hash, &b| (hash ^ b as u64).wrapping_mul(FNV_PRIME))
}

// What:     `pub(crate) fn fingerprint(path: &Path) -> Option<String>`. Build the opaque
//           cache key for a file from its path, size, and modified-time. Returns `None`
//           if the file cannot be stat'd. `pub(crate)` for the controller and background
//           worker.
// Why:      Identify a track without storing anything identifying; size+mtime make the
//           key change when the file is replaced or edited in place.
// TS map:   `function fingerprint(path: string): string | null`
//
// In TS you'd write (pseudocode):
// ```ts
// function fingerprint(path: string): string | null {
//   let meta; try { meta = statSync(path); } catch { return null; }
//   const material = encode(path) + u64le(meta.size) + u128le(meta.mtimeNanos);
//   return fnv1a(material).toString(16).padStart(16, "0");
// }
// ```
pub(crate) fn fingerprint(path: &Path) -> Option<String> {
    // What:     `let meta = std::fs::metadata(path).ok()?;`. Read filesystem metadata.
    //           `.ok()` turns the `Result` into an `Option` (dropping the error); `?`
    //           returns `None` from this function if it was an error.
    // Why:      We need the size and modified time; bail to "no fingerprint" if absent.
    // TS map:   `let meta; try { meta = statSync(path); } catch { return null; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let meta; try { meta = statSync(path); } catch { return null; }
    // ```
    let meta = std::fs::metadata(path).ok()?;
    // What:     `let modified = meta.modified().ok()?;`. The file's last-modified
    //           `SystemTime`; `?` bails if the platform cannot report it.
    // Why:      Part of the key so editing a file in place invalidates its entry.
    // TS map:   `const modified = meta.mtime;`
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
    // TS map:   `const mtimeNanos = BigInt(modified) * 1_000_000n;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const mtimeNanos = BigInt(modified) * 1_000_000n;
    // ```
    let mtime_nanos = modified.duration_since(UNIX_EPOCH).ok()?.as_nanos();
    // What:     `let path_text = path.to_string_lossy();`. The path as text, with any
    //           non-UTF-8 bytes replaced. Returns a `Cow<str>` (borrowed-or-owned string).
    // Why:      Stable bytes to feed the hash; lossy is fine since we only hash it.
    // TS map:   `const pathText = String(path);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const pathText = String(path);
    // ```
    let path_text = path.to_string_lossy();
    // What:     `let mut material: Vec<u8> = Vec::new();`. A growable byte buffer for the
    //           key material. `let mut` because we append to it.
    // Why:      Concatenate path + size + mtime before hashing.
    // TS map:   `const material: number[] = [];`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const material: number[] = [];
    // ```
    let mut material: Vec<u8> = Vec::new();
    // What:     `material.extend_from_slice(path_text.as_bytes());`. Append the path
    //           bytes. `.as_bytes()` views the string as `&[u8]`.
    // Why:      Distinguish tracks at different paths.
    // TS map:   `material.push(...encode(pathText));`
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
    // TS map:   `material.push(...u64le(meta.size));`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // material.push(...u64le(meta.size));
    // ```
    material.extend_from_slice(&meta.len().to_le_bytes());
    // What:     `material.extend_from_slice(&mtime_nanos.to_le_bytes());`. Append the
    //           mtime as little-endian bytes (`u128` -> `[u8; 16]`).
    // Why:      In-place edits (same size) still change the key via mtime.
    // TS map:   `material.push(...u128le(mtimeNanos));`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // material.push(...u128le(mtimeNanos));
    // ```
    material.extend_from_slice(&mtime_nanos.to_le_bytes());
    // What:     `Some(format!("{:016x}", fnv1a(&material)))`. Hash the material and
    //           `format!` it as a zero-padded 16-digit lowercase hex string (`{:016x}`),
    //           wrapped in `Some`. Tail -> return.
    // Why:      The opaque key stored on disk; reversing it to the path is infeasible.
    // TS map:   `return fnv1a(material).toString(16).padStart(16, "0");`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return fnv1a(material).toString(16).padStart(16, "0");
    // ```
    Some(format!("{:016x}", fnv1a(&material)))
}

// What:     `fn cache_path() -> Option<PathBuf>`. The on-disk location of the peak cache
//           file, or `None` if no config directory is available. Module-private.
// Why:      One place decides where the cache lives (alongside the session file).
// TS map:   `function cachePath(): string | null`
//
// In TS you'd write (pseudocode):
// ```ts
// function cachePath(): string | null {
//   const dirs = projectDirs(CONFIG_QUALIFIER, CONFIG_ORGANIZATION, CONFIG_APPLICATION);
//   return dirs ? join(dirs.configDir, "peaks.json") : null;
// }
// ```
fn cache_path() -> Option<PathBuf> {
    // What:     `directories::ProjectDirs::from(identity::CONFIG_QUALIFIER, identity::CONFIG_ORGANIZATION, identity::CONFIG_APPLICATION)`
    //           asks for the standard per-app config dir (Linux: `$XDG_CONFIG_HOME/
    //           musicplayer`) from the reverse-DNS triple, sourced from the shared
    //           `identity` module instead of inline literals so the cache directory cannot
    //           drift from the session file's; returns `Option<ProjectDirs>`. Start of a
    //           method chain whose value is the tail.
    // Why:      Same directory the session uses, so the containerized run's config volume
    //           persists it and it never pollutes the source tree.
    // TS map:   `const dirs = projectDirs(CONFIG_QUALIFIER, CONFIG_ORGANIZATION, CONFIG_APPLICATION);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const dirs = projectDirs(CONFIG_QUALIFIER, CONFIG_ORGANIZATION, CONFIG_APPLICATION);
    // ```
    directories::ProjectDirs::from(
        identity::CONFIG_QUALIFIER,
        identity::CONFIG_ORGANIZATION,
        identity::CONFIG_APPLICATION,
    )
        // What:     `.map(|dirs| dirs.config_dir().join("peaks.json"))`. When present,
        //           join the cache filename onto the config dir. `config_dir()` is a
        //           `&Path`; `.join(...)` returns an owned `PathBuf`. Tail -> return.
        // Why:      Turn the directory into the full file path.
        // TS map:   `dirs ? join(dirs.configDir, "peaks.json") : null`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return dirs ? join(dirs.configDir, "peaks.json") : null;
        // ```
        .map(|dirs| dirs.config_dir().join("peaks.json"))
}

// What:     `pub(crate) struct PeakCache { ... }`. The in-memory cache plus where it
//           persists and how many inserts are unsaved. `pub(crate)` so the controller
//           and worker share it (behind an `Arc<Mutex<...>>`).
// Why:      Hold the fingerprint -> peak map and batch writes to disk.
// TS map:   `class PeakCache { map; path; unsaved; }`
//
// In TS you'd write (pseudocode):
// ```ts
// class PeakCache { map: Record<string, number>; path: string | null; unsaved: number; }
// ```
pub(crate) struct PeakCache {
    // What:     `map: HashMap<String, f32>`. Fingerprint hex -> measured true peak.
    // Why:      The actual memoized data.
    // TS map:   `map: Record<string, number>;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // map: Record<string, number>;
    // ```
    map: HashMap<String, f32>,
    // What:     `path: Option<PathBuf>`. Where to persist, or `None` (no config dir).
    // Why:      Save/load target; `None` means run in-memory only.
    // TS map:   `path: string | null;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // path: string | null;
    // ```
    path: Option<PathBuf>,
    // What:     `unsaved: usize`. Count of inserts not yet flushed to disk.
    // Why:      Lets the background worker batch saves instead of writing per track.
    // TS map:   `unsaved: number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // unsaved: number;
    // ```
    unsaved: usize,
}

// What:     `pub(crate) fn write_atomic(path: &Path, json: &str) -> std::io::Result<()>`.
//           Write `json` to `path` atomically: stage it in a sibling `.tmp` file, then
//           rename over the real file. `&Path`/`&str` borrow the inputs read-only (we do
//           not take ownership). `pub(crate)` so the background sweep can call it WITHOUT
//           holding the cache lock.
// Why:      Saving is the only part of persistence that touches the disk; pulling it out
//           as a free function lets a caller serialize under the lock, then release the
//           lock and do the slow file I/O here. That matters because the sweep runs at
//           idle scheduling priority: holding the shared cache mutex across a disk write
//           could stall the engine thread (which also locks the cache on track load) if
//           the idle sweep is starved mid-write.
// TS map:   `function writeAtomic(path: string, json: string): void  // throws on IO error`
//
// In TS you'd write (pseudocode):
// ```ts
// function writeAtomic(path: string, json: string): void {
//   mkdirSync(dirname(path), { recursive: true });
//   const tmp = path.replace(/\.json$/, ".tmp");
//   writeFileSync(tmp, json);
//   renameSync(tmp, path);
// }
// ```
pub(crate) fn write_atomic(path: &Path, json: &str) -> std::io::Result<()> {
    // What:     `if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }`.
    //           Ensure the directory exists; `?` propagates an IO error.
    // Why:      First save has no config dir yet.
    // TS map:   `mkdirSync(dirname(path), { recursive: true });`
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
    // TS map:   `const tmp = path.replace(/\.json$/, ".tmp");`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const tmp = path.replace(/\.json$/, ".tmp");
    // ```
    let tmp = path.with_extension("tmp");
    // What:     `std::fs::write(&tmp, json)?;`. Write the bytes to the temp file. `&tmp`/
    //           `json` lend the path and contents.
    // Why:      Stage the new contents.
    // TS map:   `writeFileSync(tmp, json);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // writeFileSync(tmp, json);
    // ```
    std::fs::write(&tmp, json)?;
    // What:     `std::fs::rename(&tmp, path)?;`. Atomically replace the real file
    //           (same-filesystem rename is atomic on POSIX).
    // Why:      Readers always see a complete file, never a half-written one.
    // TS map:   `renameSync(tmp, path);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // renameSync(tmp, path);
    // ```
    std::fs::rename(&tmp, path)?;
    // What:     `Ok(())`. Success with no value. Tail -> return.
    // Why:      Signal the write succeeded.
    // TS map:   `return;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return;
    // ```
    Ok(())
}

// What:     `impl PeakCache { ... }`. The cache's behaviour.
// Why:      Load, query, insert, and persist.
// TS map:   the class body.
//
// In TS you'd write (pseudocode):
// ```ts
// class PeakCache { /* load, from_path, get, unsaved, insert, save, pending_save, mark_saved */ }
// ```
impl PeakCache {
    // What:     `pub(crate) fn load() -> PeakCache`. Read the cache from its standard
    //           location, or start empty if absent/corrupt.
    // Why:      Called once at startup.
    // TS map:   `static load(): PeakCache`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static load(): PeakCache { return PeakCache.fromPath(cachePath()); }
    // ```
    pub(crate) fn load() -> PeakCache {
        // What:     `PeakCache::from_path(cache_path())`. Delegate to the path-taking
        //           constructor with the standard location. Tail -> return.
        // Why:      Share one code path with the test constructor.
        // TS map:   `return PeakCache.fromPath(cachePath());`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return PeakCache.fromPath(cachePath());
        // ```
        PeakCache::from_path(cache_path())
    }

    // What:     `pub(crate) fn from_path(path: Option<PathBuf>) -> PeakCache`. Build a
    //           cache that persists to `path`, pre-loading any existing entries.
    //           `pub(crate)` so `measure`'s tests can point it at a throwaway file.
    // Why:      One place to parse the on-disk map, reusable by `load` and tests.
    // TS map:   `static fromPath(path: string | null): PeakCache`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static fromPath(path: string | null): PeakCache { ... }
    // ```
    pub(crate) fn from_path(path: Option<PathBuf>) -> PeakCache {
        // What:     `let map = path.as_ref().and_then(...).and_then(...).unwrap_or_default();`.
        //           Read the file to a string then parse it as a `HashMap<String, f32>`;
        //           any missing/unreadable/corrupt step yields an empty map. `.as_ref()`
        //           borrows the `Option<PathBuf>` as `Option<&PathBuf>`; `.and_then`
        //           chains steps that may produce `None`;
        //           `serde_json::from_str::<HashMap<String, f32>>` (turbofish) parses the
        //           JSON; `.unwrap_or_default()` substitutes an empty map on `None`.
        // Why:      Start from saved data when possible, empty otherwise; never fail.
        // TS map:   `let map; try { map = JSON.parse(readFileSync(path,"utf8")); } catch { map = {}; }`
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
        // TS map:   `return { map, path, unsaved: 0 };`
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

    // What:     `pub(crate) fn get(&self, fingerprint: &str) -> Option<f32>`. Look up a
    //           cached peak. `&str` borrows the key; `Option<f32>` is the maybe-result.
    // Why:      Callers check the cache before measuring.
    // TS map:   `get(fingerprint: string): number | undefined`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // get(fingerprint: string): number | undefined { return this.map[fingerprint]; }
    // ```
    pub(crate) fn get(&self, fingerprint: &str) -> Option<f32> {
        // What:     `self.map.get(fingerprint).copied()`. `.get` returns `Option<&f32>` (a
        //           borrow); `.copied()` turns it into `Option<f32>` (an owned copy). Tail
        //           -> return.
        // Why:      Hand back the value, not a borrow into the map.
        // TS map:   `return this.map[fingerprint];`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.map[fingerprint];
        // ```
        self.map.get(fingerprint).copied()
    }

    // What:     `pub(crate) fn unsaved(&self) -> usize`. How many inserts are pending a
    //           save.
    // Why:      The background worker uses it to decide when to flush a batch.
    // TS map:   `unsaved(): number`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // unsaved(): number { return this.unsaved; }
    // ```
    pub(crate) fn unsaved(&self) -> usize {
        // What:     `self.unsaved`. Tail -> return the counter.
        // Why:      Expose the private field read-only.
        // TS map:   `return this.unsaved;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.unsaved;
        // ```
        self.unsaved
    }

    // What:     `pub(crate) fn insert(&mut self, fingerprint: String, peak: f32)`. Add or
    //           replace an entry and bump the unsaved counter. Takes an OWNED `String`
    //           key (the map stores it).
    // Why:      Record a freshly measured peak.
    // TS map:   `insert(fingerprint: string, peak: number): void`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // insert(fingerprint: string, peak: number): void { this.map[fingerprint] = peak; this.unsaved++; }
    // ```
    pub(crate) fn insert(&mut self, fingerprint: String, peak: f32) {
        // What:     `self.map.insert(fingerprint, peak);`. Store the pair (consumes the
        //           owned key).
        // Why:      Memoize the measurement.
        // TS map:   `this.map[fingerprint] = peak;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.map[fingerprint] = peak;
        // ```
        self.map.insert(fingerprint, peak);
        // What:     `self.unsaved += 1;`. One more entry awaiting persistence.
        // Why:      Track batch size.
        // TS map:   `this.unsaved += 1;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.unsaved += 1;
        // ```
        self.unsaved += 1;
    }

    // What:     `pub(crate) fn save(&mut self) -> std::io::Result<()>`. Write the map to
    //           disk atomically (write a temp file, then rename over the real one) and
    //           reset the unsaved counter.
    // Why:      Persist memoized peaks; atomic rename means a crash/kill mid-write cannot
    //           corrupt the real cache file.
    // TS map:   `save(): void  // throws on IO error`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // save(): void { if (!this.path) return; writeAtomic(this.path, JSON.stringify(this.map)); this.unsaved = 0; }
    // ```
    // What:     `#[cfg(test)]` compiles the next method only for test builds.
    // Why:      Production callers use `pending_save` plus `write_atomic` so disk I/O
    //           happens outside the mutex; tests keep this direct helper for round-trip assertions.
    // TS map:   no direct equivalent; closest is a test-only helper export.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // only exported in test builds
    // ```
    #[cfg(test)]
    pub(crate) fn save(&mut self) -> std::io::Result<()> {
        // What:     `let path = match &self.path { Some(p) => p, None => return Ok(()) };`.
        //           Borrow the target path, or quietly succeed if there is none.
        // Why:      In-memory-only mode (no config dir) is not an error.
        // TS map:   `const path = this.path; if (!path) return;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const path = this.path; if (!path) return;
        // ```
        let path = match &self.path {
            // What:     `Some(p) => p`. Borrow the present path.
            // Why:      Continue to writing.
            // TS map:   `path = p;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // path = p;
            // ```
            Some(p) => p,
            // What:     `None => return Ok(())`. No path: succeed without writing.
            // Why:      In-memory mode.
            // TS map:   `return;`
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
        // TS map:   `const json = JSON.stringify(this.map);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const json = JSON.stringify(this.map);
        // ```
        let json = serde_json::to_string(&self.map).map_err(std::io::Error::other)?;
        // What:     `write_atomic(path, &json)?;`. Stage-and-rename the bytes to disk via
        //           the shared free function; `?` propagates an IO error.
        // Why:      One place owns the atomic-write dance.
        // TS map:   `writeAtomic(path, json);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // writeAtomic(path, json);
        // ```
        write_atomic(path, &json)?;
        // What:     `self.unsaved = 0;`. Everything is now on disk.
        // Why:      Reset the batch counter.
        // TS map:   `this.unsaved = 0;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.unsaved = 0;
        // ```
        self.unsaved = 0;
        // What:     `Ok(())`. Success with no value. Tail -> return.
        // Why:      Signal the save succeeded.
        // TS map:   `return;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return;
        // ```
        Ok(())
    }

    // What:     `pub(crate) fn pending_save(&self) -> Option<(PathBuf, String, usize)>`.
    //           Take a SNAPSHOT for an out-of-lock write: if there is a path and at least
    //           one unsaved insert, serialize the map now (under the caller's lock) and
    //           return the owned `(path, json, count)` tuple. `None` means nothing to
    //           write. Read-only borrow of self.
    // Why:      Lets the background sweep do the slow disk write WITHOUT holding the cache
    //           mutex: it calls this under the lock (fast, in-memory), releases the lock,
    //           writes with `write_atomic`, then calls `mark_saved(count)`.
    // TS map:   `pendingSave(): [path: string, json: string, count: number] | null`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // pendingSave(): [string, string, number] | null {
    //   if (this.unsaved === 0 || !this.path) return null;
    //   return [this.path, JSON.stringify(this.map), this.unsaved];
    // }
    // ```
    pub(crate) fn pending_save(&self) -> Option<(PathBuf, String, usize)> {
        // What:     `if self.unsaved == 0 { return None; }`. Nothing new to persist.
        // Why:      Skip redundant writes.
        // TS map:   `if (this.unsaved === 0) return null;`
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
        // TS map:   `const path = this.path; if (!path) return null;`
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
        // TS map:   `let json; try { json = JSON.stringify(this.map); } catch { return null; }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let json; try { json = JSON.stringify(this.map); } catch { return null; }
        // ```
        let json = serde_json::to_string(&self.map).ok()?;
        // What:     `Some((path, json, self.unsaved))`. Hand back the snapshot plus the
        //           number of unsaved entries it covers. Tail -> return.
        // Why:      `mark_saved` will subtract this exact count later.
        // TS map:   `return [path, json, this.unsaved];`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return [path, json, this.unsaved];
        // ```
        Some((path, json, self.unsaved))
    }

    // What:     `pub(crate) fn mark_saved(&mut self, count: usize)`. After a successful
    //           out-of-lock write of a `pending_save` snapshot, subtract the snapshot's
    //           entry count from the unsaved counter.
    // Why:      Inserts that happened AFTER the snapshot (e.g. the engine thread measuring
    //           a just-loaded track) must stay counted as unsaved, so we subtract `count`
    //           rather than resetting to zero.
    // TS map:   `markSaved(count: number): void`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // markSaved(count: number): void { this.unsaved = Math.max(0, this.unsaved - count); }
    // ```
    pub(crate) fn mark_saved(&mut self, count: usize) {
        // What:     `self.unsaved = self.unsaved.saturating_sub(count);`. Subtract, but
        //           clamp at 0 instead of underflowing (a concurrent `save()` may have
        //           already reset the counter). `saturating_sub` never wraps below 0.
        // Why:      Keep the counter non-negative and correct under concurrent saves.
        // TS map:   `this.unsaved = Math.max(0, this.unsaved - count);`
        // Gotcha:   on `usize` a plain `-` underflow PANICS; `saturating_sub` clamps to 0.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.unsaved = Math.max(0, this.unsaved - count);
        // ```
        self.unsaved = self.unsaved.saturating_sub(count);
    }
}

// What:     `#[cfg(test)] #[path = "peakcache_tests.rs"] mod tests;` declares a
//           test-only submodule whose code lives in the sibling file
//           `peakcache_tests.rs`. `#[cfg(test)]` gates it to test builds only;
//           `#[path = "..."]` aims the module at a flat sibling file instead of the
//           default `peakcache/tests.rs` subdirectory lookup. The file stays the `tests`
//           CHILD of peakcache, so its `use super::*` reaches the module items
//           (including private ones) unchanged.
// Why:      Keep `peakcache.rs` to production code; the tests live beside it without
//           inflating this file or its max-lines budget (sibling `*_tests.rs` files are
//           exempt from the linter).
// TS map:   the `peakcache.unit.test.ts` file beside `peakcache.ts`, excluded from the
//           production bundle.
//
// In TS you'd write (pseudocode):
// ```ts
// // peakcache.unit.test.ts, run only by the test runner
// ```
#[cfg(test)]
#[path = "peakcache_tests.rs"]
mod tests;
