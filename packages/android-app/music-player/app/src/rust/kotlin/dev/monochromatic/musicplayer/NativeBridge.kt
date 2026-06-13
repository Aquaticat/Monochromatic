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

    external fun nativeDecodeFdBenchmark(fd: Int): Double

    external fun nativeOutputLatencyProbe(): Double

    external fun nativeMeasureTruePeak(fd: Int): Float

    external fun nativeEngineCreate(): Long

    external fun nativeEngineLoad(handle: Long, fd: Int, play: Boolean): Int

    external fun nativeEnginePlay(handle: Long)

    external fun nativeEnginePause(handle: Long)

    external fun nativeEngineSeek(handle: Long, positionSec: Double)

    external fun nativeEngineSetVolume(handle: Long, volume: Float)

    external fun nativeEnginePositionSec(handle: Long): Double

    external fun nativeEngineDurationSec(handle: Long): Double

    external fun nativeEngineIsPlaying(handle: Long): Boolean

    external fun nativeEngineIsEnded(handle: Long): Boolean

    external fun nativeEnginePlayWhenReady(handle: Long): Boolean

    external fun nativeEngineRelease(handle: Long)
}
