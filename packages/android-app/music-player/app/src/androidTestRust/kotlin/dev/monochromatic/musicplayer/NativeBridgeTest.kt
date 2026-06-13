package dev.monochromatic.musicplayer

import org.junit.Assert.assertEquals
import org.junit.Test

// On-device proof that cargo-ndk produced a loadable arm64 .so and that a JNI
// call crosses the boundary on this GrapheneOS device. Run via am instrument
// (not connectedAndroidTest, which uninstalls the app afterward and would wipe
// the persisted SAF grant).
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
}
