// The Android side of the analysis-failure notification (decision D123): channel, builder and the post.

// What:     `package dev.monochromatic.musicplayer` places the poster beside the analysis notification it must not
//           disturb.
// Why:      Everything with a decision in it lives in `core`; this file only maps the notice onto Android types and
//           reads the platform state the decision needs.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import dev.monochromatic.musicplayer.core.AnalysisFailureNotice
import dev.monochromatic.musicplayer.core.NotificationPostVerdict
import dev.monochromatic.musicplayer.core.deliverAnalysisFailureNotice
import dev.monochromatic.musicplayer.core.notificationPostVerdict

/** Id of the notification channel that carries only the analysis-failure notification. */
internal const val ANALYSIS_FAILURE_CHANNEL_ID: String = "analysis-failure"

/** Channel name that the system settings show to the user. */
private const val ANALYSIS_FAILURE_CHANNEL_NAME: String = "Analysis problems"

/** Fixed id of the analysis-failure notification, different from the progress notification's id. */
internal const val ANALYSIS_FAILURE_NOTIFICATION_ID: Int = 4202

/** Logcat tag of the failure notification, shared with the sweep code that reports to it. */
private const val FAILURE_NOTIFICATION_TAG: String = "PeakSweep"

// What:     `fun ensureAnalysisFailureChannel(context)` creates the low-importance channel when it is missing.
// Why:      An analysis failure is not urgent, so the channel is IMPORTANCE_LOW, which Android describes as "Makes no
//           sound": the notification waits in the shade without a sound or a heads-up. A channel that exists keeps
//           whatever the user set in the settings, because importance cannot be changed by the app after creation.
//
// In TS you'd write (pseudocode):
// ```ts
// function ensureAnalysisFailureChannel(context) { if (!manager.hasChannel("analysis-failure")) manager.create(...); }
// ```
/**
 * Creates the `analysis-failure` notification channel when it is missing.
 *
 * @param context any context of this app
 */
internal fun ensureAnalysisFailureChannel(context: Context) {
    /** The system notification service that owns the channels. */
    val manager: NotificationManager = context.getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(ANALYSIS_FAILURE_CHANNEL_ID) != null) {
        return
    }
    manager.createNotificationChannel(
        NotificationChannel(
            ANALYSIS_FAILURE_CHANNEL_ID,
            ANALYSIS_FAILURE_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_LOW,
        ),
    )
}

// What:     `internal fun buildAnalysisFailureNotification(context, notice)` maps the notice onto a notification.
// Why:      D123: the title and text are the old message's two lines, shown expanded so the retry sentence is not
//           cut off; it has the app's small icon, goes away when tapped, has no action button, and tapping it opens
//           the app.
//
// In TS you'd write (pseudocode):
// ```ts
// function buildAnalysisFailureNotification(context, notice): Notification { /* title, text, icon, tap target */ }
// ```
/**
 * Builds the analysis-failure notification for [notice].
 *
 * @param context any context of this app
 * @param notice what the notification says
 * @return the notification, ready to post
 */
internal fun buildAnalysisFailureNotification(context: Context, notice: AnalysisFailureNotice): Notification {
    /** Builder on the failure channel with every part of the notification. */
    val builder: NotificationCompat.Builder = NotificationCompat.Builder(context, ANALYSIS_FAILURE_CHANNEL_ID)
        .setContentTitle(notice.title)
        .setContentText(notice.text)
        .setStyle(NotificationCompat.BigTextStyle().bigText(notice.text))
        .setSmallIcon(R.drawable.ic_stat_analysis)
        .setCategory(NotificationCompat.CATEGORY_ERROR)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setAutoCancel(true)
    openAppIntent(context)?.let { openApp -> builder.setContentIntent(openApp) }
    return builder.build()
}

// What:     `private fun currentPostVerdict(context)` reads the platform state and applies the decision.
// Why:      The decision itself is pure; this reads the permission, the app-wide switch and the channel's importance,
//           after making sure the channel exists, because a channel that was never created cannot be switched off.
//
// In TS you'd write (pseudocode):
// ```ts
// const currentPostVerdict = (context) => notificationPostVerdict({ sdk, permission, appEnabled, channelOff });
// ```
/** Returns whether a notification can be posted on the failure channel right now. */
private fun currentPostVerdict(context: Context): NotificationPostVerdict {
    ensureAnalysisFailureChannel(context)
    /** The system notification service that knows the switches. */
    val manager: NotificationManager = context.getSystemService(NotificationManager::class.java)
    /** The failure channel as the user left it, or null when it vanished. */
    val channel: NotificationChannel? = manager.getNotificationChannel(ANALYSIS_FAILURE_CHANNEL_ID)
    return notificationPostVerdict(
        sdkInt = Build.VERSION.SDK_INT,
        permissionGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED,
        notificationsEnabled = manager.areNotificationsEnabled(),
        channelDisabled = channel?.importance == NotificationManager.IMPORTANCE_NONE,
    )
}

// What:     `fun postAnalysisFailureNotification(context, fileNames)` posts the one notification for a report.
// Why:      D123: the notification replaces the in-app message and has no fallback; when it cannot be posted the log
//           gets one warning and nothing is shown. No failure here reaches the sweep that reports.
//
// In TS you'd write (pseudocode):
// ```ts
// function postAnalysisFailureNotification(context, names) { deliver(names, verdictOf(context), notify, logWarning); }
// ```
/**
 * Posts one notification that names [fileNames], or logs one warning and posts nothing when it cannot be posted.
 *
 * @param context any context of this app
 * @param fileNames bare names of the files whose analysis failed for the first time
 */
internal fun postAnalysisFailureNotification(context: Context, fileNames: List<String>) {
    /** Whether the notice was posted, logged for the sweep's log line. */
    val posted: Boolean = deliverAnalysisFailureNotice(
        fileNames = fileNames,
        verdict = { currentPostVerdict(context) },
        post = { notice ->
            context.getSystemService(NotificationManager::class.java)
                .notify(ANALYSIS_FAILURE_NOTIFICATION_ID, buildAnalysisFailureNotification(context, notice))
        },
        warn = { message, cause -> Log.w(FAILURE_NOTIFICATION_TAG, message, cause) },
    )
    Log.i(FAILURE_NOTIFICATION_TAG, "analysis failure notification files=${fileNames.size} posted=$posted")
}
