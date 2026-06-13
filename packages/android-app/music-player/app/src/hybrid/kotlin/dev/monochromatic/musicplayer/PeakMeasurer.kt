// File summary (folds in the old KDoc's domain content):
//
// This is the "hybrid" build-flavor STUB for true-peak measurement on Android.
//
// Domain background: "true peak" (a.k.a. inter-sample peak) is the highest level
// the analog waveform reaches AFTER a digital-to-analog converter reconstructs it
// between the stored samples; it can sit ABOVE the largest stored sample. The
// player measures it so it can later apply a normalization gain that brings each
// track down to a safe ceiling, so playback never overflows the converter.
//
// The REAL hybrid engine is meant to measure that true peak by calling a small
// DSP (digital-signal-processing) core compiled to a native Rust `.so` shared
// library and bridged into Kotlin via UniFFI (a tool that auto-generates the
// Kotlin <-> Rust foreign-function bindings). That `.so` is NOT built yet, so
// this file exists only to keep the `hybrid` flavor COMPILING. It throws on every
// call.
//
// The background peak sweep that calls this function treats the throw as a
// per-track failure: it catches it, moves on to the next track, and simply caches
// nothing for the failed one, rather than crashing the whole sweep. So an unbuilt
// flavor degrades to "measures nothing", not "app crashes".
//
// (This is a Kotlin file: comments use `//`. The dum-dum comment blocks below
// translate every concept-introducing line into TypeScript thinking for a reader
// who knows only TypeScript.)

// What:     `package dev.monochromatic.musicplayer` declares the package (namespace)
//           this file belongs to. Every Kotlin file starts by naming its package; the
//           dotted name `dev.monochromatic.musicplayer` is the fully-qualified prefix
//           other files use to refer to the symbols declared here.
// Why:      We need this so other Kotlin files in the app can import and call
//           `measureTrackPeak` by its full name, and so the build groups this file
//           with its siblings in the same package.
// TS map:   TS has no `package` keyword; the closest idea is the directory/module a file
//           lives in. Mentally, picture this as the top-of-file marker that says "I am the
//           module `dev/monochromatic/musicplayer`", with nothing exported until a
//           declaration is written.
//
// In TS you'd write (pseudocode):
// ```ts
// // No 1:1 equivalent — a TS file's "package" is just its path on disk.
// // Picture: // module: dev/monochromatic/musicplayer
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` pulls the `Context` type into this file by
//           its short name. `Context` is an Android-framework object that represents the
//           running app's environment: it is the handle you ask for things like the file
//           system, content resolvers, and system services.
// Why:      The real measurer would need a `Context` to open the audio file behind a
//           content `Uri` (Android requires a `Context` to resolve content URIs to bytes).
//           The stub keeps the parameter so its signature matches the eventual real one.
// TS map:   `Context` has no clean TS analogue; mentally it is "an ambient app-environment
//           handle you must thread through to touch the device". The import itself is just
//           a named import.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Context } from "android/content";
// ```
import android.content.Context

// What:     `import android.net.Uri` pulls the `Uri` type into this file. `Uri` is
//           Android's parsed representation of a URI string (for example a
//           `content://...` or `file://...` address) that points at a piece of media.
// Why:      A track is identified to this function by its `Uri`; the real measurer would
//           open the bytes at that `Uri` and run the DSP over them. The stub keeps the
//           parameter so the signature is already correct for when the real code lands.
// TS map:   Closest TS is the built-in `URL` class, or just a `string` holding the address.
//           Here it is an opaque parsed-address object.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Uri } from "android/net"; // or just use `string`
// ```
import android.net.Uri

// What:     `suspend fun measureTrackPeak(context: Context, uri: Uri): Float = ...`
//           declares a function named `measureTrackPeak`.
//           - `suspend` marks it as a Kotlin coroutine function: it is allowed to pause
//             ("suspend") and resume later without blocking a thread. Only other `suspend`
//             functions, or a coroutine builder (`launch`/`async`/`withContext`/
//             `runBlocking`), may call it.
//           - `context: Context` and `uri: Uri` are its two parameters (the audio file's
//             app-environment handle and its address). Kotlin writes the type AFTER the
//             name with a colon, the reverse of TS's `name: type`... which actually reads
//             the same as TS here.
//           - `: Float` is the RETURN type. `Float` is a 32-bit IEEE floating-point number.
//             Sibling the reader might expect: `Double`, which is the 64-bit float. We
//             return `Float` (not `Double`) because a normalized audio peak only needs
//             ~7 significant digits and the value crosses the UniFFI/Rust boundary as a
//             Rust `f32`; using `Double` would waste width and force a conversion.
//           - The `=` (expression body) means the function's value IS the single
//             expression on the right-hand side; there is no `{ ... }` block and no
//             explicit `return`. Whatever that expression evaluates to is what the function
//             returns.
// Why:      This is the one entry point the background sweep calls to get a track's true
//           peak. The stub must still declare it with the exact real signature so the
//           `hybrid` flavor compiles and links against callers.
// Gotcha:   `Float` is NOT TS's `number` (which is always 64-bit). It is a narrower 32-bit
//           float, so very large or very precise values lose precision compared to a TS
//           `number`. Also, `suspend` is not the same as `async`: a `suspend` function does
//           not return a promise object; the coroutine machinery handles the pausing
//           invisibly, and to the caller it looks like an ordinary (possibly slow) call.
// TS map:   Picture an `async` function returning a plain number:
//           `async function measureTrackPeak(context: Context, uri: Uri): Promise<number>`.
//           The `= <expr>` expression body is like an arrow function body with no braces:
//           `const measureTrackPeak = (...) => <expr>`.
//
// In TS you'd write (pseudocode):
// ```ts
// async function measureTrackPeak(
//   context: Context,
//   uri: Uri,
// ): Promise<number> {
//   // ...single expression below becomes the body...
// }
// ```
suspend fun measureTrackPeak(context: Context, uri: Uri): Float =
    // What:     `throw NotImplementedError("hybrid true-peak measurer not built yet")`
    //           raises an exception and aborts the call. `NotImplementedError` is a
    //           standard Kotlin error type meaning "this code path exists but is
    //           deliberately not finished yet"; the string is the human-readable message.
    //           Because the function uses an `=` expression body, this `throw` IS that
    //           single expression: it is the function's "value-producing" tail (it never
    //           actually produces a `Float` because throwing unwinds before any value is
    //           returned). In Kotlin a `throw` has the bottom type `Nothing`, which is
    //           assignable to the declared `Float` return type, so this type-checks.
    // Why:      The native `.so` is not built, so there is nothing real to measure. We
    //           throw a clear, named error instead of returning a fake number; the sweep
    //           catches it as a per-track failure, caches nothing for this track, and
    //           continues, so the unbuilt flavor degrades gracefully rather than crashing.
    // Gotcha:   This looks like a plain `throw` from TS, but two things differ: (1) it is
    //           the WHOLE function body (no separate `return`), and (2) `throw` is a real
    //           expression of type `Nothing` in Kotlin, which is why it can stand where a
    //           `Float` is expected. In TS, `throw` is a statement, not an expression, so
    //           you cannot put it after `=>` without braces.
    // TS map:   `throw new Error("hybrid true-peak measurer not built yet");` placed inside
    //           the async function body. (TS has no `NotImplementedError`; a plain `Error`
    //           with the same message is the closest stand-in.)
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // throw new Error("hybrid true-peak measurer not built yet");
    // ```
    throw NotImplementedError("hybrid true-peak measurer not built yet")
