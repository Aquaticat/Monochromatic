// ============================================================================
// File summary (folds in the old KDoc that sat on the two functions below)
// ============================================================================
//
// This file answers two questions about the device's audio-read permission and
// nothing else: WHICH permission string to use, and WHETHER it is granted.
//
// Android renamed the audio-read permission across versions, so there is a
// per-platform choice: the GRANULAR `READ_MEDIA_AUDIO` on API 33+ (Android 13,
// "Tiramisu"), and the BROAD `READ_EXTERNAL_STORAGE` on API 26-32 (where the
// granular one does not exist yet). Both functions here are shared by the
// activity (which REQUESTS the permission) and by `PlaybackService` (which
// CHECKS it before loading the library on a headless restart, since the grant
// persists across process death).
//
// There is no type, no class, no state: just two top-level helper functions.
// ============================================================================

// What:     `package dev.monochromatic.musicplayer` declares the namespace
//           (Kotlin's named bucket that fully qualifies the names in this file)
//           these two functions live in. They become reachable elsewhere as
//           `dev.monochromatic.musicplayer.audioPermission` /
//           `...hasAudioPermission`. By convention the package mirrors the
//           on-disk directory path.
// Why:      We need it so the activity and `PlaybackService` (both in this same
//           package, so they need no import) can call these helpers by name.
//
// In TS you'd write (pseudocode):
// ```ts
// // No `package` line in TS. Module identity comes from the file path itself.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.Manifest` pulls in the framework `Manifest` class,
//           whose nested `Manifest.permission.*` constants are the string names
//           of every Android permission (e.g. `READ_MEDIA_AUDIO`).
// Why:      Both branches of `audioPermission` return one of these permission
//           name constants, so we need the class in scope.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Manifest } from "android";
// ```
import android.Manifest

// What:     `import android.content.Context` pulls in `Context`, Android's
//           handle to the running app environment (resources, system services,
//           and the `ContentResolver`/permission checker).
// Why:      `hasAudioPermission` takes a `Context` parameter to check the
//           permission against.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Context } from "android/content";
// ```
import android.content.Context

// What:     `import android.content.pm.PackageManager` pulls in `PackageManager`,
//           whose `PERMISSION_GRANTED` constant (the integer `0`) is the
//           "permission is granted" status code.
// Why:      `hasAudioPermission` compares the check result against
//           `PackageManager.PERMISSION_GRANTED`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { PackageManager } from "android/content/pm";
// ```
import android.content.pm.PackageManager

// What:     `import android.os.Build` pulls in `Build`, the class exposing the
//           device's OS info. We read `Build.VERSION.SDK_INT` (the running
//           Android API level as an `Int`) and `Build.VERSION_CODES.TIRAMISU`
//           (the constant `33`, Android 13).
// Why:      `audioPermission` branches on the API level to pick the right
//           permission name.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Build } from "android/os";
// ```
import android.os.Build

// What:     `import androidx.core.content.ContextCompat` pulls in `ContextCompat`,
//           an AndroidX helper of static methods that smooth over version
//           differences. We use `ContextCompat.checkSelfPermission(context, name)`,
//           which returns a `PERMISSION_GRANTED`/`PERMISSION_DENIED` `Int`.
// Why:      `hasAudioPermission` uses it to read whether we currently hold the
//           audio permission.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ContextCompat } from "androidx/core/content";
// ```
import androidx.core.content.ContextCompat

// What:     `internal fun audioPermission(): String = <if/else>` declares a
//           top-level function named `audioPermission` taking no parameters and
//           returning a `String`. Two pieces a TS reader should notice:
//           - `internal` is a VISIBILITY modifier meaning "visible everywhere
//             inside THIS Gradle module, but not from other modules." Siblings
//             the reader might have expected: `private` (this file only),
//             `public` (the Kotlin default, everywhere), `protected` (subclasses).
//           - the `= <expr>` form is an EXPRESSION BODY: the single expression
//             after `=` IS the return value (no `return` keyword, no braces).
//             Here that expression is the whole `if/else` below.
// Why:      It is the one place that decides which audio-read permission string
//           the rest of the app requests and checks, so the per-version rule
//           lives once and both callers stay in sync. (Old `@example` usage:
//           `permissionLauncher.launch(audioPermission())`.)
//
// In TS you'd write (pseudocode):
// ```ts
// function audioPermission(): string {
//   return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
//     ? Manifest.permission.READ_MEDIA_AUDIO
//     : Manifest.permission.READ_EXTERNAL_STORAGE;
// }
// ```
/**
 * Defines audio permission behavior for this music-player component; the TypeScript-oriented notes above explain
 * its call shape and effects.
 */
