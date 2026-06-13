package dev.monochromatic.musicplayer

import android.content.Context
import android.util.Log
import androidx.core.net.toUri
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/**
 * Background true-peak sweep: walks the active library ([LibrarySource]) and measures-and-caches every
 * uncached track, so playback rarely meets a track whose peak is not already known and the foreground
 * decode-on-miss becomes the exception rather than the rule. A full first sweep is large (each opus
 * track is seconds of decode and the library is thousands of tracks), so it runs only while charging
 * (see [PeakSweepScheduler]) and decodes at the lowest thread priority, yielding to playback rather
 * than contending with it.
 *
 * The sweep is silent by construction: [measureAndCache] decodes through [Media3TruePeakDecoder],
 * which is a decode-only pass with no [android.media.AudioTrack], so it produces no sound while it
 * runs. It is also resumable for free, with no separate cursor: the durable cursor is the cache file
 * itself, because an already-measured track is a cheap [PeakCacheStore] hit that the next pass skips.
 *
 * A single worker execution is time-bounded by the platform (WorkManager's ~10-minute
 * foreground-service-less limit), so [doWork] cooperates: it checks [isStopped] at every track
 * boundary, flushes what it measured, and returns [Result.success]. It does not return [Result.retry]:
 * WorkManager's exponential backoff (capped at five hours, and only reset on a terminal result) would
 * otherwise pin a long sweep to one attempt per five hours even while charging held continuously. As
 * periodic work, returning success keeps the attempt count
 * at zero and lets the next period continue the backlog, and newly added tracks are caught by future
 * periods natively. Per-track failures never fail the run, so one unsupported file cannot stall the
 * sweep forever.
 *
 * @param context Application context WorkManager constructs the worker with.
 * @param parameters Worker parameters, including the [KEY_MAX_TRACKS] bound used by tests.
 */
class PeakSweepWorker(
    context: Context,
    parameters: WorkerParameters,
) : CoroutineWorker(context, parameters) {
    /**
     * Sweep the library once, bounded by the idle window: measure each uncached track, flush in
     * batches, and stop cooperatively when the platform asks. Always reports success so periodic
     * scheduling continues without backoff.
     *
     * @return [Result.success] in every normal case; the backlog resumes on the next period.
     */
    override suspend fun doWork(): Result {
        val tracks: List<Track> = LibrarySource.load(applicationContext)
        if (tracks.isEmpty()) {
            Log.i(WORKER_TAG, "PeakSweepWorker found no library to sweep")
            return Result.success()
        }
        val limit: Int = inputData.getInt(KEY_MAX_TRACKS, DEFAULT_MAX_TRACKS)
        var processed = 0
        var measured = 0
        var cached = 0
        var skipped = 0
        var failed = 0
        var pendingFlush = 0
        for (track in tracks) {
            if (isStopped || processed >= limit) {
                break
            }
            val outcome: SweepOutcome = measureAndCache(applicationContext, track.uri.toUri())
            processed += 1
            when (outcome) {
                SweepOutcome.MEASURED -> {
                    measured += 1
                    pendingFlush += 1
                }
                SweepOutcome.CACHED -> cached += 1
                SweepOutcome.UNFINGERPRINTABLE -> skipped += 1
                SweepOutcome.FAILED -> failed += 1
            }
            if (pendingFlush >= FLUSH_BATCH) {
                PeakCacheStore.flush(applicationContext)
                pendingFlush = 0
            }
        }
        if (pendingFlush > 0) {
            PeakCacheStore.flush(applicationContext)
        }
        Log.i(
            WORKER_TAG,
            "PeakSweepWorker swept $processed/${tracks.size} tracks " +
                "(measured=$measured cached=$cached skipped=$skipped failed=$failed stopped=$isStopped)",
        )
        return Result.success()
    }

    companion object {
        /** Logcat tag shared with [measureAndCache]. */
        private const val WORKER_TAG: String = "PeakSweep"

        /**
         * Fresh measurements between disk flushes. Each flush rewrites the whole `peaks.json`, so a
         * small batch keeps writes infrequent while bounding the at-most-this-many measurements an
         * abrupt stop can lose (they are simply re-measured on the next pass, idempotently).
         */
        private const val FLUSH_BATCH: Int = 16

        /**
         * Input-data key capping how many tracks one run processes. Unset in production (the run is
         * bounded only by [isStopped]); a test sets it small so a single instrumented run stays short
         * instead of decoding the whole device library.
         */
        internal const val KEY_MAX_TRACKS: String = "max_tracks"

        /** No cap: a production run processes the whole backlog until the platform stops it. */
        internal const val DEFAULT_MAX_TRACKS: Int = Int.MAX_VALUE
    }
}
