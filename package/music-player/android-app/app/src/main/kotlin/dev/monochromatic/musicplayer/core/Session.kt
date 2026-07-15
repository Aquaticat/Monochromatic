// What:     `package dev.monochromatic.musicplayer.core` names the namespace this
//           file's declarations live under. The single top-level name below
//           (`Session`, the data class) becomes reachable from other files as
//           `dev.monochromatic.musicplayer.core.Session`, or via an `import`. It is
//           not a statement that runs; it is metadata the compiler reads to decide
//           where these symbols belong.
// Why:      Without it the `Session` type would land in the unnamed default package
//           and collide with everything else; the build expects this file's package
//           to match its directory path (`.../core/`).
//
// In TS you'd write (pseudocode):
// ```ts
// // No statement equivalent — the file's path *is* its namespace in TS.
// ```
package dev.monochromatic.musicplayer.core

// MODULE SUMMARY (folds in the design of the source-root session redesign):
//
// The saved "where the user left off" state. This was REDESIGNED away from a
// materialized queue: the desktop player no longer persists the track list and a
// current index, it persists the opened directory ("Source Root") plus the single
// SELECTED TRACK, and re-derives the queue by scanning the root on restore (so a
// file added, removed, or renamed since last run self-corrects). See
// `doc/decision/music-player-session-source-root.md`.
//
// Android differs from desktop in ONE field: it does NOT persist the Source Root.
// On Android the source is re-resolved every launch by `LibrarySource.load` (a held
// SAF document-tree grant, else the device-wide MediaStore), and the SAF grant is
// persisted by Android's own persistable-URI-permission machinery (via
// `LibraryRoot`), not by this model. So the desktop's `source_root` field has no
// Android analog here; this Session carries only the selected track, the resume
// position, and the user settings. See `CONTEXT.md` (Android-specific referents).
//
// This is a PURE model: it carries ONLY the in-memory shape. The actual storage
// (read/write to SharedPreferences) lives in the platform layer (`SessionStore`),
// so this type reads only its own fields, touches no disk, and is trivially
// value-comparable in tests.
//
// Field domain notes:
//   - selected     : identity of the SELECTED TRACK, or `null` when nothing was
//                    selected. On Android this is a content URI string (a SAF
//                    document URI or a MediaStore item URI); on desktop the twin is
//                    a filesystem path. The model is identity-agnostic: it is just
//                    the opaque string the platform uses to re-find the track after
//                    a rescan.
//   - positionSecs : saved playback position of the selected track, in seconds.
//   - volume       : saved gain in the range 0.0..=1.0.
//   - shuffle      : saved shuffle mode (off, within-page, or all).
//   - repeatTrack  : whether "repeat track" was enabled.
//
// The defaults reproduce the desktop's `impl Default for Session` (minus the
// dropped queue/index/source-root): nothing selected, zero position, full volume,
// shuffle off, no repeat-track.
//
// No imports appear in this file: `ShuffleMode` lives in this same `core` package,
// so it is visible without an `import` line; everything else (`String`, `Double`,
// `Float`, `Boolean`) is Kotlin's always-imported standard prelude.

// What:     `data class Session( ... )` declares a DATA CLASS named `Session`. A
//           `data class` is Kotlin's "plain record" shape: from the properties
//           listed in its PRIMARY CONSTRUCTOR (the parameter list in parentheses
//           right after the name), the compiler AUTO-GENERATES a bundle of methods
//           for free —
//             - `equals()` / `hashCode()`: structural (value) equality, so two
//               sessions with identical fields compare equal.
//             - `toString()`: a readable `Session(selected=..., positionSecs=...)`
//               dump.
//             - `copy(...)`: a "make a near-duplicate with some fields changed"
//               helper (used by the platform layer and tests).
//             - `componentN()`: destructuring support (`val (a, b) = session`).
//           Each constructor parameter prefixed with `val` (every one here) is BOTH
//           a constructor argument AND a public read-only property — declaring the
//           parameter declares the field, in one stroke. The `= ...` after each
//           type is that parameter's DEFAULT, used when a caller omits it.
//           Siblings the reader might expect instead of `data class`: a plain
//           `class` (no auto-generated `equals`/`copy`; you write them by hand), or
//           an `object` (a singleton). We want `data class` precisely for the
//           value-equality and `copy()`.
// Why:      One serializable-shaped record describing "where the user left off",
//           with cheap value-equality (used in tests) and a `copy()` for building a
//           tweaked session without mutating the old one.
//
// In TS you'd write (pseudocode):
// ```ts
// interface Session {
//   selected: string | null;
//   positionSecs: number;
//   volume: number;
//   shuffle: ShuffleMode;
//   repeatTrack: boolean;
// }
// function makeSession(p: Partial<Session> = {}): Session {
//   return {
//     selected: p.selected ?? null,
//     positionSecs: p.positionSecs ?? 0,
//     volume: p.volume ?? 1,
//     shuffle: p.shuffle ?? ShuffleMode.OFF,
//     repeatTrack: p.repeatTrack ?? false,
//   };
// }
// ```
/**
 * Defines session type for this music-player component; the TypeScript-oriented notes above explain its role.
 */
