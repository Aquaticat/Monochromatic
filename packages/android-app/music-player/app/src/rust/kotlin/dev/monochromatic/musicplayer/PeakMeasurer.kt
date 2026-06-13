package dev.monochromatic.musicplayer

import android.content.Context
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.os.Process
import java.io.FileNotFoundException
import java.util.concurrent.Executors
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.withContext

/**
 * One low-priority (nice 19) daemon thread the background sweep decodes on, so its CPU-heavy native
 * true-peak pass yields to playback and the UI under contention. Mirrors the Media3 flavor's sweep
 * dispatcher: [Process.THREAD_PRIORITY_LOWEST] runs full speed when idle (the overnight charging window
 * the sweep targets) and almost fully yields whenever a foreground thread wants the CPU. One thread
 * suffices because the sweep measures one track at a time; a daemon never holds the process open.
 */
private val sweepDecodeDispatcher: CoroutineDispatcher =
    Executors.newSingleThreadExecutor { runnable ->
        Thread(
            {
                Process.setThreadPriority(Process.THREAD_PRIORITY_LOWEST)
                runnable.run()
            },
            "peak-sweep-decode",
        ).apply { isDaemon = true }
    }.asCoroutineDispatcher()

/**
 * Full-Rust flavor's offline true-peak measurer for the background sweep, mirroring the Media3 flavor's
 * `measureTrackPeak` so the engine-agnostic [measureAndCache] resolves the right decoder at compile
 * time. Decodes the track natively (symphonia/libopus via `nativeMeasureTruePeak`) on the low-priority
 * sweep thread, the in-process replacement for the Media3 flavor's MediaCodec decoder.
 *
 * @param context Resolves the URI to a descriptor.
 * @param uri Track content URI (MediaStore or SAF document).
 * @return Measured true peak (linear), `0.0` for a zero-channel stream.
 * @example
 * ```kotlin
 * val peak = measureTrackPeak(context, track.uri.toUri())
 * ```
 */
suspend fun measureTrackPeak(context: Context, uri: Uri): Float =
    withContext(sweepDecodeDispatcher) { measureTruePeakBlocking(context, uri) }

/**
 * Open [uri] read-only and run the native true-peak measure on the calling thread, returning its true
 * peak. The borrowed descriptor's fd is passed inside `use {}`, so the native side dups it synchronously
 * while it is still open. The background sweep calls this on its low-priority dispatcher; the foreground
 * engine calls it on a default background thread, so the dispatcher choice lives with each caller.
 *
 * @param context Resolves the URI's provider.
 * @param uri Track content URI.
 * @return Measured true peak (linear).
 * @throws FileNotFoundException When the provider cannot open the URI.
 * @throws IllegalStateException When the native measure returns an error code.
 */
internal fun measureTruePeakBlocking(context: Context, uri: Uri): Float {
    val descriptor: ParcelFileDescriptor = context.contentResolver.openFileDescriptor(uri, "r")
        ?: throw FileNotFoundException("could not open $uri for true-peak measure")
    val peak: Float = descriptor.use { NativeBridge.nativeMeasureTruePeak(it.fd) }
    if (peak < 0.0f) {
        throw IllegalStateException("native true-peak measure failed (code $peak) for $uri")
    }
    return peak
}
