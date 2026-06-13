// ====================================================================
// FILE SUMMARY (folds in the old KDoc's domain content)
//
// This is the "hybrid" flavor's engine factory. The music-player app
// ships three interchangeable playback back-ends ("flavors" in Android
// build-speak: separate source folders that the build system swaps in
// at compile time, each providing its own copy of the same function):
//   1. media3 - pure-Kotlin playback on top of Google's Media3/ExoPlayer.
//   2. hybrid - Media3 playback PLUS a true-peak DSP (digital-signal-
//      processing, i.e. the loudness/peak-metering math) implemented as
//      a tiny Rust library compiled to a native `.so` shared object and
//      called from Kotlin through UniFFI (a Rust<->Kotlin bridge
//      generator). THIS FILE is that hybrid flavor.
//   3. rust   - the all-Rust back-end.
//
// The hybrid engine itself is NOT built yet: the Rust `.so` and the NDK
// (Native Development Kit: the toolchain for compiling native code on
// Android) wiring do not exist. This file is a deliberate STUB whose
// only job is to keep the hybrid flavor compiling, so the three-engine
// architecture can be exercised end to end before any native work
// begins. Calling the factory at runtime throws on purpose.
//
// For a TS reader: think of three folders `engines/media3/`,
// `engines/hybrid/`, `engines/rust/`, each exporting a function with the
// SAME name and signature, and a bundler config that picks exactly one
// folder per build. This file is the not-yet-implemented one whose
// exported function just `throw`s.
// ====================================================================

// What:     `package dev.monochromatic.musicplayer` declares which
//           "package" (namespace) every top-level name in this file
//           belongs to. In Kotlin/Java a package is a dotted path that
//           also mirrors the folder layout on disk; it groups related
//           files and controls which names are visible without an
//           explicit import. Every other `.kt` file under this same
//           package can see `createAudioEngine` without importing it.
// Why:      We need this so the build can match this stub's
//           `createAudioEngine` to the `AudioEngine` interface and the
//           `MainActivity` caller, which all live in the same package.
//           A wrong/missing package would make those names unresolvable.
// TS map:   There is no exact equivalent. The closest mental model is a
//           module folder path plus an implicit "everything in this
//           folder shares a scope". In TS you would instead `export` the
//           function and `import` it by relative path; Kotlin packages
//           do that grouping by declaration rather than by file path.
//
// In TS you'd write (pseudocode):
// ```ts
// // No 1:1 equivalent. Mentally: this file lives in a module folder
// // `dev/monochromatic/musicplayer/` and shares scope with its siblings.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` pulls the name `Context`
//           into this file from the Android framework package
//           `android.content`. `Context` is Android's "handle to the
//           running app environment" object (it gives access to
//           resources, system services, the app's files, etc.). After
//           this line we can write `Context` instead of the fully
//           qualified `android.content.Context`.
// Why:      We need it so the `context: Context` parameter type on the
//           factory function below resolves. Even though this stub never
//           uses the value, the SIGNATURE must still name the type so it
//           matches the media3/rust flavors' factory signatures exactly.
// TS map:   A named import: `import { Context } from "android/content";`.
//           Kotlin imports a single symbol per line (no `{ }` braces and
//           no `from`); the dotted path before the last segment is the
//           package, the last segment is the symbol.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Context } from "android/content";
// ```
import android.content.Context

