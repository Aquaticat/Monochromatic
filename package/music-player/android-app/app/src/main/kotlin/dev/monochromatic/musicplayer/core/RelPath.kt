// Pure relative-path display. We strip the longest common directory prefix from a queue's track paths so the UI shows
// each track relative to the loaded root (`Artist/Album/01.flac` instead of the full path, or a bare filename when the
// whole queue is one folder). This is a faithful port of the desktop player's `relpath.rs`; it has no platform
// dependency and is unit-tested against the same Rust test vectors and against the first, slower implementation. The
// pagination grouping consumes this output, and the fallback to the full path guards a degenerate input that would
// otherwise collapse a UI row to an empty label.
//
// At a million tracks the first implementation (split every path into a list, compare the lists, join them again)
// cost seconds and a million lists on every library change. This one reads each path in place, builds no list for a
// path that is already normal, and returns the very same string when nothing needs stripping. `CommonPrefix` does the
// same comparison one path at a time, so a scan can keep the prefix of the tracks found so far without keeping lists.

// What:     `package dev.monochromatic.musicplayer.core` names the namespace of this file's declarations.
// Why:      The queue, the pagination code and the library feed refer to these functions by this package.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer.core

/** The separator between the segments of a track path, which pagination and the UI also expect. */
private const val SEPARATOR = "/"

/** The separator as a character, for scans that read a path in place. */
private const val SEPARATOR_CHAR = '/'

/** Segment that names the directory itself and is ignored. */
private const val CURRENT = "."

/** Segment that names the parent directory and is ignored. */
private const val PARENT = ".."

// What:     `private fun normalComponents(path: String): List<String>` splits a path into its named segments.
// Why:      The comparison and the re-joining of an unusual path (one with empty, `.` or `..` segments) need just the
//           real folder and file names.
//
// In TS you'd write (pseudocode):
// ```ts
// const normalComponents = (path: string) => path.split("/").filter((s) => s !== "" && s !== "." && s !== "..");
// ```
/** Splits [path] at `/` and drops the empty segments and the `.` and `..` markers. */
private fun normalComponents(path: String): List<String> =
    path.split(SEPARATOR).filter { segment -> segment.isNotEmpty() && segment != CURRENT && segment != PARENT }

// What:     `private fun isMeaningful(path: String, start: Int, end: Int): Boolean` tests one segment in place.
// Why:      A segment counts when it is not empty and not a `.` or `..` marker; testing it by range avoids a substring.
//
// In TS you'd write (pseudocode):
// ```ts
// const isMeaningful = (s: string) => s !== "" && s !== "." && s !== "..";
// ```
/** Reports whether `path[start, end)` is a named segment. */
private fun isMeaningful(path: String, start: Int, end: Int): Boolean {
    /** Number of characters in the segment. */
    val length: Int = end - start
    if (length == 0) {
        return false
    }
    if (length == 1 && path[start] == '.') {
        return false
    }
    return !(length == 2 && path[start] == '.' && path[start + 1] == '.')
}

// What:     `internal class CommonPrefix` keeps the longest common run of leading segments of the paths added so far.
// Why:      The prefix of a scan's first thousand tracks can be longer than the prefix of the whole library, so the
//           library feed must know the prefix of exactly the tracks it has shown, and it must not keep a list of
//           segments for each of a million paths to know it.
//
// In TS you'd write (pseudocode):
// ```ts
// class CommonPrefix { add(path: string) {} get count(): number { return 0; } }
// ```
/**
 * The number of leading segments that every added path shares, capped so the last segment of the shortest path
 * always survives, exactly as `relativeDisplayPaths` strips them.
 */
internal class CommonPrefix {
    /** Segments of the first path added, which every later path is compared with, or null before any path. */
    private var first: List<String>? = null

    /** Length of the run of leading segments that all added paths share with [first]. */
    private var shared: Int = 0

    /** Fewest segments any added path has. */
    private var shortest: Int = Int.MAX_VALUE

