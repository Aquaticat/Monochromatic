//region Shared authored track records, never production library identities
// What: Package joins the existing native debug renderers' namespace.
// Why: Both physical panels consume the same fixture data without copying row content.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

/**
 * What: A data class is a record with generated value equality and copy support.
 * Each val field is read-only; String holds immutable text rather than nullable String?.
 * Why: The menu receives the actual authored row data, not a guessed label or file handle.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type PrototypeTrack = Readonly<{ title: string; duration: string; peak: string }>;
 * ```
 */
internal data class PrototypeTrack(
    /** Authored title displayed by the shared player row. */
    val title: String,
    /** Authored duration, not an audio decode result. */
    val duration: String,
    /** Authored peak text, not an analysis result. */
    val peak: String,
)

/**
 * What: val binds a read-only List of records; listOf constructs the collection.
 * List is used instead of MutableList because the study never edits a live queue.
 * Why: Cover and inner renderers retain the exact accepted default rows and ordering.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const prototypePlayerTracks: readonly PrototypeTrack[] = [
 *   { title: 'Another Xronixle', duration: '4:35', peak: '−1.2 dBTP' },
 *   // Remaining authored rows retain the same order.
 * ];
 * ```
 */
internal val prototypePlayerTracks: List<PrototypeTrack> = listOf(
    PrototypeTrack("Another Xronixle", "4:35", "−1.2 dBTP"),
    PrototypeTrack("Burning Aquamarine", "5:12", "−0.8 dBTP"),
    PrototypeTrack("Dokuhebi", "4:01", "−1.4 dBTP"),
    PrototypeTrack("ENÛMA∇ELIŠ", "9:47", "−0.3 dBTP"),
    PrototypeTrack("Ghost", "3:22", "−1.1 dBTP"),
    PrototypeTrack("Hyperflux", "4:44", "−0.9 dBTP"),
    PrototypeTrack("Idol Corruption", "5:31", "−0.6 dBTP"),
    PrototypeTrack("KillerToy", "4:12", "−1.0 dBTP"),
    PrototypeTrack("Nacreous Snowmelt", "6:03", "−0.7 dBTP"),
)
//endregion
