// What:     `package dev.monochromatic.musicplayer` declares which namespace
//           (logical folder of names) every declaration in this file belongs to.
//           In Kotlin/Java the package name normally mirrors the directory path, but
//           this file lives under a FLAVOR source set (`app/src/media3/kotlin/...`),
//           not the shared `app/src/main/kotlin/...`. Gradle merges exactly one
//           flavor's sources with `main` per build variant, so this `media3` flavor's
//           `createAudioEngine` and the `rust` flavor's `createAudioEngine` share the
//           identical package name and only one is compiled in at a time.
// Why:      Puts `createAudioEngine` in the same package as the shared `main` code
//           (`MainActivity`, the `AudioEngine` interface) so they see each other with
//           no import, and lets each flavor supply its own engine under one name.
// TS map:   No direct equivalent. TS has no `package` keyword and no "build flavor /
//           source set" merge; the nearest mental model is two files
//           `engine.media3.ts` and `engine.rust.ts` that both
//           `export function createAudioEngine(...)`, with the bundler configured to
//           include exactly one of them per build.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path is the module; a build flag picks media3 vs rust.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` pulls the Android framework class
//           `Context` into this file by its short name, so we can write `Context`
//           instead of the fully-qualified `android.content.Context`. `android.content`
//           is the package (namespace) the class lives in; `Context` is the class.
//           A `Context` is Android's handle to the running app environment (resources,
//           system services, package info) that almost every framework call needs.
// Why:      The factory takes a `Context` and forwards it to the `Media3Engine`
//           constructor, which needs it to build the underlying ExoPlayer.
// TS map:   `import { Context } from "android-framework";` — a plain named import of a
//           type. There is no TS/Node analogue of `Context` itself; mentally it is an
//           "ambient app handle" the platform hands you.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Context } from "android-framework";
// ```
import android.content.Context

// =============================================================================
// File summary (folds in the old KDoc's domain content)
// =============================================================================
//
// This file is the Media3 flavor's ENGINE FACTORY. The app supports more than one
// audio backend (a Media3/ExoPlayer flavor and a full-Rust flavor); each flavor's
// source set provides its OWN `createAudioEngine(context)` with the SAME signature.
// Because the package and signature match, the shared `main` code (`MainActivity`)
// just calls `createAudioEngine(...)` and the build picks the right one AT COMPILE
// TIME, with no runtime `if (flavor == ...)` switch.
//
// This Media3 implementation returns a `Media3Engine` (backed by ExoPlayer). The
// return type is the shared `AudioEngine` interface (declared in `main`), so callers
// only ever see the backend-agnostic contract, never the concrete class.

// What:     `fun createAudioEngine(context: Context): AudioEngine = Media3Engine(context)`
//           declares a top-level (package-level, not inside any class) function named
//           `createAudioEngine`. Pieces:
//           - `(context: Context)` is its single parameter: the app `Context`.
//           - `: AudioEngine` is the RETURN TYPE. `AudioEngine` is an INTERFACE (a
//             contract of methods with no implementation) declared in the shared
//             `main` source set. Sibling the reader might expect: the concrete class
//             `Media3Engine` itself. The function deliberately returns the INTERFACE,
//             not the concrete class, so callers cannot depend on Media3-specific
//             details and the two flavors stay interchangeable.
//           - `= Media3Engine(context)` is an EXPRESSION BODY: the single expression
//             after `=` IS the return value (no `return` keyword, no braces).
//             `Media3Engine(context)` is a CONSTRUCTOR CALL on the `Media3Engine`
//             class (in Kotlin you call a constructor like a function, with NO `new`
//             keyword); it builds the engine and that instance is returned, widened to
//             the `AudioEngine` interface.
// Why:      Gives the shared code one stable name to build "the audio engine" without
//           knowing which flavor is compiled in; here it hands back an ExoPlayer-backed
//           engine.
// TS map:   `function createAudioEngine(context: Context): AudioEngine { return new Media3Engine(context); }`
//           — TS needs `new` and a `return`; Kotlin's constructor call omits `new` and
//           the expression body omits `return`. `AudioEngine` maps to a TS `interface`.
// Gotcha:   No `new` keyword: `Media3Engine(context)` looks like a plain function call
//           but constructs an object. A TS reader expects `new Media3Engine(context)`.
//
// In TS you'd write (pseudocode):
// ```ts
// function createAudioEngine(context: Context): AudioEngine {
//   return new Media3Engine(context); // returned as the AudioEngine interface
// }
// ```
fun createAudioEngine(context: Context): AudioEngine = Media3Engine(context)
