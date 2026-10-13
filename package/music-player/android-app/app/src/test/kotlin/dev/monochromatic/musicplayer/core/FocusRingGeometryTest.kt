// The focus ring geometry of D117: two solid rings, 2 dp then 1 dp, flush against the element and hugging its shape.

// What:     `package ...core` matches the geometry's package.
// Why:      The tests call the pure functions directly.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the path.
// ```
package dev.monochromatic.musicplayer.core

import org.junit.Assert.assertEquals
import org.junit.Test

/** Checks that the ring bounds are the element bounds grown by the widths and that every shape keeps its kind. */
class FocusRingGeometryTest {
    /** The spec of the ring the app draws, which every rule below is checked for. */
    private val specs: List<FocusRingSpec> = listOf(FIREFOX_RING_SPEC)

    /** The rings are flush: bounds grown by 2 dp to the middle edge, then by 1 dp more to the outer edge. */
    @Test
    fun boundsGrowByTheNearWidthThenByTheOuterWidth() {
        for (spec in specs) {
            /** Bands of a 200 by 56 element with 8 dp corners. */
            val bands: FocusRingBands = focusRingBands(200f, 56f, RingCorners.uniform(8f), spec)
            assertEquals(0f, bands.inner.left, 0f)
            assertEquals(0f, bands.inner.top, 0f)
            assertEquals(200f, bands.inner.right, 0f)
            assertEquals(56f, bands.inner.bottom, 0f)
            assertEquals(-2f, bands.middle.left, 0f)
            assertEquals(-2f, bands.middle.top, 0f)
            assertEquals(202f, bands.middle.right, 0f)
            assertEquals(58f, bands.middle.bottom, 0f)
            assertEquals(-3f, bands.outer.left, 0f)
            assertEquals(-3f, bands.outer.top, 0f)
            assertEquals(203f, bands.outer.right, 0f)
            assertEquals(59f, bands.outer.bottom, 0f)
        }
    }

    /** Radii grow by the widths inside them: the element's radius, plus 2 dp, plus 3 dp at the outer edge. */
    @Test
    fun radiiGrowByTheWidthsInside() {
        for (spec in specs) {
            /** Bands of a 100 by 48 element with 12 dp corners. */
            val bands: FocusRingBands = focusRingBands(100f, 48f, RingCorners.uniform(12f), spec)
            assertEquals(RingCorners.uniform(12f), bands.inner.corners)
            assertEquals(RingCorners.uniform(14f), bands.middle.corners)
            assertEquals(RingCorners.uniform(15f), bands.outer.corners)
        }
    }

    /** The room a clipping parent must leave is the sum of the gap and both widths: 3 dp. */
    @Test
    fun outsetIsThreeDp() {
        assertEquals(3f, FIREFOX_RING_SPEC.outset, 0f)
    }

    /** A pill stays a pill: every edge's radius is still half of that edge's own height. */
    @Test
    fun aPillStaysAPill() {
        for (spec in specs) {
            /** Bands of a 160 by 40 pill. */
            val bands: FocusRingBands = focusRingBands(160f, 40f, RingCorners.uniform(20f), spec)
            for (edge in listOf(bands.inner, bands.middle, bands.outer)) {
                assertEquals(edge.height / 2f, edge.corners.topLeft, 0f)
                assertEquals(edge.height / 2f, edge.corners.bottomRight, 0f)
            }
        }
    }

    /** A circle stays a circle: every edge is square and its radius is half its side. */
    @Test
    fun aCircleStaysACircle() {
        for (spec in specs) {
            /** Bands of a 48 dp circle. */
            val bands: FocusRingBands = focusRingBands(48f, 48f, RingCorners.uniform(24f), spec)
            for (edge in listOf(bands.inner, bands.middle, bands.outer)) {
                assertEquals(edge.width, edge.height, 0f)
                assertEquals(edge.width / 2f, edge.corners.topLeft, 0f)
            }
        }
    }

    /** Firefox gives a square corner a 2 dp outer radius at the near ring and 3 dp at the outer ring. */
    @Test
    fun firefoxRoundsSquareCornersByTwoDp() {
        /** Bands of a plain rectangle. */
        val bands: FocusRingBands = focusRingBands(300f, 64f, RingCorners.uniform(0f), FIREFOX_RING_SPEC)
        assertEquals(RingCorners.uniform(0f), bands.inner.corners)
        assertEquals(RingCorners.uniform(2f), bands.middle.corners)
        assertEquals(RingCorners.uniform(3f), bands.outer.corners)
    }

    /** Only the square corner of a segment changes: the rounded corners grow by the widths. */
    @Test
    fun aSegmentRoundsOnlyItsOwnSquareCorners() {
        /** Corners of an end segment: rounded on the left, square on the right. */
        val corners = RingCorners(topLeft = 24f, topRight = 0f, bottomRight = 0f, bottomLeft = 24f)
        /** Bands of that segment under Firefox. */
        val bands: FocusRingBands = focusRingBands(90f, 48f, corners, FIREFOX_RING_SPEC)
        assertEquals(RingCorners(topLeft = 26f, topRight = 2f, bottomRight = 2f, bottomLeft = 26f), bands.middle.corners)
        assertEquals(RingCorners(topLeft = 27f, topRight = 3f, bottomRight = 3f, bottomLeft = 27f), bands.outer.corners)
    }

    /** A gap, when a spec has one, moves both rings out and grows every radius by it. */
    @Test
    fun aGapPushesBothRingsOutward() {
        /** A spec with a 2 dp gap. */
        val spec = FocusRingSpec(nearWidth = 2f, outerWidth = 1f, gap = 2f, squareCornerRadius = 0f)
        /** Bands of a 100 by 40 element with 10 dp corners. */
        val bands: FocusRingBands = focusRingBands(100f, 40f, RingCorners.uniform(10f), spec)
        assertEquals(-2f, bands.inner.left, 0f)
        assertEquals(RingCorners.uniform(12f), bands.inner.corners)
        assertEquals(-4f, bands.middle.left, 0f)
        assertEquals(-5f, bands.outer.left, 0f)
        assertEquals(5f, spec.outset, 0f)
    }
}
