package dev.monochromatic.musicplayer

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Schedules [PeakSweepWorker] as unique periodic work that runs only while charging. The worker is
 * enqueued whenever a library becomes available (a headless restart with a held grant, or the activity
 * granting audio access), and [ExistingPeriodicWorkPolicy.KEEP] makes that idempotent: the first
 * enqueue wins and later ones are no-ops, so calling it from several entry points cannot stack
 * duplicate sweeps.
 *
 * Charging is the only constraint: a full first pass is hours of decode, so it must not run on
 * battery. Contention with playback is not handled by a device-idle constraint (which on some devices
 * is never satisfied together with charging, and would also block the sweep while the phone is simply
 * in use); instead the decode itself runs at the lowest thread priority (see `measureTrackPeak`), the
 * Android analog of the desktop's idle-priority worker, so it yields to playback and the UI while
 * still making progress whenever the phone is plugged in.
 *
 * Periodic, not one-time-with-retry: a long first sweep is broken across many short runs (a single
 * worker execution is capped at about ten minutes), and one-time work would have to return
 * [androidx.work.ListenableWorker.Result.retry] on each forced stop, whose exponential backoff (capped
 * at five hours, reset only on a terminal result) would throttle the sweep to one attempt per five
 * hours regardless of charge state. A periodic request sidesteps that entirely, and re-running each
 * period also picks up tracks added since the last sweep.
 */
object PeakSweepScheduler {
    /** Unique name so repeated enqueues collapse to the one sweep. */
    private const val UNIQUE_WORK_NAME: String = "peak-sweep"

    /**
     * Repeat interval, the platform minimum for periodic work. The interval only gates the minimum gap
     * between runs; the charging constraint decides when a run actually fires, so a shorter nominal
     * interval simply means "as often as charging allows".
     */
    private const val SWEEP_INTERVAL_MINUTES: Long = 15L

    /**
     * Enqueue the sweep if it is not already scheduled. Safe to call from every point a library
     * becomes available; [ExistingPeriodicWorkPolicy.KEEP] dedups.
     *
     * @param context Resolves the [WorkManager] instance.
     * @example
     * ```kotlin
     * if (hasAudioPermission(context)) PeakSweepScheduler.enqueue(context)
     * ```
     */
    fun enqueue(context: Context) {
        val constraints: Constraints = Constraints.Builder()
            .setRequiresCharging(true)
            .build()
        val request = PeriodicWorkRequestBuilder<PeakSweepWorker>(SWEEP_INTERVAL_MINUTES, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(UNIQUE_WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }
}