// What:     `fun createAudioEngine(context: Context): AudioEngine = ...`
//           declares a top-level function named `createAudioEngine`.
//           - `fun` is Kotlin's keyword for "function" (like TS's
//             `function`).
//           - `(context: Context)` is one parameter named `context` of
//             type `Context` (the Android handle imported above). The
//             type comes AFTER the name with a colon, same order as TS.
//           - `: AudioEngine` after the parameter list is the RETURN
//             type: this function promises to hand back something that
//             implements the `AudioEngine` interface (the small
//             "play one track" seam defined in the shared `main` source
//             set). `AudioEngine` is an interface here, not a concrete
//             class; siblings the reader might have expected as the
//             return type are the concrete `Media3Engine` (media3 flavor)
//             or a full-Rust engine class (rust flavor). This stub
//             declares the broad interface because it never actually
//             constructs anything.
//           - The `=` (instead of a `{ }` block) makes this an
//             "expression-body" function: the function's value (and thus
//             its return value) IS the single expression on the right.
//             The expression is on the next line.
// Why:      Each flavor source set provides its own `createAudioEngine`
//           with this identical signature, so `MainActivity` can call
//           one function name and get whichever engine the active flavor
//           wired in, decided at COMPILE time with no runtime branch.
//           This hybrid copy keeps that contract present (so the flavor
//           compiles) while the real engine is unbuilt.
// TS map:   `function createAudioEngine(context: Context): AudioEngine`.
//           The `=` expression body is like a TS arrow function whose
//           body is a single expression: `const f = (context: Context):
//           AudioEngine => <expr>`. Here the `<expr>` happens to be a
//           `throw`, which Kotlin allows as an expression (see below).
// Gotcha:   Unlike TS, the parameter `context` is declared but UNUSED in
//           this stub, and Kotlin still compiles it without complaint
//           because the signature must match the other flavors. Do not
//           read the unused param as a bug; it is required surface area.
//
// In TS you'd write (pseudocode):
// ```ts
// function createAudioEngine(context: Context): AudioEngine {
//   // ...single expression that produces an AudioEngine (or throws)...
// }
// ```
fun createAudioEngine(context: Context): AudioEngine =
    // What:     `throw NotImplementedError("hybrid engine not built yet")`
    //           raises an exception immediately.
    //           - `throw` aborts the function by raising an error, exactly
    //             like TS's `throw`. The twist: in Kotlin `throw` is an
    //             EXPRESSION of the special type `Nothing` (the type with
    //             no values, meaning "this never returns normally").
    //             Because `Nothing` is assignable to ANY type, a bare
    //             `throw` can legally sit on the right-hand side of the
    //             `=` expression-body even though the declared return type
    //             is `AudioEngine`. This line is the function's tail/return
    //             position: its "value" is the throw, so the function never
    //             actually produces an `AudioEngine`.
    //           - `NotImplementedError(...)` constructs Kotlin's built-in
    //             exception meaning "this code path is intentionally not
    //             implemented yet". It is a standard-library class (the
    //             twin of the `TODO()` helper). Siblings the reader might
    //             have reached for: `RuntimeException`,
    //             `IllegalStateException`, or `UnsupportedOperationException`
    //             (which `NotImplementedError` actually subclasses). We pick
    //             `NotImplementedError` because its name documents intent
    //             precisely: "planned, not built", not "illegal state".
    //           - `"hybrid engine not built yet"` is the message string
    //             carried by the exception, shown if it ever surfaces.
    //           - Note there is no `new` keyword: Kotlin constructs objects
    //             by calling the class name like a function.
    // Why:      Make any accidental runtime call FAIL LOUDLY with a clear
    //           message, so nobody mistakes this stub flavor for a working
    //           engine while the native Rust DSP and NDK wiring are still
    //           missing. Throwing is preferable to returning a fake engine
    //           that would silently misbehave.
    // TS map:   `throw new Error("hybrid engine not built yet");`. In TS the
    //           `throw` is a STATEMENT, so to put it in an arrow
    //           expression body you would wrap it in a block. Kotlin needs
    //           no wrapper because `throw` is itself an expression.
    // Gotcha:   Reading `=` then `throw` can look like "assign a thrown
    //           value", which makes no sense in TS. It is not an
    //           assignment of a value; it is an expression-bodied function
    //           whose sole expression aborts. The function returns nothing
    //           because control never reaches a normal return.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function createAudioEngine(context: Context): AudioEngine {
    //   throw new Error("hybrid engine not built yet");
    // }
    // ```
    throw NotImplementedError("hybrid engine not built yet")
