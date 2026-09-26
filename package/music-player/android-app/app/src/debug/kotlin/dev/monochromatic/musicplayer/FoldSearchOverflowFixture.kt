// Debug-only synthetic search results, never a production library or ranking rule.
package dev.monochromatic.musicplayer

/**
 * What:     Long, spaced folder title used only to stress selected Search A row wrapping.
 * Why:      A folder name must wrap without crossing the Fold's informational crease.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const overflowFolderTitle = "Camellia's Archive of Live Sessions...";
 * ```
 */
internal const val overflowFolderTitle =
    "Camellia's Archive of Live Sessions, Alternate Masterings, Unreleased Rehearsals and Notes from the Entire Collection"

/**
 * What:     Unbroken track title used only to stress fallback wrapping and scrolling.
 * Why:      A filename-like result must not widen its right pane across the crease.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const overflowTrackTitle = "AnotherXronixleLive...";
 * ```
 */
internal const val overflowTrackTitle =
    "AnotherXronixleLiveAtTheNorthernObservatoryRecordedAcrossManyRoomsWithoutAnyBreaksOrSeparators" +
    "AnotherXronixleLiveAtTheNorthernObservatoryRecordedAcrossManyRoomsWithoutAnyBreaksOrSeparators"

/**
 * What:     Secondary result text is deliberately longer than the ordinary fixture label.
 * Why:      Wrapping must preserve the role cue and readable Search result context.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const overflowTrackDetail = "Track · Camellia's Archive... · reveals track";
 * ```
 */
internal const val overflowTrackDetail =
    "Track · Camellia's Archive of Live Sessions and Alternate Masterings · reveals track"
