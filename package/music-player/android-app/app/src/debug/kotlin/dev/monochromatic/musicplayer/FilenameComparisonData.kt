// What: Share the debug-only Search fixture namespace.
// Why: These records are authored labels, not source files or matching results.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from its source path.
// ```
package dev.monochromatic.musicplayer

/**
 * What: Declare a no-argument function returning read-only List, rather than MutableList or Array.
 * Why: Keep the already captured long pair's membership, order and context stable.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function filenamePlacementLongItems(): readonly FilenameComparisonItem[];
 * ```
 */
internal fun filenamePlacementLongItems(): List<FilenameComparisonItem> {
    // What: String is immutable text, not mutable CharArray or the broader CharSequence interface.
    // Why: Preserve the exact long stem as a fixed authored value between presentations.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const stem = 'Camellia Waltz (Live at Miraikan 2026, Extended Archive Version)';
    // ```
    val stem: String = "Camellia Waltz (Live at Miraikan 2026, Extended Archive Version)"
    // What: listOf creates an ordered read-only List instead of an owned mutable builder.
    // Why: The formatting study must not change result order or membership.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return [flacItem, mp3Item, literalFolder];
    // ```
    return listOf(
        // What: Construct the immutable record with literal pieces, not a filename parser's output.
        // Why: Both alternatives retain the same exact suffix and parent identity.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // { stem, literalSuffix: '.flac', kind: 'Track', parent: 'Cult of Luna / Live',
        //   action: 'Play', displayed: true, suffixCueRequired: true }
        // ```
        FilenameComparisonItem(stem, ".flac", "Track", "Cult of Luna / Live", "Play", true, true),
        // The paired record changes only its known literal suffix.
        FilenameComparisonItem(stem, ".mp3", "Track", "Cult of Luna / Live", "Play", true, true),
        // A folder has no proposed suffix split even when other folder fixtures contain dots.
        FilenameComparisonItem("Camellia", "", "Folder", "library root", "Open", true, true),
    )
}

/**
 * What: Declare another no-argument function returning the same read-only item collection.
 * Why: Check ancestor distinction, literal dots/case/Unicode and extensionless names separately from long wrapping.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function filenamePlacementLiteralItems(): readonly FilenameComparisonItem[];
 * ```
 */
internal fun filenamePlacementLiteralItems(): List<FilenameComparisonItem> {
    // Keep the complete literal corpus immutable and ordered.
    return listOf(
        // Equal complete filenames retain ancestor identity independently of suffix placement.
        FilenameComparisonItem("Cam", ".flac", "Track", "Collection A / Live", "Play", true, true),
        // The second equal name changes its ancestor, not its suffix or kind.
        FilenameComparisonItem("Cam", ".flac", "Track", "Collection B / Live", "Play", true, true),
        // The folder's dot and apparent suffix belong to its indivisible literal folder name.
        FilenameComparisonItem("Camellia.flac", "", "Folder", "library root", "Open", true, true),
        // Preserve internal dots and uppercase literal suffix without format inference.
        FilenameComparisonItem("Cam.mix.2026", ".FLAC", "Track", "library root", "Play", true, true),
        // Preserve the leading dot and exact authored suffix.
        FilenameComparisonItem(".Cam.session", ".opus", "Track", "Archive / Live", "Play", true, true),
        // Preserve the Unicode and parenthesized name instead of normalizing it.
        FilenameComparisonItem("かめりあ(Camellia) - Camellia Waltz", ".flac", "Track", "Camellia", "Play", true, true),
        // An extensionless name has no suffix to invent, hide or relocate.
        FilenameComparisonItem("Cam", "", "Track", "library root", "Play", true, true),
    )
}

/**
 * What: Return an explicitly authored scope including a non-displayed item.
 * Why: A displayed subset cannot by itself establish that a suffix is safe to omit.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function filenameVisibilityAuthoredScope(): readonly FilenameComparisonItem[];
 * ```
 */
internal fun filenameVisibilityAuthoredScope(): List<FilenameComparisonItem> {
    // This fixed scope is not a matcher, collision detector or live inventory assessment.
    return listOf(
        // Explicitly unambiguous authored name: omission is a usable candidate in this known scope only.
        FilenameComparisonItem("Cam Solo", ".opus", "Track", "Cult of Luna / Studio", "Play", true, false),
        // The same-parent suffix-distinct pair must retain its distinguishing cues.
        FilenameComparisonItem("Cam", ".flac", "Track", "Cult of Luna / Live", "Play", true, true),
        // The second visible partner makes the retained cue requirement apparent.
        FilenameComparisonItem("Cam", ".mp3", "Track", "Cult of Luna / Live", "Play", true, true),
        // This name keeps its cue despite its partner being outside the displayed subset.
        FilenameComparisonItem("Cam Outside", ".flac", "Track", "Archive / Live", "Play", true, true),
        // The non-displayed partner is scope evidence, not a claim about actual query membership.
        FilenameComparisonItem("Cam Outside", ".mp3", "Track", "Archive / Live", "Play", false, true),
        // Dotted folder identity remains literal in both visibility alternatives.
        FilenameComparisonItem("Camellia.flac", "", "Folder", "library root", "Open", true, true),
    )
}
