// File summary (for a TypeScript-only reader):
//
// This file declares ONE type, `FinishLoadResult`, a two-state tag returned by
// `PlayerController.finishLoad` to tell the caller WHICH path the end of a
// streaming cold-start load took. The streaming load lets the list become
// interactive while it is still filling in, so when the scan finally finishes
// there are two possibilities, and the service must persist differently for
// each:
//   - RestoredSavedSession ......... the user did NOT tap anything during the
//                                    load, so `finishLoad` reselected the saved
//                                    track at its saved position. The service
//                                    must NOT save immediately here, because the
//                                    engine has not applied the async seek yet
//                                    and would write position 0 over the real
//                                    saved position.
//   - KeptUserSelectionDuringLoad .. the user DID tap a track mid-load, so
//                                    `finishLoad` kept that choice and only
//                                    adopted the full list. The service SHOULD
//                                    save immediately, because that track has
//                                    been playing for seconds and its position
//                                    is already real.
//
// Returning a tag (rather than a boolean) keeps the two intentions named at the
// call site, so the service's "save now vs do not save now" branch reads as the
// real reason instead of a bare `if (kept)`.

// What:     `package dev.monochromatic.musicplayer` declares which package
//           (Kotlin's namespace, mirroring the folder path) this file belongs
//           to. The enum becomes reachable elsewhere as
//           `dev.monochromatic.musicplayer.FinishLoadResult`.
// Why:      So `PlayerController` (returns it) and `PlaybackService` (branches on
//           it) can both name the type; they live in this same package.
//
// In TS you'd write (pseudocode):
// ```ts
// // No `package` line in TS; the file path is the module identity:
// //   import { FinishLoadResult } from "./FinishLoadResult";
// ```
package dev.monochromatic.musicplayer

// What:     `enum class FinishLoadResult { ... }` declares an "enum class": a type
//           whose value must be exactly ONE of a fixed, named list of constants
//           (here two). Each constant is a fieldless tag carrying no extra data.
//           Siblings a TS reader cannot know exist, and why we did NOT pick them:
//             - `sealed class`/`sealed interface`: would let each variant carry
//               its own payload; we need only two plain tags, so that is overkill.
//             - a bare `Boolean`: would work mechanically, but `true`/`false`
//               carry no meaning at the call site, whereas a named tag does.
// Why:      `finishLoad` must report which terminal path it took so the service
//           persists correctly (save now only on the kept-tap path), and a named
//           two-value type makes that branch self-documenting and exhaustive.
// Gotcha:   `enum class` is PUBLIC by default in Kotlin (no modifier means
//           `public`); a TS reader should not read the absence of `export` as
//           file-private. It is visible to the whole module.
//
// In TS you'd write (pseudocode):
// ```ts
// export type FinishLoadResult = "RestoredSavedSession" | "KeptUserSelectionDuringLoad";
// ```
/**
 * Defines finish load result type for this music-player component; the TypeScript-oriented notes above explain
 * its role.
 */
enum class FinishLoadResult {
    // What:     `RestoredSavedSession` is the first enum constant (a fieldless tag
    //           of type `FinishLoadResult`). The trailing comma separates it from
    //           the next constant.
    // Why:      Marks the no-tap path: `finishLoad` reselected the saved track and
    //           seeked to the saved position. The service must NOT save on this
    //           path, so the not-yet-applied seek cannot overwrite the stored
    //           position with zero.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // "RestoredSavedSession"
    // ```
    /**
     * Defines restored saved session case for this music-player state; the TypeScript-oriented notes above
     * explain when it is selected.
     */
    RestoredSavedSession,

    // What:     `KeptUserSelectionDuringLoad` is the second and final enum constant
    //           (a fieldless tag of type `FinishLoadResult`). Kotlin permits the
    //           trailing comma after the last constant; it is legal syntax, not an
    //           extra member.
    // Why:      Marks the mid-load-tap path: `finishLoad` kept the user's tapped
    //           track and only adopted the full list. The service SHOULD save
    //           immediately, since that track's position is already real.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // "KeptUserSelectionDuringLoad"
    // ```
    /**
     * Defines kept user selection during load case for this music-player state; the TypeScript-oriented notes
     * above explain when it is selected.
     */
    KeptUserSelectionDuringLoad,
}
