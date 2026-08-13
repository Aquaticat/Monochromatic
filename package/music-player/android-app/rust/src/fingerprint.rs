//! Track cache-key fingerprint, computed natively so the JVM side and the desktop
//! crate share one hash. Android's `fingerprint` used to be hand-written FNV-1a in
//! pure Kotlin (`core/PeakCache.kt`); it now hashes with `gxhash`, which has no
//! JVM/Kotlin port, so the computation moved here behind a JNI call. The material
//! layout (path bytes, then size as 8 little-endian bytes, then mtime-nanos as 16
//! little-endian bytes) and the fixed seed match the desktop crate
//! (`desktop-app/src/peakcache.rs`), so identical inputs hash identically on both.
//!
//! Testing: this crate is Android-only (its `ndk`/`ndk-sys` dependency refuses to
//! compile off-Android), so there is no host `cargo test` to exercise `compute`
//! directly. The fingerprint contract (determinism, non-zero opacity,
//! change-sensitivity to path/size/mtime) is verified ON DEVICE by
//! `NativeBridgeTest`, and the identical hashing algorithm is unit-tested host-side on
//! the desktop twin. The value is now the raw `u64` (returned as a Kotlin `Long`), which
//! the shared `DecisionCache` keys on directly, rather than the former hex string.

/// What:     `use jni::JNIEnv;` imports the per-call interface pointer the JVM hands
///           every native method (the gateway used to read the Java string and build
///           the returned one).
/// Why:      `native_fingerprint` reads its `JString` argument and allocates the
///           result string through this handle.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type JNIEnv = RuntimeContext; // per-call handle to talk to the host runtime
/// ```
use jni::JNIEnv;

/// What:     `use jni::objects::{JClass, JString};`. `JClass` is the calling Java
///           class handle (unused here); `JString` is a borrowed handle to a Java
///           `String` argument (sibling: `JObject`, the untyped object handle).
/// Why:      The JNI entry's signature names both: `_class` is the class handle and
///           `path` is the incoming Java string.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // both are opaque host-runtime handles
/// ```
use jni::objects::{JClass, JString};

/// What:     `use jni::sys::jlong;`. The JNI 64-bit signed integer (maps to Kotlin `Long`;
///           sibling `jint` is 32-bit).
/// Why:      `size`/`mtime_nanos` arrive as `jlong`, and the function now RETURNS a `jlong`
///           (the raw `u64` fingerprint bit-cast), not a Java string.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type jlong = bigint;
/// ```
use jni::sys::jlong;

/// What:     `use gxhash::gxhash64;` imports ONE free function from the external
///           `gxhash` crate: `gxhash64(input: &[u8], seed: i64) -> u64`, a fast
///           NON-cryptographic hash. Siblings: `gxhash32` / `gxhash128`.
/// Why:      It is the cache fingerprint hash, replacing the old pure-Kotlin FNV-1a.
/// Gotcha:   `gxhash` compiles a hardware-AES path with no software fallback, so the
///           native crate only builds with the `aes` CPU feature enabled (set in
///           `.cargo/config.toml` for the Android target triples) and the resulting
///           `.so` requires a CPU with ARM AES (every arm64-v8a phone with the crypto
///           extensions; checked on the target device before shipping).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { gxhash64 } from "gxhash"; // hypothetical; no real JVM port exists
/// ```
use gxhash::gxhash64;

/// What:     `const FINGERPRINT_SEED: i64 = 0;`. The fixed seed handed to `gxhash64`.
///           `i64` (signed 64-bit; the sibling `u64` is what you might expect, but the
///           gxhash API takes `i64`) because that is `gxhash64`'s exact parameter type.
/// Why:      gxhash64 is fully deterministic given `(bytes, seed)`; pinning one
///           constant seed makes the fingerprint reproducible. It MUST equal the
///           desktop crate's `FINGERPRINT_SEED` (also 0) so the two flavors hash
///           identical input identically.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const FINGERPRINT_SEED = 0n;
/// ```
const FINGERPRINT_SEED: i64 = 0;