internal fun audioPermission(): String =
    // What:     `if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) { A } else { B }`.
    //           In Kotlin `if` is an EXPRESSION: whichever branch runs, its last
    //           value becomes the result of the whole `if`, and that result is
    //           what the expression-bodied function returns.
    //           `Build.VERSION.SDK_INT` is the device API level (an `Int`);
    //           `Build.VERSION_CODES.TIRAMISU` is the constant `33`; `>=` is a
    //           plain numeric compare giving a `Boolean`.
    // Why:      API 33+ has the granular `READ_MEDIA_AUDIO`; older versions only
    //           have the broad `READ_EXTERNAL_STORAGE`. This picks the correct
    //           name for the running platform.
    // Gotcha:   Unlike TS, this whole `if/else` PRODUCES a value (it is the
    //           function's return), it is not a control-flow side effect.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? A : B
    // ```
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        // What:     `Manifest.permission.READ_MEDIA_AUDIO` reads a `String`
        //           constant naming the granular audio-read permission. As the
        //           `then`-branch's last expression it becomes the branch's value,
        //           hence (on API 33+) the function's return.
        // Why:      The permission to request/check on Android 13 and newer.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // Manifest.permission.READ_MEDIA_AUDIO
        // ```
        Manifest.permission.READ_MEDIA_AUDIO
    } else {
        // What:     `Manifest.permission.READ_EXTERNAL_STORAGE` reads the `String`
        //           constant naming the broad storage-read permission. As the
        //           `else`-branch's last expression it becomes the branch's value,
        //           hence (on API 26-32) the function's return.
        // Why:      The only audio-capable read permission before Android 13.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // Manifest.permission.READ_EXTERNAL_STORAGE
        // ```
        Manifest.permission.READ_EXTERNAL_STORAGE
    }

// What:     `internal fun hasAudioPermission(context: Context): Boolean = <expr>`
//           declares a module-internal (see `internal` above) function named
//           `hasAudioPermission` taking one `Context` parameter and returning a
//           `Boolean`, as an expression body (`= <expr>` is the return).
// Why:      So the first composition can SKIP the permission gate when access is
//           already held, and so `PlaybackService` can self-load its library
//           after a process restart (the grant persists across process death).
//           (Old `@example` usage:
//           `if (hasAudioPermission(context)) controller.openLibrary(...)`.)
//
// In TS you'd write (pseudocode):
// ```ts
// function hasAudioPermission(context: Context): boolean {
//   return ContextCompat.checkSelfPermission(context, audioPermission())
//     === PackageManager.PERMISSION_GRANTED;
// }
// ```
/**
 * Defines has audio permission behavior for this music-player component; the TypeScript-oriented notes above
 * explain its call shape and effects.
 */
internal fun hasAudioPermission(context: Context): Boolean =
    // What:     `ContextCompat.checkSelfPermission(context, audioPermission()) == PackageManager.PERMISSION_GRANTED`
    //           is the expression body. Pieces:
    //           - `audioPermission()` is a NESTED call to the function above; its
    //             returned permission-name `String` is passed as the second
    //             argument, so this helper always checks the platform-correct
    //             permission.
    //           - `ContextCompat.checkSelfPermission(context, name)` returns an
    //             `Int` STATUS CODE (`PERMISSION_GRANTED` = 0, or
    //             `PERMISSION_DENIED` = -1), not a boolean.
    //           - `== PackageManager.PERMISSION_GRANTED` compares that `Int`
    //             status against the granted constant, yielding the `Boolean`
    //             this function returns. Kotlin's `==` is value equality (here on
    //             two `Int`s, identical to TS `===` on numbers).
    // Why:      Turn Android's integer permission status into a plain yes/no the
    //           rest of the app can branch on.
    // Gotcha:   The result of `checkSelfPermission` is an `Int` code, NOT a
    //           `Boolean`; forgetting the `== PERMISSION_GRANTED` would be a type
    //           error in Kotlin (and a silent bug in looser languages).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // ContextCompat.checkSelfPermission(context, audioPermission())
    //   === PackageManager.PERMISSION_GRANTED
    // ```
    ContextCompat.checkSelfPermission(context, audioPermission()) == PackageManager.PERMISSION_GRANTED
