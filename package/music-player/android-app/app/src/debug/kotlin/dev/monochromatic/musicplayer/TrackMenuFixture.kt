//region Closed authored menu inputs and identities, no file or playback operations
// What: Package connects the isolated menu host and shared debug track records.
// Why: Fixture values cannot accidentally become production controller calls.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

/**
 * What: A data class supplies immutable val fields, value equality and record copying.
 * String identifies authored actions; Int identifies an ordered group, unlike fractional Double.
 * Why: The accepted action list has stable identities separate from its visible text.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type TrackMenuAction = Readonly<{ id: string; label: string; group: number; destructive: boolean }>;
 * ```
 */
internal data class TrackMenuAction(
    /** Stable debug intent name, never an executable command. */
    val id: String,
    /** Accepted D7 action wording. */
    val label: String,
    /** Group position owns divider placement. */
    val group: Int,
    /** Destructive meaning receives both wording and an error role. */
    val destructive: Boolean = false,
)

/**
 * What: A read-only List is created with listOf rather than mutable collection operations.
 * Why: Preserve the seven enumerated D7 actions without inventing an eighth action from its caption.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const trackMenuActions: readonly TrackMenuAction[] = [
 *   { id: 'play', label: 'Play', group: 0, destructive: false },
 *   // Remaining accepted actions in their existing groups.
 * ];
 * ```
 */
internal val trackMenuActions: List<TrackMenuAction> = listOf(
    TrackMenuAction("play", "Play", 0),
    TrackMenuAction("shuffle-here", "Start shuffle from here", 0),
    TrackMenuAction("details", "File details", 1),
    TrackMenuAction("analyse", "Re-analyse true peak", 1),
    TrackMenuAction("show", "Show in file manager", 2),
    TrackMenuAction("copy-name", "Copy filename", 2),
    TrackMenuAction("trash", "Move to trash", 2, destructive = true),
)

/**
 * What: A second record stores the source index and the exact authored row object.
 * Why: Equal displayed names must not collapse distinct targets into a filename-based identity.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type TrackMenuTarget = Readonly<{ sourceIndex: number; track: PrototypeTrack }>;
 * ```
 */
internal data class TrackMenuTarget(
    /** Position in this fixed fixture, not a live library identifier. */
    val sourceIndex: Int,
    /** Actual row data captured when the menu opens. */
    val track: PrototypeTrack,
)

/**
 * What: A named function checks an Int index before constructing the target record.
 * Why: An invalid authored row cannot silently select another track or a fallback.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function trackMenuTarget(input: { index: number; tracks: readonly PrototypeTrack[] }): TrackMenuTarget;
 * ```
 */
internal fun trackMenuTarget(index: Int, tracks: List<PrototypeTrack>): TrackMenuTarget {
    if (index < 0 || index >= tracks.size) throw IllegalArgumentException("Unknown authored menu row: $index")
    return TrackMenuTarget(sourceIndex = index, track = tracks[index])
}

/**
 * What: An explicit loop returns a known record or throws IllegalArgumentException.
 * Why: Debug intent identity is closed to the accepted action set, not an arbitrary callback name.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function trackMenuAction(id: string): TrackMenuAction { /* exact lookup or throw */ }
 * ```
 */
internal fun trackMenuAction(id: String): TrackMenuAction {
    for (action in trackMenuActions) {
        if (action.id == id) return action
    }
    throw IllegalArgumentException("Unknown authored menu action: $id")
}

/**
 * What: A named function returns an immutable list for one explicitly named scene.
 * Why: Long-name fit and duplicate-name identity are authored controls, not template presets.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function trackMenuTracks(scene: string): readonly PrototypeTrack[];
 * ```
 */
internal fun trackMenuTracks(scene: String): List<PrototypeTrack> {
    if (scene == "ordinary" || scene == "lower") return prototypePlayerTracks
    if (scene != "long-name" && scene != "duplicate") throw IllegalArgumentException("Unknown track-menu scene: $scene")
    // What: mapIndexed invokes a lambda with each source index and record; copy returns a new record.
    // Why: The displayed row and menu heading share stress data without mutating the accepted defaults.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return prototypePlayerTracks.map((track, index) => replaceFixtureTitle({ scene, index, track }));
    // ```
    return prototypePlayerTracks.mapIndexed { index, track ->
        if (scene == "long-name" && index == 1) {
            // Return the copied stress record from this lambda, like return in a TS arrow body.
            track.copy(title = "Burning Aquamarine · \"Night / Dawn\" [study] 日本語 extended instrumental arrangement with a separately authored ending")
        } else if (scene == "duplicate" && (index == 1 || index == 2)) {
            // Matching labels retain their original distinct index, duration and peak.
            track.copy(title = "Signal [authored duplicate]")
        } else {
            // Kotlin's final expression is the lambda's return value.
            track
        }
    }
}
//endregion
