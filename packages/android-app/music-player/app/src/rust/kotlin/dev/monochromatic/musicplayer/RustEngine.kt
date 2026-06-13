package dev.monochromatic.musicplayer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.util.Log
import java.io.File

/**
 * The full-Rust [AudioEngine]: a thin Kotlin facade over the native engine (`engine.rs`), which
 * decodes with symphonia/libopus and outputs through AAudio, all in-process. This is the engine
 * whose performance the variant exists to measure: no platform MediaCodec, no ExoPlayer.
 *
 * The native engine is pull-based (no native-to-JVM callbacks), so this class translates that into
 * the push-style [AudioEngine] contract: a 200 ms main-thread poller reads the native playing/ended
 * state and fires [setOnPlayingChanged]/[setOnTrackEnded] on transitions. [PlayerController] drives
 * this engine entirely on the main thread, which is also where the poller runs, so the callbacks land
 * on the thread the controller's Compose state requires.
 *
 * Loading hands the native side a `content://` (or file) descriptor: the borrowed `ParcelFileDescriptor`
 * fd is passed inside a `use {}` block, and the native `load` dups it synchronously, so the JVM keeps
 * and closes the original while Rust owns the dup (the dup-ownership protocol that avoids the fdsan
 * double-close).
 *
 * Not yet wired (a later slice): audio-focus handling (a phone call will not pause this engine),
 * the becoming-noisy headphone-unplug pause, and true-peak normalization. ExoPlayer gave those for
 * free; the full-Rust engine must add them itself, but they are not needed to measure decode/output.
 *
 * @param context Resolves `content://` URIs to descriptors; only the application context is retained.
 */
class RustEngine(context: Context) : AudioEngine {
    /** Application context for the content resolver, held without leaking the activity. */
    private val appContext: Context = context.applicationContext

    /** Opaque native engine handle; 0 only if the worker thread could not be spawned. */
    private var handle: Long = NativeBridge.nativeEngineCreate()

    /** Play/pause-state callback, fired by the poller on a transition. */
    private var onPlayingChanged: ((Boolean) -> Unit)? = null

    /** Natural-end callback, fired by the poller once per ended track. */
    private var onTrackEnded: (() -> Unit)? = null

    /** Last play state the poller reported, to edge-trigger [onPlayingChanged]. */
    private var lastPlaying: Boolean = false

    /** Whether the current ended state has already fired [onTrackEnded]; rearms when native clears it. */
    private var endedHandled: Boolean = false

    /** Main-looper poller that turns the native pull-state into the engine's push callbacks. */
    private val poller: Handler = Handler(Looper.getMainLooper())

    /** Self-rescheduling poll task. */
    private val pollTask: Runnable = object : Runnable {
        override fun run() {
            poll()
            poller.postDelayed(this, POLL_MS)
        }
    }

