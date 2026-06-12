package dev.monochromatic.musicplayer.core

/**
 * One entry within a [Page]: a position in the queue plus the display name shown for that row.
 * Faithful port of the desktop's `PageEntry` (pagination.rs).
 *
 * @property index Position of this track in the queue.
 * @property name Display name for the row (the queue-relative path).
 */
data class PageEntry(
    val index: Int,
    val name: String,
)

/**
 * A page in the two-axis pagination, a faithful port of the desktop's `Page` (pagination.rs):
 * top-level-folder pages for subfolder tracks, then A-Z letter pages plus a `#` catch-all for
 * root-level tracks.
 *
 * @property label Page tab label (a folder name, an A-Z letter, or `#`).
 * @property entries Tracks on this page, in the paginated order.
 */
data class Page(
    val label: String,
    val entries: List<PageEntry>,
)
