package dev.monochromatic.musicplayer

import android.content.Context

/**
 * Full-Rust flavor's engine factory, mirroring the Media3 flavor's `createAudioEngine` signature so
 * [MainActivity] resolves the engine at compile time. Returns the native [RustEngine] (symphonia +
 * libopus decode, AAudio output, in-process), the engine whose performance this variant exists to
 * measure against Media3.
 *
 * @param context Handed to the engine for the content resolver (descriptor resolution) and the native
 *   handle's lifetime.
 * @returns A [RustEngine] backed by the native `.so`.
 */
fun createAudioEngine(context: Context): AudioEngine = RustEngine(context)
