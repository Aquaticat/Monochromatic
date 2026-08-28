// What:     `package dev.monochromatic.musicplayer` places tests beside internal fold geometry.
// Why:      Host-JVM coverage reaches the helper without exposing it from the app module.
//
// In TS you'd write (pseudocode):
// ```ts
// // File path supplies test module namespace.
// ```
package dev.monochromatic.musicplayer

// What:     `assertEquals` compares expected and actual integer offsets through JUnit.
// Why:      Every visibility branch needs an exact destination assertion.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect } from "test";
// ```
import org.junit.Assert.assertEquals

// What:     `Test` marks methods discovered by JUnit's host-JVM runner.
// Why:      Gradle must execute each fold-geometry branch.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from "test";
// ```
import org.junit.Test

/** Verifies horizontal selected-control reveal decisions. */
class PageControlFoldTest {
    /** Confirms already visible control preserves manual scroll position. */
    @Test
    fun visibleItemPreservesCurrentOffset() {
        assertEquals(
            40,
            horizontalRevealOffset(
                HorizontalRevealOptions(
                    currentOffsetPx = 40,
                    viewportWidthPx = 200,
                    itemStartPx = 80,
                    itemEndPx = 160,
                    maximumOffsetPx = 500,
                ),
            ),
        )
    }

    /** Confirms hidden leading control aligns with viewport start. */
    @Test
    fun leadingHiddenItemScrollsBackward() {
        assertEquals(
            20,
            horizontalRevealOffset(
                HorizontalRevealOptions(
                    currentOffsetPx = 100,
                    viewportWidthPx = 200,
                    itemStartPx = 20,
                    itemEndPx = 80,
                    maximumOffsetPx = 500,
                ),
            ),
        )
    }

    /** Confirms hidden trailing control aligns with viewport end. */
    @Test
    fun trailingHiddenItemScrollsForward() {
        assertEquals(
            180,
            horizontalRevealOffset(
                HorizontalRevealOptions(
                    currentOffsetPx = 40,
                    viewportWidthPx = 200,
                    itemStartPx = 300,
                    itemEndPx = 380,
                    maximumOffsetPx = 500,
                ),
            ),
        )
    }

    /** Confirms oversized control aligns its leading edge. */
    @Test
    fun oversizedItemUsesLeadingEdge() {
        assertEquals(
            220,
            horizontalRevealOffset(
                HorizontalRevealOptions(
                    currentOffsetPx = 120,
                    viewportWidthPx = 200,
                    itemStartPx = 220,
                    itemEndPx = 480,
                    maximumOffsetPx = 500,
                ),
            ),
        )
    }

    /** Confirms requested destination clamps to legal scroll maximum. */
    @Test
    fun trailingDestinationClampsToMaximum() {
        assertEquals(
            240,
            horizontalRevealOffset(
                HorizontalRevealOptions(
                    currentOffsetPx = 100,
                    viewportWidthPx = 200,
                    itemStartPx = 400,
                    itemEndPx = 480,
                    maximumOffsetPx = 240,
                ),
            ),
        )
    }
}
