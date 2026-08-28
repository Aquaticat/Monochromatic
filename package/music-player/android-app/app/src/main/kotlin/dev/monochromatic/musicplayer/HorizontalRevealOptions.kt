// What:     `package dev.monochromatic.musicplayer` places fold geometry beside page-control UI.
// Why:      Compose and host-JVM tests share one scroll-position decision without Android dependencies.
//
// In TS you'd write (pseudocode):
// ```ts
// // File path supplies module namespace.
// ```
package dev.monochromatic.musicplayer

/** Groups horizontal viewport and selected-control geometry in physical pixels. */
internal data class HorizontalRevealOptions(
    /** Stores current non-negative scroll offset. */
    val currentOffsetPx: Int,
    /** Stores visible strip width. */
    val viewportWidthPx: Int,
    /** Stores selected control's source-ordered leading coordinate. */
    val itemStartPx: Int,
    /** Stores selected control's exclusive trailing coordinate. */
    val itemEndPx: Int,
    /** Stores largest legal scroll offset. */
    val maximumOffsetPx: Int,
)

/** Returns nearest legal offset that completely reveals selected control when possible. */
internal fun horizontalRevealOffset(options: HorizontalRevealOptions): Int {
    /** Keeps every computed destination inside scroll state's legal range. */
    fun constrained(offsetPx: Int): Int = offsetPx.coerceIn(0, options.maximumOffsetPx)

    /** Stores selected control width for oversized-control handling. */
    val itemWidthPx: Int = options.itemEndPx - options.itemStartPx
    if (itemWidthPx >= options.viewportWidthPx) {
        return constrained(options.itemStartPx)
    }
    if (options.itemStartPx < options.currentOffsetPx) {
        return constrained(options.itemStartPx)
    }
    /** Stores current viewport's exclusive trailing coordinate. */
    val viewportEndPx: Int = options.currentOffsetPx + options.viewportWidthPx
    if (options.itemEndPx > viewportEndPx) {
        return constrained(options.itemEndPx - options.viewportWidthPx)
    }
    return constrained(options.currentOffsetPx)
}
