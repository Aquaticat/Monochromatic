package dev.monochromatic.musicplayer

import android.content.Context
import android.net.Uri

/**
 * Hybrid flavor stub. The hybrid engine measures the true peak with the DSP core compiled to a small
 * Rust `.so` via UniFFI; it is not built yet, so this keeps the flavor compiling. The sweep treats the
 * throw as a per-track failure and moves on, so an unbuilt flavor simply caches nothing rather than
 * crashing.
 *
 * @param context Unused until the hybrid measurer lands.
 * @param uri Unused until the hybrid measurer lands.
 * @return Never returns; throws until implemented.
 */
suspend fun measureTrackPeak(context: Context, uri: Uri): Float =
    throw NotImplementedError("hybrid true-peak measurer not built yet")
