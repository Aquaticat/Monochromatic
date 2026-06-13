// What:     `package dev.monochromatic.musicplayer` declares the namespace this file's
//           declarations belong to. This file is in the `rust` FLAVOR source set
//           (`app/src/rust/kotlin/...`), merged with the shared `main` source set for the
//           full-Rust build variant.
// Why:      Keeps `NativeBridge` in the same package as `RustEngine` and the shared code that
//           call into it.
// TS map:   No `package` keyword in TS; the file path is the module identity.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — file path is the module; this one is rust-flavor only.
// ```
package dev.monochromatic.musicplayer

// =============================================================================
// File summary (folds in the old comment's domain content)
// =============================================================================
//
// `NativeBridge` is the full-Rust flavor's thin Kotlin FACADE over the native engine
// shared library (`.so`, built from Rust via cargo-ndk). Every function here is `external`:
// it has NO Kotlin body; its implementation lives in the native library and is linked at
// load through JNI (Java Native Interface, the bridge between JVM code and native code).
//
// Two groups of functions are declared:
//   - SMOKE-TEST probes that proved the cargo-ndk -> JNI toolchain on device: `nativePing`,
//     `nativeOpusSelfTest`, `nativeSymphoniaSelfTest`, the decode benchmarks, and
//     `nativeOutputLatencyProbe`.
//   - the REAL engine surface the `RustEngine` drives: `nativeMeasureTruePeak` plus the
//     `nativeEngine*` create/load/transport/query/release calls.
//
// `handle: Long` everywhere is an OPAQUE native engine pointer (a 64-bit address the Rust
// side owns); `fd: Int` is a borrowed file descriptor. The JVM never dereferences either; it
// just passes them back to the native side. Integer return codes follow the convention `0` =
// success, negative = error.

// What:     `object NativeBridge { ... }` declares a SINGLETON OBJECT named `NativeBridge`:
//           Kotlin creates exactly one instance, with no constructor to call. Members are
//           reached as `NativeBridge.nativePing()`, like static methods on a namespace.
// Why:      The native bridge is global, stateless glue (the engine state lives behind the
//           native `handle`, not in this object); a singleton `object` is Kotlin's "static
//           namespace" with one shared instance.
// TS map:   `export const NativeBridge = { ... };` (a singleton namespace), or a class with
//           only `static` members. There is no `new`.
// Gotcha:   `object X { }` here is a TYPE DECLARATION creating one global instance, not the
//           `object : Interface { }` expression used elsewhere for anonymous instances.
//
// In TS you'd write (pseudocode):
// ```ts
// export const NativeBridge = {
//   // ...native function declarations as members...
// };
// ```
object NativeBridge {
    // What:     `init { System.loadLibrary("musicplayer_native") }` is an INITIALIZER BLOCK that
    //           runs once when the object is first used. `System.loadLibrary("musicplayer_native")`
    //           asks the JVM to load the native shared library named `libmusicplayer_native.so`
    //           (the `lib` prefix and `.so` suffix are added by the platform), wiring up the
    //           `external` functions below to their native implementations.
    // Why:      The `external` functions cannot be called until their native library is loaded;
    //           doing it in `init` guarantees the load happens before any bridge call.
    // TS map:   No real equivalent. Mentally the WASM/native-addon load step that must complete
    //           before any imported native function is callable, e.g.
    //           `const native = require("./musicplayer_native.node");` at module load.
    // Gotcha:   `System.loadLibrary` takes the library's SHORT name (`musicplayer_native`), not
    //           the on-disk filename; the platform expands it to `libmusicplayer_native.so`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // const native = loadNativeAddon("musicplayer_native"); // must run before any call below
    // ```
    init {
        System.loadLibrary("musicplayer_native")
    }

    // What:     `external fun nativePing(): Int` declares a function with NO Kotlin body (the
    //           `external` keyword): its implementation is in the native library, linked via JNI.
    //           It takes no arguments and returns an `Int` (32-bit signed integer).
    // Why:      Smoke test: the simplest possible round-trip proving the JVM can call into the
    //           native library at all.
    // TS map:   `declare function nativePing(): number;` — an ambient declaration backed by a
    //           native addon; there is no JS body, the runtime supplies one.
    // Gotcha:   `external` means "implemented elsewhere (native code)"; calling it before the
    //           library is loaded would crash. A TS reader should picture an FFI/native import.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativePing(): number; // implemented in the native addon
    // ```
    external fun nativePing(): Int

    // What:     `external fun nativeOpusSelfTest(): Int` is a JNI native function (no Kotlin body)
    //           taking no args and returning an `Int` result/status code.
    // Why:      Smoke test: exercise the bundled Opus decoder inside the native library and report
    //           a pass/fail code.
    // TS map:   `declare function nativeOpusSelfTest(): number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeOpusSelfTest(): number;
    // ```
    external fun nativeOpusSelfTest(): Int

