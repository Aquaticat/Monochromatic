package dev.monochromatic.musicplayer

import android.content.ContentUris
import android.net.Uri
import android.provider.MediaStore
import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

// On-device proof that cargo-ndk produced a loadable arm64 .so and that the JNI
// boundary and the native decoders work on this GrapheneOS device. Run via am
// instrument (not connectedAndroidTest, which uninstalls and would wipe the SAF
// grant).
class NativeBridgeTest {
    @Test
    fun nativePingCrossesJniBoundary() {
        assertEquals(42, NativeBridge.nativePing())
    }

    // Proves the bundled libopus C library cross-compiled for arm64 and actually
    // runs on this device: nativeOpusSelfTest constructs an opus decoder via
    // opus_decoder_create and returns 1 on success.
    @Test
    fun opusDecoderConstructsOnDevice() {
        assertEquals(1, NativeBridge.nativeOpusSelfTest())
    }

    // Proves symphonia (pure Rust, all codecs) cross-compiled and links into the
    // .so: nativeSymphoniaSelfTest initializes its prober + codec registry and
    // returns 1.
    @Test
    fun symphoniaRegistryInitializesOnDevice() {
        assertEquals(1, NativeBridge.nativeSymphoniaSelfTest())
    }

    // Benchmarks native decode-to-PCM throughput on device for a pushed opus and
    // flac fixture, logged (tag NativeBench) for head-to-head comparison against
    // the Media3 MediaCodec baseline. Skips (does not fail) when a fixture is
    // absent; push fixtures to the app's external files dir as bench.opus /
    // bench.flac first. A negative result is a native error code.
    @Test
    fun benchmarkNativeDecode() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val dir = context.getExternalFilesDir(null)
        for (name in listOf("bench.opus", "bench.flac")) {
            val fixture = File(dir, name)
            assumeTrue("missing fixture $name", fixture.exists())
            val usPerSample = NativeBridge.nativeDecodeBenchmark(fixture.absolutePath)
            Log.i("NativeBench", "$name -> $usPerSample us/sample (native symphonia/opus, decode-only)")
            assertTrue("decode failed for $name (native code $usPerSample)", usPerSample > 0.0)
        }
    }

    // Opens a silent low-latency AAudio output stream (raw ndk::audio) and reads
    // its presentation latency, proving the pure-Rust AAudio output path opens and
    // runs on this GrapheneOS device. Inaudible (writes zeros), so the
    // resident-noise rule is not engaged.
    @Test
    fun aaudioOutputLatencyOnDevice() {
        val latencyMs = NativeBridge.nativeOutputLatencyProbe()
        Log.i("NativeBench", "AAudio output latency = $latencyMs ms (ndk::audio, silent)")
        assertTrue("AAudio output probe failed (native code $latencyMs)", latencyMs > 0.0)
    }

    // Measures a real library track's true peak natively (4x-oversampled), the
    // loudness-normalization input the rust flavor needs (its peak cache starts empty,
    // and Media3TruePeakDecoder is MediaCodec-bound). Reads the first MediaStore track
    // via a content:// fd, logs the peak and the gain the core would derive
    // (min(0.8912509/peak, 1)), and asserts a sane positive peak. Skips when no library
    // is indexed; silent (decode-only).
    @Test
    fun measureTruePeakOnDevice() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val resolver = context.contentResolver
        val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        val uris = mutableListOf<Uri>()
        resolver.query(collection, arrayOf(MediaStore.Audio.Media._ID), "${MediaStore.Audio.Media.IS_MUSIC} != 0", null, null)?.use { cursor ->
            val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            while (cursor.moveToNext() && uris.size < 8) {
                uris.add(ContentUris.withAppendedId(collection, cursor.getLong(idColumn)))
            }
        }
        assumeTrue("no indexed MediaStore audio (grant READ_MEDIA_AUDIO)", uris.isNotEmpty())
        val ceiling = 0.8912509f
        var maxPeak = 0.0f
        for (uri in uris) {
            val peak: Float = resolver.openFileDescriptor(uri, "r")?.use { pfd ->
                NativeBridge.nativeMeasureTruePeak(pfd.fd)
            } ?: -100.0f
            val gain: Float = if (peak > 0.0f) minOf(ceiling / peak, 1.0f) else 1.0f
            Log.i("NativeBench", "true-peak (${uri.lastPathSegment}) -> peak=$peak gain=$gain")
            assertTrue("true-peak measure failed for $uri (peak=$peak)", peak > 0.0f && peak < 8.0f)
            maxPeak = maxOf(maxPeak, peak)
        }
        // A real library has at least one reasonably loud track; a uniformly tiny max
        // across the sample would mean a systematic scaling bug, not genuinely quiet music.
        assertTrue("all sampled tracks improbably quiet (maxPeak=$maxPeak) - possible scaling bug", maxPeak > 0.1f)
    }

    // Decodes a real library track straight from a content:// file descriptor, the
    // exact path the full-Rust engine will use. Proves on this GrapheneOS device
    // that (1) MediaProvider hands back a seekable regular-file fd, (2) symphonia
    // probes and decodes over a borrowed ParcelFileDescriptor, and (3) the dup-based
    // fd-ownership protocol does not double-close (a deterministic fdsan SIGABRT if
    // it did). The fd is the borrowed pfd.fd (getFd) and decode happens synchronously
    // inside use{}, so Rust dups before Kotlin closes the original. Needs
    // READ_MEDIA_AUDIO (granted via `adb shell pm grant` before the run); skips (not
    // fails) when the permission or the indexed library is absent. Silent
    // (decode-only), so the resident-noise rule is not engaged.
    @Test
    fun decodeFromContentFd() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val resolver = context.contentResolver
        val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        val projection = arrayOf(MediaStore.Audio.Media._ID, MediaStore.Audio.Media.DISPLAY_NAME)
        val wantedExtensions = listOf(".flac", ".opus", ".mp3")
        val firstByExtension = mutableMapOf<String, Uri>()
        resolver.query(collection, projection, "${MediaStore.Audio.Media.IS_MUSIC} != 0", null, null)?.use { cursor ->
            val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            val nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
            while (cursor.moveToNext() && firstByExtension.size < wantedExtensions.size) {
                val name = cursor.getString(nameColumn)?.lowercase() ?: continue
                val extension = wantedExtensions.firstOrNull { name.endsWith(it) } ?: continue
                if (extension !in firstByExtension) {
                    firstByExtension[extension] = ContentUris.withAppendedId(collection, cursor.getLong(idColumn))
                }
            }
        }
        assumeTrue("no indexed MediaStore audio (grant READ_MEDIA_AUDIO)", firstByExtension.isNotEmpty())
        for ((extension, uri) in firstByExtension) {
            val usPerSample = resolver.openFileDescriptor(uri, "r")?.use { pfd ->
                NativeBridge.nativeDecodeFdBenchmark(pfd.fd)
            } ?: -100.0
            Log.i("NativeBench", "content-fd $extension ($uri) -> $usPerSample us/sample (native symphonia/opus, decode-only)")
            assertTrue("content-fd decode failed for $extension (native code $usPerSample)", usPerSample > 0.0)
        }
    }
}
