package dev.monochromatic.musicplayer

import android.content.Context

/**
 * Hybrid flavor stub. The hybrid engine (Media3 playback plus the true-peak DSP as a small Rust
 * `.so` via UniFFI) is not built yet; this keeps the flavor compiling so the three-engine
 * architecture is exercised end to end before the NDK work begins.
 *
 * @param context Unused until the hybrid engine lands.
 * @returns Never returns; throws until implemented.
 */
fun createAudioEngine(context: Context): AudioEngine =
    throw NotImplementedError("hybrid engine not built yet")
