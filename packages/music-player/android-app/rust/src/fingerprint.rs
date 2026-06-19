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
//! directly. The fingerprint contract (determinism, 16-char opacity,
//! change-sensitivity to path/size/mtime) is verified ON DEVICE by
//! `NativeBridgeTest.fingerprintIsDeterministicOpaqueAndChangeSensitiveOnDevice`,
//! and the identical hashing algorithm is unit-tested host-side on the desktop twin.

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

/// What:     `use jni::sys::{jlong, jstring};`. `jlong` is the JNI 64-bit signed
///           integer (maps to Kotlin `Long`; sibling `jint` is 32-bit). `jstring` is
///           the RAW pointer type a native method returns to hand a string back to
///           the JVM (sibling: the safe `JString` used for arguments).
/// Why:      `size`/`mtime_nanos` arrive as `jlong`, and the function returns a
///           `jstring`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type jlong = bigint; type jstring = HostStringHandle;
/// ```
use jni::sys::{jlong, jstring};

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

/// What:     `fn compute(path: &str, size: u64, mtime_nanos: u128) -> String`. The
///           pure fingerprint: borrow the path text (`&str`, a borrowed view; sibling
///           owned `String`), the file size, and the modified-time in nanoseconds, and
///           return the owned hex `String` cache key.
/// Why:      Keeping the hashing here (separate from the JNI glue) mirrors the
///           desktop's `fingerprint` and keeps the byte layout in one readable place.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function compute(path: string, size: bigint, mtimeNanos: bigint): string { ... }
/// ```
fn compute(path: &str, size: u64, mtime_nanos: u128) -> String {
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
    // What:     `format!("{:016x}", gxhash64(&material, FINGERPRINT_SEED))`.
    //           `gxhash64(&material, FINGERPRINT_SEED)` hashes the borrowed buffer
    //           (`&material`, read-only loan) with the fixed seed, returning a `u64`;
    //           `format!("{:016x}", ...)` renders it as a zero-padded 16-digit
    //           lowercase hex string. No trailing `;`, so this tail expression is the
    //           return value.
    // Why:      The opaque, fixed-width cache key; not reversible to the path in
    //           practice, preserving the privacy guarantee.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return gxhash64(material, FINGERPRINT_SEED).toString(16).padStart(16, "0");
    // ```
    format!("{:016x}", gxhash64(&material, FINGERPRINT_SEED))
}

// What:     `#[no_mangle]` keeps the symbol name unmangled so the JVM's
//           `System.loadLibrary` + `native` lookup finds it by the exact name below.
// Why:      Without it the linker would rename the symbol and JNI could not locate it.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
/// What:     `pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeFingerprint<'local>(...)`.
///           The JNI entry. The name encodes `Java_` + package + class (`NativeBridge`)
///           + method (`nativeFingerprint`), underscore-joined. Params: `env` (the JNI
///           gateway), `_class` (the calling class, unused), `path: JString<'local>`
///           (the borrowed Java string), `size`/`mtime_nanos` (`jlong`, i.e. Kotlin
///           `Long`). `-> jstring` returns a raw Java-string pointer.
/// Why:      Kotlin's `NativeBridge.nativeFingerprint(path, size, mtimeNanos)` calls
///           this; it returns the hex cache key.
/// Gotcha:   `extern "system"` means a panic must NEVER cross this boundary; the body
///           only does infallible work plus two `match`es that return a null `jstring`
///           on the (practically unreachable) JNI string-conversion failure.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export function nativeFingerprint(env, _class, path: JString, size: bigint, mtimeNanos: bigint): jstring { ... }
/// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeFingerprint<'local>(
    env: JNIEnv<'local>,
    _class: JClass<'local>,
    path: JString<'local>,
    size: jlong,
    mtime_nanos: jlong,
) -> jstring {
    // What:     `let mut env = env;`. Rebind (shadow) the parameter as a mutable local
    //           because `get_string`/`new_string` take `&mut self`.
    // Why:      The `jni` API mutates the env to read and create strings.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // (no-op in TS; env is already reassignable)
    // ```
    let mut env = env;
    // What:     `let path_str: String = match env.get_string(&path) { Ok(value) => value.into(), Err(_) => return std::ptr::null_mut() };`.
    //           `env.get_string(&path)` borrows the `JString` (`&path`) and returns a
    //           `Result`; `Ok(value) => value.into()` converts the JVM-string wrapper
    //           into an owned `String`; `Err(_) => return std::ptr::null_mut()` bails
    //           with a null `jstring`. `std::ptr::null_mut()` is the raw null pointer.
    // Why:      Turn the opaque Java string into an owned Rust `String` to hash; a
    //           valid Kotlin `String` never fails here, so the null path is unreachable
    //           in practice but keeps the boundary panic-free.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let pathStr: string;
    // try { pathStr = env.getString(path); } catch { return null; }
    // ```
    let path_str: String = match env.get_string(&path) {
        Ok(value) => value.into(),
        Err(_) => return std::ptr::null_mut(),
    };
    // What:     `let hex = compute(&path_str, size as u64, mtime_nanos as u64 as u128);`.
    //           `&path_str` lends the string read-only. `size as u64` reinterprets the
    //           `jlong` (i64) as unsigned (sizes are never negative). `mtime_nanos as
    //           u64 as u128` reinterprets the i64 as u64 then widens to u128, matching
    //           desktop's 16-byte mtime field.
    // Why:      Build the cache key from the three inputs in the desktop's exact layout.
    // Gotcha:   `as` casts here are bit-reinterpretations, not range checks; valid
    //           sizes/timestamps are non-negative so the unsigned view is the intended
    //           value.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const hex = compute(pathStr, BigInt.asUintN(64, size), BigInt.asUintN(64, mtimeNanos));
    // ```
    let hex = compute(&path_str, size as u64, mtime_nanos as u64 as u128);
    // What:     `match env.new_string(hex) { Ok(java_string) => java_string.into_raw(), Err(_) => std::ptr::null_mut() }`.
    //           `env.new_string(hex)` allocates a Java `String` from the owned Rust
    //           string (consuming `hex`), returning a `Result`. `Ok(java_string) =>
    //           java_string.into_raw()` converts the safe `JString` into the raw
    //           `jstring` pointer the JVM expects (transferring ownership to the JVM);
    //           `Err(_) => std::ptr::null_mut()` returns null on the (unreachable)
    //           allocation failure. No `;`, so this is the tail/return value.
    // Why:      Hand the hex cache key back to Kotlin as a Java string.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { return env.newString(hex); } catch { return null; }
    // ```
    match env.new_string(hex) {
        Ok(java_string) => java_string.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}
