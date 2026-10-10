// What:     `package dev.monochromatic.musicplayer.core` places the track menu actions beside the playback model.
// Why:      The action list is pure data that the menu, its tests, and later wiring can share without Compose.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer.core

// What:     `enum class TrackMenuAction` declares the seven actions of the track context menu in display order.
// Why:      Decision D7 accepts exactly these actions, and a closed enum keeps an extra action out of the menu.
//
// In TS you'd write (pseudocode):
// ```ts
// type TrackMenuAction = "play" | "shuffleFromHere" | "details" | "reanalyse"
//   | "showInFileManager" | "copyFilename" | "moveToTrash";
// ```
/** Closed set of track context menu actions, declared in the order decision D7 displays them. */
enum class TrackMenuAction(
    // What:     `val group: Int` names the divider section that an action belongs to.
    // Why:      Neighbours with equal groups share a section, and a change between neighbours starts a new one.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // group: number;
    // ```
    /** Divider section of the action; a change between neighbouring actions draws one divider. */
    val group: Int,
    // What:     `val destructive: Boolean` marks the one action that removes the file.
    // Why:      The menu shows destruction with a label and icon as well as the error role, never color alone.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // destructive: boolean;
    // ```
    /** True only for the action that removes the file from storage. */
    val destructive: Boolean = false,
) {
    // What:     `PLAY(group = 0)` is the first action, in the top section with shuffle.
    // Why:      D7 lists Play first, so playback of the track is the most direct action.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // play: { group: 0, destructive: false },
    // ```
    /** Starts playback of the track from its beginning. */
    PLAY(group = 0),

    // What:     `SHUFFLE_FROM_HERE(group = 0)` starts shuffled playback at the track.
    // Why:      D7 places shuffle in the same section as Play because both start playback.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // shuffleFromHere: { group: 0, destructive: false },
    // ```
    /** Starts shuffled playback beginning at the track. */
    SHUFFLE_FROM_HERE(group = 0),

    // What:     `DETAILS(group = 1)` opens the file information for the track.
    // Why:      D7 groups information with re-analysis, separate from playback and file-system actions.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // details: { group: 1, destructive: false },
    // ```
    /** Shows the file information for the track. */
    DETAILS(group = 1),

    // What:     `REANALYSE_TRUE_PEAK(group = 1)` repeats the true-peak analysis for the track.
    // Why:      Decision D12 keeps re-analysis as the only remaining entry point for analysis results.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // reanalyse: { group: 1, destructive: false },
    // ```
    /** Repeats the true-peak analysis of the track. */
    REANALYSE_TRUE_PEAK(group = 1),

    // What:     `SHOW_IN_FILE_MANAGER(group = 2)` reveals the file in the system file manager.
    // Why:      D7 places file-system actions together in the last section.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // showInFileManager: { group: 2, destructive: false },
    // ```
    /** Reveals the track file in the system file manager. */
    SHOW_IN_FILE_MANAGER(group = 2),

    // What:     `COPY_FILENAME(group = 2)` copies the file name of the track.
    // Why:      D7 places copying the name with the other file-system actions.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // copyFilename: { group: 2, destructive: false },
    // ```
    /** Copies the file name of the track to the clipboard. */
    COPY_FILENAME(group = 2),

    // What:     `MOVE_TO_TRASH(group = 2, destructive = true)` is the last action and the only destructive one.
    // Why:      D7 and D8 make this the destructive action; D8 deletes immediately and offers Undo instead of a dialog.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // moveToTrash: { group: 2, destructive: true },
    // ```
    /** Moves the track file to the trash, which the menu marks as destructive. */
    MOVE_TO_TRASH(group = 2, destructive = true),
}

// What:     `fun label(action: TrackMenuAction): String` returns the visible wording of one action.
// Why:      The wording is accepted D7 text, so it lives beside the action identities rather than in Compose code.
//
// In TS you'd write (pseudocode):
// ```ts
// function label(action: TrackMenuAction): string { /* exhaustive switch */ }
// ```
/** Returns the exact visible label of an action as accepted in decision D7. */
fun label(action: TrackMenuAction): String = when (action) {
    TrackMenuAction.PLAY -> "Play"
    TrackMenuAction.SHUFFLE_FROM_HERE -> "Start shuffle from here"
    TrackMenuAction.DETAILS -> "File details"
    TrackMenuAction.REANALYSE_TRUE_PEAK -> "Re-analyse true peak"
    TrackMenuAction.SHOW_IN_FILE_MANAGER -> "Show in file manager"
    TrackMenuAction.COPY_FILENAME -> "Copy filename"
    TrackMenuAction.MOVE_TO_TRASH -> "Move to trash"
}

// What:     `fun trackMenuActionsFor(): List<TrackMenuAction>` returns the ordered menu for any track.
// Why:      D7 and the accepted study show the same seven actions for every track, so no track state is needed.
//
// In TS you'd write (pseudocode):
// ```ts
// function trackMenuActionsFor(): readonly TrackMenuAction[] { return allActions; }
// ```
/** Returns the seven D7 actions in display order; decision D7 defines no current-track variant. */
fun trackMenuActionsFor(): List<TrackMenuAction> = TrackMenuAction.entries
