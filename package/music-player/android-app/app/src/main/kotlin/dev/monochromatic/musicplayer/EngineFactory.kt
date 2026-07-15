// Top-of-file summary (the Kotlin stand-in for a Rust `//!` module header):
//
// This file is the app's engine factory. There is one production engine now: `RustEngine`, a native
// engine written in Rust that decodes with `symphonia` + `libopus`, outputs through AAudio, and runs
// in-process behind the small `AudioEngine` interface.
//
// The single function below, `createAudioEngine`, is still useful even without build flavors. It gives
// the rest of the app one stable construction point, keeps `RustEngine` out of most call sites, and
// leaves tests free to inject their own `AudioEngine` without knowing how the production engine is
// built.
//
// In TS you'd write (pseudocode):
// ```ts
// // A whole source file is a module. This file exports the production factory.
// ```

// What:     `package dev.monochromatic.musicplayer` declares the namespace (the
//           dotted "folder path" of names) that every type in this file lives
//           under. Other files use this same line to say "I belong to the same
//           namespace", and code in OTHER namespaces must import these names by
//           their full `dev.monochromatic.musicplayer.SomeName` path.
// Why:      Kotlin requires the package line so the compiler knows the fully
//           qualified name of `createAudioEngine` and can match it to the call
//           site in `MainActivity`, which lives in this same package.
//
// In TS you'd write (pseudocode):
// ```ts
// // No literal equivalent — the directory the file lives in plays this role,
// // and you reach names via `import { ... } from "./musicplayer/...";`.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` pulls the name `Context` into this
//           file so we can refer to it as just `Context` instead of writing the
//           full `android.content.Context` everywhere. `Context` is an Android
//           framework type: a handle the operating system hands your app that
//           grants access to system services (here: the content resolver, used
//           to turn `content://` URIs into file descriptors) and ties native
//           resources to the app's lifetime.
// Why:      The function below takes a `Context` parameter and passes it into the
//           engine; without this import the name `Context` would be unresolved.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Context } from "android/content"; // opaque Android handle
// ```
import android.content.Context

// What:     This one physical line declares a function and gives its entire body
//           as a single expression. Naming every symbol left to right:
//           - `fun` is Kotlin's keyword that starts a function declaration (it is
//             what TS spells `function`).
//           - `createAudioEngine` is the function's name.
//           - `(context: Context)` is the parameter list: one parameter named
//             `context`, whose type is the `Context` we imported above. Kotlin
//             writes the type AFTER the name with a colon, the reverse of how a
//             beginner might guess.
//           - `: AudioEngine` is the RETURN type. It is the INTERFACE
//             `AudioEngine` (the contract the production engine and test fakes implement), NOT the
//             concrete class `RustEngine`. `RustEngine` is the sibling type we
//             could have written here instead.
//           - `=` followed by an expression is a "single-expression body": instead
//             of `{ return ... }`, the `=` says "this function's body and return
//             value ARE this one expression". There is an invisible `return`.
//           - `RustEngine(context)` constructs a new `RustEngine`, handing it the
//             `context`. Note there is NO `new` keyword: in Kotlin you call the
//             class name like a function to construct an instance.
// Why:      `MainActivity` only ever calls `createAudioEngine(context)` and stores
//           the result as an `AudioEngine`. This factory hides the concrete native
//           engine behind the small contract. Returning the interface `AudioEngine`
//           (and not `RustEngine`) is the deliberate choice: the caller programs
//           against the contract, so it does not learn about native handles,
//           descriptors, or Rust internals. Declaring the concrete `RustEngine` as
//           the return type would leak the engine implementation into the call site.
// Gotcha:   Two traps for a TS reader on this line: (1) constructing an object has
//           NO `new` keyword in Kotlin — `RustEngine(context)` looks like an
//           ordinary function call but it builds an instance; (2) the `=` is an
//           implicit return, so there is a hidden `return` you must read in.
//
// In TS you'd write (pseudocode):
// ```ts
// function createAudioEngine(context: Context): AudioEngine {
//   return new RustEngine(context);
// }
// ```
/**
 * Defines create audio engine behavior for this music-player component; the TypeScript-oriented notes above
 * explain its call shape and effects.
 */
fun createAudioEngine(context: Context): AudioEngine = RustEngine(context)
