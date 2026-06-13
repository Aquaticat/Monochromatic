package dev.monochromatic.musicplayer

import android.app.Instrumentation
import android.content.ContentUris
import android.net.Uri
import android.provider.MediaStore
import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicReference

/**
 * Drives the full-Rust [RustEngine] end to end on this GrapheneOS device: load a real `content://`
 * track, play, pause, and seek, checking that position advances while playing, freezes while paused,
 * and jumps after a seek, and that duration is read. This exercises the whole native stack the variant
 * exists to measure (fd dup -> symphonia/libopus decode -> SPSC ring -> AAudio output -> position),
 * crossing the Kotlin/JNI boundary the real player uses.
 *
 * Resident-noise rule: the engine is set to volume 0 before playing, so the AAudio stream runs (the
 * output path is genuinely exercised) but emits pure silence; nothing is audible and no MediaSession is
 * involved, so no session ever reports PLAYING. The engine is created and driven on the main thread
 * (via runOnMainSync) so it and its poller stay single-threaded; sleeps run on the test thread so the
 * main looper keeps ticking. Needs READ_MEDIA_AUDIO (granted via `adb shell pm grant`); skips when no
 * library is indexed.
 */
class RustEngineTest {
    @Test
    fun playsPausesSeeksThroughRustEngine() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val uri: Uri? = audioUris(instrumentation, 1).firstOrNull()
        assumeTrue("no indexed MediaStore audio (grant READ_MEDIA_AUDIO)", uri != null)

        val engineRef = AtomicReference<RustEngine>()
        instrumentation.runOnMainSync {
            val engine = RustEngine(context)
            engine.setVolume(0.0f)
            engine.load(uri.toString(), true)
            engineRef.set(engine)
        }

        Thread.sleep(SETTLE_MS)
        val positionPlaying: Double = onMain(instrumentation) { engineRef.get().positionSec() }
        val duration: Double = onMain(instrumentation) { engineRef.get().durationSec() }
        val playWhenReady: Boolean = onMain(instrumentation) { engineRef.get().playWhenReady() }
        Log.i(BENCH_TAG, "RustEngine playing: pos=$positionPlaying dur=$duration playWhenReady=$playWhenReady")

        instrumentation.runOnMainSync { engineRef.get().pause() }
        Thread.sleep(STEP_MS)
        val pausedA: Double = onMain(instrumentation) { engineRef.get().positionSec() }
        Thread.sleep(STEP_MS)
        val pausedB: Double = onMain(instrumentation) { engineRef.get().positionSec() }
        Log.i(BENCH_TAG, "RustEngine paused: a=$pausedA b=$pausedB")

        val seekTarget: Double = duration / 2.0
        val seekable: Boolean = duration > MIN_SEEKABLE_SECONDS
        if (seekable) {
            instrumentation.runOnMainSync {
                engineRef.get().seekTo(seekTarget)
                engineRef.get().play()
            }
            Thread.sleep(SETTLE_MS)
        }
        val positionSeek: Double = onMain(instrumentation) { engineRef.get().positionSec() }
        Log.i(BENCH_TAG, "RustEngine after seek to $seekTarget (seekable=$seekable): pos=$positionSeek")

        instrumentation.runOnMainSync {
            engineRef.get().pause()
            engineRef.get().release()
        }

