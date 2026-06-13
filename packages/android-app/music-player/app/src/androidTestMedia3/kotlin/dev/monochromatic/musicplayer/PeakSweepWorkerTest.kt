package dev.monochromatic.musicplayer

import android.content.Context
import android.net.Uri
import androidx.core.net.toUri
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.work.ListenableWorker
import androidx.work.testing.TestListenableWorkerBuilder
import androidx.work.workDataOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * On-device verification of the background peak sweep against the installed app's real library and
 * cache file. The sweep's value is end to end: enumerate the same source playback uses, decode through
 * a real [android.media.MediaCodec], and write the shared `peaks.json`, none of which exist on the
 * host JVM. So this is a connected (instrumented) test, run via `am instrument` against the installed
 * app (the AGP `connectedAndroidTest` task uninstalls afterward and would wipe the persisted folder
 * grant the library scan depends on).
 *
 * The decode is silent (decode-only, no [android.media.AudioTrack]), so the sweep makes no sound while
 * it runs. Both tests are bounded to a single track ([PeakSweepWorker.KEY_MAX_TRACKS] for the worker,
 * one explicit URI for the helper) so an instrumented run stays seconds long instead of decoding the
 * whole device library; writing the measured peak into the real cache is the correct production
 * behavior, not a side effect to undo.
 */
@RunWith(AndroidJUnit4::class)
class PeakSweepWorkerTest {
    private val context: Context get() = ApplicationProvider.getApplicationContext()

    /**
     * The engine-agnostic sweep body measures an uncached track, memoizes its peak, and is a pure
     * cache hit the second time. This pins the seam the worker loops over: fingerprint, cache lookup,
     * decode-on-miss, and write, against a real track from the device library.
     */
    @Test
    fun measureAndCacheMeasuresThenCachesOneTrack() {
        val tracks: List<Track> = runBlocking { LibrarySource.load(context) }
        assumeTrue("device library is empty; nothing to sweep", tracks.isNotEmpty())
        val uri: Uri = tracks.first().uri.toUri()

        val first: SweepOutcome = runBlocking { measureAndCache(context, uri) }
        assertTrue(
            "first pass should measure the track or find it already cached, was $first",
            first == SweepOutcome.MEASURED || first == SweepOutcome.CACHED,
        )

        val key: String? = runBlocking { TrackFingerprint.of(context, uri) }
        assertNotNull("a library track must be fingerprintable", key)
        val cachedPeak: Float? = runBlocking { PeakCacheStore.get(context, key!!) }
        assertNotNull("the peak must be cached after the first pass", cachedPeak)
        assertTrue(
            "cached peak $cachedPeak should be a sane, finite level",
            cachedPeak!!.isFinite() && cachedPeak >= 0.0f && cachedPeak < SANE_PEAK_UPPER_BOUND,
        )

        val second: SweepOutcome = runBlocking { measureAndCache(context, uri) }
        assertEquals("the second pass must be a pure cache hit", SweepOutcome.CACHED, second)
    }

    /**
     * The worker, driven through WorkManager's own test harness, enumerates the library, processes its
     * bounded share, and reports success so periodic scheduling continues. Bounding it to one track
     * keeps the run short while still crossing the real enumerate to decode to flush to result path.
     */
    @Test
    fun workerSweepsBoundedShareAndSucceeds() {
        val worker: PeakSweepWorker = TestListenableWorkerBuilder
            .from(context, PeakSweepWorker::class.java)
            .setInputData(workDataOf(PeakSweepWorker.KEY_MAX_TRACKS to 1))
            .build()
        val result: ListenableWorker.Result = runBlocking { worker.doWork() }
        assertTrue("a normal sweep run must report success, was $result", result is ListenableWorker.Result.Success)
    }

    private companion object {
        /** True peaks above this are physically implausible (a few dB of inter-sample overshoot is normal). */
        private const val SANE_PEAK_UPPER_BOUND: Float = 4.0f
    }
}