    // What:     `external fun nativeSymphoniaSelfTest(): Int` is a JNI native function returning an
    //           `Int` status code.
    // Why:      Smoke test: exercise the symphonia decoder in the native library and report a
    //           pass/fail code.
    // TS map:   `declare function nativeSymphoniaSelfTest(): number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeSymphoniaSelfTest(): number;
    // ```
    external fun nativeSymphoniaSelfTest(): Int

    // What:     `external fun nativeDecodeBenchmark(path: String): Double` is a JNI native function
    //           taking a `String` file `path` and returning a `Double` (64-bit float). Sibling
    //           `Float` (32-bit) is declined because a benchmark duration/throughput wants the
    //           wider precision.
    // Why:      Smoke test: decode the file at `path` natively and return a timing/throughput
    //           figure for performance comparison against the Media3 flavor.
    // TS map:   `declare function nativeDecodeBenchmark(path: string): number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeDecodeBenchmark(path: string): number;
    // ```
    external fun nativeDecodeBenchmark(path: String): Double

    // What:     `external fun nativeDecodeFdBenchmark(fd: Int): Double` is a JNI native function
    //           taking a file descriptor `fd` (an `Int`, 32-bit) and returning a `Double` timing.
    // Why:      Smoke test: like `nativeDecodeBenchmark` but decoding from an already-open file
    //           descriptor (the `content://` path), which is how the app actually opens media.
    // TS map:   `declare function nativeDecodeFdBenchmark(fd: number): number;`
    // Gotcha:   `fd` is a raw OS file descriptor (an `Int`), not a path or handle; the native side
    //           reads from it directly.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeDecodeFdBenchmark(fd: number): number;
    // ```
    external fun nativeDecodeFdBenchmark(fd: Int): Double

    // What:     `external fun nativeOutputLatencyProbe(): Double` is a JNI native function returning
    //           a `Double` (64-bit) latency figure.
    // Why:      Smoke test: measure the native AAudio output path's latency for the
    //           performance-comparison story this flavor exists to tell.
    // TS map:   `declare function nativeOutputLatencyProbe(): number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeOutputLatencyProbe(): number;
    // ```
    external fun nativeOutputLatencyProbe(): Double

    // What:     `external fun nativeMeasureTruePeak(fd: Int): Float` is a JNI native function taking
    //           a file descriptor `fd` (`Int`) and returning a `Float` (32-bit) true peak. Sibling
    //           `Double` is declined because the sample/peak domain is 32-bit float, matching the
    //           desktop's `f32`.
    // Why:      Decode the track at `fd` natively and return its true peak; a negative return is an
    //           error code (the Kotlin caller checks `peak < 0`).
    // TS map:   `declare function nativeMeasureTruePeak(fd: number): number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeMeasureTruePeak(fd: number): number; // <0 means error
    // ```
    external fun nativeMeasureTruePeak(fd: Int): Float

    // What:     `external fun nativeEngineCreate(): Long` is a JNI native function returning a `Long`
    //           (64-bit signed integer). The `Long` is an OPAQUE HANDLE: a native pointer/address
    //           the Rust engine owns, passed back on every later call. Sibling `Int` (32-bit) is
    //           declined because a native pointer needs 64 bits on a 64-bit device.
    // Why:      Create the native engine (spawning its worker thread) and return its handle; `0`
    //           means the worker could not be spawned.
    // TS map:   `declare function nativeEngineCreate(): bigint;` — a 64-bit opaque handle is closest
    //           to a `bigint`/number you treat as a token and never inspect.
    // Gotcha:   The returned `Long` is NOT a number to do math on; it is an opaque pointer. `0` is
    //           the only meaningful value to test (failure).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeEngineCreate(): bigint; // opaque engine handle; 0n = failed
    // ```
    external fun nativeEngineCreate(): Long

    // What:     `external fun nativeEngineLoad(handle: Long, fd: Int, play: Boolean): Int` is a JNI
    //           native function. `handle: Long` is the opaque engine handle; `fd: Int` is the
    //           track's file descriptor; `play: Boolean` says whether to start playing. Returns an
    //           `Int` status code (`0` = success).
    // Why:      Load the track at `fd` into the engine `handle`, optionally starting playback; the
    //           native side dups `fd` synchronously so the JVM can close its copy after.
    // TS map:   `declare function nativeEngineLoad(handle: bigint, fd: number, play: boolean): number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeEngineLoad(handle: bigint, fd: number, play: boolean): number;
    // ```
    external fun nativeEngineLoad(handle: Long, fd: Int, play: Boolean): Int

    // What:     `external fun nativeEnginePlay(handle: Long)` is a JNI native function taking the
    //           opaque `handle` and returning nothing (no return type = `Unit`/void).
    // Why:      Resume playback on the native engine.
    // TS map:   `declare function nativeEnginePlay(handle: bigint): void;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeEnginePlay(handle: bigint): void;
    // ```
    external fun nativeEnginePlay(handle: Long)

