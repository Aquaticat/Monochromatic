package dev.monochromatic.musicplayer

import android.content.Context
import android.net.Uri
import android.util.Log
import kotlinx.coroutines.CancellationException

/**
 * Resolves the library the app reads, the single seam both the foreground player ([PlaybackService])
 * and the background sweep ([PeakSweepWorker]) load from. Sharing one selection is not cosmetic: the
 * peak-cache key is [TrackFingerprint] over the track's URI plus size plus modified-time, and a
 * MediaStore URI and a SAF document URI for the same physical file fingerprint differently (MediaStore
 * carries no last-modified column and falls back to zero). If the sweep enumerated one source while
 * playback enumerated another, every entry the sweep wrote would miss on playback and the cache would
 * be write-only. Both paths call [load], so their URIs (and therefore fingerprints) coincide.
 *
 * The source is the user's chosen folder when [LibraryRoot.heldRoot] confirms a live grant (honored
 * even when empty, so a deliberately small folder is respected rather than silently widened to the
 * whole device), otherwise the device-wide MediaStore collection when the audio permission is held,
 * otherwise nothing.
 */
object LibrarySource {
    /** Logcat tag for the scan-failure fallback. */
    private const val SOURCE_TAG: String = "LibrarySource"

    /**
     * Load the active library. Prefers the chosen folder over the device-wide collection; returns
     * empty when neither a folder grant nor the audio permission is held (the user has set up no
     * source yet).
     *
     * @param context Resolves the held root, the audio permission, and the content resolver.
     * @return Tracks for the current source in display-path order; empty when no source is available.
     */
    suspend fun load(context: Context): List<Track> {
        val root: Uri? = LibraryRoot.heldRoot(context)
        if (root != null) {
            return scanRoot(context, root)
        }
        if (hasAudioPermission(context)) {
            return MediaStoreSource.query(context.contentResolver)
        }
        return emptyList()
    }

    /**
     * Scan a chosen folder, degrading an unexpected whole-walk failure to an empty library rather than
     * crashing the cold-start service or the background worker. [SafTreeSource.query] already skips
     * individual unreadable directories, so this guards only a failure of the entire walk; a coroutine
     * cancellation is rethrown so structured cancellation still works.
     *
     * @param context Resolves the content resolver the document provider is queried through.
     * @param treeUri Granted tree URI to scan.
     * @return Audio tracks under the folder, or empty when the whole scan failed.
     */
    suspend fun scanRoot(context: Context, treeUri: Uri): List<Track> =
        try {
            SafTreeSource.query(context.contentResolver, treeUri)
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (failure: Exception) {
            Log.w(SOURCE_TAG, "scan of folder $treeUri failed; treating as empty", failure)
            emptyList()
        }
}
