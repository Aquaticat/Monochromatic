// What: Share the debug Search fixture namespace, not a production parser package.
// Why: Native studies consume authored filename pieces without indexing files.
//
// In TS you'd write (pseudocode):
// ```ts
// // The source path supplies module identity.
// ```
package dev.monochromatic.musicplayer

/**
 * What: A data class is an immutable record, unlike a mutable container or identity-only class.
 * Why: Each suffix and scope flag is authored explicitly, not discovered by an algorithm.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type FilenameComparisonItem = { readonly stem: string; readonly literalSuffix: string;
 *   readonly kind: string; readonly parent: string; readonly action: string;
 *   readonly displayed: boolean; readonly suffixCueRequired: boolean };
 * ```
 */
internal data class FilenameComparisonItem(
    /**
     * What: String stores immutable text, rather than mutable CharArray or broader CharSequence.
     * Why: Retain the authored name exactly while presentation varies only its known literal suffix.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * readonly stem: string;
     * ```
     */
    val stem: String,
    /** Exact authored suffix including its dot and original case; empty means no split is proposed. */
    val literalSuffix: String,
    /** Authored Track or Folder kind, independent of dots and suffix content. */
    val kind: String,
    /** Useful parent identity retained unchanged between the compared presentations. */
    val parent: String,
    /** Authored Play or Open meaning; no activation is wired by these fixtures. */
    val action: String,
    /**
     * What: Boolean is a true/false flag, not an integer mode or nullable Boolean.
     * Why: Explicit subset membership avoids claiming the fixture performs query evaluation.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * readonly displayed: boolean;
     * ```
     */
    val displayed: Boolean,
    /** Whether the authored scope requires its visible suffix cue, even with a non-displayed partner. */
    val suffixCueRequired: Boolean,
)

/**
 * What: Another immutable data class groups one item with independent display modes.
 * Why: One request value avoids positional mode booleans at the formatting boundary.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type FilenameComparisonPresentation = { readonly item: FilenameComparisonItem;
 *   readonly suffixInSupport: boolean; readonly conditionalVisibility: boolean };
 * ```
 */
internal data class FilenameComparisonPresentation(
    /** Authored complete identity and explanatory context. */
    val item: FilenameComparisonItem,
    /** Placement comparison only: retain the exact suffix in support rather than title. */
    val suffixInSupport: Boolean,
    /** Visibility comparison only: omit suffixes for explicitly authored eligible items. */
    val conditionalVisibility: Boolean,
)
