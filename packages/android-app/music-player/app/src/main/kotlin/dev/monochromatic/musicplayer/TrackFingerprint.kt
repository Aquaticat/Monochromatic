package dev.monochromatic.musicplayer

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import dev.monochromatic.musicplayer.core.fingerprint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Computes the opaque peak-cache key for a track from its content URI, the Android source for the
 * desktop's filesystem `path + size + mtime` fingerprint. The platform pieces the pure core left as
 * parameters (the file's size and modified-time) come from the content provider here; the resulting
 * key is hashed by [fingerprint], so no path, name, or tag is ever stored.
 *
 * The URI string stands in for the desktop's path: it is stable per track (a SAF document URI is
 * derived from the tree and document id; a MediaStore URI ends in the stable row id). Size comes from
 * [OpenableColumns.SIZE], which both SAF and MediaStore expose, so a re-encode (size change)
 * invalidates a stale entry. Last-modified comes from [DocumentsContract.Document.COLUMN_LAST_MODIFIED];
 * SAF document providers report it (so an in-place edit invalidates the entry), while MediaStore does
 * not carry that column and falls back to zero (size still guards it). Cross-source or cross-device
 * portability is not a goal: the cache is per-install and rebuilt on a miss.
 */
object TrackFingerprint {
    /** Nanoseconds per millisecond; the provider reports milliseconds, the core key wants nanoseconds. */
    private const val NANOS_PER_MILLI: Long = 1_000_000L

    /** Last-modified value used when the provider does not expose the column (for example MediaStore). */
    private const val UNKNOWN_MODIFIED_MS: Long = 0L

    /**
     * Fingerprint the track at [uri], or `null` when its size cannot be read (so the caller skips
     * caching and plays at unity gain). Runs the provider queries on [Dispatchers.IO].
     *
     * @param context Resolves [uri] through its `ContentResolver`.
     * @param uri Track content URI (SAF document or MediaStore).
     * @return Opaque cache key, or `null` when the size is unavailable.
     */
    suspend fun of(context: Context, uri: Uri): String? = withContext(Dispatchers.IO) {
        val size: Long = querySize(context, uri) ?: return@withContext null
        val modifiedMs: Long = queryLastModifiedMs(context, uri)
        fingerprint(uri.toString(), size.toULong(), (modifiedMs * NANOS_PER_MILLI).toULong())
    }

    /**
     * Read the file size in bytes from [OpenableColumns.SIZE], or `null` when the provider does not
     * report it.
     *
     * @param context Resolves [uri].
     * @param uri Track content URI.
     * @return Size in bytes, or `null`.
     */
    private fun querySize(context: Context, uri: Uri): Long? {
        context.contentResolver
            .query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)
            ?.use { cursor ->
                if (cursor.moveToFirst() && !cursor.isNull(0)) {
                    return cursor.getLong(0)
                }
            }
        return null
    }

    /**
     * Read the last-modified time in milliseconds from [DocumentsContract.Document.COLUMN_LAST_MODIFIED],
     * or [UNKNOWN_MODIFIED_MS] when the provider lacks that column (MediaStore uses a different one and
     * the query throws, which is treated as "unknown" rather than an error).
     *
     * @param context Resolves [uri].
     * @param uri Track content URI.
     * @return Last-modified time in milliseconds, or [UNKNOWN_MODIFIED_MS].
     */
    private fun queryLastModifiedMs(context: Context, uri: Uri): Long =
        runCatching {
            context.contentResolver
                .query(uri, arrayOf(DocumentsContract.Document.COLUMN_LAST_MODIFIED), null, null, null)
                ?.use { cursor ->
                    if (cursor.moveToFirst() && !cursor.isNull(0)) {
                        cursor.getLong(0)
                    } else {
                        UNKNOWN_MODIFIED_MS
                    }
                } ?: UNKNOWN_MODIFIED_MS
        }.getOrDefault(UNKNOWN_MODIFIED_MS)
}
