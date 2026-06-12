package dev.monochromatic.musicplayer

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

/**
 * The audio-read permission for this platform: the granular `READ_MEDIA_AUDIO` on API 33+, the broad
 * `READ_EXTERNAL_STORAGE` on API 26-32 (where the granular permission does not exist). Shared by the
 * activity (which requests it) and [PlaybackService] (which checks it before loading the library on a
 * headless restart).
 *
 * @return Permission string to request and check.
 * @example
 * ```kotlin
 * permissionLauncher.launch(audioPermission())
 * ```
 */
internal fun audioPermission(): String =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        Manifest.permission.READ_MEDIA_AUDIO
    } else {
        Manifest.permission.READ_EXTERNAL_STORAGE
    }

/**
 * Whether the platform's audio-read permission ([audioPermission]) is already granted, so the first
 * composition can skip the gate and the service can self-load its library after a process restart
 * (the grant persists across process death).
 *
 * @param context Context to check the permission against.
 * @return True when the permission is granted.
 * @example
 * ```kotlin
 * if (hasAudioPermission(context)) controller.openLibrary(MediaStoreSource.query(resolver))
 * ```
 */
internal fun hasAudioPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, audioPermission()) == PackageManager.PERMISSION_GRANTED
