package dev.monochromatic.musicplayer

// Full-Rust flavor: thin Kotlin facade over the native engine .so. Smoke-test
// stage exposes only nativePing(); the real engine surface (decode/meter/output)
// replaces it once the cargo-ndk -> JNI toolchain is proven on device. The
// dum-dum-non-ts / TSDoc pass is deferred to finalization.
object NativeBridge {
    init {
        System.loadLibrary("musicplayer_native")
    }

    external fun nativePing(): Int

    external fun nativeOpusSelfTest(): Int

    external fun nativeSymphoniaSelfTest(): Int

    external fun nativeDecodeBenchmark(path: String): Double
}
