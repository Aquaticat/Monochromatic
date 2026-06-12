package dev.monochromatic.musicplayer

/**
 * One library entry, the bridge between a storage source and the player: the engine plays [uri]
 * while the UI and pagination group and label rows by [displayPath]. The two are deliberately
 * separate because an Android `content://` URI does not relativize into a readable folder path the
 * way the desktop's filesystem path does; the source supplies a real relative path for display and
 * an opaque URI for playback. [PlayerController] feeds the display paths to the ported queue (whose
 * pagination treats them exactly like the desktop's relative paths) and keeps the URIs in a parallel
 * list it loads by the queue's load-order index.
 *
 * @property uri Opaque locator the [AudioEngine] loads (a MediaStore `content://media/...` URI, a
 *   SAF document URI, or a bare filesystem path).
 * @property displayPath Source-root-relative slash path shown in the list and grouped into pages,
 *   e.g. `Artist/Album/01.flac`.
 */
data class Track(val uri: String, val displayPath: String)
