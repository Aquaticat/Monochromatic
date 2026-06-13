package dev.monochromatic.musicplayer

import android.content.Context
import android.net.Uri
import android.util.Log
import kotlinx.coroutines.CancellationException

/** Logcat tag shared by the measure-and-cache helper and [PeakSweepWorker]. */
private const val SWEEP_TAG: String = "PeakSweep"

/**
 * What [measureAndCache] did with one track, so the worker can count outcomes, decide when to flush,
 * and log a useful summary.
 *
 * @property CACHED Already measured; the cache held a peak, so nothing was decoded.
 * @property MEASURED Decoded and a fresh peak was memoized (pending flush by the caller).
 * @property UNFINGERPRINTABLE No cache key could be derived (the provider did not report a size), so
 *   the track is skipped; playback would fall back to unity gain for it too.
 * @property FAILED The decode threw (unsupported or corrupt file); left uncached so a later pass, or a
 *   foreground play, can retry it.
 */
enum class SweepOutcome { CACHED, MEASURED, UNFINGERPRINTABLE, FAILED }

/**
 * Measure the true peak of the track at [uri] and memoize it in [PeakCacheStore], unless it is already
 * cached. This is the engine-agnostic body of the sweep: it fingerprints the track, short-circuits on
 * a cache hit, and otherwise delegates the actual decode to the per-flavor [measureTrackPeak] seam
 * (the Media3 flavor decodes via [Media3TruePeakDecoder]; the Rust flavors will use their native
 * decoder). It deliberately does not flush: the foreground path flushes per measurement, but the sweep
 * batches many measurements per flush, so persistence is the caller's call.
 *
 * The outcome mirrors [Media3Engine]'s foreground resolve: a coroutine cancellation propagates (the
 * worker is being stopped mid-track), while any decode failure is logged and swallowed so one bad file
 * cannot abort a sweep of thousands.
 *
 * @param context Resolves the URI's provider for fingerprinting and decoding.
 * @param uri Track content URI (MediaStore or SAF document).
 * @return Which branch ran, for the worker's accounting and flush cadence.
 * @example
 * ```kotlin
 * when (measureAndCache(context, track.uri.toUri())) {
 *     SweepOutcome.MEASURED -> pendingFlush++
 *     else -> Unit
 * }
 * ```
 */
suspend fun measureAndCache(context: Context, uri: Uri): SweepOutcome {
    val key: String = TrackFingerprint.of(context, uri) ?: return SweepOutcome.UNFINGERPRINTABLE
    if (PeakCacheStore.get(context, key) != null) {
        return SweepOutcome.CACHED
    }
    val peak: Float = try {
        measureTrackPeak(context, uri)
    } catch (cancellation: CancellationException) {
        throw cancellation
    } catch (failure: Exception) {
        Log.w(SWEEP_TAG, "true-peak measure failed for $uri; leaving it uncached", failure)
        return SweepOutcome.FAILED
    }
    PeakCacheStore.put(context, key, peak)
    return SweepOutcome.MEASURED
}
