package dev.monochromatic.musicplayer

import android.content.ContentResolver
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import android.util.Log
import dev.monochromatic.musicplayer.core.compareByCodePoint
import dev.monochromatic.musicplayer.core.isAudioFile
import dev.monochromatic.musicplayer.core.joinDisplayPath
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Walks a user-chosen Storage Access Framework tree and turns its audio files into the [Track] list
 * the player consumes. This is the Android realization of the desktop's "point at one folder" model:
 * the user grants a directory through `ACTION_OPEN_DOCUMENT_TREE`, and this scans that directory and
 * every descendant, unlike [MediaStoreSource] which reads the device-wide audio collection. A file
 * is enqueued by the same extension allowlist the desktop uses ([isAudioFile]), so the two sources
 * agree on what counts as music; each yields a playable `content://.../tree/.../document/...` URI
 * built from the document's opaque id (never from its name) and a tree-relative display path, and the
 * rows are returned sorted by display path in Unicode code-point order, matching [MediaStoreSource]'s
 * contract so the two are interchangeable through the same pagination.
 *
 * The walk is iterative with an explicit work stack (not recursion), so an arbitrarily deep tree
 * cannot exhaust the call stack, and a visited-id set makes a misbehaving provider that reports a
 * cycle terminate rather than loop. A single unreadable directory is logged and skipped instead of
 * aborting the whole scan; a revoked grant on the root itself surfaces to the caller, which falls
 * back to the device-wide source.
 *
 * The query runs on [Dispatchers.IO] because it is cursor I/O over a whole subtree.
 */
object SafTreeSource {
    /** Logcat tag for the on-device verification to read the scanned-file count back. */
    private const val SOURCE_TAG: String = "SafTreeSource"

    /** Columns each child row needs: its document id, its name, and the type that flags a directory. */
    private val PROJECTION: Array<String> = arrayOf(
        Document.COLUMN_DOCUMENT_ID,
        Document.COLUMN_DISPLAY_NAME,
        Document.COLUMN_MIME_TYPE,
    )

    /**
     * One pending directory in the depth-first walk: the document to list and the already-sanitized
     * folder path its children hang under.
     *
     * @property documentId Provider document id of a directory to enumerate.
     * @property prefix Tree-relative display path of this directory, empty for the chosen root.
     */
    private data class Frame(val documentId: String, val prefix: String)

    /**
     * Scan [treeUri] and every directory beneath it, returning its audio tracks sorted by display
     * path. The caller must hold a read grant for [treeUri] (see [LibraryRoot.heldRoot]); listing the
     * root without one throws, which the caller treats as a signal to fall back rather than a crash.
     *
     * @param resolver Content resolver to query the document provider through.
     * @param treeUri Tree URI returned by `ACTION_OPEN_DOCUMENT_TREE`.
     * @return Audio tracks under the tree in code-point display-path order; empty when the tree holds
     *   no playable file.
     */
    suspend fun query(resolver: ContentResolver, treeUri: Uri): List<Track> = withContext(Dispatchers.IO) {
        val rootDocumentId: String = DocumentsContract.getTreeDocumentId(treeUri)
        val pending: ArrayDeque<Frame> = ArrayDeque()
        pending.addLast(Frame(documentId = rootDocumentId, prefix = ""))
        val visited: MutableSet<String> = mutableSetOf()
        val tracks: MutableList<Track> = mutableListOf()

        while (pending.isNotEmpty()) {
            val frame: Frame = pending.removeLast()
            // A provider that reports a document twice (a cycle, or a hardlink-like alias) must not
            // loop forever; the first visit wins, later ones are dropped.
            if (!visited.add(frame.documentId)) {
                continue
            }
            scanDirectory(resolver = resolver, treeUri = treeUri, frame = frame, pending = pending, tracks = tracks)
        }

        Log.i(SOURCE_TAG, "scanned ${tracks.size} audio files under $treeUri")
        tracks.sortedWith { left, right -> compareByCodePoint(left.displayPath, right.displayPath) }
    }

    /**
     * List one directory's children: push subdirectories onto [pending] and append audio files to
     * [tracks]. An unreadable directory (a transient provider error, a per-folder permission quirk)
     * is logged and skipped so it cannot abort the rest of the walk; the root's own failure is the
     * one case that propagates, because there is nothing left to scan.
     *
     * @param resolver Content resolver to query through.
     * @param treeUri Granted tree URI, the access leveraged for every child query.
     * @param frame Directory being listed and its display-path prefix.
     * @param pending Work stack subdirectories are pushed onto.
     * @param tracks Accumulator audio files are appended to.
     */
    private fun scanDirectory(
        resolver: ContentResolver,
        treeUri: Uri,
        frame: Frame,
        pending: ArrayDeque<Frame>,
        tracks: MutableList<Track>,
    ) {
        val childrenUri: Uri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, frame.documentId)
        try {
            // The cursor read holds no suspension point, so it cannot raise a coroutine
            // CancellationException here; the catch only ever sees a real provider failure.
            resolver.query(childrenUri, PROJECTION, null, null, null)?.use { cursor ->
                val idColumn: Int = cursor.getColumnIndexOrThrow(Document.COLUMN_DOCUMENT_ID)
                val nameColumn: Int = cursor.getColumnIndexOrThrow(Document.COLUMN_DISPLAY_NAME)
                val mimeColumn: Int = cursor.getColumnIndexOrThrow(Document.COLUMN_MIME_TYPE)
                while (cursor.moveToNext()) {
                    val childId: String = cursor.getString(idColumn) ?: continue
                    val name: String = cursor.getString(nameColumn) ?: continue
                    val mimeType: String? = cursor.getString(mimeColumn)
                    val childPath: String = joinDisplayPath(frame.prefix, name)
                    if (mimeType == Document.MIME_TYPE_DIR) {
                        pending.addLast(Frame(documentId = childId, prefix = childPath))
                    } else if (isAudioFile(name)) {
                        val documentUri: Uri = DocumentsContract.buildDocumentUriUsingTree(treeUri, childId)
                        tracks.add(Track(uri = documentUri.toString(), displayPath = childPath))
                    }
                }
            }
        } catch (failure: Exception) {
            Log.w(SOURCE_TAG, "skipping unreadable directory ${frame.documentId}", failure)
        }
    }
}
