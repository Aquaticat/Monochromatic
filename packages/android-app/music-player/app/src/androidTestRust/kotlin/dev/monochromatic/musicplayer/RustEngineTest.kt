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
        val uri: Uri? = firstAudioUri(instrumentation)
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
     * First indexed music track as a `content://` URI, or null when nothing is indexed.
     *
     * @param instrumentation Supplies the target context's content resolver.
     * @return Playable MediaStore URI for the first track, or null.
     */
    private fun firstAudioUri(instrumentation: Instrumentation): Uri? {
        val resolver = instrumentation.targetContext.contentResolver
        val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        val projection = arrayOf(MediaStore.Audio.Media._ID)
        resolver.query(collection, projection, "${MediaStore.Audio.Media.IS_MUSIC} != 0", null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                return ContentUris.withAppendedId(collection, cursor.getLong(idColumn))
            }
        }
        return null
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
    }
}
