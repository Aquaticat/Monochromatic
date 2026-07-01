//! True-peak fingerprinting plus the cache module wiring.
//!
//! The cache store now lives in a Turso-backed actor (`peakcache_service.rs`)
//! reached through the synchronous `CacheHandle` (`peakcache_handle.rs`); this root
//! keeps only the storage-independent pieces: `fingerprint` (the opaque cache key)
//! and `db_path` (the one place that decides where the database file lives).
//! Privacy is unchanged: a fingerprint is a one-way hash of (path, size, mtime), so
//! only `fingerprint -> peak` rows ever hit disk, never a filename, path, or tag.

/// What:     `use std::path::{Path, PathBuf};`. Borrowed and owned filesystem paths.
/// Why:      `fingerprint` borrows a path; `db_path` returns an owned one.
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

/// What:     `use gxhash::gxhash64;`. The one-shot 64-bit non-cryptographic hash
///           `gxhash64(input: &[u8], seed: i64) -> u64`.
/// Why:      Derive the opaque fingerprint; its output is fully determined by
///           `(bytes, seed)` with no per-process randomness, which a stable cache
///           key needs.
/// Gotcha:   gxhash has a hardware-AES code path with no software fallback, so the
///           target must enable the `aes` CPU feature (.cargo/config.toml) or the
///           binary SIGILLs at runtime.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { gxhash64 } from "gxhash"; // hypothetical; no real JVM/JS port exists
/// ```
use gxhash::gxhash64;

/// What:     `use crate::identity;` imports the shared identity-strings module
///           (reads stay qualified as `identity::config_dir`).
/// Why:      `db_path` builds the config dir from the same reverse-DNS triple the
///           session uses, so the cache and session share a directory.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as identity from "./identity";
/// ```
use crate::identity;

/// What:     `use truepeak_core::{CacheIdentity, default_policy};`. The four-part cache
///           identity type and the one shipped policy, from the shared crate.
/// Why:      `cache_identity` pairs the shared policy's `policy_id`/`meter_id`/`schema`
///           with the desktop's `decoder_stack_id`, so a cache row is reused only when the
///           whole measurement environment matches.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { CacheIdentity, defaultPolicy } from "truepeak-core";
/// ```
use truepeak_core::{CacheIdentity, default_policy};

/// What:     `#[path = "peakcache_service.rs"] mod service;`. The async cache actor,
///           loaded from a flat sibling file.
/// Why:      Keep the Turso connection, runtime, and serve-loop out of this root.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as service from "./peakcache_service";
/// ```
#[path = "peakcache_service.rs"]
mod service;

/// What:     `#[path = "peakcache_handle.rs"] mod handle;`. The synchronous handle,
///           loaded from a flat sibling file.
/// Why:      Keep the channel plumbing beside, but separate from, the actor.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as handle from "./peakcache_handle";
/// ```
#[path = "peakcache_handle.rs"]
mod handle;

/// What:     `pub(crate) use handle::CacheHandle;`. Re-export the handle type at the
///           `peakcache` path.
/// Why:      Callers say `peakcache::CacheHandle`, unaware of the submodule split.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export { CacheHandle } from "./peakcache_handle";
/// ```
pub(crate) use handle::CacheHandle;

/// What:     `const FINGERPRINT_SEED: i64 = 0;`. The fixed seed handed to `gxhash64`.
///           `i64` because that is the exact parameter type of `gxhash64(input, seed)`.
/// Why:      gxhash64 is fully deterministic given `(bytes, seed)`, so pinning one
///           constant seed makes the fingerprint reproducible across runs of the SAME
///           binary, which is all a cache key needs. The value itself is arbitrary.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const FINGERPRINT_SEED = 0n; // bigint: the API wants a 64-bit integer
/// ```
const FINGERPRINT_SEED: i64 = 0;

/// What:     `pub(crate) fn fingerprint(path: &Path) -> Option<u64>`. Build the opaque
///           cache key for a file from its path, size, and modified-time. Returns `None`
///           if the file cannot be stat'd. `pub(crate)` for the controller and background
///           worker. The value is the raw `gxhash64` output, since the shared
///           `DecisionCache` keys on a `u64` (stored as a bijective `i64` bit-cast), not a
///           hex string.
/// Why:      Identify a track without storing anything identifying; size+mtime make the key
///           change when the file is replaced or edited in place.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function fingerprint(path: string): bigint | null {
///   let meta; try { meta = statSync(path); } catch { return null; }
///   const material = encode(path) + u64le(meta.size) + u128le(meta.mtimeNanos);
///   return gxhash64(material, FINGERPRINT_SEED);
/// }
/// ```
pub(crate) fn fingerprint(path: &Path) -> Option<u64> {
    // What:     `let meta = std::fs::metadata(path).ok()?;`. Read filesystem metadata;
    //           `?` returns `None` on error.
    // Why:      Need the size and modified time; bail to "no fingerprint" if absent.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let meta; try { meta = statSync(path); } catch { return null; }
    // ```
    let meta = std::fs::metadata(path).ok()?;
    // What:     `let modified = meta.modified().ok()?;`. The last-modified `SystemTime`.
    // Why:      Part of the key so editing a file in place invalidates its entry.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const modified = meta.mtime;
    // ```
    let modified = meta.modified().ok()?;
    // What:     `let mtime_nanos = modified.duration_since(UNIX_EPOCH).ok()?.as_nanos();`.
    //           Nanoseconds since 1970 as a `u128`; bails if the time predates 1970.
    // Why:      A plain number to hash.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const mtimeNanos = BigInt(modified) * 1_000_000n;
    // ```
    let mtime_nanos = modified.duration_since(UNIX_EPOCH).ok()?.as_nanos();
    // What:     `let path_text = path.to_string_lossy();`. The path as text, lossy.
    // Why:      Stable bytes to feed the hash; lossy is fine since we only hash it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const pathText = String(path);
    // ```
    let path_text = path.to_string_lossy();
    // What:     `let mut material: Vec<u8> = Vec::new();`. A growable byte buffer.
    // Why:      Concatenate path + size + mtime before hashing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const material: number[] = [];
    // ```
    let mut material: Vec<u8> = Vec::new();
    // What:     `material.extend_from_slice(path_text.as_bytes());`. Append path bytes.
    // Why:      Distinguish tracks at different paths.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // material.push(...encode(pathText));
    // ```
    material.extend_from_slice(path_text.as_bytes());
    // What:     `material.extend_from_slice(&meta.len().to_le_bytes());`. Append the
    //           file size as little-endian bytes (`u64` -> `[u8; 8]`).
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
    // What:     `Some(gxhash64(&material, FINGERPRINT_SEED))`. Hash the bytes with the
    //           fixed seed; the raw `u64` is the cache key. Tail -> return.
    // Why:      The opaque key stored on disk; a 64-bit non-cryptographic hash is not
    //           reversible to the path in practice, preserving the privacy guarantee. The
    //           shared cache keys on the `u64` directly, so no hex rendering is needed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return gxhash64(material, FINGERPRINT_SEED);
    // ```
    Some(gxhash64(&material, FINGERPRINT_SEED))
}

