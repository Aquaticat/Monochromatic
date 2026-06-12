package dev.monochromatic.musicplayer

/**
 * The low-level audio primitive each engine flavor implements: play one track at a time, report the
 * play/pause state and natural end, and expose position/duration for the seek bar. The queue,
 * pagination, shuffle/scope, and transport orchestration live in [PlayerController]; this interface
 * is only "play this file". Keeping it small is what lets the three variants (Media3, hybrid Rust,
 * full Rust) swap behind one seam.
 */
interface AudioEngine {
    /**
     * Load the track at [uri] and optionally begin playing.
     *
     * @param uri Absolute filesystem path or content URI the engine can resolve.
     * @param play Start playback immediately when true; load paused when false.
     */
    fun load(uri: String, play: Boolean)

    /** Resume playback of the loaded track. */
    fun play()

    /** Pause playback, keeping the loaded track and position. */
    fun pause()

    /**
     * Seek within the loaded track.
     *
     * @param positionSec Target position in seconds.
     */
    fun seekTo(positionSec: Double)

    /**
     * Set the output gain.
     *
     * @param volume Linear gain in `0.0..1.0`.
     */
    fun setVolume(volume: Float)

    /**
     * Current playback position.
     *
     * @return Position in seconds, 0.0 when nothing is loaded.
     */
    fun positionSec(): Double

    /**
     * Loaded track duration.
     *
     * @return Duration in seconds, 0.0 when still unknown.
     */
    fun durationSec(): Double

    /**
     * Register the play/pause-state callback.
     *
     * @param callback Invoked with true when playback is running, false when paused or stopped.
     */
    fun setOnPlayingChanged(callback: (Boolean) -> Unit)

    /**
     * Register the natural-end callback.
     *
     * @param callback Invoked when the loaded track plays through to its end.
     */
    fun setOnTrackEnded(callback: () -> Unit)

    /** Release native resources; the engine is unusable afterwards. */
    fun release()
}
