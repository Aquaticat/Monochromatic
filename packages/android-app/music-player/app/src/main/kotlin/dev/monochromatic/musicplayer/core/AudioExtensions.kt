package dev.monochromatic.musicplayer.core

/**
 * Pure audio-file recognition and within-folder ordering, a faithful port of the desktop's
 * `playback.rs`. Covers the playable-extension allowlist, the case-insensitive
 * "is this filename an audio file" predicate, and the pure filter-then-sort a folder scan applies to
 * the names in a single directory. The recursive directory traversal itself (reading directory
 * entries, skipping symlinked folders to stay loop-safe, the depth-first "a folder's own files
 * before its subfolders' files, subfolders ascending" ordering, and the single-file passthrough)
 * retargets to Android storage APIs later and is deliberately not ported here; see
 * [audioFilesSorted] for the pure ordering primitive that traversal will reuse per directory.
 */

private const val SEPARATOR: Char = '/'

private const val EXTENSION_DOT: Char = '.'

/**
 * Extensions (lowercased, no leading dot) treated as playable, matching the desktop's documented
 * codec set: FLAC, WAV/PCM, MP3, Vorbis (Ogg), Opus, AAC-LC/ALAC (MP4), and AIFF. A folder holds
 * more than music (cover art, playlists, system files like `.DS_Store`/`.nomedia`); this allowlist
 * is the single rule deciding what a scan enqueues, so junk never reaches the queue. Membership
 * matters here, not order, so a [Set] mirrors the Rust slice's `contains` check.
 */
val AUDIO_EXTENSIONS: Set<String> = setOf(
    "flac",
    "wav",
    "wave",
    "mp3",
    "ogg",
    "oga",
    "opus",
    "m4a",
    "m4b",
    "mp4",
    "aac",
    "aiff",
    "aif",
    "aifc",
)

/**
 * Extract a path's extension the way Rust's `Path::extension` does: the text after the final dot of
 * the last path component, but only when that dot is neither absent nor the component's leading
 * character. A leading-dot name (`.DS_Store`) and an extensionless name (`noext`) both yield no
 * extension, so neither is mistaken for audio; dots inside parent directories are ignored because
 * the final component is isolated first.
 *
 * @param path Slash-separated path whose extension is wanted.
 * @return Lowercased extension with no leading dot, or `null` when the final component has none.
 */
private fun extensionOf(path: String): String? {
    val component = path.substringAfterLast(SEPARATOR)
    val dotIndex = component.lastIndexOf(EXTENSION_DOT)
    if (dotIndex <= 0) {
        return null
    }
    return component.substring(dotIndex + 1).lowercase()
}

/**
 * Decide whether a path names an audio file, comparing its extension against [AUDIO_EXTENSIONS]
 * case-insensitively. Shared by the (deferred) folder scan and any session restore so the two cannot
 * disagree on what belongs in a music queue. Faithful to the Rust `is_audio_file`: extensionless
 * names and leading-dot system files are rejected because [extensionOf] returns `null` for them.
 *
 * @param path Slash-separated path to classify.
 * @return `true` when the final component's lowercased extension is in [AUDIO_EXTENSIONS].
 */
fun isAudioFile(path: String): Boolean {
    val extension = extensionOf(path) ?: return false
    return extension in AUDIO_EXTENSIONS
}

/**
 * Apply the pure per-directory rule the Rust walk uses for the files of a single folder: keep only
 * audio files, then sort them. The sort is code-unit (byte) order, matching Rust's case-sensitive
 * `PathBuf` sort for the ASCII filenames a music library produces, so capitalized names are not
 * folded to lowercase. This is the ordering primitive the deferred recursive traversal will reuse
 * once per directory; cross-directory ordering (parent files before child files) stays with that
 * traversal.
 *
 * @param names Filenames or paths found directly in one directory, in any order.
 * @return Audio files only, sorted in case-sensitive code-unit order.
 */
fun audioFilesSorted(names: List<String>): List<String> =
    names.filter(::isAudioFile).sorted()