data class Session(
    // What:     `val selected: String? = null`. A read-only property holding the
    //           identity of the selected track, OR `null`.
    //           - `val` = read-only (cannot be reassigned), the opposite of `var`.
    //           - `: String?` is the type. `String` is an immutable text value; the
    //             trailing `?` makes it NULLABLE, so the field is either a `String`
    //             or `null`. Sibling the reader might expect: a non-nullable
    //             `String` (cannot represent "nothing selected"). We need the `?`
    //             precisely so "no track selected" is representable, mirroring the
    //             desktop twin's `Option<PathBuf>`.
    //           - `= null` is the DEFAULT: nothing selected, matching the desktop's
    //             `None`.
    //           On Android the string is a content URI (SAF document URI or
    //           MediaStore item URI); the model does not interpret it, it only
    //           stores and returns it so the platform layer can re-find the track
    //           after a rescan.
    // Why:      Restore the selected track by stable identity after re-scanning the
    //           source; `null` when nothing was selected.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // selected: string | null; // default null
    // ```
    val selected: String? = null,
    // What:     `val positionSecs: Double = 0.0`. A read-only property: the saved
    //           playback position of the selected track, in seconds.
    //           - `: Double` is the type. `Double` is a 64-bit IEEE-754 floating
    //             point number (about 15 to 17 significant decimal digits). The
    //             sibling the reader might expect is `Float` (32-bit, ~7 digits —
    //             which IS used for `volume` two lines down). We pick `Double` for
    //             the position because seconds-into-a-track wants the extra
    //             precision (a long track plus sub-second seek accuracy), exactly
    //             the reasoning the desktop port used to pick `f64` here.
    //           - `= 0.0` is the DEFAULT: start of the track. The `.0` makes the
    //             literal a floating-point `Double`, not an `Int`.
    // Why:      Resume the selected track where it left off; default `0.0` is "start".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // positionSecs: number; // default 0
    // ```
    val positionSecs: Double = 0.0,
    // What:     `val volume: Float = 1.0f`. A read-only property: the saved gain in
    //           the range 0.0..=1.0.
    //           - `: Float` is the type. `Float` is a 32-bit IEEE-754 floating point
    //             number (~7 significant digits). The sibling the reader might
    //             expect is `Double` (64-bit, used by `positionSecs` just above). We
    //             pick the narrower `Float` here because volume is a coarse 0..1 gain
    //             that the audio path itself stores as 32-bit; matching that type
    //             avoids needless widen/narrow conversions, exactly as the desktop
    //             port chose `f32` for the same field.
    //           - `= 1.0f` is the DEFAULT: FULL volume. The `f` SUFFIX is
    //             load-bearing: `1.0` alone is a `Double` literal and would NOT fit a
    //             `Float` field, so `1.0f` explicitly types the literal as a 32-bit
    //             `Float`.
    // Why:      Restore the user's last volume; default `1.0f` is "full gain".
    // Gotcha:   The `f` in `1.0f` is NOT a TS thing. In TS you would write plain `1`.
    //           Forgetting the `f` in Kotlin is a compile error here, not a no-op.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // volume: number; // default 1
    // ```
    val volume: Float = 1.0f,
    // What:     `val shuffle: ShuffleMode = ShuffleMode.OFF`. A read-only property:
    //           the saved shuffle mode.
    //           - `: ShuffleMode` is the type — the three-state enum (`OFF`,
    //             `WITHIN_PAGE`, `ALL`) declared in the sibling `ShuffleMode.kt`. It
    //             is visible here without an `import` because it lives in this same
    //             `core` package. Sibling shapes the reader might expect instead of
    //             an `enum class`: a plain string union, or a sealed class; the
    //             desktop persists these as serde variant strings, and the Kotlin
    //             side keeps an idiomatic enum (the platform store maps it to a
    //             string via the enum's `.name`).
    //           - `= ShuffleMode.OFF` is the DEFAULT. `ShuffleMode.OFF` is ENUM
    //             MEMBER ACCESS: it names one specific constant of the `ShuffleMode`
    //             enum (the `EnumName.MEMBER` form), here the "no shuffle" mode that
    //             matches the desktop default `ShuffleMode::Off`.
    // Why:      Restore the user's shuffle choice; default `OFF` is "not shuffling".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // shuffle: ShuffleMode; // default ShuffleMode.OFF
    // ```
    val shuffle: ShuffleMode = ShuffleMode.OFF,
    // What:     `val repeatTrack: Boolean = false`. A read-only property: whether
    //           "repeat track" was enabled.
    //           - `: Boolean` is Kotlin's true/false type; it maps cleanly onto TS
    //             `boolean` (no sibling-type subtlety here).
    //           - `= false` is the DEFAULT: repeat off, matching the desktop default.
    // Why:      Restore the repeat-track flag; default `false` is "do not repeat".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // repeatTrack: boolean; // default false
    // ```
    val repeatTrack: Boolean = false,
)
