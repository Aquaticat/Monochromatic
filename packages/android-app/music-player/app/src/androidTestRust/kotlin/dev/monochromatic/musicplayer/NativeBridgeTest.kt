package dev.monochromatic.musicplayer

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
}