/// What:     `const DECODER_STACK_DESCRIPTION: &str = "...";`. A stable text description of
///           the desktop decode stack that produces the PCM the meter reads.
/// Why:      Its hash is the `decoder_stack_id`; editing this string when the decoder stack
///           changes (a Symphonia or libopus bump, an f32 conversion change) re-keys the
///           cache, so decisions measured under a different decoder are never reused.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const DECODER_STACK_DESCRIPTION = "desktop:symphonia-0.6+opus-rev-5598766+f32le";
/// ```
const DECODER_STACK_DESCRIPTION: &str = "desktop:symphonia-0.6+opus-rev-5598766+f32le";

/// What:     `fn decoder_stack_id() -> u64`. Hash the decoder-stack description into a stable
///           id with the shared crate's `stack_id`. Module-private.
/// Why:      The platform owns its description; the shared crate owns the derivation, the
///           same FNV every other identity id uses.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function decoderStackId(): bigint { return stackId(DECODER_STACK_DESCRIPTION); }
/// ```
fn decoder_stack_id() -> u64 {
    // What:     `truepeak_core::stack_id(DECODER_STACK_DESCRIPTION)`. Tail -> return.
    // Why:      Deterministic id that changes only when the description does.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return stackId(DECODER_STACK_DESCRIPTION);
    // ```
    truepeak_core::stack_id(DECODER_STACK_DESCRIPTION)
}

/// What:     `pub(crate) fn cache_identity() -> CacheIdentity`. The full four-part identity a
///           desktop cache row must match: the shipped policy's id and meter id, the desktop
///           decoder id, and the schema version. `pub(crate)` for the cache actor.
/// Why:      The actor keys every `get`/`put`/`exact_fingerprints` on this identity, so a
///           policy, meter, decoder, or schema change transparently starts a fresh cache.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function cacheIdentity(): CacheIdentity { return defaultPolicy().cacheIdentity(decoderStackId()); }
/// ```
pub(crate) fn cache_identity() -> CacheIdentity {
    // What:     `default_policy().cache_identity(decoder_stack_id())`. Assemble the identity
    //           from the shared policy and the desktop decoder id. Tail -> return.
    // Why:      One place builds the desktop's cache identity.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return defaultPolicy().cacheIdentity(decoderStackId());
    // ```
    default_policy().cache_identity(decoder_stack_id())
}

/// What:     `fn db_path() -> Option<PathBuf>`. The on-disk location of the decision
///           database, or `None` if no config directory is available. Module-private.
/// Why:      One place decides where the cache lives (the same `identity::config_dir` the
///           session file uses, so they never drift apart).
/// Gotcha:   The filename is `decisions.db`, NOT the legacy `peaks.db`: the shared cache
///           uses a different schema (a `decisions` table keyed by the identity tuple), and
///           the plan says not to import legacy raw-peak rows, so a fresh file starts the
///           new policy from an empty cache and leaves any old `peaks.db` orphaned.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function dbPath(): string | null {
///   const dir = configDir();
///   return dir ? join(dir, "decisions.db") : null;
/// }
/// ```
fn db_path() -> Option<PathBuf> {
    // What:     `identity::config_dir().map(|dir| dir.join("decisions.db"))`. Append the
    //           database filename to the shared config directory when present. Tail
    //           -> return.
    // Why:      Same directory the session uses, so the containerized run's config volume
    //           persists it and it never pollutes the source tree.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const dir = configDir();
    // return dir ? join(dir, "decisions.db") : null;
    // ```
    identity::config_dir().map(|dir| dir.join("decisions.db"))
}

/// What:     `#[cfg(test)] #[path = "peakcache_tests.rs"] mod tests;` declares a
///           test-only submodule whose code lives in the sibling file.
/// Why:      Keep tests beside the code without inflating this file or its max-lines
///           budget (sibling `*_tests.rs` files are exempt from the linter).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // peakcache.unit.test.ts, run only by the test runner
/// ```
#[cfg(test)]
#[path = "peakcache_tests.rs"]
mod tests;
