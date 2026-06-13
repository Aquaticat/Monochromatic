//! Native bridge for the full-Rust engine flavor.
//!
//! JNI entry points plus the ported decode path (symphonia + libopus). The
//! self-tests prove the toolchain and decoders cross-compile and run on the
//! GrapheneOS device; `nativeDecodeBenchmark` times native decode-to-PCM so it
//! can be compared head to head against the Media3 MediaCodec baseline.
//!
//! Dum-dum orientation for a TypeScript reader: "JNI" (Java Native Interface) is
//! the bridge that lets Android's Kotlin/Java code call into compiled native code
//! (this Rust, built into a `.so` shared library) and get values back. Every
//! `pub extern "system" fn Java_dev_monochromatic_..._native...` function below is
//! one callable slot on the Kotlin `NativeBridge` class: the long mangled name IS
//! the wiring (package path + class + method, joined by underscores), so Kotlin's
//! `external fun nativePing(): Int` finds this `..._nativePing` by name at runtime.
//! Mentally, picture this whole file as a set of exported functions in a `.node`
//! native addon that a TS file imports and calls; the parameter and return types
//! are deliberately limited to the handful the JVM understands (`jint`, `jlong`,
//! `jdouble`, `jfloat`, `jboolean`, `JString`), which are just the platform's
//! fixed-width integers/floats and an opaque Java-string handle.

// What:     `mod decode;` declares a child module named `decode` and tells the
//           compiler its code lives in the sibling file `decode.rs`. A "module" is
//           Rust's namespace/file-grouping unit. The other `mod` lines do the same
//           for `engine.rs`, `engine_worker.rs`, `error.rs`, `opus.rs`, `output.rs`,
//           and `truepeak.rs`.
// Why:      This file (the crate root) is the only place that lists the crate's
//           modules; without these lines those sibling files are never compiled and
//           `decode::open`, `engine::Engine`, etc. below would not resolve.
// TS map:   No exact equivalent. Closest is a barrel file doing
//           `export * as decode from "./decode";` for each sibling, except here we
//           are not re-exporting, only declaring that the file is part of the build.
//
// In TS you'd write (pseudocode):
// ```ts
// // No runtime statement; the bundler discovers ./decode.ts when it is imported.
// // Mentally: `import * as decode from "./decode";` makes `decode.open` reachable.
// ```
mod decode;
// What:     `mod engine;` declares the `engine` child module, compiled from
//           `engine.rs`. It holds the playback `Engine` type the JNI handle wraps.
// Why:      So `engine::Engine::new()` and the `engine_ref.*` method calls below
//           resolve to real code.
// TS map:   `import * as engine from "./engine";`
//
// In TS you'd write (pseudocode):
// ```ts
// import * as engine from "./engine";
// ```
mod engine;
// What:     `mod engine_worker;` declares the `engine_worker` child module
//           (`engine_worker.rs`), the background thread the engine drives.
// Why:      The `engine` module spawns it; declaring it here puts it in the build.
// TS map:   `import * as engine_worker from "./engine_worker";`
//
// In TS you'd write (pseudocode):
// ```ts
// import * as engine_worker from "./engine_worker";
// ```
mod engine_worker;
// What:     `mod error;` declares the `error` child module (`error.rs`), home of
//           the shared `PlayerError` type that all fallible calls funnel into.
// Why:      Many functions below return `Result<_, PlayerError>`; this brings that
//           type's definition into the crate.
// TS map:   `import * as error from "./error";`
//
// In TS you'd write (pseudocode):
// ```ts
// import * as error from "./error";
// ```
mod error;
// What:     `mod opus;` declares a LOCAL child module named `opus` (`opus.rs`),
//           our own Opus glue. Note: there is ALSO an external crate also named
//           `opus` (libopus bindings); this local module shadows that name at the
//           crate root, which is why `nativeOpusSelfTest` reaches the external one
//           with the leading-`::` form `::opus` (see its comment).
// Why:      Our decode path uses this local wrapper around libopus.
// TS map:   `import * as opus from "./opus";`
//
// In TS you'd write (pseudocode):
// ```ts
// import * as opus from "./opus";
// ```
mod opus;
// What:     `mod output;` declares the `output` child module (`output.rs`), the
//           AAudio (Android's low-latency audio) output backend.
// Why:      `output::measure_output_latency_ms()` below lives here.
// TS map:   `import * as output from "./output";`
//
// In TS you'd write (pseudocode):
// ```ts
// import * as output from "./output";
// ```
mod output;
// What:     `mod truepeak;` declares the `truepeak` child module (`truepeak.rs`),
//           the oversampled true-peak loudness measurement.
// Why:      `truepeak::measure_true_peak(...)` below lives here.
// TS map:   `import * as truepeak from "./truepeak";`
//
// In TS you'd write (pseudocode):
// ```ts
// import * as truepeak from "./truepeak";
// ```
mod truepeak;

// What:     `use std::os::fd::RawFd;` imports the Unix raw-file-descriptor type.
//           A file descriptor is a small integer the OS uses to name an open
//           file/stream. `RawFd` is a plain type alias for `i32` (a 32-bit signed
//           integer; the OS reserves `-1` for "no fd", which is why it is signed,
//           not the sibling `u32`). `use` just brings the name into scope so we can
//           write `RawFd` instead of the full `std::os::fd::RawFd` path.
// Why:      We convert the JVM's `jint` fd into a `RawFd` before handing it to the
//           decoder/engine, which speak in `RawFd`.
// TS map:   `type RawFd = number;` plus an `import` to bring the alias in. Node/TS
//           hides fd ownership entirely, so this is purely a number to a TS reader.
//
// In TS you'd write (pseudocode):
// ```ts
// type RawFd = number; // a bare OS file-descriptor integer
// ```
use std::os::fd::RawFd;
// What:     `use std::path::Path;` imports the borrowed filesystem-path type.
//           `Path` is an unsized, borrowed VIEW of a path (its owned, growable
//           sibling is `PathBuf`, exactly like `&str` is to `String`).
// Why:      `decode::open` takes `&Path`, so we wrap the decoded path string in a
//           `Path` reference before calling it.
// TS map:   just `string` — TS models filesystem paths as plain strings.
//
// In TS you'd write (pseudocode):
// ```ts
// type Path = string;
// ```
use std::path::Path;
// What:     `use std::time::Instant;` imports a monotonic clock reading. `Instant`
//           is an opaque "moment on the steady clock" (it never goes backwards,
//           unlike wall-clock `SystemTime`, its sibling), used only for measuring
//           elapsed durations.
// Why:      The benchmark records `Instant::now()` before the decode loop and asks
//           how much time elapsed after it.
// TS map:   `performance.now()` returns a monotonic millisecond timestamp; `Instant`
//           is the value that call returns, but as an opaque object, not a number.
//
// In TS you'd write (pseudocode):
// ```ts
// type Instant = number; // a performance.now() timestamp, monotonic
// ```
use std::time::Instant;

// What:     `use jni::objects::{JClass, JString};` imports two handle types from the
//           `jni` crate. `JClass<'local>` is a borrowed handle to the Java/Kotlin
//           class object that invoked us; `JString<'local>` is a borrowed handle to
//           a Java string passed across the boundary (NOT a Rust `String` yet, it
//           must be converted). The `{A, B}` braces import several names in one line.
// Why:      Every JNI entry point receives the calling class, and the path/string
//           functions also receive a `JString` argument; we need these types named.
// TS map:   In a native addon these are opaque handles the runtime hands you, e.g.
//           `napi_value`. Picture `type JString = OpaqueHandle;` that you must turn
//           into a real JS `string` with a conversion call.
//
// In TS you'd write (pseudocode):
// ```ts
// type JClass = OpaqueHandle;  // the calling class object
// type JString = OpaqueHandle; // a Java string handle, convert before use
// ```
use jni::objects::{JClass, JString};
// What:     `use jni::sys::{jboolean, jdouble, jfloat, jint, jlong};` imports the
//           JVM's fixed-width primitive types as Rust aliases. `jint` is a 32-bit
//           signed integer (Java `int`), `jlong` a 64-bit signed integer (Java
//           `long`), `jdouble` a 64-bit float (Java `double`), `jfloat` a 32-bit
//           float (Java `float`), `jboolean` an 8-bit unsigned byte where 0 is false
//           and non-zero is true (Java `boolean`). Siblings a reader might expect on
//           the Rust side are `u32`/`i64`/`f64`/`f32`/`bool`; we use the `j*` aliases
//           because the function signatures must match exactly what the JVM passes.
// Why:      The JNI functions can only speak these types across the boundary; using
//           the aliases documents "this is a JVM-ABI value", not a free Rust value.
// TS map:   All of these collapse to TS `number` (and `jboolean` to `boolean`); TS
//           has no fixed-width integer/float distinction at the value level.
//
// In TS you'd write (pseudocode):
// ```ts
// type jint = number;     // 32-bit signed
// type jlong = number;    // 64-bit signed
// type jdouble = number;  // 64-bit float
// type jfloat = number;   // 32-bit float
// type jboolean = number; // 0 = false, non-zero = true
// ```
use jni::sys::{jboolean, jdouble, jfloat, jint, jlong};
// What:     `use jni::JNIEnv;` imports the per-call interface pointer the JVM hands
//           every native method. `JNIEnv<'local>` is the gateway object you call to
//           touch JVM state (read a string, throw, etc.); it is valid only for the
//           duration of one native call and only on the calling thread.
// Why:      The string-taking entry point uses it (`env.get_string(...)`) to pull a
//           Rust string out of the `JString`.
// TS map:   No analogue; in a native addon this is the `napi_env` context handle the
//           runtime threads through every call. Picture `type JNIEnv = RuntimeCtx;`.
//
// In TS you'd write (pseudocode):
// ```ts
// type JNIEnv = RuntimeContext; // per-call handle to talk to the host runtime
// ```
use jni::JNIEnv;

