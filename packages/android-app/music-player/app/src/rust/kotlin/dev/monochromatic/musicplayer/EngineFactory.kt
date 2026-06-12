package dev.monochromatic.musicplayer

import android.content.Context

/**
 * Full-Rust flavor stub. The full reuse engine (the whole symphonia/opus/truepeak/queue core as a
 * `.so` via UniFFI) is not built yet; this keeps the flavor compiling so the three-engine
 * architecture is exercised end to end before the NDK work begins.
 *
 * @param context Unused until the Rust engine lands.
 * @returns Never returns; throws until implemented.
 */
fun createAudioEngine(context: Context): AudioEngine =
    throw NotImplementedError("full-Rust engine not built yet")
