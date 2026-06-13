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
}
