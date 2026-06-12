package dev.monochromatic.musicplayer

import android.content.ContentResolver
import android.content.ContentUris
import android.os.Build
import android.provider.MediaStore
import android.util.Log
import dev.monochromatic.musicplayer.core.compareByCodePoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Reads the device's shared audio library from [MediaStore] and turns it into the [Track] list the
 * player consumes. This is the Android analog of the desktop's "scan a music root" step, with one
 * honest divergence: the desktop walks a single chosen folder, while MediaStore is the device-wide
 * audio collection, so this filters to `IS_MUSIC != 0` to drop ringtones, alarms, and notification
 * sounds (a chosen-root SAF source covers the desktop's "point at one folder" model and lands in a
 * later slice). Each row yields a playable `content://media/...` URI built with [ContentUris] and a
 * folder-relative display path; the rows are returned sorted by display path in Unicode code-point
 * order, matching the desktop's bytewise path sort so within-page load order is faithful.
 *
 * The query runs on [Dispatchers.IO] because it is cursor I/O over the whole collection.
 */
object MediaStoreSource {
    /** Logcat tag for the on-device verification to read the row count back. */
    private const val SOURCE_TAG: String = "MediaStoreSource"

    /**
     * Query the audio collection and return its music tracks, sorted by display path.
     *
     * The caller must hold the audio-read permission (`READ_MEDIA_AUDIO` on API 33+, otherwise
     * `READ_EXTERNAL_STORAGE`) before calling; without it the cursor comes back empty rather than
     * throwing. `DATA` (the absolute filesystem path) is referenced only as the pre-API-29 fallback
     * for the display path, because `RELATIVE_PATH` does not exist before Android 10; it is
     * deprecated under scoped storage but remains the only folder-aware display source on those old
     * API levels, and it is never used to open the file (the `content://` URI is).
     *
     * @param resolver Content resolver to run the query against.
     * @return Music tracks in code-point display-path order; empty when nothing is indexed or the
     *   permission is missing.
     */
    @Suppress("DEPRECATION")
    suspend fun query(resolver: ContentResolver): List<Track> = withContext(Dispatchers.IO) {
        val hasRelativePath: Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
        val collection = if (hasRelativePath) {
            MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        } else {
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        }
        // RELATIVE_PATH (API 29+) is the scoped-storage folder path; DATA is the legacy absolute path
        // kept only as the < API 29 fallback. Requesting RELATIVE_PATH on an older platform throws
        // "unknown column", so it is added conditionally.
        val projection: Array<String> = buildList {
            add(MediaStore.Audio.Media._ID)
            add(MediaStore.Audio.Media.DISPLAY_NAME)
            if (hasRelativePath) {
                add(MediaStore.Audio.Media.RELATIVE_PATH)
            } else {
                add(MediaStore.Audio.Media.DATA)
            }
        }.toTypedArray()
        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0"

        val tracks: MutableList<Track> = mutableListOf()
        resolver.query(collection, projection, selection, null, null)?.use { cursor ->
            val idColumn: Int = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            val nameColumn: Int = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
            val pathColumn: Int = if (hasRelativePath) {
                cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.RELATIVE_PATH)
            } else {
                cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA)
            }
            while (cursor.moveToNext()) {
                val name: String = cursor.getString(nameColumn) ?: continue
                val id: Long = cursor.getLong(idColumn)
                val rawPath: String? = cursor.getString(pathColumn)
                val displayPath: String = displayPathOf(rawPath = rawPath, name = name, isRelative = hasRelativePath)
                val uri: String = ContentUris.withAppendedId(collection, id).toString()
                tracks.add(Track(uri = uri, displayPath = displayPath))
            }
        }
        Log.i(SOURCE_TAG, "queried ${tracks.size} music tracks from MediaStore")
        tracks.sortedWith { left, right -> compareByCodePoint(left.displayPath, right.displayPath) }
    }

    /**
     * Build a row's folder-relative display path from its raw path column and file name.
     *
     * @param rawPath `RELATIVE_PATH` (a trailing-slash folder like `Plain/Music/`) on API 29+, or the
     *   absolute `DATA` path below it; null when the column had no value.
     * @param name `DISPLAY_NAME`, the bare file name.
     * @param isRelative True when [rawPath] is a `RELATIVE_PATH` folder that needs the file name
     *   appended; false when it is already a full `DATA` path to use as is.
     * @return Display path: `<relative-folder>/<name>` on API 29+, the absolute `DATA` path on older
     *   platforms, or the bare name when no path is available (a degenerate row).
     */
    private fun displayPathOf(rawPath: String?, name: String, isRelative: Boolean): String = when {
        rawPath.isNullOrEmpty() -> name
        isRelative -> "${rawPath.removeSuffix("/")}/$name"
        else -> rawPath
    }
}
