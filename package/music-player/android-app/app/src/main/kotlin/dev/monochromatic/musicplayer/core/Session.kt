// A session is the platform-independent value restored before Android scans its
// library. Android persists the library grant separately, so this record stores only
// selected-track identity, resume state, volume, and one playback mode.

// What:     `package ...core` places this pure value beside Queue and PlaybackMode.
// Why:      Host JVM tests can exercise the model without Android framework classes.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer.core

// What:     `data class Session(...)` is Kotlin's immutable value-record syntax.
//           It generates structural equality and a `copy` method from the declared
//           read-only properties.
// Why:      Restore and persistence code exchange one comparable snapshot without
//           retaining independent shuffle and repeat state.
//
// In TS you'd write (pseudocode):
// ```ts
// type Session = {
//   readonly selected: string | null;
//   readonly positionSecs: number;
//   readonly volume: number;
//   readonly playbackMode: PlaybackMode;
// };
// ```
/** Describes the Android playback state that survives process restarts. */
data class Session(
    // What:     `String?` is nullable text, unlike non-null `String`.
    // Why:      No selected track is a valid first-run and post-rescan state.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly selected: string | null;
    // ```
    /** Stable content URI text for the selected track, or null. */
    val selected: String? = null,

    // What:     `Double` is Kotlin's 64-bit floating type; `Float` is its 32-bit
    //           sibling.
    // Why:      Position keeps sub-second precision for long tracks, so it uses
    //           Double rather than Float.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly positionSecs: number;
    // ```
    /** Resume position in seconds. */
    val positionSecs: Double = 0.0,

    // What:     `Float` is Kotlin's 32-bit floating type; `Double` is its wider
    //           sibling.
    // Why:      Volume matches the 32-bit audio path and needs no Double precision.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly volume: number;
    // ```
    /** Output gain from zero to one. */
    val volume: Float = 1.0f,

    // What:     `PlaybackMode` is the closed four-state enum from the sibling file.
    // Why:      One value, rather than shuffle plus a boolean, makes exactly one
    //           playback behavior selected and persisted.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly playbackMode: PlaybackMode;
    // ```
    /** Selected behavior for completion and transport. */
    val playbackMode: PlaybackMode = PlaybackMode.IN_ORDER,
)
