// What: This namespace shares the existing debug-only Search result model.
// Why: Filename witnesses stay outside the production source set.
//
// In TS you'd write (pseudocode):
// ```ts
// // The module path supplies the namespace.
// ```
package dev.monochromatic.musicplayer

/**
 * What: Return literal filename-backed examples for one keyboard-closed scene.
 * Why: Observe suffix visibility without implementing a parser, matcher or activation.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function searchFilenameHits(variant: string): readonly SearchRankingHit[];
 * ```
 */
internal fun searchFilenameHits(variant: String): List<SearchRankingHit> {
    // What: Kotlin's listOf creates a read-only List, rather than a mutable list or fixed array.
    // Why: Capture order must remain unchanged during this nonfunctional study.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (variant === 'rankfileshort') return [flacTrack, mp3Track, dottedFolder, rootTrack];
    // ```
    if (variant == "rankfileshort") {
        return listOf(
            // SearchRankingHit constructs an existing named result, not a real indexed file.
            SearchRankingHit("Cam.flac", "Track · Cult of Luna · Play", "Track"),
            SearchRankingHit("Cam.mp3", "Track · Cult of Luna · Play", "Track"),
            SearchRankingHit("Camellia.flac", "Folder · library root · Open", "Folder"),
            SearchRankingHit("Cam.opus", "Track · library root · Play", "Track"),
        )
    }
    // Reuse the immutable-list constructor for long equal stems in the same parent.
    if (variant == "rankfilelong") {
        return listOf(
            SearchRankingHit("Camellia Waltz (Live at Miraikan 2026, Extended Archive Version).flac",
                "Track · Cult of Luna / Live · Play", "Track"),
            SearchRankingHit("Camellia Waltz (Live at Miraikan 2026, Extended Archive Version).mp3",
                "Track · Cult of Luna / Live · Play", "Track"),
            SearchRankingHit("Camellia", "Folder · library root · Open", "Folder"),
        )
    }
    // These examples retain internal dots, uppercase suffixes, Unicode and an extensionless title literally.
    if (variant == "rankfileedge") {
        return listOf(
            SearchRankingHit("Cam.mix.2026.FLAC", "Track · library root · Play", "Track"),
            SearchRankingHit(".Cam.session.opus", "Track · Archive / Live · Play", "Track"),
            SearchRankingHit("かめりあ(Camellia) - Camellia Waltz.flac", "Track · Camellia · Play", "Track"),
            SearchRankingHit("Cam", "Track · library root · Play", "Track"),
        )
    }
    // What: IllegalArgumentException is a standard failure class whose text names the invalid scene.
    // Why: Never silently substitute a different filename witness.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // throw new Error(`Unknown filename presentation fixture: ${variant}`);
    // ```
    throw IllegalArgumentException("Unknown filename presentation fixture: $variant")
}
