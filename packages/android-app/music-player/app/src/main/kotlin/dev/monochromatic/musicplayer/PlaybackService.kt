package dev.monochromatic.musicplayer

import android.content.Intent
import android.net.Uri
import android.os.Binder
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Hosts the player so audio survives the activity being backgrounded or destroyed. Owns the one
 * [PlayerController] brain and the flavor's [AudioEngine] (built via `createAudioEngine`), projects
 * the brain to a [MediaSession] through [BrainPlayer], and registers that session with the media
 * notification manager itself ([addSession]) so the system notification, lockscreen, headset
 * buttons, and foreground-on-play work without any app-side [androidx.media3.session.MediaController].
 *
 * The in-app activity reaches the same brain through a private [LocalBinder] (single process), so it
 * reads the brain's page/scope UI state and drives actions directly while the session projects the
 * very same brain to the system; one source of truth, two views. The audio-read permission can only
 * be obtained by the activity, so the library loads either here on a headless restart (the grant
 * persists) or on the activity's signal after a fresh grant, whichever comes first.
 */
class PlaybackService : MediaSessionService() {
    private lateinit var controller: PlayerController
    private lateinit var brainPlayer: BrainPlayer
    private var session: MediaSession? = null

    /** Guards the one-time library load so the activity signal and the headless self-load do not double it. */
    private var libraryLoaded: Boolean = false

    /** Main-thread scope for the cursor I/O of the initial library query. */
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    /**
     * The in-flight library load, kept so a newer load (a folder re-pick superseding the initial
     * self-load) can cancel it first. Without this, a slow MediaStore self-load could deliver after a
     * fast folder scan and wrongly overwrite the chosen library with the device-wide one.
     */
    private var loadJob: Job? = null

    private val localBinder: LocalBinder = LocalBinder()

    /**
     * Hands the in-app activity a direct reference to the service-owned brain (same process), plus a
     * permission-gated library-load trigger.
     */
    inner class LocalBinder : Binder() {
        /** Service-owned brain the activity observes ([PlayerController.uiState]) and drives. */
        val controller: PlayerController get() = this@PlaybackService.controller

        /** Load the library if not already loaded; the activity calls this once it has the audio grant. */
        fun ensureLibraryLoaded() = this@PlaybackService.ensureLibraryLoaded()

        /**
         * Replace the library with the contents of a just-picked Storage Access Framework folder; the
         * activity calls this after taking a persistable grant for [treeUri].
         *
         * @param treeUri Tree URI the user chose through `ACTION_OPEN_DOCUMENT_TREE`.
         */
        fun reloadFromRoot(treeUri: Uri) = this@PlaybackService.reloadFromRoot(treeUri)
    }

    override fun onCreate() {
        super.onCreate()
        Log.i(LOG_TAG, "PlaybackService.onCreate flavor=${BuildConfig.FLAVOR}")
        controller = PlayerController(createAudioEngine(this))
        brainPlayer = BrainPlayer(controller, Looper.getMainLooper())
        val built: MediaSession = MediaSession.Builder(this, brainPlayer).build()
        session = built
        // Start the notification/foreground machinery now, without waiting for an external controller:
        // addSession registers the media notification manager's own player listener for this session.
        addSession(built)
        // Both a chosen-folder grant and the audio permission persist across process death, so a
        // headless restart can self-load from whichever the user set up.
        if (LibraryRoot.heldRoot(this) != null || hasAudioPermission(this)) {
            ensureLibraryLoaded()
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    override fun onBind(intent: Intent?): IBinder? =
        if (intent?.action == ACTION_LOCAL_BIND) localBinder else super.onBind(intent)

    /**
     * Load the library and hand it to the brain, once. Safe to call from both the headless self-load
     * and the activity's post-grant signal; the [libraryLoaded] guard keeps it to a single load. The
     * source is [LibrarySource], shared with the background sweep so their fingerprints agree. A
     * library is available at this point, so the charging-plus-idle peak sweep is enqueued here too
     * ([PeakSweepScheduler.enqueue] is idempotent).
     */
    fun ensureLibraryLoaded() {
        if (libraryLoaded) {
            return
        }
        libraryLoaded = true
        PeakSweepScheduler.enqueue(this)
        controller.beginLoad()
        loadJob?.cancel()
        loadJob = scope.launch {
            val tracks = LibrarySource.load(this@PlaybackService)
            controller.openLibrary(tracks)
            Log.i(LOG_TAG, "PlaybackService loaded ${tracks.size} tracks")
        }
    }

    /**
     * Replace the library with a just-picked folder's contents, overriding the one-shot
     * [libraryLoaded] guard because an explicit re-pick is meant to supersede whatever loaded first.
     *
     * @param treeUri Tree URI the user chose; the activity has already taken a persistable grant.
     */
    fun reloadFromRoot(treeUri: Uri) {
        libraryLoaded = true
        PeakSweepScheduler.enqueue(this)
        controller.beginLoad()
        loadJob?.cancel()
        loadJob = scope.launch {
            val tracks = LibrarySource.scanRoot(this@PlaybackService, treeUri)
            controller.openLibrary(tracks)
            Log.i(LOG_TAG, "PlaybackService loaded ${tracks.size} tracks from picked folder")
        }
    }

    override fun onDestroy() {
        session?.run {
            player.release()
            release()
        }
        session = null
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        /** Private bind action the in-app activity uses to obtain the [LocalBinder]. */
        const val ACTION_LOCAL_BIND: String = "dev.monochromatic.musicplayer.LOCAL_BIND"
    }
}
