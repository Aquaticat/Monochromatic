// What:     `package dev.monochromatic.musicplayer` declares the namespace this file's
//           declarations belong to.
// Why:      Keep `SweepTally` beside the sweep coordinator and outcome types.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword; the file path is the module.
// ```
package dev.monochromatic.musicplayer

// What:     `data class SweepTally(...)` declares an immutable record of how a
//           sweep went: the library size, how many items were visited, and the
//           count of each outcome. A Kotlin `data class` auto-derives
//           `equals`/`hashCode`/`copy`/`toString` from its properties.
// Why:      Both callers log these numbers, and the unit test asserts on them; a
//           typed record is clearer than returning a bare count.
//
// In TS you'd write (pseudocode):
// ```ts
// type SweepTally = {
//   total: number; processed: number; measured: number;
//   cached: number; unfingerprintable: number; failed: number;
// };
// ```
/**
 * Immutable result of a sweep: [total] is the full library size, [processed] how many items were
 * actually visited (bounded by `maxTracks`), and the rest are the per-[SweepOutcome] counts. The
 * TypeScript-oriented notes above explain the record shape.
 */
data class SweepTally(
    /** Full number of items handed in, before any `maxTracks` cap. */
    val total: Int,
    /** Items actually visited (each claimed and run through `process` exactly once). */
    val processed: Int,
    /** Items freshly decoded and memoized this run ([SweepOutcome.MEASURED]). */
    val measured: Int,
    /** Items already in the cache, so nothing was decoded ([SweepOutcome.CACHED]). */
    val cached: Int,
    /** Items with no derivable cache key, skipped ([SweepOutcome.UNFINGERPRINTABLE]). */
    val unfingerprintable: Int,
    /** Items whose decode threw and were left uncached ([SweepOutcome.FAILED]). */
    val failed: Int,
)