    /** System audio service, for focus and the music-stream becoming-noisy broadcast. */
    private val audioManager: AudioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    /** Persistent media focus request (gain, usage=media), reused for every play. */
    private val focusRequest: AudioFocusRequest =
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build(),
            )
            .setOnAudioFocusChangeListener({ change -> onFocusChange(change) }, poller)
            .setWillPauseWhenDucked(true)
            .build()

    /** Set when a transient focus loss paused mid-play, so a later focus gain resumes; a permanent loss
     * or a user pause clears it. */
    private var resumeOnFocusGain: Boolean = false

    /** Pauses on a headphone unplug (ACTION_AUDIO_BECOMING_NOISY) so audio never jumps to the speaker. */
    private val noisyReceiver: BroadcastReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                resumeOnFocusGain = false
                NativeBridge.nativeEnginePause(handle)
            }
        }
    }

    init {
        if (handle == 0L) {
            throw IllegalStateException("native engine worker could not be spawned")
        }
        appContext.registerReceiver(
            noisyReceiver,
            IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY),
            Context.RECEIVER_NOT_EXPORTED,
        )
        poller.postDelayed(pollTask, POLL_MS)
    }

    override fun load(uri: String, play: Boolean) {
        Log.i(LOG_TAG, "RustEngine.load ${uri.substringAfterLast('/')} play=$play")
        // Do NOT reset endedHandled here: the worker clears native `ended` asynchronously, so an
        // eager reset would let a poll between this load and that clear see the OLD ended=true with
        // endedHandled=false and fire onTrackEnded a second time (a skipped track). The falling-edge
        // rearm in poll() (endedHandled clears only when native `ended` actually clears) is correct.
        val descriptor: ParcelFileDescriptor? = openDescriptor(uri)
        if (descriptor == null) {
            Log.w(LOG_TAG, "could not open a descriptor for $uri")
            return
        }
        // Only start playing if audio focus is granted (a phone call or another player can deny it).
        val startPlaying: Boolean = play && requestFocus()
        // Pass the BORROWED fd; native dups it synchronously, so use {} closes the original after.
        val result: Int = descriptor.use { NativeBridge.nativeEngineLoad(handle, it.fd, startPlaying) }
        if (result != 0) {
            Log.w(LOG_TAG, "native load failed (code $result) for $uri")
        }
    }

    /**
     * Open a read-only descriptor for the track: a bare absolute path via [ParcelFileDescriptor.open],
     * everything else (the `content://` URIs the library actually yields) via the content resolver.
     *
     * @param uri Track locator from [Track.uri].
     * @return Borrowed descriptor to hand to the native loader, or null when it cannot be opened.
     */
    private fun openDescriptor(uri: String): ParcelFileDescriptor? =
        try {
            if (uri.startsWith("/")) {
                ParcelFileDescriptor.open(File(uri), ParcelFileDescriptor.MODE_READ_ONLY)
            } else {
                appContext.contentResolver.openFileDescriptor(Uri.parse(uri), "r")
            }
        } catch (failure: Exception) {
            Log.w(LOG_TAG, "openDescriptor failed for $uri", failure)
            null
        }

    override fun play() {
        if (requestFocus()) {
            NativeBridge.nativeEnginePlay(handle)
        }
    }

    override fun pause() {
        NativeBridge.nativeEnginePause(handle)
    }

    override fun seekTo(positionSec: Double) {
        NativeBridge.nativeEngineSeek(handle, positionSec)
    }

    override fun setVolume(volume: Float) {
        NativeBridge.nativeEngineSetVolume(handle, volume)
    }

    override fun positionSec(): Double = NativeBridge.nativeEnginePositionSec(handle)

    override fun durationSec(): Double = NativeBridge.nativeEngineDurationSec(handle)

    override fun playWhenReady(): Boolean = NativeBridge.nativeEnginePlayWhenReady(handle)

    override fun setOnPlayingChanged(callback: (Boolean) -> Unit) {
        onPlayingChanged = callback
    }

    override fun setOnTrackEnded(callback: () -> Unit) {
        onTrackEnded = callback
    }

    override fun release() {
        poller.removeCallbacks(pollTask)
        resumeOnFocusGain = false
        audioManager.abandonAudioFocusRequest(focusRequest)
        try {
            appContext.unregisterReceiver(noisyReceiver)
        } catch (alreadyUnregistered: IllegalArgumentException) {
            // Benign: release() ran twice, or the receiver was never registered; nothing to undo.
            Log.w(LOG_TAG, "noisy receiver already unregistered", alreadyUnregistered)
        }
        NativeBridge.nativeEngineRelease(handle)
        handle = 0L
    }

    /**
     * Request media audio focus.
     *
     * @return True when focus was granted (so playback may start).
     */
    private fun requestFocus(): Boolean =
        audioManager.requestAudioFocus(focusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED

    /**
     * React to a system audio-focus change so a phone call, navigation prompt, or another media app
     * pauses (and a transient interruption resumes) this engine, the behavior ExoPlayer gives the
     * Media3 flavor for free. A permanent loss pauses and abandons focus; a transient loss pauses and
     * arms resume-on-gain; a gain resumes only if a transient loss had paused us.
     *
     * @param change One of the `AudioManager.AUDIOFOCUS_*` change constants.
     */
    private fun onFocusChange(change: Int) {
        when (change) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                resumeOnFocusGain = false
                NativeBridge.nativeEnginePause(handle)
                audioManager.abandonAudioFocusRequest(focusRequest)
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                resumeOnFocusGain = NativeBridge.nativeEngineIsPlaying(handle)
                NativeBridge.nativeEnginePause(handle)
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                if (resumeOnFocusGain) {
                    resumeOnFocusGain = false
                    NativeBridge.nativeEnginePlay(handle)
                }
            }
        }
    }

    /**
     * Sample the native state and fire the push callbacks on a transition. [onPlayingChanged] is
     * edge-triggered on the play state; [onTrackEnded] fires once on the rising edge of `ended` and
     * rearms when the native side clears `ended` (the worker resets it when the next track loads), so a
     * track-change handoff cannot double-fire.
     */
    private fun poll() {
        if (handle == 0L) {
            return
        }
        val playing: Boolean = NativeBridge.nativeEngineIsPlaying(handle)
        if (playing != lastPlaying) {
            lastPlaying = playing
            onPlayingChanged?.invoke(playing)
        }
        val ended: Boolean = NativeBridge.nativeEngineIsEnded(handle)
        if (ended && !endedHandled) {
            endedHandled = true
            onTrackEnded?.invoke()
        } else if (!ended) {
            endedHandled = false
        }
    }

    companion object {
        /** Logcat tag. */
        private const val LOG_TAG: String = "RustEngine"

        /** Poll cadence for the play/ended state, matching the UI's position poll. */
        private const val POLL_MS: Long = 200L
    }
}
