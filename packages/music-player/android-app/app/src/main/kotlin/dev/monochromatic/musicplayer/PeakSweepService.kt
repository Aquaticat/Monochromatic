// Auto-started foreground service that runs the INITIAL full true-peak index in one continuous
// session, in parallel, on the performance cores. The periodic WorkManager sweep
// (PeakSweepScheduler) is throttled into ~10-minute charging windows and never finished a
// multi-thousand-track library on a real phone; a user-foreground service escapes that windowing.
// It runs the bulk index exactly once (guarded by a SharedPreferences flag) and then leaves
// incremental upkeep of newly added tracks to the low-priority background worker. See
// DECISION.peak-sweep-parallelism.md for the on-device benchmark that set the worker count and
// priority.

package dev.monochromatic.musicplayer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import androidx.core.net.toUri
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Foreground service that performs the one-time parallel true-peak index of the whole library.
 * Auto-started from [MainActivity] when the app is opened and the initial sweep has not yet
 * completed; self-terminates as soon as the library is fully measured.
 */
class PeakSweepService : Service() {
    /** Service-scoped coroutine scope for the sweep; cancelled in [onDestroy]. */
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** Bound clients are not supported; this service is start-only. */
    override fun onBind(intent: Intent?): IBinder? = null

    /** Promotes the service to foreground, runs the sweep, persists the done flag, then stops. */
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureChannel()
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(0, 0),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            } else {
                0
            },
        )
        scope.launch {
            /** True only when the sweep walked the whole library without being cut short. */
            val completed = runSweep()
            if (completed) {
                markInitialSweepDone(applicationContext)
            }
            ServiceCompat.stopForeground(this@PeakSweepService, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf(startId)
        }
        return START_NOT_STICKY
    }

    /** Loads the library and measures every uncached track across the parallel decode pool. */
    private suspend fun runSweep(): Boolean {
        /** The production track enumeration, the exact list the background worker also walks. */
        val tracks = LibrarySource.load(applicationContext)
        if (tracks.isEmpty()) {
            Log.i(TAG, "PeakSweepService found no library to index")
            return false
        }
        /** Outcome tally from the shared parallel coordinator over the foreground decode pool. */
        val tally = sweepTracksInParallel(
            items = tracks,
            workers = FOREGROUND_SWEEP_WORKERS,
            dispatcher = foregroundSweepDispatcher,
            flushBatch = FLUSH_BATCH,
            notifyEvery = NOTIFY_EVERY,
            maxTracks = Int.MAX_VALUE,
            process = { track ->
                measureAndCache(applicationContext, track.uri.toUri(), foregroundSweepDispatcher)
            },
            // The native decision cache commits each write itself, so there is nothing to flush.
            onFlush = { },
            onProgress = { done, total -> postProgress(done, total) },
        )
        Log.i(TAG, "PeakSweepService indexed ${tally.processed} of ${tally.total} tracks")
        return true
    }

    /** Creates the low-importance (silent) progress channel once; a no-op if it already exists. */
    private fun ensureChannel() {
        /** The system notification service this service posts its foreground notification through. */
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW),
            )
        }
    }

    /** Builds the ongoing progress notification; [total] of 0 renders an indeterminate bar. */
    private fun buildNotification(done: Int, total: Int): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(CHANNEL_NAME)
            .setContentText(if (total > 0) "$done of $total tracks" else "Starting")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .setProgress(total, done, total == 0)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()

    /** Refreshes the foreground notification with current progress. */
    private fun postProgress(done: Int, total: Int) {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification(done, total))
    }

    /** Cancels the sweep scope so a destroyed service does not leak its workers. */
    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    /**
     * API 34+ time-limit signal for a dataSync foreground service: stop promptly so the system does
     * not force-kill the app for ignoring it. Measurements persist in batches, so a stop here loses
     * at most one unflushed batch, which the next run re-measures from the cache cursor.
     */
    override fun onTimeout(startId: Int) {
        Log.w(TAG, "PeakSweepService hit the foreground-service time limit; stopping")
        stopSelf(startId)
    }

    /** Static entry points and tuning constants for the sweep service. */
    companion object {
        /** Shared logcat tag with the rest of the sweep code. */
        private const val TAG = "PeakSweep"

        /** Notification channel id for the indexing progress notification. */
        private const val CHANNEL_ID = "peak-sweep"

        /** User-visible channel and notification title. */
        private const val CHANNEL_NAME = "Indexing audio levels"

        /** Fixed id of the single foreground notification this service posts. */
        private const val NOTIFICATION_ID = 4201

        /** Fresh measurements between disk flushes: small enough to bound loss when killed, large
         *  enough that the full-file JSON rewrite stays cheap (the cache is about 120 KB). */
        private const val FLUSH_BATCH = 32

        /** Visit count between notification refreshes, so the UI updates without thrashing. */
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
