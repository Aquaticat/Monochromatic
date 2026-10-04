//region Authored short messages and measured line-fit boundary, never provider outcomes
// What: Package shares the isolated feedback host's namespace.
// Why: Native text measurement can choose concise copy without reaching storage or changing source scope.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

/**
 * What: A named function returns brief authored summary text for an exact scene.
 * Why: Details that exceed two lines go to diagnostics and the Android-log capture direction.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function lightFeedbackBriefMessage(scene: string): string { /* exact branches; unknown throws */ }
 * ```
 */
internal fun lightFeedbackBriefMessage(scene: String): String {
    if (scene == "missing") return "Track unavailable."
    if (scene == "combined") return "3 unavailable files."
    if (scene == "trash-failed") return "Ghost was not moved to trash."
    if (scene == "detail-heavy") return "Operation unavailable."
    if (scene == "undo") return "Ghost moved to trash"
    if (scene == "trash-pending") return ""
    throw IllegalArgumentException("Unknown brief feedback scene: $scene")
}

/**
 * What: A named function classifies measured line count and overflow, returning Boolean.
 * Why: The renderer never turns a longer message into a growing bar or silently clipped detail.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function lightFeedbackNeedsLogs(input: { lines: number; overflow: boolean }): boolean {
 *   if (input.lines < 1) throw new Error('Measured feedback must have a line');
 *   return input.lines > 2 || input.overflow;
 * }
 * ```
 */
internal fun lightFeedbackNeedsLogs(lines: Int, overflow: Boolean): Boolean {
    // What: Int is a signed whole-number count, unlike floating-point Float or wider Long.
    // Why: Native text layout reports line counts as Int; a nonpositive count is not valid message evidence.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (lines < 1) throw new Error('Measured feedback must have a line');
    // ```
    if (lines < 1) throw IllegalArgumentException("Measured feedback must have at least one line: $lines")
    return lines > 2 || overflow
}
//endregion
