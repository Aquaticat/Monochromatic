// The on-disk form of the duration cache: one line per track, keyed by the track's fingerprint.
// The fingerprint already hashes the URI, size, and modified time, so a changed file misses the
// cache by itself. This file holds only the text codec; the file I/O lives in the platform layer.

// What:     `package dev.monochromatic.musicplayer.core` places the codec beside the measure model.
// Why:      The codec is platform-free, so its round trip and its malformed-line handling are JVM tests.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer.core

// What:     `const val MEASURE_DURATION_FILE_NAME: String` names the cache file under the app's files directory.
// Why:      One place decides the file name, so the reader and the writer cannot drift apart.
//
// In TS you'd write (pseudocode):
// ```ts
// const MEASURE_DURATION_FILE_NAME = "track-durations.tsv";
// ```
/** Name of the duration cache file under the app's private files directory. */
const val MEASURE_DURATION_FILE_NAME: String = "track-durations.tsv"

// What:     `private const val MEASURE_DURATION_SEPARATOR: Char = '\t'` splits a fingerprint from its duration.
// Why:      A tab never appears in a decimal number, so the two fields split without quoting.
//
// In TS you'd write (pseudocode):
// ```ts
// const MEASURE_DURATION_SEPARATOR = "\t";
// ```
/** Separator between the fingerprint and the duration on one line. */
private const val MEASURE_DURATION_SEPARATOR: Char = '\t'

// What:     `private const val MEASURE_DURATION_FIELDS: Int = 2` is the number of fields on one line.
// Why:      A line with any other field count is malformed and is skipped.
//
// In TS you'd write (pseudocode):
// ```ts
// const MEASURE_DURATION_FIELDS = 2;
// ```
/** Fields on one line: the fingerprint, then the duration in milliseconds. */
private const val MEASURE_DURATION_FIELDS: Int = 2

// What:     `fun measureEncodeDurations(durations: Map<Long, Long>): String` writes the cache as text.
// Why:      A line per track keeps the file small and lets a corrupt line cost only that track.
//
// In TS you'd write (pseudocode):
// ```ts
// function encodeDurations(durations: Map<bigint, bigint>): string { ... }
// ```
/**
 * Writes one `fingerprint TAB milliseconds` line per entry, each ending in a newline.
 */
fun measureEncodeDurations(durations: Map<Long, Long>): String = buildString {
    durations.forEach { entry ->
        append(entry.key)
        append(MEASURE_DURATION_SEPARATOR)
        append(entry.value)
        append('\n')
    }
}

// What:     `private fun measureParseDurationLine(line: String): Pair<Long, Long>?` reads one cache line.
// Why:      Each damaged shape (a wrong field count, a non-number, a negative duration) is refused in one place.
//
// In TS you'd write (pseudocode):
// ```ts
// function parseDurationLine(line: string): [bigint, bigint] | null { ... }
// ```
/** Parses one `fingerprint TAB milliseconds` line, or returns null when it is damaged. */
private fun measureParseDurationLine(line: String): Pair<Long, Long>? {
    /** Fields of the line, split at the separator. */
    val fields: List<String> = line.split(MEASURE_DURATION_SEPARATOR)
    if (fields.size != MEASURE_DURATION_FIELDS) {
        return null
    }
    /** Fingerprint field read as a number, or null when it is not one. */
    val fingerprint: Long = fields[0].toLongOrNull() ?: return null
    /** Duration field read as a non-negative number, or null when it is not one. */
    val durationMs: Long = fields[1].toLongOrNull()?.takeIf { value -> value >= 0L } ?: return null
    return fingerprint to durationMs
}

// What:     `fun measureDecodeDurations(text: String): Map<Long, Long>` reads the cache text back.
// Why:     A malformed or negative line is dropped rather than failing the whole cache, so one bad write never blanks
//           it.
//
// In TS you'd write (pseudocode):
// ```ts
// function decodeDurations(text: string): Map<bigint, bigint> { ... }
// ```
/**
 * Reads the cache text, skipping any line that is not a fingerprint and a non-negative duration.
 */
fun measureDecodeDurations(text: String): Map<Long, Long> {
    /** Durations read so far, keyed by fingerprint. */
    val durations: MutableMap<Long, Long> = mutableMapOf()
    for (line in text.lineSequence()) {
        /** Fingerprint and duration of the line, or null when the line is damaged. */
        val entry: Pair<Long, Long>? = measureParseDurationLine(line)
        if (entry != null) {
            durations[entry.first] = entry.second
        }
    }
    return durations
}
