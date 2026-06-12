package dev.monochromatic.musicplayer

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.core.content.edit
import androidx.core.net.toUri

/**
 * Remembers the user's chosen Storage Access Framework library root across launches and process
 * death. The picked tree URI is stored as a string in private [android.content.SharedPreferences];
 * the matching read grant is persisted separately by the activity through
 * `takePersistableUriPermission`. Those two can drift: the user can revoke the grant in system
 * settings, or move or delete the folder, leaving a remembered URI the app no longer has access to.
 * [heldRoot] is therefore the only correct way to read the root back, because it returns the saved
 * URI only when a live read grant still backs it, and forgets the URI otherwise so a dead pointer is
 * never handed to a scan (which would throw and, on a headless service cold start, take the service
 * down).
 */
object LibraryRoot {
    /** Logcat tag for the on-device verification to trace the remembered root. */
    private const val ROOT_TAG: String = "LibraryRoot"

    /** Private preferences file holding the one remembered tree URI. */
    private const val PREFS_NAME: String = "library_root"

    /** Preferences key for the chosen tree URI string. */
    private const val KEY_TREE_URI: String = "tree_uri"

    /**
     * Remember [treeUri] as the chosen library root. The caller must already have taken a
     * persistable read grant for it, so a later [heldRoot] finds a live permission to confirm.
     *
     * @param context Any context; its application preferences store the value.
     * @param treeUri Tree URI returned by `ACTION_OPEN_DOCUMENT_TREE`.
     */
    fun save(context: Context, treeUri: Uri) {
        prefs(context).edit { putString(KEY_TREE_URI, treeUri.toString()) }
        Log.i(ROOT_TAG, "saved library root $treeUri")
    }

    /**
     * Return the remembered library root only when a persisted read grant still backs it. A
     * remembered URI with no live grant (revoked in settings, or the folder moved or deleted) is
     * treated as absent and forgotten, so callers can branch cleanly to the device-wide MediaStore
     * source instead of scanning a root they cannot read.
     *
     * @param context Any context; supplies the preferences and the content resolver's grant list.
     * @return Live, still-readable tree URI, or null when none is remembered or the grant is gone.
     */
    fun heldRoot(context: Context): Uri? {
        val saved: String = prefs(context).getString(KEY_TREE_URI, null) ?: return null
        val uri: Uri = saved.toUri()
        val held: Boolean = context.contentResolver.persistedUriPermissions.any { permission ->
            permission.uri == uri && permission.isReadPermission
        }
        if (!held) {
            Log.w(ROOT_TAG, "remembered root $uri has no live read grant; forgetting it")
            clear(context)
            return null
        }
        return uri
    }

    /**
     * Forget the remembered library root, so the next load falls back to the device-wide source.
     *
     * @param context Any context; its application preferences hold the value.
     */
    fun clear(context: Context) {
        prefs(context).edit { remove(KEY_TREE_URI) }
    }

    /**
     * Open the private preferences file backing the remembered root.
     *
     * @param context Any context; the application preferences are process-wide, so the activity's
     *   write is visible to the service's read.
     * @return Preferences handle for [PREFS_NAME].
     */
    private fun prefs(context: Context) = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
