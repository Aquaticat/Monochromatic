// What: Use the shared debug-only Search namespace.
// Why: Presentation alternatives reuse selected native row geometry without a matcher.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from its source path.
// ```
package dev.monochromatic.musicplayer

/**
 * What: List<String> is read-only ordered text, rather than MutableList or fixed Array.
 * Why: One scene registry serves both native hosts and the shared fixture entry point.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const filenameComparisonScenes: readonly string[] = [/* authored scene names */];
 * ```
 */
internal val filenameComparisonScenes: List<String> = listOf(
    "rankfileplacementfull", "rankfileplacementsupport",
    "rankfileliteralfull", "rankfileliteralsupport",
    "rankfilevisibilityfull", "rankfilevisibilityconditional",
    "rankfilevisibilitysupportfull", "rankfilevisibilitysupportconditional",
)

/**
 * What: Declare a function returning a scene name or the explicit empty-string sentinel.
 * Why: Both hosts can keep their existing scene fallback when no comparison marker is present.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function filenameComparisonSceneOrEmpty(candidate: string): string;
 * ```
 */
internal fun filenameComparisonSceneOrEmpty(candidate: String): String {
    // What: A for loop visits each element, not a numeric range or recursive walk.
    // Why: Resolve only registered, delimited study markers without parsing filenames.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const scene of filenameComparisonScenes) {
    //   if (candidate.includes(`-${scene}-`) || candidate.endsWith(`-${scene}`)) return scene;
    // }
    // ```
    for (scene in filenameComparisonScenes) {
        // The cover delegate puts a dark scene at the end; light scenes have a following marker.
        if (candidate.contains("-$scene-") || candidate.endsWith("-$scene")) return scene
    }
    return ""
}

/**
 * What: Declare a one-request function returning the existing immutable Search hit record.
 * Why: Move or omit only explicitly authored suffix pieces while preserving kind/context/action.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function filenameComparisonHit(request: FilenameComparisonPresentation): SearchRankingHit;
 * ```
 */
internal fun filenameComparisonHit(request: FilenameComparisonPresentation): SearchRankingHit {
    // What: Bind the immutable record to a named local rather than modify it in place.
    // Why: All identity pieces remain available for exact comparison assertions.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const item = request.item;
    // ```
    val item: FilenameComparisonItem = request.item
    // What: Boolean is a two-valued flag, not an integer code or nullable Boolean.
    // Why: Visibility comes from authored scope knowledge, not an inferred collision calculation.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const suffixVisible = !request.conditionalVisibility || item.suffixCueRequired;
    // ```
    val suffixVisible: Boolean = !request.conditionalVisibility || item.suffixCueRequired
    // What: String is immutable text, rather than mutable CharArray or broader CharSequence.
    // Why: Branch assignment produces a single literal title without mutating the fixture.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let title: string;
    // ```
    val title: String
    // The support line is another immutable text value assigned by the same presentation branch.
    val detail: String
    if (request.suffixInSupport && suffixVisible && item.literalSuffix.length > 0) {
        title = item.stem
        // What: Dollar interpolation inserts values into literal text; it does not parse a filename.
        // Why: The exact dot and original suffix case remain visible beside kind and useful parent.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // detail = `${item.kind} · ${item.literalSuffix} · ${item.parent} · ${item.action}`;
        // ```
        detail = "${item.kind} · ${item.literalSuffix} · ${item.parent} · ${item.action}"
    } else {
        if (suffixVisible) title = item.stem + item.literalSuffix else title = item.stem
        // Preserve the same supporting identity and action text when placement is unchanged.
        detail = "${item.kind} · ${item.parent} · ${item.action}"
    }
    // What: Construct the existing hit record, rather than a native file or matching result.
    // Why: The selected Search row renderer receives unchanged kind and explanatory context.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { title, detail, kind: item.kind };
    // ```
    return SearchRankingHit(title, detail, item.kind)
}

/**
 * What: Declare a fixture entry returning read-only result records for a registered scene.
 * Why: Presentation mode is bounded and failures cannot silently select a different option.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function filenameComparisonHits(scene: string): readonly SearchRankingHit[];
 * ```
 */
internal fun filenameComparisonHits(scene: String): List<SearchRankingHit> {
    // Read-only item collection is assigned once from the independently authored corpus.
    val items: List<FilenameComparisonItem>
    if (scene == "rankfileplacementfull" || scene == "rankfileplacementsupport") {
        items = filenamePlacementLongItems()
    } else if (scene == "rankfileliteralfull" || scene == "rankfileliteralsupport") {
        items = filenamePlacementLiteralItems()
    } else if (scene == "rankfilevisibilityfull" || scene == "rankfilevisibilityconditional"
        || scene == "rankfilevisibilitysupportfull" || scene == "rankfilevisibilitysupportconditional") {
        items = filenameVisibilityAuthoredScope()
    } else {
        throw IllegalArgumentException("Unknown filename comparison fixture: $scene")
    }
    // Read-only boolean flags vary placement and visibility in separate scene pairs.
    val suffixInSupport: Boolean = scene == "rankfileplacementsupport" || scene == "rankfileliteralsupport"
        || scene == "rankfilevisibilitysupportfull" || scene == "rankfilevisibilitysupportconditional"
    // This flag acts only on explicit fixture eligibility, never actual inventory or matcher output.
    val conditionalVisibility: Boolean = scene == "rankfilevisibilityconditional"
        || scene == "rankfilevisibilitysupportconditional"
    // What: ArrayList is an owned mutable builder, unlike the read-only List returned to consumers.
    // Why: Build one linear result list while preserving authored order and subset membership.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const hits: SearchRankingHit[] = [];
    // ```
    val hits: ArrayList<SearchRankingHit> = ArrayList<SearchRankingHit>()
    // Reuse element iteration for the fixed fixture scope.
    for (item in items) {
        if (!item.displayed) continue
        // What: Construct the immutable request before formatting rather than pass positional mode flags.
        // Why: Keep independent presentation controls explicit at the boundary.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const request = { item, suffixInSupport, conditionalVisibility };
        // ```
        val request: FilenameComparisonPresentation = FilenameComparisonPresentation(item, suffixInSupport, conditionalVisibility)
        hits.add(filenameComparisonHit(request))
    }
    return hits
}
