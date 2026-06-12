package dev.monochromatic.musicplayer.core

/**
 * Pure relative-path display: strip the longest common directory prefix from a queue's track paths
 * so the UI shows each track relative to the loaded root (`Artist/Album/01.flac` instead of the full
 * path, or a bare filename when the whole queue is one folder). Faithful port of the desktop's
 * `relpath.rs`; no platform dependency, fully unit-tested against the Rust test vectors. The
 * pagination grouping consumes this output, and the fallback to the full path guards a degenerate
 * input that would otherwise collapse a row to an empty label.
 */

private const val SEPARATOR = "/"

/**
 * Split a path into its named segments only, dropping the root and any `.`/`..` markers.
 *
 * @param path Slash-separated path to split.
 * @return Named segments in order, with empty, `.`, and `..` segments removed.
 */
private fun normalComponents(path: String): List<String> =
    path.split(SEPARATOR).filter { it.isNotEmpty() && it != "." && it != ".." }

/**
 * Count the leading segments every list shares, capped so at least the final segment (the filename)
 * always survives on every track.
 *
 * @param lists Per-track segment lists.
 * @return Length of the shared leading run, never reaching the shortest list's full length.
 */
private fun commonPrefixLen(lists: List<List<String>>): Int {
    val shortest = lists.minOfOrNull { it.size } ?: 0
    if (shortest == 0) return 0
    val cap = shortest - 1
    var run = 0
    while (run < cap && lists.all { it[run] == lists[0][run] }) {
        run++
    }
    return run
}

/**
 * Turn each track's full path into its path relative to the queue's common root.
 *
 * @param tracks Track paths in load order.
 * @return One relative display string per track, in the same order; the full path is kept for any
 *   track that would otherwise relativize to an empty string.
 */
fun relativeDisplayPaths(tracks: List<String>): List<String> {
    if (tracks.isEmpty()) return emptyList()
    val componentLists = tracks.map { normalComponents(it) }
    val prefixLen = commonPrefixLen(componentLists)
    return componentLists.zip(tracks).map { (list, path) ->
        val relative = list.drop(prefixLen).joinToString(SEPARATOR)
        if (relative.isEmpty()) path else relative
    }
}
