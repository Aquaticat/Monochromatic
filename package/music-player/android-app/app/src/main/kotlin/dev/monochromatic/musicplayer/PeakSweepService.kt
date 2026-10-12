// Auto-started foreground service that runs the INITIAL full true-peak index in one continuous
// session, in parallel, on the performance cores. The periodic WorkManager sweep
// (PeakSweepScheduler) is throttled into ~10-minute charging windows and never finished a
// multi-thousand-track library on a real phone; a user-foreground service escapes that windowing.
// It runs the bulk index exactly once (guarded by a SharedPreferences flag) and then leaves
// incremental upkeep of newly added tracks to the low-priority background worker. See
// DECISION.peak-sweep-parallelism.md for the on-device benchmark that set the worker count and
// priority.
//
// Decision D107: this service is the process owner of the analysis notification. Its mandatory foreground
// notification IS the progress notification (title, count, determinate bar, Pause and Resume button), posted
// from a coroutine of its own so the sweep workers and the UI thread never wait on the notification service.
// The sweep lives as long as this service, which outlives the activity; the pause gate is process-wide
// (AnalysisControl) because the button is a broadcast receiver.

package dev.monochromatic.musicplayer

import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import androidx.core.net.toUri
import dev.monochromatic.musicplayer.core.AnalysisNotificationContent
import dev.monochromatic.musicplayer.core.AnalysisNotificationPublisher
import dev.monochromatic.musicplayer.core.AnalysisUpdatePacer
import dev.monochromatic.musicplayer.core.analysisNotificationContent
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Foreground service that performs the one-time parallel true-peak index of the whole library.
 * Auto-started from [MainActivity] when the app is opened and the initial sweep has not yet
 * completed; self-terminates as soon as the library is fully measured. Its foreground notification
 * is the analysis progress notification of decision D107.
 */
class PeakSweepService : Service() {
    /** Service-scoped coroutine scope for the sweep; cancelled in [onDestroy]. */
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** Publisher of the run in progress, or null before the first start command; touched on the main thread. */
    private var publisher: AnalysisNotificationPublisher? = null

    /** Job of the run in progress, so a repeated start command does not begin a second sweep. */
    private var sweepJob: Job? = null

    /** Bound clients are not supported; this service is start-only. */
    override fun onBind(intent: Intent?): IBinder? = null

    /**
     * Promotes the service to foreground, runs the sweep, persists the done flag, then stops. A start command
     * that arrives while a sweep runs (the activity was recreated) only refreshes the foreground promotion.
     */
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureAnalysisChannel(this)
        /** Publisher of the run that is already in progress, if there is one. */
        val running: AnalysisNotificationPublisher? = publisher
        if (running != null && sweepJob?.isActive == true) {
            Log.i(TAG, "PeakSweepService start command ignored: a sweep is already running")
            promoteToForeground(running.currentContent())
            return START_NOT_STICKY
        }
        /** Frame shown until the library is read and the total is known, an indeterminate bar. */
        val firstFrame: AnalysisNotificationContent = analysisNotificationContent(done = 0, total = 0, paused = false)
        promoteToForeground(firstFrame)
        /** Pacer that knows the first frame was posted by the foreground promotion. */
        val pacer = AnalysisUpdatePacer()
        pacer.markPosted(content = firstFrame, nowMs = SystemClock.elapsedRealtime())
        /** Publisher that posts paced updates from a coroutine of its own. */
        val newPublisher = AnalysisNotificationPublisher(
            paused = AnalysisControl.pauseGate.paused,
            pacer = pacer,
            clockMs = SystemClock::elapsedRealtime,
            post = { content -> postContent(content) },
            remove = { removeNotification() },
        )
        publisher = newPublisher
        sweepJob = scope.launch {
            /** Posting loop, on the IO dispatcher because a post is a binder call. */
            val poster: Job = launch(Dispatchers.IO) { newPublisher.run() }
            /** True only when the sweep walked the whole library without being cut short. */
            val completed: Boolean = try {
                runSweep(newPublisher)
            } finally {
                newPublisher.abandon()
            }
            poster.join()
            AnalysisControl.setActiveTotal(0)
            if (completed) {
                markInitialSweepDone(applicationContext)
            }
            ServiceCompat.stopForeground(this@PeakSweepService, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
        return START_NOT_STICKY
    }

    /** Loads the library and measures every uncached track across the parallel decode pool. */
    private suspend fun runSweep(newPublisher: AnalysisNotificationPublisher): Boolean {
        AnalysisControl.pauseGate.resume()
        SweepProgress.reset()
        /** The production track enumeration, the exact list the background worker also walks. */
        val tracks = LibrarySource.load(applicationContext)
        if (tracks.isEmpty()) {
            Log.i(TAG, "PeakSweepService found no library to index")
            return false
        }
        SweepProgress.report(done = 0, total = tracks.size)
        newPublisher.report(done = 0, total = tracks.size)
        AnalysisControl.setActiveTotal(tracks.size)
        /** Outcome tally from the shared parallel coordinator over the foreground decode pool. */
        val tally = try {
            sweepTracksInParallel(
                items = tracks,
                workers = FOREGROUND_SWEEP_WORKERS,
                dispatcher = foregroundSweepDispatcher,
                flushBatch = FLUSH_BATCH,
                notifyEvery = NOTIFY_EVERY,
                maxTracks = Int.MAX_VALUE,
                process = { track ->
                    measureAndCache(applicationContext, track.uri.toUri(), foregroundSweepDispatcher)
                },
                onFlush = { },
                onProgress = { done, total ->
                    SweepProgress.report(done = done, total = total)
                    newPublisher.report(done = done, total = total)
                },
                pauseGate = AnalysisControl.pauseGate,
            )
        } catch (cancellation: CancellationException) {
            SweepProgress.reset()
            throw cancellation
        }
        SweepProgress.report(done = tally.total, total = tally.total)
        newPublisher.report(done = tally.total, total = tally.total)
        newPublisher.complete()
        Log.i(TAG, "PeakSweepService indexed ${tally.processed} of ${tally.total} tracks")
        return true
    }

    /** Promotes the service to foreground with the notification for [content]. */
    private fun promoteToForeground(content: AnalysisNotificationContent) {
        ServiceCompat.startForeground(
            this,
            ANALYSIS_NOTIFICATION_ID,
            buildAnalysisNotification(this, content),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            } else {
                0
            },
        )
    }

