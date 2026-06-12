package dev.monochromatic.musicplayer

/**
 * One entry of a [PlaybackSnapshot]: the data a [MediaSession] timeline window needs for one track in
 * the current playback scope.
 *
 * @property uri Playback `content://`/file URI the engine opens.
 * @property title Folder-relative display path shown as the track title on the notification/lockscreen.
 * @property loadIndex Load-order index of this track; used as the stable timeline-window uid so the UI
 *   can map the current media item back to its row.
 */
data class SnapshotItem(
    val uri: String,
    val title: String,
    val loadIndex: Int,
)

/**
 * A point-in-time view of [PlayerController] for the [BrainPlayer] projection: the current playback
 * scope as an ordered track list plus the transport state a [MediaSession] reports. Read fresh on
 * each `getState()` pull; position/duration are sampled here and extrapolated by the session between
 * pulls, so the snapshot is not rebuilt every frame.
 *
 * @property items Current scope's tracks in playback order (timeline window order).
 * @property currentIndex Position within [items] of the current track, or null when the queue is empty.
 * @property playWhenReady Play intent (playing or buffering, false when paused): what the session
 *   reports so the notification icon does not flip during buffering, distinct from actual sound.
 * @property volume Output gain in `0.0..1.0`.
 * @property durationMs Current track duration in milliseconds, 0 when not yet known.
 * @property positionMs Current playback position in milliseconds.
 */
data class PlaybackSnapshot(
    val items: List<SnapshotItem>,
    val currentIndex: Int?,
    val playWhenReady: Boolean,
    val volume: Float,
    val durationMs: Long,
    val positionMs: Long,
)