    // What:     `external fun nativeEnginePause(handle: Long)` is a JNI native function taking the
    //           opaque `handle`, returning `Unit` (void).
    // Why:      Pause playback on the native engine.
    // TS map:   `declare function nativeEnginePause(handle: bigint): void;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeEnginePause(handle: bigint): void;
    // ```
    external fun nativeEnginePause(handle: Long)

    // What:     `external fun nativeEngineSeek(handle: Long, positionSec: Double)` is a JNI native
    //           function taking the `handle` and a `positionSec` (`Double`, 64-bit, seconds),
    //           returning `Unit` (void). Sibling `Float` is declined: seconds want the wider type.
    // Why:      Seek the native engine to `positionSec`.
    // TS map:   `declare function nativeEngineSeek(handle: bigint, positionSec: number): void;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeEngineSeek(handle: bigint, positionSec: number): void;
    // ```
    external fun nativeEngineSeek(handle: Long, positionSec: Double)

    // What:     `external fun nativeEngineSetVolume(handle: Long, volume: Float)` is a JNI native
    //           function taking the `handle` and a `volume` (`Float`, 32-bit, `0.0..1.0`), returning
    //           `Unit` (void).
    // Why:      Set the user volume on the native engine.
    // TS map:   `declare function nativeEngineSetVolume(handle: bigint, volume: number): void;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeEngineSetVolume(handle: bigint, volume: number): void;
    // ```
    external fun nativeEngineSetVolume(handle: Long, volume: Float)

    // What:     `external fun nativeEngineSetNormalizationGain(handle: Long, gain: Float)` is a JNI
    //           native function taking the `handle` and a `gain` (`Float`, `0.0..1.0`), returning
    //           `Unit` (void).
    // Why:      Set the per-track true-peak normalization gain on the native engine (applied inside
    //           the native output callback, where the clamp also guards clipping).
    // TS map:   `declare function nativeEngineSetNormalizationGain(handle: bigint, gain: number): void;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeEngineSetNormalizationGain(handle: bigint, gain: number): void;
    // ```
    external fun nativeEngineSetNormalizationGain(handle: Long, gain: Float)

    // What:     `external fun nativeEnginePositionSec(handle: Long): Double` is a JNI native function
    //           taking the `handle` and returning a `Double` (seconds).
    // Why:      Query the current playback position in seconds from the native engine.
    // TS map:   `declare function nativeEnginePositionSec(handle: bigint): number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeEnginePositionSec(handle: bigint): number;
    // ```
    external fun nativeEnginePositionSec(handle: Long): Double

    // What:     `external fun nativeEngineDurationSec(handle: Long): Double` is a JNI native function
    //           taking the `handle` and returning a `Double` (seconds).
    // Why:      Query the current track's duration in seconds from the native engine.
    // TS map:   `declare function nativeEngineDurationSec(handle: bigint): number;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeEngineDurationSec(handle: bigint): number;
    // ```
    external fun nativeEngineDurationSec(handle: Long): Double

    // What:     `external fun nativeEngineIsPlaying(handle: Long): Boolean` is a JNI native function
    //           taking the `handle` and returning a `Boolean`.
    // Why:      Query whether the native engine is currently playing (the poller edge-triggers the
    //           play/pause callback off this).
    // TS map:   `declare function nativeEngineIsPlaying(handle: bigint): boolean;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeEngineIsPlaying(handle: bigint): boolean;
    // ```
    external fun nativeEngineIsPlaying(handle: Long): Boolean

    // What:     `external fun nativeEngineIsEnded(handle: Long): Boolean` is a JNI native function
    //           taking the `handle` and returning a `Boolean`.
    // Why:      Query whether the current track has ended (the poller fires the track-ended callback
    //           on the rising edge of this).
    // TS map:   `declare function nativeEngineIsEnded(handle: bigint): boolean;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeEngineIsEnded(handle: bigint): boolean;
    // ```
    external fun nativeEngineIsEnded(handle: Long): Boolean

    // What:     `external fun nativeEnginePlayWhenReady(handle: Long): Boolean` is a JNI native
    //           function taking the `handle` and returning a `Boolean`.
    // Why:      Query the engine's intended play state ("should play once ready"), mirroring
    //           ExoPlayer's `playWhenReady` for the shared `AudioEngine` contract.
    // TS map:   `declare function nativeEnginePlayWhenReady(handle: bigint): boolean;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeEnginePlayWhenReady(handle: bigint): boolean;
    // ```
    external fun nativeEnginePlayWhenReady(handle: Long): Boolean

    // What:     `external fun nativeEngineRelease(handle: Long)` is a JNI native function taking the
    //           `handle` and returning `Unit` (void).
    // Why:      Release the native engine (stop its worker thread, free its resources); after this
    //           the handle is invalid and must not be reused.
    // TS map:   `declare function nativeEngineRelease(handle: bigint): void;`
    // Gotcha:   After `nativeEngineRelease`, the `handle` is dangling; the Kotlin side sets its
    //           stored handle to `0` so later calls are guarded.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // declare function nativeEngineRelease(handle: bigint): void; // handle invalid afterward
    // ```
    external fun nativeEngineRelease(handle: Long)
}
