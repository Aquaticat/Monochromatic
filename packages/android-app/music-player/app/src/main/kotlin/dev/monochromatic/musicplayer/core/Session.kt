package dev.monochromatic.musicplayer.core

/**
 * The saved "where the user left off" state: queue, cursor, position, volume, shuffle, and the
 * repeat-track flag. Pure model ported from the desktop's `Session` (session.rs); the desktop
 * persists this as JSON under the user's config directory, but this core type carries only the
 * in-memory shape and its pruning logic. The default constructor reproduces the desktop's
 * `impl Default for Session` (empty queue, no cursor, zero position, full volume, shuffle off, no
 * repeat).
 *
 * @property tracks Queue track paths in load order.
 * @property current Index of the current track, or `null` when the queue is empty.
 * @property positionSecs Saved playback position of the current track, in seconds.
 * @property volume Saved gain in the range `0.0..=1.0`.
 * @property shuffle Saved shuffle mode (off, within-page, or all).
 * @property repeatTrack Whether "repeat track" was enabled.
 */
data class Session(
    val tracks: List<String> = emptyList(),
    val current: Int? = null,
    val positionSecs: Double = 0.0,
    val volume: Float = 1.0f,
    val shuffle: ShuffleMode = ShuffleMode.OFF,
    val repeatTrack: Boolean = false,
) {
    /**
     * Drop tracks that cannot or should not be played and remap the cursor onto the survivors, a
     * faithful port of the desktop's `prune_unplayable`. A track is kept only when it still exists
     * (per the injected predicate) and its extension is in the audio allowlist; dropping earlier
     * tracks shifts later indices, so [current] is remapped to the survivor's new position, and when
     * no current track survives both the cursor and [positionSecs] reset. The desktop reads file
     * existence from disk (`Path::exists`); this core takes that check as a parameter so the model
     * stays pure and deterministic, deferring real filesystem access to the platform layer.
     *
     * @param fileExists Predicate reporting whether a track path still exists, standing in for the
     *   desktop's `Path::exists` filesystem check.
     * @return New session holding only the surviving tracks, with the cursor and position fixed up.
     */
    fun pruneUnplayable(fileExists: (String) -> Boolean): Session {
        val kept = mutableListOf<String>()
        var newCurrent: Int? = null
        tracks.forEachIndexed { oldIndex, path ->
            if (fileExists(path) && isAudioFile(path)) {
                if (current == oldIndex) {
                    newCurrent = kept.size
                }
                kept.add(path)
            }
        }
        return copy(
            tracks = kept.toList(),
            current = newCurrent,
            positionSecs = if (newCurrent == null) 0.0 else positionSecs,
        )
    }
}
