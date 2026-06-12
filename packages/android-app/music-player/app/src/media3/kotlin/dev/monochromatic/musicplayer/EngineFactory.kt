package dev.monochromatic.musicplayer

import android.content.Context

/**
 * Media3 flavor's engine factory. The same function signature is provided by each flavor source
 * set, so [MainActivity] resolves the right engine at compile time without a runtime switch.
 *
 * @param context Context handed to the engine for building the player.
 * @returns A [Media3Engine] backed by ExoPlayer.
 */
fun createAudioEngine(context: Context): AudioEngine = Media3Engine(context)
