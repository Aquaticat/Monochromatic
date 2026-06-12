package dev.monochromatic.musicplayer

/**
 * Observable snapshot of the engine's playback state, surfaced to the UI.
 *
 * @property status Human-readable transport state: idle, buffering, playing, paused, ended, or an error string.
 * @property nowPlaying File name of the loaded track, or null when nothing is loaded.
 */
data class EngineState(
    val status: String,
    val nowPlaying: String?,
)

/**
 * The single seam the three engine variants (Media3, hybrid, full-Rust) implement.
 *
 * Each product flavor supplies its own [createAudioEngine] factory, so the rest of the app
 * (the Compose UI, later the MediaSessionService) depends only on this interface and never
 * on a concrete engine. Kept deliberately small for the derisking skeleton; it grows as the
 * queue, true-peak gain, and session features port over.
 */
interface AudioEngine {
    /**
     * Load the file at [path] and begin playback.
     *
     * @param path Absolute filesystem path or content URI string the engine can resolve.
     */
    fun play(path: String)

    /** Pause playback, keeping the loaded track and position. */
    fun pause()

    /** Stop playback and clear the prepared media. */
    fun stop()

    /** Release all native resources; the engine is unusable afterwards. */
    fun release()

    /**
     * Register the callback the engine invokes on every state transition.
     *
     * @param callback Receiver of each new [EngineState]; replaces any previously set callback.
     */
    fun setOnState(callback: (EngineState) -> Unit)
}