/// What:     `fn compute(path: &str, size: u64, mtime_nanos: u128) -> u64`. The pure
///           fingerprint: borrow the path text (`&str`, a borrowed view; sibling owned
///           `String`), the file size, and the modified-time in nanoseconds, and return the
///           raw `u64` cache key (the shared `DecisionCache` keys on a `u64`, not a hex
///           string).
/// Why:      Keeping the hashing here (separate from the JNI glue) mirrors the desktop's
///           `fingerprint` and keeps the byte layout in one readable place.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function compute(path: string, size: bigint, mtimeNanos: bigint): bigint { ... }
/// ```
fn compute(path: &str, size: u64, mtime_nanos: u128) -> u64 {
    // What:     `let mut material: Vec<u8> = Vec::new();`. A growable byte buffer
    //           (`Vec<u8>`; sibling fixed `[u8; N]` or borrowed `&[u8]`). `mut`
    //           because we append to it.
    // Why:      Concatenate path + size + mtime before hashing, exactly as desktop.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const material: number[] = [];
    // ```
    let mut material: Vec<u8> = Vec::new();
    // What:     `material.extend_from_slice(path.as_bytes());`. `.as_bytes()` views
    //           the `&str` as a read-only `&[u8]` (UTF-8 bytes); `.extend_from_slice`
    //           appends them all.
    // Why:      Distinguish tracks at different paths (the URI string on Android).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // material.push(...new TextEncoder().encode(path));
    // ```
    material.extend_from_slice(path.as_bytes());
    // What:     `material.extend_from_slice(&size.to_le_bytes());`. `size.to_le_bytes()`
    //           turns the `u64` into a `[u8; 8]` (little-endian); `&` borrows it as a
    //           slice for `extend_from_slice`.
    // Why:      A size change (re-encode) must change the key; 8 LE bytes matches
    //           desktop's `meta.len().to_le_bytes()`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // material.push(...u64le(size));
    // ```
    material.extend_from_slice(&size.to_le_bytes());
    // What:     `material.extend_from_slice(&mtime_nanos.to_le_bytes());`. `u128`'s
    //           `to_le_bytes()` is a `[u8; 16]`; the high 8 bytes are zero for any
    //           realistic timestamp.
    // Why:      An in-place edit (same size, new mtime) must change the key; 16 LE
    //           bytes matches desktop's `u128` mtime serialization exactly.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // material.push(...u128le(mtimeNanos));
    // ```
    material.extend_from_slice(&mtime_nanos.to_le_bytes());
    // What:     `gxhash64(&material, FINGERPRINT_SEED)` hashes the borrowed buffer
    //           (`&material`, read-only loan) with the fixed seed, returning the `u64` cache
    //           key. No trailing `;`, so this tail expression is the return value.
    // Why:      The opaque cache key; not reversible to the path in practice, preserving the
    //           privacy guarantee. The shared cache keys on the `u64` directly, so no hex
    //           rendering is needed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return gxhash64(material, FINGERPRINT_SEED);
    // ```
    gxhash64(&material, FINGERPRINT_SEED)
}

// What:     `#[unsafe(no_mangle)]` keeps the symbol name unmangled so the JVM's
//           `System.loadLibrary` + `native` lookup finds it by the exact name below.
// Why:      Without it the linker would rename the symbol and JNI could not locate it.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[unsafe(no_mangle)]
/// What:     `pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeFingerprint<'local>(...)`.
///           The JNI entry. The name encodes `Java_` + package + class (`NativeBridge`)
///           + method (`nativeFingerprint`), underscore-joined. Params: `env` (the JNI
///           gateway), `_class` (the calling class, unused), `path: JString<'local>`
///           (the borrowed Java string), `size`/`mtime_nanos` (`jlong`, i.e. Kotlin
///           `Long`). `-> jlong` returns the raw `u64` fingerprint bit-cast to `i64`.
/// Why:      Kotlin's `NativeBridge.nativeFingerprint(path, size, mtimeNanos)` calls
///           this; it returns the cache key that `nativeResolveGain`/`nativeWarmTrack`
///           take. Returning the `u64` as a `Long` avoids a hex-string round-trip.
/// Gotcha:   `extern "system"` means a panic must NEVER cross this boundary; the body
///           only does infallible work plus one `match` that returns `0` on the
///           (practically unreachable) JNI string-read failure. A `0` key is a benign
///           collision risk only when the read fails, which never happens for a real
///           Kotlin string.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export function nativeFingerprint(env, _class, path: JString, size: bigint, mtimeNanos: bigint): jlong { ... }
/// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeFingerprint<'local>(
    mut env: JNIEnv<'local>,
    _class: JClass<'local>,
    path: JString<'local>,
    size: jlong,
    mtime_nanos: jlong,
) -> jlong {
    // What:     `let path_str: String = match env.get_string(&path) { Ok(value) => value.into(), Err(_) => return 0 };`.
    //           `env.get_string(&path)` borrows the `JString` (`&path`) and returns a
    //           `Result`; `Ok(value) => value.into()` converts the JVM-string wrapper
    //           into an owned `String`; `Err(_) => return 0` bails with the `0` sentinel.
    // Why:      Turn the opaque Java string into an owned Rust `String` to hash; a valid
    //           Kotlin `String` never fails here, so the sentinel path is unreachable in
    //           practice but keeps the boundary panic-free.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let pathStr: string;
    // try { pathStr = env.getString(path); } catch { return 0n; }
    // ```
    let path_str: String = match env.get_string(&path) {
        Ok(value) => value.into(),
        Err(_) => return 0,
    };
    // What:     `let fingerprint = compute(&path_str, size as u64, mtime_nanos as u64 as u128);`.
    //           `&path_str` lends the string read-only. `size as u64` reinterprets the
    //           `jlong` (i64) as unsigned (sizes are never negative). `mtime_nanos as u64 as
    //           u128` reinterprets the i64 as u64 then widens to u128, matching desktop's
    //           16-byte mtime field.
    // Why:      Build the cache key from the three inputs in the desktop's exact layout.
    // Gotcha:   `as` casts here are bit-reinterpretations, not range checks; valid
    //           sizes/timestamps are non-negative so the unsigned view is the intended value.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const fingerprint = compute(pathStr, BigInt.asUintN(64, size), BigInt.asUintN(64, mtimeNanos));
    // ```
    let fingerprint = compute(&path_str, size as u64, mtime_nanos as u64 as u128);
    // What:     `fingerprint as jlong`. Bit-cast the `u64` to the `i64`/`jlong` the JVM
    //           carries (bijective; the native cache reverses it). No `;`, so this is the
    //           tail/return value.
    // Why:      Hand the cache key back to Kotlin as a `Long`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return BigInt.asIntN(64, fingerprint);
    // ```
    fingerprint as jlong
}