    /** Number of leading segments to strip from every added path: zero when there is none or a path has no segment. */
    val count: Int
        get() = if (first == null || shortest == 0) 0 else minOf(shared, shortest - 1)

    /** Adds one path and narrows the shared run, reading the path in place after the first. */
    fun add(path: String) {
        /** Segments of the first path, or null while this is the first path. */
        val head: List<String>? = first
        if (head == null) {
            /** Named segments of the first path. */
            val segments: List<String> = normalComponents(path)
            first = segments
            shared = segments.size
            shortest = segments.size
            return
        }
        /** Number of named segments of this path found so far. */
        var named = 0
        /** Whether the named segments so far all equal the first path's. */
        var matching = true
        /** Start of the segment being read. */
        var start = 0
        while (start <= path.length) {
            /** Offset of the separator that ends this segment, or the path length for the last one. */
            val stop: Int = path.indexOf(SEPARATOR_CHAR, start).let { found -> if (found < 0) path.length else found }
            if (isMeaningful(path, start, stop)) {
                if (matching && (named >= shared || !path.regionMatches(start, head[named], 0, stop - start) ||
                        head[named].length != stop - start)
                ) {
                    shared = minOf(shared, named)
                    matching = false
                }
                named += 1
            }
            start = stop + 1
        }
        shortest = minOf(shortest, named)
        shared = minOf(shared, named)
    }
}

// What:     `internal fun relativeOf(path: String, strip: Int): String` shows one path without its first segments.
// Why:      It is the per-path part of `relativeDisplayPaths`, so a feed that appends tracks can compute the display
//           path of one new track from the prefix of all the tracks so far. A normal path (no empty, `.` or `..`
//           segment) is cut with one substring, or returned as it is when nothing is stripped.
//
// In TS you'd write (pseudocode):
// ```ts
// const relativeOf = (path: string, strip: number) => normalComponents(path).slice(strip).join("/") || path;
// ```
/**
 * Returns the segments of [path] after the first [strip] named ones, joined with `/`, or [path] itself when no
 * segment remains.
 */
internal fun relativeOf(path: String, strip: Int): String {
    /** Number of named segments found so far. */
    var named = 0
    /** Offset of the first named segment that is kept, once the stripped ones are passed. */
    var keptFrom = -1
    /** Whether every segment is named, so the path can be cut instead of rebuilt. */
    var normal = true
    /** Start of the segment being read. */
    var start = 0
    while (start <= path.length) {
        /** Offset of the separator that ends this segment, or the path length for the last one. */
        val stop: Int = path.indexOf(SEPARATOR_CHAR, start).let { found -> if (found < 0) path.length else found }
        if (isMeaningful(path, start, stop)) {
            if (named == strip) {
                keptFrom = start
            }
            named += 1
        } else {
            normal = false
        }
        start = stop + 1
    }
    if (named <= strip) {
        return path
    }
    if (normal) {
        return if (strip == 0) path else path.substring(keptFrom)
    }
    return normalComponents(path).drop(strip).joinToString(SEPARATOR)
}

// What:     `fun relativeDisplayPaths(tracks: List<String>): List<String>` is the one public function of this file.
// Why:      The UI shows folders, not just bare filenames, but the shared absolute prefix (e.g. a long music-library
//           root) is noise; this strips it once per queue.
//
// In TS you'd write (pseudocode):
// ```ts
// function relativeDisplayPaths(tracks: string[]): string[] {
//   const prefix = commonPrefix(tracks);
//   return tracks.map((path) => relativeOf(path, prefix));
// }
// ```
/**
 * Returns each path without the leading segments that all the paths share, in the same order.
 *
 * A path with no named segment keeps its full text, and an empty list gives an empty list.
 */
fun relativeDisplayPaths(tracks: List<String>): List<String> {
    if (tracks.isEmpty()) return emptyList()
    /** Shared prefix of all the paths. */
    val prefix = CommonPrefix()
    tracks.forEach { path -> prefix.add(path) }
    /** Number of segments to strip from each path. */
    val strip: Int = prefix.count
    return tracks.map { path -> relativeOf(path, strip) }
}
