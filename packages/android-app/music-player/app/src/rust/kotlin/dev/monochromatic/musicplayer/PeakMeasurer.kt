package dev.monochromatic.musicplayer

import android.content.Context
import android.net.Uri

/**
 * Full-Rust flavor stub. The full reuse engine measures the true peak inside the symphonia/truepeak
 * core compiled to a `.so` via UniFFI; it is not built yet, so this keeps the flavor compiling. The
 * sweep treats the throw as a per-track failure and moves on, so an unbuilt flavor simply caches
 * nothing rather than crashing.
 *
 * @param context Unused until the Rust measurer lands.
 * @param uri Unused until the Rust measurer lands.
 * @return Never returns; throws until implemented.
 */
suspend fun measureTrackPeak(context: Context, uri: Uri): Float =
    throw NotImplementedError("full-Rust true-peak measurer not built yet")
