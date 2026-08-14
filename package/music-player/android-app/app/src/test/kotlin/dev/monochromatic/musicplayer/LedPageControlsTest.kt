// What:     `package dev.monochromatic.musicplayer` places this test beside internal LED row packing.
// Why:      Host tests can verify exact wrapping without exposing layout helpers publicly.
//
// In TS you'd write (pseudocode):
// ```ts
// // File path supplies test module namespace.
// ```
package dev.monochromatic.musicplayer

// What:     `assertEquals` compares expected and actual immutable row values.
// Why:      Width, order, and row boundaries must exactly match source geometry.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect } from "test";
// ```
import org.junit.Assert.assertEquals

// What:     `Test` registers each method with JUnit host runner.
// Why:      Gradle discovers LED packing branches automatically.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from "test";
// ```
import org.junit.Test

// What:     `LedPageControlsTest` groups pure wrapping tests.
// Why:      Shared plate rows must remain deterministic as visual layers evolve.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("LED page controls", () => { ... });
// ```
/** Verifies measured LED targets pack into exact content-width shared plates. */
class LedPageControlsTest {
    // What:     `emptyInputProducesNoPlateRows` covers zero pages.
    // Why:      Empty libraries must not reserve or paint an unused plate.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("empty input produces no rows", () => { ... });
    // ```
    /** Confirms empty page list remains empty. */
    @Test
    fun emptyInputProducesNoPlateRows() {
        assertEquals(
            emptyList<LedLine>(),
            packLedLines(
                LedPackingOptions(
                    capWidthsPx = emptyList(),
                    maximumWidthPx = 100,
                    marginPx = 8,
                    gapPx = 8,
                ),
            ),
        )
    }

    // What:     `exactFitKeepsCapsOnOneSharedPlate` covers inclusive row capacity.
    // Why:      A row matching available width must not wrap prematurely.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("exact fit stays together", () => { ... });
    // ```
    /** Confirms exact equality remains one row. */
    @Test
    fun exactFitKeepsCapsOnOneSharedPlate() {
        assertEquals(
            listOf(LedLine(pageIndexes = listOf(0, 1), widthPx = 100)),
            packLedLines(
                LedPackingOptions(
                    capWidthsPx = listOf(40, 36),
                    maximumWidthPx = 100,
                    marginPx = 8,
                    gapPx = 8,
                ),
            ),
        )
    }

    // What:     `onePixelOverflowStartsNewPlateRow` covers strict overflow boundary.
    // Why:      No cap or plate may paint outside available width.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("one pixel overflow wraps", () => { ... });
    // ```
    /** Confirms one-pixel overflow wraps whole second cap. */
    @Test
    fun onePixelOverflowStartsNewPlateRow() {
        assertEquals(
            listOf(
                LedLine(pageIndexes = listOf(0), widthPx = 56),
                LedLine(pageIndexes = listOf(1), widthPx = 53),
            ),
            packLedLines(
                LedPackingOptions(
                    capWidthsPx = listOf(40, 37),
                    maximumWidthPx = 100,
                    marginPx = 8,
                    gapPx = 8,
                ),
            ),
        )
    }

    // What:     `multipleRowsPreservePageOrderAndContentWidths` covers repeated packing.
    // Why:      Wrapping must never reorder page semantics or reserve full parent width.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("multiple rows preserve order and width", () => { ... });
    // ```
    /** Confirms row order and each shared plate width. */
    @Test
    fun multipleRowsPreservePageOrderAndContentWidths() {
        assertEquals(
            listOf(
                LedLine(pageIndexes = listOf(0, 1), widthPx = 96),
                LedLine(pageIndexes = listOf(2, 3), widthPx = 93),
                LedLine(pageIndexes = listOf(4), widthPx = 58),
            ),
            packLedLines(
                LedPackingOptions(
                    capWidthsPx = listOf(32, 40, 34, 35, 42),
                    maximumWidthPx = 100,
                    marginPx = 8,
                    gapPx = 8,
                ),
            ),
        )
    }
}