        assertTrue("position did not advance while playing (pos=$positionPlaying)", positionPlaying > 0.0)
        assertTrue("duration not positive (dur=$duration)", duration > 0.0)
        assertTrue("playWhenReady should be true after play", playWhenReady)
        assertTrue("position advanced while paused (a=$pausedA b=$pausedB)", pausedB - pausedA < PAUSE_TOLERANCE)
        if (seekable) {
            assertTrue("seek did not reach near $seekTarget (pos=$positionSeek)", positionSeek >= seekTarget - SEEK_TOLERANCE)
        }
    }

    /**
     * Drive the production auto-advance chain on device: a [PlayerController] over a [RustEngine] plays
     * a track, is seeked to just before its end so it finishes quickly, and must advance to exactly the
     * next track (a single advance, not a double). This exercises the novel pull-based adaptation, the
     * poller turning native `ended` into `onTrackEnded` and the controller loading the next track, which
     * a direct-engine test cannot reach. Volume 0, so silent. Needs at least three indexed tracks.
     */
    @Test
    fun autoAdvancesOnceOnNaturalEnd() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val uris = audioUris(instrumentation, ADVANCE_TRACK_COUNT)
        assumeTrue("need >= $ADVANCE_TRACK_COUNT indexed tracks", uris.size >= ADVANCE_TRACK_COUNT)
        // Same folder, so all three share one page: under ShuffleMode.OFF the playback scope is the
        // current page, so a natural end advances through the page (a different folder per track would
        // make three one-track pages that each loop on themselves).
        val tracks = uris.mapIndexed { index, uri -> Track(uri = uri.toString(), displayPath = "probe/track$index.flac") }

        val controllerRef = AtomicReference<PlayerController>()
        instrumentation.runOnMainSync {
            val controller = PlayerController(RustEngine(context))
            controller.setVolume(0.0f)
            controller.openLibrary(tracks)
            controller.playIndex(0)
            controllerRef.set(controller)
        }

        Thread.sleep(SETTLE_MS)
        val firstDuration: Double = onMain(instrumentation) { controllerRef.get().durationSec() }
        Log.i(BENCH_TAG, "auto-advance: track0 dur=$firstDuration")
        assumeTrue("track0 duration unknown", firstDuration > MIN_SEEKABLE_SECONDS)

        instrumentation.runOnMainSync { controllerRef.get().seek(firstDuration - NEAR_END_SECONDS) }
        Thread.sleep(ADVANCE_WAIT_MS)
        val scopeIndex: Int? = onMain(instrumentation) { controllerRef.get().currentScopeIndex() }
        Log.i(BENCH_TAG, "auto-advance: after natural end scopeIndex=$scopeIndex")
        instrumentation.runOnMainSync { controllerRef.get().release() }

        assertTrue("expected a single advance to scope index 1, got $scopeIndex", scopeIndex == 1)
    }

    /**
     * Up to [count] indexed music tracks as `content://` URIs, in MediaStore order.
     *
     * @param instrumentation Supplies the target context's content resolver.
     * @param count Maximum number of URIs to return.
     * @return Playable MediaStore URIs (possibly fewer than [count] when the library is small).
     */
    private fun audioUris(instrumentation: Instrumentation, count: Int): List<Uri> {
        val resolver = instrumentation.targetContext.contentResolver
        val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        val projection = arrayOf(MediaStore.Audio.Media._ID)
        val uris = mutableListOf<Uri>()
        resolver.query(collection, projection, "${MediaStore.Audio.Media.IS_MUSIC} != 0", null, null)?.use { cursor ->
            val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            while (cursor.moveToNext() && uris.size < count) {
                uris.add(ContentUris.withAppendedId(collection, cursor.getLong(idColumn)))
            }
        }
        return uris
    }

    /**
     * Run [block] on the main thread and return its result, so engine reads happen on the same thread
     * that owns the native handle.
     *
     * @param instrumentation Supplies runOnMainSync.
     * @param block Engine read to run on the main thread.
     * @return Value the block produced.
     */
    private fun <T> onMain(instrumentation: Instrumentation, block: () -> T): T {
        val holder = AtomicReference<T>()
        instrumentation.runOnMainSync { holder.set(block()) }
        return holder.get()
    }

    companion object {
        /** Logcat tag, shared with the other native on-device checks. */
        private const val BENCH_TAG: String = "NativeBench"

        /** Settle time for the worker to open, start AAudio, and let position advance. */
        private const val SETTLE_MS: Long = 600L

        /** Short dwell between paused-position samples. */
        private const val STEP_MS: Long = 200L

        /** Max position drift tolerated while paused (should be exactly zero; allows scheduling slop). */
        private const val PAUSE_TOLERANCE: Double = 0.1

        /** Tolerance below the seek target after a brief post-seek play. */
        private const val SEEK_TOLERANCE: Double = 1.5

        /** Only seek-test tracks long enough that mid-point seeking is meaningful. */
        private const val MIN_SEEKABLE_SECONDS: Double = 4.0

        /** Tracks the auto-advance test loads; >= 3 so a double-advance bug would overshoot index 1. */
        private const val ADVANCE_TRACK_COUNT: Int = 3

        /** How far before the end to seek, so the track finishes within a couple of poll cycles. */
        private const val NEAR_END_SECONDS: Double = 0.4

        /** Wait for the natural end to be detected and the advance to land (several 200 ms polls). */
        private const val ADVANCE_WAIT_MS: Long = 2500L
    }
}