// What:     `#[no_mangle]` is an ATTRIBUTE (a compiler annotation, written
//           `#[...]`) telling the compiler "do NOT rename this function's symbol".
//           Rust normally scrambles ("mangles") symbol names for uniqueness; the JVM
//           must find this function by the exact name `Java_dev_..._nativePing`, so
//           mangling must be off.
// Why:      Without `#[no_mangle]` the JVM's `System.loadLibrary` + `native` lookup
//           would fail to find the symbol and the call would crash at link time.
// TS map:   No equivalent; bundlers do not rename your exported function names. The
//           closest mental model is marking a symbol `export` so its name is stable.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed; `export function nativePing()` keeps its name
// ```
#[no_mangle]
// What:     `pub extern "system" fn Java_..._nativePing<'local>(...) -> jint`
//           declares the function. `pub` = visible outside this module. `extern
//           "system"` = use the platform's C/JVM calling convention so the JVM can
//           call it (NOT Rust's internal convention). The long name is the JNI
//           wiring: `Java_` + package path + class + method, underscore-joined.
//           `<'local>` introduces a LIFETIME parameter named `local` (a label, not a
//           value) used by the borrowed JVM handle types. `-> jint` returns a 32-bit
//           signed JVM int. `_env` / `_class` are the two params every JNI method
//           gets; the leading `_` marks them deliberately unused.
// Why:      This is the first slot Kotlin calls to prove the `.so` loaded and an int
//           survives the round trip; it just returns a known constant.
// TS map:   `export function nativePing(_env, _class): number { return 42; }`
// Gotcha:   `extern "system"` means a panic must NEVER cross this boundary (it would
//           abort the process); this function only returns a literal, so it is safe.
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativePing(_env: JNIEnv, _class: JClass): number {
//   return 42;
// }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativePing<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
) -> jint {
    // What:     `42` is a bare literal at the end of the function body with no `;`.
    //           In Rust, the final expression of a block WITHOUT a trailing semicolon
    //           IS the return value (a "tail expression"), so this returns 42.
    // Why:      Hand the Kotlin side a known sentinel it can assert on.
    // TS map:   `return 42;` — Rust's implicit tail-return becomes an explicit
    //           `return`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return 42;
    // ```
    42
}

// What:     `#[no_mangle]` again: keep the symbol name unmangled so the JVM finds it.
// Why:      Same reason as `nativePing`: the JVM looks this function up by exact name.
// TS map:   no annotation needed; exported names are already stable.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     Same declaration shape as `nativePing`: `pub extern "system"`, the JNI
//           mangled name, a `<'local>` lifetime, the two unused `_env`/`_class`
//           params, and a `-> jint` return.
// Why:      A second self-test slot Kotlin calls; returns 1 or 0 as success/failure.
// TS map:   `export function nativeOpusSelfTest(_env, _class): number { ... }`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeOpusSelfTest(_env: JNIEnv, _class: JClass): number { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeOpusSelfTest<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
) -> jint {
    // What:     `match ::opus::Decoder::new(48_000, ::opus::Channels::Stereo) { ... }`
    //           builds an Opus decoder and inspects the `Result` it returns. `::opus`
    //           with a LEADING `::` means "the EXTERNAL crate named opus", not our
    //           local `mod opus` (which shadows the bare name `opus` here). `::` is
    //           the path separator (like `.` in TS module paths). `Decoder::new(...)`
    //           is an associated constructor function. `48_000` is the sample rate;
    //           the `_` in the number is just a digit separator (= 48000).
    //           `::opus::Channels::Stereo` is an enum VARIANT (one named choice of the
    //           `Channels` enum, here "two channels"). `Decoder::new` returns a
    //           `Result<Decoder, Error>` (success-or-failure container); `match`
    //           branches on which case it is.
    // Why:      Prove the bundled C libopus links and a decoder constructs on-device.
    // TS map:   `try { new opus.Decoder(48000, opus.Channels.Stereo); ... } catch { ... }`
    //           — Rust returns a `Result` instead of throwing, so we branch on it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try {
    //   new opus.Decoder(48000, opus.Channels.Stereo);
    //   return 1;
    // } catch {
    //   return 0;
    // }
    // ```
    match ::opus::Decoder::new(48_000, ::opus::Channels::Stereo) {
        // What:     `Ok(_decoder) => 1` is the success arm of the `match`. `Ok(...)`
        //           is the success variant of `Result`; we DESTRUCTURE the decoder out
        //           of it into `_decoder`, whose leading `_` says "I do not use this
        //           value, just confirm it exists". The arm's value `1` (no `;`) is
        //           what the whole `match` evaluates to.
        // Why:      Construction succeeded, so report success (1) to Kotlin.
        // TS map:   the `try` body succeeded -> `return 1;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // succeeded: return 1;
        // ```
        Ok(_decoder) => 1,
        // What:     `Err(_error) => 0` is the failure arm. `Err(...)` is the failure
        //           variant of `Result`; we destructure the error into `_error` and
        //           ignore it (leading `_`). The arm yields `0`.
        // Why:      Construction failed, so report failure (0) to Kotlin.
        // TS map:   the `catch` block -> `return 0;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // failed: return 0;
        // ```
        Err(_error) => 0,
    }
}

// What:     `#[no_mangle]`: keep the symbol name as-is for JVM lookup.
// Why:      Same as the other entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     Same JNI-entry declaration shape: `pub extern "system"`, mangled name,
//           `<'local>` lifetime, unused `_env`/`_class`, `-> jint`.
// Why:      A self-test slot that forces symphonia's registries to initialize.
// TS map:   `export function nativeSymphoniaSelfTest(_env, _class): number { ... }`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeSymphoniaSelfTest(_env: JNIEnv, _class: JClass): number { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeSymphoniaSelfTest<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
) -> jint {
    // What:     `std::hint::black_box(symphonia::default::get_probe());`. The inner
    //           `symphonia::default::get_probe()` builds the container prober.
    //           `std::hint::black_box(x)` is a compiler hint that takes a value and
    //           hands it straight back, but makes the optimizer treat it as "used for
    //           real" so it cannot delete the call as dead code. `::` are path
    //           separators (module/function navigation).
    // Why:      We want the prober to actually initialize on-device; without
    //           `black_box`, the optimizer could notice we throw the result away and
    //           skip the work, defeating the self-test.
    // TS map:   no equivalent — JS/TS engines do not dead-code-eliminate observable
    //           side effects this way. Mentally: `noInline(symphonia.getProbe());`
    // Gotcha:   `black_box` is NOT a no-op you can delete; removing it changes whether
    //           the optimizer runs the call at all.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // symphonia.getProbe(); // (no black_box concept needed in TS)
    // ```
    std::hint::black_box(symphonia::default::get_probe());
    // What:     `std::hint::black_box(symphonia::default::get_codecs());` does the
    //           same for the codec registry: build it, and prevent the optimizer from
    //           eliding the call.
    // Why:      Force the codec registry to initialize on-device too.
    // TS map:   `symphonia.getCodecs();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // symphonia.getCodecs();
    // ```
    std::hint::black_box(symphonia::default::get_codecs());
    // What:     `1` is the tail expression (no trailing `;`), so it is the function's
    //           return value: report success.
    // Why:      Both registries initialized; tell Kotlin "ok" (1).
    // TS map:   `return 1;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return 1;
    // ```
    1
}

