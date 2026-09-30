// What: Keep this debug-only comparison in the same namespace as the selected Search study.
// Why: Inner and cover can consume identical illustrative result data without a real index.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module location supplies the namespace.
// ```
package dev.monochromatic.musicplayer

/** What: One synthetic Search hit has a title, disambiguating detail and folder/track kind.
 *  Why: Capturing order variants should not manufacture real search or playback behavior.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type SearchRankingHit = { title: string; detail: string; kind: 'Folder' | 'Track' };
 * ```
 */
internal data class SearchRankingHit(val title: String, val detail: String, val kind: String)

/** What: Return fixed result rows for three independent ordering studies.
 *  Why: Exact, prefix, contained-title and parent-only examples expose ranking tradeoffs.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function searchRankingHits(variant: string, includeParent: boolean): SearchRankingHit[];
 * ```
 */
internal fun searchRankingHits(variant: String, includeParent: Boolean): List<SearchRankingHit> {
    // The shared registry routes every comparison scene without selecting matching or changing row geometry.
    if (filenameComparisonScenes.contains(variant)) return filenameComparisonHits(variant)
    // Filename scenes vary only literal fixture data, never production matching or selected row geometry.
    if (variant == "rankfileshort" || variant == "rankfilelong" || variant == "rankfileedge" ||
        variant == "rankfilecontext" || variant == "rankfilestem" || variant == "rankfileordinary") {
        return searchFilenameHits(variant)
    }
    // What: These record constructors make synthetic folders and track filenames explicit.
    // Why: Parent context distinguishes duplicate titles without relying on metadata tags.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const folderCamellia = { title: 'Camellia', detail: 'Folder · opens this folder', kind: 'Folder' };
    // ```
    val folderCamellia = SearchRankingHit("Camellia", "Folder · opens this folder", "Folder")
    val folderCamera = SearchRankingHit("Camera Obscura", "Folder · opens this folder", "Folder")
    val trackExact = SearchRankingHit("Cam", "Track · Cult of Luna · exact filename", "Track")
    val trackCamellia = SearchRankingHit("Camellia Waltz", "Track · Camellia · prefix filename", "Track")
    val trackCult = SearchRankingHit("Camellia Waltz", "Track · Cult of Luna · same filename", "Track")
    val trackContained = SearchRankingHit("Live at Camellia", "Track · Cult of Luna · contained filename", "Track")
    val parentOnly = SearchRankingHit("Another Xronixle", "Track · Camellia · parent-only match", "Track")
    val trackHits = if (includeParent) {
        listOf(trackExact, trackCamellia, trackCult, trackContained, parentOnly)
    } else {
        listOf(trackExact, trackCamellia, trackCult, trackContained)
    }
    if (variant == "rankfolders") {
        return listOf(folderCamellia, folderCamera) + trackHits
    }
    if (variant == "ranktracks") {
        return trackHits + listOf(folderCamellia, folderCamera)
    }
    if (variant != "rankmixed") {
        throw IllegalArgumentException("Unknown Search ranking fixture: $variant")
    }
    // Interleave types by the named match: exact filename, prefix name, contained title, then parent-only.
    val direct = listOf(trackExact, folderCamellia, trackCamellia, trackCult, folderCamera, trackContained)
    return if (includeParent) direct + parentOnly else direct
}

/**
 * What: Return direct-name result rows with or without middle-of-word `cam` examples.
 * Why: A native cover/inner comparison can keep D60 and D61 constant while exposing one undecided word boundary.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function searchBoundaryHits(allowInterior: boolean): readonly SearchRankingHit[] {
 *   const accepted = [camTrack, camelliaFolder, liveAtCamelliaTrack];
 *   return allowInterior ? [...accepted, scamperTrack, dreamcamTrack] : accepted;
 * }
 * ```
 */
internal fun searchBoundaryHits(allowInterior: Boolean): List<SearchRankingHit> {
    // What: These fixed rows demonstrate accepted exact, prefix and later-word matches.
    // Why: Both comparisons must contain the already settled `cam` results in the same mixed order.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const accepted = [camTrack, camelliaFolder, liveAtCamelliaTrack];
    // ```
    val accepted = listOf(
        SearchRankingHit("Cam", "Track · Cult of Luna · exact filename", "Track"),
        SearchRankingHit("Camellia", "Folder · opens this folder", "Folder"),
        SearchRankingHit("Live at Camellia", "Track · Cult of Luna · later word", "Track"),
    )
    if (!allowInterior) return accepted
    // What: `+` appends one direct folder and one direct track with interior `cam`.
    // Why: Identical accepted controls make membership easy to compare; appended placement is not a ranking rule.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return [...accepted, scamperTrack, dreamcamTrack];
    // ```
    return accepted + listOf(
        SearchRankingHit("Scamper", "Folder · own-name middle of word", "Folder"),
        SearchRankingHit("Dreamcam", "Track · Cult of Luna · end of word", "Track"),
    )
}