    /**
     * Posts [content] over the foreground notification. Called from the posting coroutine only; a failure is
     * logged and swallowed so one refused post cannot end the posting loop.
     */
    private fun postContent(content: AnalysisNotificationContent) {
        runCatching {
            getSystemService(NotificationManager::class.java)
                .notify(ANALYSIS_NOTIFICATION_ID, buildAnalysisNotification(this, content))
        }.onFailure { refused ->
            Log.w(TAG, "PeakSweepService could not post the analysis notification", refused)
        }
    }

    /**
     * Takes the notification away: ends the foreground promotion with removal, then cancels any plain copy.
     * Called from the posting coroutine after the final value, so no post can follow it.
     */
    private fun removeNotification() {
        runCatching {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            getSystemService(NotificationManager::class.java).cancel(ANALYSIS_NOTIFICATION_ID)
        }.onFailure { refused ->
            Log.w(TAG, "PeakSweepService could not remove the analysis notification", refused)
        }
    }

    /** Cancels the sweep scope so a destroyed service does not leak its workers. */
    override fun onDestroy() {
        scope.cancel()
        AnalysisControl.setActiveTotal(0)
        super.onDestroy()
    }

    /**
     * API 34+ time-limit signal for a dataSync foreground service: stop promptly so the system does
     * not force-kill the app for ignoring it. Measurements persist in batches, so a stop here loses
     * at most one unflushed batch, which the next run re-measures from the cache cursor.
     */
    override fun onTimeout(startId: Int) {
        Log.w(TAG, "PeakSweepService hit the foreground-service time limit; stopping")
        stopSelf()
    }

    /** Static entry points and tuning constants for the sweep service. */
    companion object {
        /** Shared logcat tag with the rest of the sweep code. */
        private const val TAG = "PeakSweep"

        /** Fresh measurements between disk flushes: small enough to bound loss when killed, large
         *  enough that the full-file JSON rewrite stays cheap (the cache is about 120 KB). */
        private const val FLUSH_BATCH = 32

        /** Visit count between progress reports, so the sweep reports without thrashing. */
        private const val NOTIFY_EVERY = 16

        /** Private preferences file holding the one-time initial-sweep flag. */
        private const val PREFS = "peak-sweep"

        /** Preference key set once the initial full index has completed. */
        private const val KEY_INITIAL_DONE = "initial-sweep-done"

        /** Starts the foreground sweep unless the initial full index has already completed. */
        fun startIfNeeded(context: Context) {
            if (context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_INITIAL_DONE, false)) {
                return
            }
            ContextCompat.startForegroundService(context, Intent(context, PeakSweepService::class.java))
        }

        /** Records that the initial full index finished, so it is not auto-started again. */
        private fun markInitialSweepDone(context: Context) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit { putBoolean(KEY_INITIAL_DONE, true) }
        }
    }
}
