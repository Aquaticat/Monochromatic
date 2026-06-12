package dev.monochromatic.musicplayer.core

/**
 * Pure assembly of a folder-relative display path from provider-supplied name components. A
 * Storage Access Framework tree is walked one directory at a time, and each step appends a child's
 * `DISPLAY_NAME` to the running folder prefix. Those names come from a `DocumentsProvider`, not a
 * real filesystem, so a single name can legally contain the separator [SEPARATOR], newlines, or
 * other control characters. This module is the single boundary where such a name is turned into one
 * path segment, so the assembled path's separator count faithfully reflects directory depth (which
 * the pagination layer keys folders on) and the result is safe to show on a single-line
 * notification or lockscreen title.
 *
 * The playable URI is built from opaque document IDs, never from this path, so a name carrying
 * `..` or a separator cannot escape the chosen tree; the clamping here protects the pure
 * path-grammar invariants (depth, single-line display), not file access.
 */

private const val SEPARATOR: Char = '/'

/**
 * Stand-in for a literal [SEPARATOR] that appears inside a single name component (U+2215 DIVISION
 * SLASH). Substituting a visually similar non-separator keeps the name readable while guaranteeing
 * the component contributes zero real separators, so depth accounting stays correct.
 */
private const val SEPARATOR_REPLACEMENT: Char = '∕'

/**
 * Replacement for any control character in a name (a single space). A newline or carriage return in
 * a title would break single-line rendering and split the visible path, so each control character
 * collapses to a space.
 */
private const val CONTROL_REPLACEMENT: Char = ' '

/**
 * Reduce one provider-supplied name to a single safe path segment: every literal [SEPARATOR] becomes
 * [SEPARATOR_REPLACEMENT] so the segment cannot widen the path's depth, and every control character
 * becomes [CONTROL_REPLACEMENT] so it cannot break single-line display. All other characters,
 * including `..`, pass through unchanged: `..` is harmless because no path here is ever resolved
 * against a filesystem (the playable URI comes from a document ID).
 *
 * @param name Raw `DISPLAY_NAME` of one document, which may contain a separator or control character.
 * @return Same text with separators and control characters neutralized, otherwise unchanged.
 */
fun sanitizeComponent(name: String): String =
    name
        .map { character ->
            when {
                character == SEPARATOR -> SEPARATOR_REPLACEMENT
                character.isISOControl() -> CONTROL_REPLACEMENT
                else -> character
            }
        }
        .joinToString(separator = "")

/**
 * Append a child [name] to the running folder [prefix], sanitizing the name first so the join adds
 * exactly one path level. The [prefix] is already the output of earlier joins (already sanitized),
 * so only [name] needs neutralizing here. A file sitting directly in the chosen tree root has an
 * empty [prefix] and yields a bare segment with no separator, an input the device-wide MediaStore
 * source never produces.
 *
 * @param prefix Already-sanitized folder path of the parent, empty for the chosen tree root.
 * @param name Raw `DISPLAY_NAME` of the child to append.
 * @return `<prefix>/<sanitized-name>`, or just the sanitized name when [prefix] is empty.
 */
fun joinDisplayPath(prefix: String, name: String): String {
    val segment = sanitizeComponent(name)
    return if (prefix.isEmpty()) segment else "$prefix$SEPARATOR$segment"
}