// What:     `fn benchmark_decode(mut source: Box<dyn decode::Source>) -> jdouble`
//           declares a PRIVATE helper (no `pub`, so it is only callable inside this
//           file). `mut source` = the parameter is mutable (we call mutating methods
//           on it). `Box<dyn decode::Source>` is an OWNING heap pointer to "some
//           value that implements the `Source` trait, exact type chosen at runtime"
//           (`dyn` = dynamic dispatch, like a TS interface reference; `Box` is the
//           owned heap box, siblings `Rc<T>`/`Arc<T>` would be shared-ownership
//           pointers, which we do not want here because exactly one owner runs the
//           benchmark). `-> jdouble` returns a 64-bit float (the JVM `double`).
// Why:      Both the path and fd benchmarks open a decoder and then run the SAME
//           timed loop; factoring it here avoids duplicating the loop twice. It
//           returns microseconds per interleaved sample (comparable to the Media3
//           MediaCodec ~0.33 baseline), or a negative sentinel: -3 decode error,
//           -4 zero samples. It also exercises seek once untimed so the seek path
//           is covered on-device.
// TS map:   `function benchmarkDecode(source: Source): number { ... }` — TS passes
//           the interface by reference and GC-owns it, so `Box`/`dyn`/`mut` vanish.
// Gotcha:   `Box<dyn Source>` is an OWNED value moved INTO this function; the caller
//           gives it up. In TS the caller would still hold a reference afterward.
//
// In TS you'd write (pseudocode):
// ```ts
// function benchmarkDecode(source: Source): number { ... }
// ```
fn benchmark_decode(mut source: Box<dyn decode::Source>) -> jdouble {
    // What:     `let spec = source.spec();` calls the trait method `spec()` to read
    //           the audio format (rate/channels/duration) and binds it to the
    //           immutable local `spec`. `let` introduces a binding; without `mut` it
    //           is read-only.
    // Why:      We touch the spec next so the decoder definitely parsed the header.
    // TS map:   `const spec = source.spec();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const spec = source.spec();
    // ```
    let spec = source.spec();
    // What:     `std::hint::black_box((spec.rate, spec.channels, spec.duration_secs));`
    //           builds a TUPLE `(a, b, c)` (an anonymous fixed-size group of values)
    //           of the three spec fields and feeds it to `black_box` so the optimizer
    //           cannot decide reading the spec was pointless and delete it.
    // Why:      Prove the header was really parsed on-device, untimed, before the
    //           decode loop.
    // TS map:   `[spec.rate, spec.channels, spec.durationSecs];` (a throwaway tuple);
    //           TS needs no black_box.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // void [spec.rate, spec.channels, spec.durationSecs];
    // ```
    std::hint::black_box((spec.rate, spec.channels, spec.duration_secs));
    // What:     `let start = Instant::now();` reads the monotonic clock and binds the
    //           moment to `start`. `Instant::now()` is the associated constructor on
    //           the `Instant` type (`::` navigates into the type).
    // Why:      Mark the start of the timed window so we can measure decode time only.
    // TS map:   `const start = performance.now();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const start = performance.now();
    // ```
    let start = Instant::now();
    // What:     `let mut total_samples: u64 = 0;` declares a MUTABLE counter with an
    //           explicit type `u64` (unsigned 64-bit integer; siblings: `u32` would
    //           overflow on long tracks, `usize` is platform-width, `i64` allows
    //           negatives we never need). `mut` is required because we add to it in
    //           the loop.
    // Why:      Accumulate how many interleaved samples we decoded, the denominator of
    //           the per-sample timing.
    // TS map:   `let totalSamples = 0;` — TS `number` is one type, no width choice.
    // Gotcha:   `u64` WRAPS on overflow in release builds (no auto-widening to bigint
    //           like TS would do); chosen wide enough that a real track cannot reach it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let totalSamples = 0;
    // ```
    let mut total_samples: u64 = 0;
    // What:     `loop { ... }` is Rust's infinite loop (runs until an inner `break`
    //           or `return`). There is no condition; this is the bare keyword form.
    // Why:      Pull decoded chunks until the decoder signals end-of-stream.
    // TS map:   `while (true) { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (true) { ... }
    // ```
    loop {
        // What:     `match source.next_chunk() { ... }` calls the trait method
        //           `next_chunk()` (which returns `Result<Vec<f32>, PlayerError>`, a
        //           success-holding-a-vector-of-floats or failure container) and
        //           branches on the outcome. `match` is exhaustive pattern dispatch.
        // Why:      Decode the next block of PCM and decide: stop, accumulate, or fail.
        // TS map:   `try { const chunk = source.nextChunk(); ... } catch { ... }`
        //           combined with checking the returned array.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let chunk: number[];
        // try { chunk = source.nextChunk(); } catch { return -3.0; }
        // ```
        match source.next_chunk() {
            // What:     `Ok(chunk) if chunk.is_empty() => break` is a GUARDED success
            //           arm. `Ok(chunk)` destructures the decoded `Vec<f32>` out of the
            //           success variant into `chunk`; the `if chunk.is_empty()` is a
            //           MATCH GUARD (extra condition the arm requires). `break` exits
            //           the `loop`.
            // Why:      An empty chunk is the decoder's end-of-stream signal; stop the
            //           loop when it arrives.
            // TS map:   `if (chunk.length === 0) break;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (chunk.length === 0) break;
            // ```
            Ok(chunk) if chunk.is_empty() => break,
            // What:     `Ok(chunk) => { ... }` is the non-empty success arm: we got a
            //           real `Vec<f32>` of samples named `chunk`, and run the block.
            // Why:      Count these samples and keep the decode work non-elidable.
            // TS map:   `else { /* chunk has samples */ }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // else {
            //   totalSamples += chunk.length;
            //   noInline(chunk);
            // }
            // ```
            Ok(chunk) => {
                // What:     `total_samples += chunk.len() as u64;`. `chunk.len()`
                //           returns the element count as `usize` (platform-width
                //           unsigned int). `as u64` is an EXPLICIT numeric cast from
                //           `usize` to `u64` (Rust never auto-converts integer types).
                //           `+=` adds into the mutable counter.
                // Why:      Grow the running sample total by this chunk's length.
                // TS map:   `totalSamples += chunk.length;` — TS auto-handles the
                //           numeric type, so no `as` cast.
                // Gotcha:   `as u64` is a real cast; on a 64-bit OS `usize` is already
                //           64-bit, but the cast is required to satisfy the type checker.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // totalSamples += chunk.length;
                // ```
                total_samples += chunk.len() as u64;
                // What:     `std::hint::black_box(&chunk);`. `&chunk` is a read-only
                //           BORROW of the vector (we LEND it, not give it away or copy
                //           it). `black_box` consumes the borrow so the optimizer treats
                //           the decoded data as genuinely observed.
                // Why:      Stop the optimizer from skipping decode work it thinks is
                //           unused; without this the benchmark could time nothing.
                // TS map:   `noInline(chunk);` — pass the array somewhere opaque so the
                //           engine cannot prove it is dead.
                // Gotcha:   `&chunk` does NOT copy the data; it is a temporary loan that
                //           ends at the end of this statement.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // noInline(chunk);
                // ```
                std::hint::black_box(&chunk);
            }
            // What:     `Err(_) => return -3.0`. `Err(_)` is the failure variant of the
            //           `Result`; the `_` discards the actual `PlayerError` (we do not
            //           inspect it). `return -3.0` exits the WHOLE function (not just
            //           the match) with the error sentinel `-3.0` (a `jdouble`).
            // Why:      Any decode failure ends the benchmark with the agreed "-3 decode
            //           error" code that Kotlin checks for.
            // TS map:   `catch { return -3.0; }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // catch { return -3.0; }
            // ```
            Err(_) => return -3.0,
        }
    }
    // What:     `let elapsed = start.elapsed();` asks the `start` `Instant` how much
    //           time passed since it was taken; binds the resulting `Duration` to the
    //           immutable `elapsed`.
    // Why:      This is the measured decode time (the loop above is the only timed
    //           work).
    // TS map:   `const elapsed = performance.now() - start;` (TS gives a number of ms;
    //           Rust gives an opaque `Duration` we convert below).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const elapsed = performance.now() - start;
    // ```
    let elapsed = start.elapsed();
    // Exercise seek once (untimed) so the seek path is covered on-device too; the
    // engine (task #12) drives it for real.
    // What:     `let _ = source.seek(0.0);`. `source.seek(0.0)` returns a
    //           `Result<(), PlayerError>` (success carrying the empty tuple `()` =
    //           "nothing", or an error). `let _ = ...` is the DISCARD pattern: run the
    //           expression but explicitly throw the result away, which also silences
    //           the "unused must-use Result" warning.
    // Why:      Run the seek path once so it is exercised on-device, but we do not care
    //           whether it succeeded here (the real engine handles seek for keeps).
    // TS map:   `try { source.seek(0.0); } catch {}` — call it, ignore the outcome.
    // Gotcha:   `let _ =` is NOT a real variable; it binds to nothing and immediately
    //           drops the value. It exists only to consume a must-use `Result`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { source.seek(0.0); } catch {}
    // ```
    let _ = source.seek(0.0);
    // What:     `if total_samples == 0 { return -4.0; }`. A plain conditional; `==` is
    //           ordinary equality. On a true condition, `return -4.0` exits the whole
    //           function with the "-4 zero samples" sentinel.
    // Why:      Avoid dividing by zero below, and report the empty-decode case.
    // TS map:   `if (totalSamples === 0) return -4.0;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (totalSamples === 0) return -4.0;
    // ```
    if total_samples == 0 {
        return -4.0;
    }
    // What:     `(elapsed.as_nanos() as f64) / 1000.0 / (total_samples as f64)` is the
    //           function's tail expression (no `;`), so it is the return value.
    //           `elapsed.as_nanos()` converts the `Duration` to an integer count of
    //           nanoseconds (`u128`); `as f64` casts that to a 64-bit float; `/ 1000.0`
    //           turns nanoseconds into microseconds; `total_samples as f64` casts the
    //           `u64` counter to a float so the final division yields microseconds per
    //           sample. Every `as` is an explicit numeric cast (Rust never converts
    //           number types implicitly).
    // Why:      Produce the single comparable figure: microseconds of decode time per
    //           interleaved sample.
    // TS map:   `return (Number(elapsed_ns) / 1000) / totalSamples;` — TS would not
    //           need the casts since `number` covers all of it.
    // Gotcha:   The two casts to `f64` matter: integer division would truncate; we want
    //           a fractional microseconds-per-sample result.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return (elapsedNanos / 1000) / totalSamples;
    // ```
    (elapsed.as_nanos() as f64) / 1000.0 / (total_samples as f64)
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     The JNI entry declaration. Same shape as before, but with a THIRD
//           parameter `path: JString<'local>` (a borrowed Java-string handle), and
//           `env` is taken WITHOUT a leading `_` this time because we actually use it.
//           `-> jdouble` returns a 64-bit float (the throughput or a negative error).
// Why:      Kotlin calls this with a filesystem path string to benchmark a file; it
//           times the decode loop only (not the open/probe) and returns throughput,
//           or a negative sentinel: -1 bad path string, -2 open failed, plus the
//           shared codes from `benchmark_decode`.
// TS map:   `export function nativeDecodeBenchmark(env, _class, path: JString): number`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeDecodeBenchmark(env: JNIEnv, _class: JClass, path: JString): number { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeDecodeBenchmark<'local>(
    env: JNIEnv<'local>,
    _class: JClass<'local>,
    path: JString<'local>,
) -> jdouble {
    // What:     `let mut env = env;` rebinds the incoming `env` parameter to a NEW
    //           mutable local also named `env` (this is "shadowing": same name, new
    //           binding). `mut` is needed because `get_string` below takes `&mut self`.
    // Why:      The `jni` API mutates the env to read a string, so we need a mutable
    //           binding; the parameter itself arrived immutable.
    // TS map:   no equivalent; TS parameters are freely reassignable, so you would just
    //           use `env` directly. Mentally a no-op rebinding.
    // Gotcha:   This is NOT a copy of the JVM env; it rebinds the same handle so we can
    //           call its `&mut self` methods.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // (no-op in TS; env is already reassignable)
    // ```
    let mut env = env;
    // What:     `let path_str: String = match env.get_string(&path) { ... };`. We call
    //           `env.get_string(&path)` to pull the Java string into Rust; `&path`
    //           BORROWS the `JString` handle (read-only loan, no ownership transfer).
    //           The call returns a `Result`, so we `match` on it and assign the chosen
    //           arm's value into the explicitly-typed local `path_str: String` (an
    //           OWNED, heap, growable UTF-8 string; sibling `&str` is a borrowed view
    //           we cannot use here because the string must outlive the JVM handle).
    // Why:      Convert the opaque JVM string into a real owned Rust `String` we can
    //           build a `Path` from.
    // TS map:   `let pathStr: string; try { pathStr = env.getString(path); } catch { return -1.0; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let pathStr: string;
    // try { pathStr = env.getString(path); } catch { return -1.0; }
    // ```
    let path_str: String = match env.get_string(&path) {
        // What:     `Ok(value) => value.into()`. `Ok(value)` destructures the success
        //           variant, binding the JVM-string wrapper to `value`. `value.into()`
        //           is a conversion call: `.into()` asks Rust to turn `value` into
        //           whatever the target type is (here `String`, inferred from the
        //           `path_str: String` annotation). The arm yields that `String`.
        // Why:      Take the successfully-read string and convert it to an owned
        //           `String`.
        // TS map:   `pathStr = String(value);` — the conversion is implicit in TS.
        // Gotcha:   `.into()` picks its target type from context (the declared
        //           `String`); it is a type-directed conversion, not a method on a
        //           fixed type.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // pathStr = String(value);
        // ```
        Ok(value) => value.into(),
        // What:     `Err(_) => return -1.0`. Failure variant, error discarded with `_`;
        //           `return -1.0` exits the whole function with the "-1 bad path string"
        //           sentinel.
        // Why:      If the JVM string could not be read, report the bad-path code.
        // TS map:   `catch { return -1.0; }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // catch { return -1.0; }
        // ```
        Err(_) => return -1.0,
    };
    // What:     `let source = match decode::open(Path::new(&path_str)) { ... };`.
    //           `Path::new(&path_str)` wraps a read-only BORROW of `path_str` (`&`) in
    //           a `Path` view (no copy, no ownership transfer). `decode::open(...)`
    //           returns `Result<Box<dyn Source>, PlayerError>`; we `match` on it and
    //           bind the opened decoder to `source`.
    // Why:      Open the file as a decoder before benchmarking it.
    // TS map:   `let source; try { source = decode.open(pathStr); } catch { return -2.0; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let source: Source;
    // try { source = decode.open(pathStr); } catch { return -2.0; }
    // ```
    let source = match decode::open(Path::new(&path_str)) {
        // What:     `Ok(source) => source`. Success arm: destructure the opened
        //           `Box<dyn Source>` out of `Ok` and yield it directly as the match
        //           value (which the outer `let source = ...` then binds).
        // Why:      Open succeeded; keep the decoder.
        // TS map:   the `try` body succeeded -> `source` holds the decoder.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // success: source = the opened decoder
        // ```
        Ok(source) => source,
        // What:     `Err(_) => return -2.0`. Failure variant, error discarded; `return
        //           -2.0` exits with the "-2 open failed" sentinel.
        // Why:      Could not open the file; report the open-failure code.
        // TS map:   `catch { return -2.0; }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // catch { return -2.0; }
        // ```
        Err(_) => return -2.0,
    };
    // What:     `benchmark_decode(source)` is the tail expression (no `;`), so its
    //           return value becomes this function's return value. We pass the opened
    //           `source` by VALUE (moving ownership into the helper).
    // Why:      Delegate the timed decode loop to the shared helper and return its
    //           microseconds-per-sample figure.
    // TS map:   `return benchmarkDecode(source);`
    // Gotcha:   `source` is MOVED here: after this call the caller no longer owns it.
    //           In TS the reference would still be usable; in Rust it is gone.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return benchmarkDecode(source);
    // ```
    benchmark_decode(source)
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration. Third parameter is `fd: jint` (a 32-bit signed JVM
//           int holding the Android file descriptor). `_env`/`_class` unused; returns
//           `jdouble` (throughput or negative error code).
// Why:      Kotlin calls this with a borrowed `content://` file descriptor (a
//           `ParcelFileDescriptor.getFd()`) to benchmark it; `open_borrowed_fd` dups
//           the fd synchronously so the JVM keeps and closes the original. Returns
//           throughput, or a negative sentinel: -1 bad fd, -2 dup/open failed, plus
//           the shared codes from `benchmark_decode`.
// TS map:   `export function nativeDecodeFdBenchmark(_env, _class, fd: number): number`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeDecodeFdBenchmark(_env: JNIEnv, _class: JClass, fd: number): number { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeDecodeFdBenchmark<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    fd: jint,
) -> jdouble {
    // BorrowedFd::borrow_raw panics on -1, and that panic across extern "system"
    // would abort, so reject a negative fd here in the error-code convention.
    // What:     `if fd < 0 { return -1.0; }`. Plain conditional with `<` comparison.
    //           A true condition returns the "-1 bad fd" sentinel from the whole
    //           function.
    // Why:      A negative fd is invalid; we reject it BEFORE handing it to
    //           `borrow_raw`, which would otherwise panic and (across `extern
    //           "system"`) abort the whole process.
    // TS map:   `if (fd < 0) return -1.0;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (fd < 0) return -1.0;
    // ```
    if fd < 0 {
        return -1.0;
    }
    // What:     `let source = match decode::open_borrowed_fd(fd as RawFd) { ... };`.
    //           `fd as RawFd` is an explicit cast from `jint` (i32) to `RawFd` (also
    //           i32 underneath, but a distinct alias the API wants). `open_borrowed_fd`
    //           dups the fd and returns `Result<Box<dyn Source>, PlayerError>`; we
    //           `match` and bind the decoder to `source`.
    // Why:      Open a decoder over the (duplicated) Android file descriptor.
    // TS map:   `let source; try { source = decode.openBorrowedFd(fd); } catch { return -2.0; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let source: Source;
    // try { source = decode.openBorrowedFd(fd); } catch { return -2.0; }
    // ```
    let source = match decode::open_borrowed_fd(fd as RawFd) {
        // What:     `Ok(source) => source`. Success arm: destructure the decoder out of
        //           `Ok` and yield it as the match value.
        // Why:      Open succeeded; keep the decoder.
        // TS map:   success -> `source` holds the decoder.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // success: source = the opened decoder
        // ```
        Ok(source) => source,
        // What:     `Err(_) => return -2.0`. Failure variant, error discarded; return
        //           the "-2 dup/open failed" sentinel.
        // Why:      Could not dup/open the fd; report the failure code.
        // TS map:   `catch { return -2.0; }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // catch { return -2.0; }
        // ```
        Err(_) => return -2.0,
    };
    // What:     `benchmark_decode(source)` is the tail expression: run the shared timed
    //           loop and return its figure. `source` is MOVED into the helper.
    // Why:      Reuse the same benchmark loop the path variant uses.
    // TS map:   `return benchmarkDecode(source);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return benchmarkDecode(source);
    // ```
    benchmark_decode(source)
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration. Third parameter `fd: jint`. Returns `jfloat` (a
//           32-bit float) this time, because a true-peak figure fits in `f32` and
//           that matches the Kotlin side; siblings `jdouble`/`f64` would be wider than
//           needed.
// Why:      Kotlin calls this to measure a track's true peak (4x Catmull-Rom
//           oversampled, the loudness-normalization input the Kotlin core turns into
//           a gain) from a borrowed `content://` fd that `open_borrowed_fd` dups
//           synchronously. Returns the peak, or a negative sentinel: -1 bad fd,
//           -2 dup/open failed, -3 decode error.
// TS map:   `export function nativeMeasureTruePeak(_env, _class, fd: number): number`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeMeasureTruePeak(_env: JNIEnv, _class: JClass, fd: number): number { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeMeasureTruePeak<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    fd: jint,
) -> jfloat {
    // What:     `if fd < 0 { return -1.0; }`. Reject a negative fd before using it,
    //           returning the "-1 bad fd" sentinel.
    // Why:      Same panic-avoidance reason as the fd benchmark: a negative fd would
    //           panic `borrow_raw` and abort across the JNI boundary.
    // TS map:   `if (fd < 0) return -1.0;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (fd < 0) return -1.0;
    // ```
    if fd < 0 {
        return -1.0;
    }
    // What:     `let source = match decode::open_borrowed_fd(fd as RawFd) { ... };`.
    //           Same as the fd benchmark: `fd as RawFd` casts the JVM int to the fd
    //           alias, `open_borrowed_fd` dups and opens, and we `match` the `Result`.
    // Why:      Open a decoder over the duplicated fd so we can scan it for the peak.
    // TS map:   `let source; try { source = decode.openBorrowedFd(fd); } catch { return -2.0; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let source: Source;
    // try { source = decode.openBorrowedFd(fd); } catch { return -2.0; }
    // ```
    let source = match decode::open_borrowed_fd(fd as RawFd) {
        // What:     `Ok(source) => source`. Success arm: destructure and yield the
        //           opened decoder.
        // Why:      Open succeeded; keep the decoder.
        // TS map:   success -> `source` holds the decoder.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // success: source = the opened decoder
        // ```
        Ok(source) => source,
        // What:     `Err(_) => return -2.0`. Failure variant, error discarded; return
        //           the "-2 dup/open failed" sentinel.
        // Why:      Could not dup/open the fd; report the failure code.
        // TS map:   `catch { return -2.0; }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // catch { return -2.0; }
        // ```
        Err(_) => return -2.0,
    };
    // What:     `match truepeak::measure_true_peak(source) { ... }` runs the true-peak
    //           scan (which returns `Result<f32, PlayerError>`) over the decoder,
    //           passing `source` by VALUE (moving ownership in), and branches on the
    //           outcome. This `match` is the function's tail expression, so its value
    //           is returned.
    // Why:      Produce the peak figure (or an error sentinel) for Kotlin.
    // TS map:   `try { return truepeak.measureTruePeak(source); } catch { return -3.0; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { return truepeak.measureTruePeak(source); } catch { return -3.0; }
    // ```
    match truepeak::measure_true_peak(source) {
        // What:     `Ok(peak) => peak`. Success arm: destructure the measured `f32`
        //           peak out of `Ok` and yield it directly (no wrapper), which the
        //           tail `match` returns.
        // Why:      Measurement succeeded; hand the peak value back to Kotlin.
        // TS map:   `return peak;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return peak;
        // ```
        Ok(peak) => peak,
        // What:     `Err(_) => -3.0`. Failure variant, error discarded; the arm yields
        //           `-3.0` (the "-3 decode error" sentinel). Because the whole `match`
        //           is the tail expression, this `-3.0` is returned (note: NO `return`
        //           keyword here, unlike earlier arms, because the match itself is the
        //           return position).
        // Why:      Decode/measurement failed; report the decode-error code.
        // TS map:   `catch { return -3.0; }`
        // Gotcha:   This arm has no `return` and no `;`; it is a value the surrounding
        //           tail `match` returns. Earlier `Err(_) => return -2.0` arms WERE in
        //           statement position, so they needed an explicit `return`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // failed: -3.0 (returned by the surrounding match)
        // ```
        Err(_) => -3.0,
    }
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration with no extra params; `_env`/`_class` unused;
//           returns `jdouble` (latency in ms, or -1.0 on failure).
// Why:      Kotlin calls this to probe the native (raw ndk::audio) AAudio output
//           latency on-device; it opens a silent low-latency stream (inaudible, it
//           writes zeros) and returns the measured latency in milliseconds, or -1.0
//           on failure.
// TS map:   `export function nativeOutputLatencyProbe(_env, _class): number`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeOutputLatencyProbe(_env: JNIEnv, _class: JClass): number { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeOutputLatencyProbe<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
) -> jdouble {
    // What:     `match output::measure_output_latency_ms() { ... }`. The call returns
    //           an `Option<f64>` (Rust's null-free "maybe a value" container: either
    //           `Some(x)` with a value, or `None` for "no value"), NOT a `Result`. The
    //           `match` is the tail expression, so its value is returned.
    // Why:      Open the AAudio stream, measure latency, and either return the number
    //           or signal failure.
    // TS map:   `const ms = output.measureOutputLatencyMs(); return ms ?? -1.0;` —
    //           Rust's `Option` is TS's `number | null`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const ms = output.measureOutputLatencyMs(); // number | null
    // return ms ?? -1.0;
    // ```
    match output::measure_output_latency_ms() {
        // What:     `Some(ms) => ms`. `Some(...)` is the "present" variant of `Option`;
        //           we destructure the inner `f64` latency into `ms` and yield it as
        //           the match value.
        // Why:      We got a real latency reading; return it.
        // TS map:   the value was non-null -> `return ms;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // ms !== null: return ms;
        // ```
        Some(ms) => ms,
        // What:     `None => -1.0`. `None` is the "absent" variant of `Option` (Rust's
        //           stand-in for `null`); the arm yields the `-1.0` failure sentinel.
        // Why:      The probe failed (no reading); report -1.0.
        // TS map:   the value was null -> `return -1.0;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // ms === null: return -1.0;
        // ```
        None => -1.0,
    }
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration. No extra params; returns `jlong` (a 64-bit signed
//           int) that secretly holds a raw pointer to a heap `Engine`, used as an
//           opaque handle Kotlin passes back in later calls. We use `jlong` (not a
//           narrower `jint`) because a pointer needs 64 bits on a 64-bit device.
// Why:      Kotlin calls this once to create the engine and stash the handle (or 0 if
//           the worker thread could not spawn). The handle must be released exactly
//           once with `nativeEngineRelease` and only used from the one Kotlin thread
//           that owns it.
// TS map:   `export function nativeEngineCreate(_env, _class): number /* handle */`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeEngineCreate(_env: JNIEnv, _class: JClass): number { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineCreate<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
) -> jlong {
    // What:     `match engine::Engine::new() { ... }`. `Engine::new()` is the
    //           associated constructor; it returns `Result<Engine, std::io::Error>`
    //           (it can fail only if the OS refuses to spawn the worker thread). The
    //           `match` is the tail expression, so its value is returned.
    // Why:      Build the engine and either box it into a handle or report failure (0).
    // TS map:   `try { const engine = new Engine(); return makeHandle(engine); } catch { return 0; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try {
    //   const engine = new Engine();
    //   return boxIntoRaw(engine); // stash the object, return an opaque handle id
    // } catch {
    //   return 0;
    // }
    // ```
    match engine::Engine::new() {
        // What:     `Ok(engine_value) => Box::into_raw(Box::new(engine_value)) as jlong`.
        //           `Box::new(engine_value)` MOVES the engine onto the heap and returns
        //           an owning `Box<Engine>` (sibling `Rc`/`Arc` would be shared
        //           ownership, but exactly one owner, Kotlin, holds this handle).
        //           `Box::into_raw(...)` CONSUMES that box and returns a raw `*mut
        //           Engine` pointer, deliberately LEAKING ownership so Rust will not
        //           free it at end of scope (Kotlin frees it later via Release).
        //           `as jlong` casts the raw pointer to a 64-bit int to hand across the
        //           JVM boundary.
        // Why:      Turn the engine into a stable numeric handle Kotlin can hold and
        //           pass back, surviving past this function's stack frame.
        // TS map:   no real analogue (TS has GC, no raw pointers). Mentally: store the
        //           object in a side table and return its id.
        // Gotcha:   `Box::into_raw` INTENTIONALLY leaks: the heap `Engine` is now
        //           nobody's responsibility until `nativeEngineRelease` reclaims it.
        //           Forgetting to release it is a memory leak; releasing twice is a
        //           use-after-free.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return boxIntoRaw(engineValue); // leak on purpose; Kotlin frees later
        // ```
        Ok(engine_value) => Box::into_raw(Box::new(engine_value)) as jlong,
        // What:     `Err(_) => 0`. Failure variant, error discarded; yield the handle
        //           value `0`, which the contract treats as "no engine".
        // Why:      The worker thread could not spawn; tell Kotlin construction failed.
        // TS map:   `catch { return 0; }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // catch { return 0; }
        // ```
        Err(_) => 0,
    }
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration with THREE extra params: `handle: jlong` (the
//           opaque engine handle from create), `fd: jint` (the file descriptor), and
//           `play: jboolean` (0 = false, non-zero = true, whether to start playing).
//           Returns `jint` (0 ok, or a negative error code).
// Why:      Kotlin calls this to hand a borrowed `content://` fd (a
//           `ParcelFileDescriptor.getFd()`, duplicated synchronously) to the engine
//           and optionally play it. Returns 0 on success, -1 bad fd, -2 dup/dispatch
//           failed, -3 null handle.
// TS map:   `export function nativeEngineLoad(_env, _class, handle, fd, play): number`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeEngineLoad(_env, _class, handle: number, fd: number, play: number): number { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineLoad<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
    fd: jint,
    play: jboolean,
) -> jint {
    // What:     `if handle == 0 { return -3; }`. Guard: a `0` handle means "no engine"
    //           (the create sentinel). Return the "-3 null handle" code.
    // Why:      We must not turn `0` into a pointer and dereference it; reject it first.
    // TS map:   `if (handle === 0) return -3;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (handle === 0) return -3;
    // ```
    if handle == 0 {
        return -3;
    }
    // What:     `if fd < 0 { return -1; }`. Guard: reject a negative file descriptor
    //           with the "-1 bad fd" code.
    // Why:      Same panic-avoidance as the benchmarks: a negative fd would panic the
    //           borrow/dup path and abort across the boundary.
    // TS map:   `if (fd < 0) return -1;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (fd < 0) return -1;
    // ```
    if fd < 0 {
        return -1;
    }
    // What:     `let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };`.
    //           This rebuilds a usable reference from the opaque handle. Reading it
    //           inside-out: `handle as *mut engine::Engine` casts the 64-bit int back
    //           to a raw MUTABLE pointer to an `Engine`. `*(...)` DEREFERENCES that raw
    //           pointer (follows it to the actual `Engine` in heap memory). `&mut ...`
    //           takes a MUTABLE BORROW of that `Engine` (we will call `&mut self`
    //           methods). The whole thing sits in an `unsafe { ... }` block: a region
    //           where the compiler trusts US to guarantee the pointer is valid, since
    //           it cannot prove it (raw-pointer deref is unchecked).
    // Why:      The engine lives behind a numeric handle; to call its methods we must
    //           turn that number back into a borrow of the real `Engine`.
    // TS map:   no analogue (TS has no raw pointers or `unsafe`). Mentally: look the
    //           object up by its handle id in a side table: `const engineRef = table.get(handle);`
    // Gotcha:   `unsafe` here is a PROMISE, not a bypass: if `handle` is stale or
    //           released, this is undefined behaviour. The safety contract (one valid
    //           handle, used from one thread) is enforced by Kotlin, not the compiler.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engineRef = handleTable.get(handle); // assume valid; no compiler check
    // ```
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    // What:     `match engine_ref.load(fd as RawFd, play != 0) { ... }`. We call the
    //           engine's `load` method. `fd as RawFd` casts the JVM int to the fd
    //           alias. `play != 0` converts the `jboolean` byte into a real Rust `bool`
    //           (any non-zero byte becomes `true`). `load` returns `Result<(),
    //           PlayerError>` (success carries the empty tuple `()` = "nothing"). The
    //           `match` is the tail expression, so its value is returned.
    // Why:      Hand the fd and play-intent to the engine and translate its result into
    //           the integer code contract.
    // TS map:   `try { engineRef.load(fd, play !== 0); return 0; } catch { return -2; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { engineRef.load(fd, play !== 0); return 0; } catch { return -2; }
    // ```
    match engine_ref.load(fd as RawFd, play != 0) {
        // What:     `Ok(()) => 0`. Success arm. `Ok(())` matches the success variant
        //           whose inner value is the empty tuple `()` (i.e. "succeeded, no
        //           payload"). The arm yields `0`, the success code.
        // Why:      Load dispatched successfully; report 0.
        // TS map:   the `try` body completed -> `return 0;`
        // Gotcha:   `()` is the unit value ("nothing"), not a typo; it is what a
        //           `Result<(), _>` carries on success.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // success: return 0;
        // ```
        Ok(()) => 0,
        // What:     `Err(_) => -2`. Failure variant, error discarded; yield `-2`, the
        //           "dup/dispatch failed" code.
        // Why:      The dup or the send-to-worker failed; report -2.
        // TS map:   `catch { return -2; }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // catch { return -2; }
        // ```
        Err(_) => -2,
    }
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration taking the engine `handle: jlong` and returning
//           NOTHING (no `-> ...`, so the return type is `()`, Rust's "unit"/void).
// Why:      Kotlin calls this to resume playback of the loaded track; it is
//           fire-and-forget, no result.
// TS map:   `export function nativeEnginePlay(_env, _class, handle): void`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeEnginePlay(_env: JNIEnv, _class: JClass, handle: number): void { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEnginePlay<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) {
    // What:     `if handle == 0 { return; }`. Guard: a `0` handle is "no engine"; the
    //           bare `return;` exits this void function early without doing anything.
    // Why:      Avoid dereferencing a null handle; silently no-op when there is no
    //           engine.
    // TS map:   `if (handle === 0) return;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (handle === 0) return;
    // ```
    if handle == 0 {
        return;
    }
    // What:     `let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };`.
    //           Same handle-to-reference reconstruction as in `load`: cast the int to a
    //           raw `*mut Engine`, dereference it with `*`, take a mutable borrow with
    //           `&mut`, all inside an `unsafe` block where we vouch for validity.
    // Why:      We need a usable engine reference to call `play()` on it.
    // TS map:   `const engineRef = handleTable.get(handle);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engineRef = handleTable.get(handle);
    // ```
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    // What:     `engine_ref.play();` calls the engine's `play` method on the borrowed
    //           reference. This is a plain method call with a trailing `;`, so it is a
    //           statement (no return value used).
    // Why:      Tell the engine to resume sounding the loaded track.
    // TS map:   `engineRef.play();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // engineRef.play();
    // ```
    engine_ref.play();
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration taking the engine `handle: jlong` and returning
//           nothing (unit/void).
// Why:      Kotlin calls this to pause playback (keeping the loaded track and
//           buffered audio); fire-and-forget.
// TS map:   `export function nativeEnginePause(_env, _class, handle): void`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeEnginePause(_env: JNIEnv, _class: JClass, handle: number): void { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEnginePause<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) {
    // What:     `if handle == 0 { return; }`. Guard: no-op early on a null handle.
    // Why:      Avoid dereferencing a null handle.
    // TS map:   `if (handle === 0) return;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (handle === 0) return;
    // ```
    if handle == 0 {
        return;
    }
    // What:     `let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };`.
    //           Same handle-to-mutable-reference reconstruction inside `unsafe`.
    // Why:      We need a usable engine reference to call `pause()`.
    // TS map:   `const engineRef = handleTable.get(handle);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engineRef = handleTable.get(handle);
    // ```
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    // What:     `engine_ref.pause();` calls the engine's `pause` method (statement,
    //           trailing `;`).
    // Why:      Tell the engine to stop sounding while keeping the loaded track and
    //           buffered audio.
    // TS map:   `engineRef.pause();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // engineRef.pause();
    // ```
    engine_ref.pause();
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration taking the engine `handle: jlong` and a target
//           `position_sec: jdouble` (64-bit float seconds); returns nothing (void).
// Why:      Kotlin calls this to seek; fire-and-forget.
// TS map:   `export function nativeEngineSeek(_env, _class, handle, position_sec): void`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeEngineSeek(_env, _class, handle: number, positionSec: number): void { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineSeek<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
    position_sec: jdouble,
) {
    // What:     `if handle == 0 { return; }`. Guard: no-op early on a null handle.
    // Why:      Avoid dereferencing a null handle.
    // TS map:   `if (handle === 0) return;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (handle === 0) return;
    // ```
    if handle == 0 {
        return;
    }
    // What:     `let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };`.
    //           Same handle-to-mutable-reference reconstruction inside `unsafe`.
    // Why:      We need a usable engine reference to call `seek_to(...)`.
    // TS map:   `const engineRef = handleTable.get(handle);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engineRef = handleTable.get(handle);
    // ```
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    // What:     `engine_ref.seek_to(position_sec);` calls the engine's `seek_to`
    //           method with the requested position (statement, trailing `;`).
    // Why:      Tell the engine to jump to `position_sec` in the loaded track.
    // TS map:   `engineRef.seekTo(positionSec);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // engineRef.seekTo(positionSec);
    // ```
    engine_ref.seek_to(position_sec);
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration taking the engine `handle: jlong` and a `volume:
//           jfloat` (32-bit float, linear gain 0.0..1.0); returns nothing (void).
// Why:      Kotlin calls this to set user volume; fire-and-forget.
// TS map:   `export function nativeEngineSetVolume(_env, _class, handle, volume): void`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeEngineSetVolume(_env, _class, handle: number, volume: number): void { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineSetVolume<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
    volume: jfloat,
) {
    // What:     `if handle == 0 { return; }`. Guard: no-op early on a null handle.
    // Why:      Avoid dereferencing a null handle.
    // TS map:   `if (handle === 0) return;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (handle === 0) return;
    // ```
    if handle == 0 {
        return;
    }
    // What:     `let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };`.
    //           Same handle-to-mutable-reference reconstruction inside `unsafe`.
    // Why:      We need a usable engine reference to call `set_volume(...)`.
    // TS map:   `const engineRef = handleTable.get(handle);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engineRef = handleTable.get(handle);
    // ```
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    // What:     `engine_ref.set_volume(volume);` calls the engine's `set_volume`
    //           method (statement, trailing `;`).
    // Why:      Apply the user's requested linear volume gain.
    // TS map:   `engineRef.setVolume(volume);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // engineRef.setVolume(volume);
    // ```
    engine_ref.set_volume(volume);
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration taking the engine `handle: jlong` and a `gain:
//           jfloat` (32-bit float, linear normalization gain 0.0..1.0); returns
//           nothing (void).
// Why:      Kotlin calls this to set the per-track loudness-normalization gain;
//           fire-and-forget.
// TS map:   `export function nativeEngineSetNormalizationGain(_env, _class, handle, gain): void`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeEngineSetNormalizationGain(_env, _class, handle: number, gain: number): void { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineSetNormalizationGain<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
    gain: jfloat,
) {
    // What:     `if handle == 0 { return; }`. Guard: no-op early on a null handle.
    // Why:      Avoid dereferencing a null handle.
    // TS map:   `if (handle === 0) return;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (handle === 0) return;
    // ```
    if handle == 0 {
        return;
    }
    // What:     `let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };`.
    //           Same handle-to-mutable-reference reconstruction inside `unsafe`.
    // Why:      We need a usable engine reference to call `set_normalization_gain(...)`.
    // TS map:   `const engineRef = handleTable.get(handle);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engineRef = handleTable.get(handle);
    // ```
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    // What:     `engine_ref.set_normalization_gain(gain);` calls the engine's
    //           `set_normalization_gain` method (statement, trailing `;`).
    // Why:      Apply the per-track normalization gain, combined with the user volume.
    // TS map:   `engineRef.setNormalizationGain(gain);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // engineRef.setNormalizationGain(gain);
    // ```
    engine_ref.set_normalization_gain(gain);
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration taking the engine `handle: jlong` and returning a
//           `jdouble` (64-bit float, current position in seconds).
// Why:      Kotlin polls this to show the current playback position.
// TS map:   `export function nativeEnginePositionSec(_env, _class, handle): number`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeEnginePositionSec(_env: JNIEnv, _class: JClass, handle: number): number { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEnginePositionSec<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) -> jdouble {
    // What:     `if handle == 0 { return 0.0; }`. Guard: with no engine, report
    //           position `0.0`.
    // Why:      Avoid dereferencing a null handle, and 0.0 is the sensible "nothing
    //           loaded" position.
    // TS map:   `if (handle === 0) return 0.0;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (handle === 0) return 0.0;
    // ```
    if handle == 0 {
        return 0.0;
    }
    // What:     `let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };`.
    //           Same handle-to-mutable-reference reconstruction inside `unsafe`.
    // Why:      We need a usable engine reference to read `position_sec()`.
    // TS map:   `const engineRef = handleTable.get(handle);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engineRef = handleTable.get(handle);
    // ```
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    // What:     `engine_ref.position_sec()` calls the engine's `position_sec` reader.
    //           No trailing `;`, so it is the tail expression and its `f64` value is
    //           returned.
    // Why:      Hand the current playback position back to Kotlin.
    // TS map:   `return engineRef.positionSec();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return engineRef.positionSec();
    // ```
    engine_ref.position_sec()
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration taking the engine `handle: jlong` and returning a
//           `jdouble` (64-bit float, track duration in seconds).
// Why:      Kotlin reads this to size the seek bar / show total length.
// TS map:   `export function nativeEngineDurationSec(_env, _class, handle): number`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeEngineDurationSec(_env: JNIEnv, _class: JClass, handle: number): number { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineDurationSec<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) -> jdouble {
    // What:     `if handle == 0 { return 0.0; }`. Guard: with no engine, report
    //           duration `0.0`.
    // Why:      Avoid dereferencing a null handle; 0.0 is the "unknown" duration.
    // TS map:   `if (handle === 0) return 0.0;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (handle === 0) return 0.0;
    // ```
    if handle == 0 {
        return 0.0;
    }
    // What:     `let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };`.
    //           Same handle-to-mutable-reference reconstruction inside `unsafe`.
    // Why:      We need a usable engine reference to read `duration_sec()`.
    // TS map:   `const engineRef = handleTable.get(handle);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engineRef = handleTable.get(handle);
    // ```
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    // What:     `engine_ref.duration_sec()` calls the engine's `duration_sec` reader.
    //           Tail expression (no `;`), so its `f64` value is returned.
    // Why:      Hand the loaded track's duration back to Kotlin.
    // TS map:   `return engineRef.durationSec();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return engineRef.durationSec();
    // ```
    engine_ref.duration_sec()
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration taking the engine `handle: jlong` and returning a
//           `jboolean` (8-bit JVM boolean: 0 = false, non-zero = true).
// Why:      Kotlin reads this to know if audio is actually coming out right now.
// TS map:   `export function nativeEngineIsPlaying(_env, _class, handle): boolean`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeEngineIsPlaying(_env: JNIEnv, _class: JClass, handle: number): boolean { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineIsPlaying<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) -> jboolean {
    // What:     `if handle == 0 { return jboolean::from(false); }`. Guard: with no
    //           engine, report "not playing". `jboolean::from(false)` is a CONVERSION
    //           constructor: `::from(...)` builds a `jboolean` (the JVM's 0/1 byte)
    //           out of a Rust `bool`, here `false` -> 0.
    // Why:      We must return the JVM's byte form, not a Rust `bool`; convert
    //           explicitly.
    // TS map:   `if (handle === 0) return false;` — TS has one boolean type, no
    //           conversion.
    // Gotcha:   `jboolean` is a byte, not a Rust `bool`; you cannot return `false`
    //           directly, hence `jboolean::from(...)`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (handle === 0) return false;
    // ```
    if handle == 0 {
        return jboolean::from(false);
    }
    // What:     `let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };`.
    //           Same handle-to-mutable-reference reconstruction inside `unsafe`.
    // Why:      We need a usable engine reference to read `is_playing()`.
    // TS map:   `const engineRef = handleTable.get(handle);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engineRef = handleTable.get(handle);
    // ```
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    // What:     `jboolean::from(engine_ref.is_playing())`. `engine_ref.is_playing()`
    //           returns a Rust `bool`; `jboolean::from(...)` converts it to the JVM
    //           0/1 byte. Tail expression (no `;`), so the converted value is returned.
    // Why:      Report the engine's sounding state in the JVM-friendly byte form.
    // TS map:   `return engineRef.isPlaying();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return engineRef.isPlaying();
    // ```
    jboolean::from(engine_ref.is_playing())
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration taking the engine `handle: jlong` and returning a
//           `jboolean` (8-bit JVM boolean).
// Why:      Kotlin reads this to know when to advance to the next track.
// TS map:   `export function nativeEngineIsEnded(_env, _class, handle): boolean`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeEngineIsEnded(_env: JNIEnv, _class: JClass, handle: number): boolean { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineIsEnded<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) -> jboolean {
    // What:     `if handle == 0 { return jboolean::from(false); }`. Guard: with no
    //           engine, report "not ended". `jboolean::from(false)` converts the Rust
    //           `bool` `false` to the JVM 0 byte.
    // Why:      Return the JVM byte form for "no engine -> not ended".
    // TS map:   `if (handle === 0) return false;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (handle === 0) return false;
    // ```
    if handle == 0 {
        return jboolean::from(false);
    }
    // What:     `let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };`.
    //           Same handle-to-mutable-reference reconstruction inside `unsafe`.
    // Why:      We need a usable engine reference to read `is_ended()`.
    // TS map:   `const engineRef = handleTable.get(handle);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engineRef = handleTable.get(handle);
    // ```
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    // What:     `jboolean::from(engine_ref.is_ended())`. Read the Rust `bool` from
    //           `is_ended()` and convert it to the JVM 0/1 byte. Tail expression, so it
    //           is returned.
    // Why:      Report end-of-track in the JVM-friendly byte form.
    // TS map:   `return engineRef.isEnded();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return engineRef.isEnded();
    // ```
    jboolean::from(engine_ref.is_ended())
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration taking the engine `handle: jlong` and returning a
//           `jboolean` (8-bit JVM boolean).
// Why:      Kotlin reads this "playWhenReady" intent (true from a play/load-and-play
//           request until a pause), distinct from actual sounding.
// TS map:   `export function nativeEnginePlayWhenReady(_env, _class, handle): boolean`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeEnginePlayWhenReady(_env: JNIEnv, _class: JClass, handle: number): boolean { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEnginePlayWhenReady<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) -> jboolean {
    // What:     `if handle == 0 { return jboolean::from(false); }`. Guard: with no
    //           engine, report "no play intent". `jboolean::from(false)` converts the
    //           Rust `bool` `false` to the JVM 0 byte.
    // Why:      Return the JVM byte form for "no engine -> no intent".
    // TS map:   `if (handle === 0) return false;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (handle === 0) return false;
    // ```
    if handle == 0 {
        return jboolean::from(false);
    }
    // What:     `let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };`.
    //           Same handle-to-mutable-reference reconstruction inside `unsafe`.
    // Why:      We need a usable engine reference to read `play_when_ready()`.
    // TS map:   `const engineRef = handleTable.get(handle);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engineRef = handleTable.get(handle);
    // ```
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    // What:     `jboolean::from(engine_ref.play_when_ready())`. Read the Rust `bool`
    //           from `play_when_ready()` and convert it to the JVM 0/1 byte. Tail
    //           expression, so it is returned.
    // Why:      Report the play-intent flag in the JVM-friendly byte form.
    // TS map:   `return engineRef.playWhenReady();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return engineRef.playWhenReady();
    // ```
    jboolean::from(engine_ref.play_when_ready())
}

// What:     `#[no_mangle]`: keep the symbol name for JVM lookup.
// Why:      Same as the other JNI entry points.
// TS map:   no annotation needed.
//
// In TS you'd write (pseudocode):
// ```ts
// // no annotation needed
// ```
#[no_mangle]
// What:     JNI entry declaration taking the engine `handle: jlong` and returning
//           nothing (unit/void).
// Why:      Kotlin calls this once to tear down the engine (stop the worker, close
//           the AAudio stream, free the handle) and reclaim the leaked box; the
//           handle must not be used afterwards.
// TS map:   `export function nativeEngineRelease(_env, _class, handle): void`
//
// In TS you'd write (pseudocode):
// ```ts
// export function nativeEngineRelease(_env: JNIEnv, _class: JClass, handle: number): void { ... }
// ```
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineRelease<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) {
    // What:     `if handle == 0 { return; }`. Guard: a `0` handle is "no engine"; the
    //           bare `return;` exits early. This also makes release safe to call when
    //           create returned 0.
    // Why:      Never try to reclaim a null handle (that would be undefined behaviour).
    // TS map:   `if (handle === 0) return;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (handle === 0) return;
    // ```
    if handle == 0 {
        return;
    }
    // SAFETY: `handle` came from a single `nativeEngineCreate` Box::into_raw and is
    // released exactly once; reclaiming the Box drops the Engine (joining the worker).
    // What:     `unsafe { drop(Box::from_raw(handle as *mut engine::Engine)); }`.
    //           Reading inside-out: `handle as *mut engine::Engine` casts the int back
    //           to a raw mutable pointer. `Box::from_raw(...)` REBUILDS an owning
    //           `Box<Engine>` FROM that raw pointer, taking ownership back (the exact
    //           inverse of the `Box::into_raw` in create). `drop(...)` immediately
    //           runs that box's destructor, freeing the heap `Engine` (which stops the
    //           worker thread and closes the AAudio stream). All inside `unsafe`
    //           because rebuilding a box from a raw pointer is unchecked.
    // Why:      Reclaim and free the engine we deliberately leaked at create time;
    //           dropping it is what actually tears the engine down.
    // TS map:   no analogue (GC frees objects automatically). Mentally: remove the
    //           object from the handle table and let it be collected: `handleTable.delete(handle);`
    // Gotcha:   `Box::from_raw` must be called EXACTLY ONCE per `into_raw`. Calling it
    //           twice is a double-free (use-after-free); never calling it leaks the
    //           engine. `drop(x)` is just an explicit "destroy now"; it is not the same
    //           as TS `delete obj.prop`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // handleTable.delete(handle); // let the GC reclaim the engine
    // ```
    unsafe {
        drop(Box::from_raw(handle as *mut engine::Engine));
    }
}
