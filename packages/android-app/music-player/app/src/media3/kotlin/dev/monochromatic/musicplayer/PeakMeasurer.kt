package dev.monochromatic.musicplayer

import android.content.Context
import android.net.Uri
import android.os.Process
import java.util.concurrent.Executors
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.asCoroutineDispatcher

/**
 * One low-priority thread the background sweep decodes on, so its CPU-heavy true-peak pass yields to
 * playback and the UI under contention. This is the Android analog of the desktop's idle-priority
 * worker: [Process.THREAD_PRIORITY_LOWEST] is nice 19, the lowest the platform offers, so the decode
 * runs at full speed when nothing competes (the overnight charging window the sweep targets) and
 * almost fully yields whenever a foreground thread wants the CPU. A single thread suffices because the
 * sweep measures one track at a time, and it is a daemon so it never holds the process open.
 *
 * The foreground measure-on-miss keeps decoding on the shared [kotlinx.coroutines.Dispatchers.IO]
 * (the decoder's default), so a mid-song gain correction is never slowed by this lower priority.
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
 * Media3 flavor's offline true-peak measurer for the background sweep. The same function signature is
 * provided by each flavor source set (exactly like `createAudioEngine`), so the engine-agnostic
 * [measureAndCache] in `main` resolves the right decoder at compile time without a runtime switch. The
 * Media3 flavor decodes through the platform [Media3TruePeakDecoder]; the Rust flavors will feed their
 * native decoder.
 *
 * This seam is the sweep's only caller, so it always decodes on the low-priority [sweepDecodeDispatcher]
 * (the foreground player calls [Media3TruePeakDecoder.measure] directly with the default dispatcher,
 * so it is unaffected).
 *
 * @param context Resolves the URI's provider for decoding.
 * @param uri Track content URI (MediaStore or SAF document).
 * @return Measured true peak across the stream, linear and typically near `1.0` for full-scale
 *   material; `0.0` for a zero-channel stream.
 * @example
 * ```kotlin
 * val peak = measureTrackPeak(context, track.uri.toUri())
 * ```
 */
suspend fun measureTrackPeak(context: Context, uri: Uri): Float =
    Media3TruePeakDecoder.measure(context, uri, sweepDecodeDispatcher)
