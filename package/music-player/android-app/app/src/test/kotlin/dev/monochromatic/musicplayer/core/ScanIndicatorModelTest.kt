// What:     `package dev.monochromatic.musicplayer.core` places this test beside the scan indicator model.
// Why:      The test reaches the public pure functions in the same package as the code under test.
//
// In TS you'd write (pseudocode):
// ```ts
// // File path supplies the test module namespace.
// ```
package dev.monochromatic.musicplayer.core

// What:     Imports from JUnit bring in the assertions and the test annotation.
// Why:      Each model outcome is compared with an explicit expected value.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect, test } from "test";
// ```
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// What:     `class ScanIndicatorModelTest` groups the pure model tests for the scan indicator.
// Why:      Phase choice, clamping, visibility, and text can be verified on the host JVM.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("ScanIndicatorModel", () => { ... });
// ```
/** Verifies the scan indicator phases, clamping, visibility, and status text without Compose. */
class ScanIndicatorModelTest {
    // What:     `idleWhenNotLoadingAndNoTotal` checks an empty library with no loading shows nothing.
    // Why:      With no loading and no total there is nothing to report, so the bar must stay hidden.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("idle with no loading and no total", () => { ... });
    // ```
    /** Confirms the idle phase is chosen and hidden when neither loading nor a total exists. */
    @Test
    fun idleWhenNotLoadingAndNoTotal() {
        /** Model produced from an idle library. */
        val model: ScanIndicatorModel = scanIndicatorFor(loading = false, measured = 0, total = 0)
        assertEquals(ScanIndicatorPhase.IDLE, model.phase)
        assertFalse(model.visible)
    }

    // What:     `idleWhenNegativeTotal` checks a negative total is treated as no total.
    // Why:      A negative count must never reach the bar, so it falls back to the idle phase.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("negative total is idle", () => { ... });
    // ```
    /** Confirms a negative total produces the idle phase with zero counts. */
    @Test
    fun idleWhenNegativeTotal() {
        /** Model produced from a negative total. */
        val model: ScanIndicatorModel = scanIndicatorFor(loading = false, measured = 3, total = -5)
        assertEquals(ScanIndicatorPhase.IDLE, model.phase)
        assertEquals(0, model.total)
        assertFalse(model.visible)
    }

    // What:     `scanningWithoutTotal` checks the library read phase with no known total.
    // Why:      While the library is read, no track count exists yet, so the bar is indeterminate.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("scanning without total", () => { ... });
    // ```
    /** Confirms loading produces the scanning phase, visible, with zero counts. */
    @Test
    fun scanningWithoutTotal() {
        /** Model produced while the library is loading. */
        val model: ScanIndicatorModel = scanIndicatorFor(loading = true, measured = 0, total = 0)
        assertEquals(ScanIndicatorPhase.SCANNING_LIBRARY, model.phase)
        assertEquals(0, model.total)
        assertTrue(model.visible)
    }

    // What:     `scanningIgnoresSweepCounts` checks loading wins over sweep counts.
    // Why:      Counts from an earlier sweep must not make a loading library look measured.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("loading wins over counts", () => { ... });
    // ```
    /** Confirms sweep counts are ignored while the library is loading. */
    @Test
    fun scanningIgnoresSweepCounts() {
        /** Model produced while loading with stale sweep counts. */
        val model: ScanIndicatorModel = scanIndicatorFor(loading = true, measured = 3, total = 10)
        assertEquals(ScanIndicatorPhase.SCANNING_LIBRARY, model.phase)
        assertEquals(0, model.done)
        assertEquals(0, model.total)
    }

    // What:     `measuringWithCounts` checks the mid-sweep state with known counts.
    // Why:      The accepted study shows 412 of 1,218 as a visible measuring state.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("measuring with counts", () => { ... });
    // ```
    /** Confirms a partial sweep is measuring, visible, and carries its counts. */
    @Test
    fun measuringWithCounts() {
        /** Model produced from a partial sweep. */
        val model: ScanIndicatorModel = scanIndicatorFor(loading = false, measured = 412, total = 1218)
        assertEquals(ScanIndicatorPhase.MEASURING_TRUE_PEAK, model.phase)
        assertEquals(412, model.done)
        assertEquals(1218, model.total)
        assertTrue(model.visible)
    }

    // What:     `measuringAtStart` checks a sweep that has visited nothing yet.
    // Why:      The bar appears as soon as measurement starts, so zero of a known total is visible.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("measuring at zero", () => { ... });
    // ```
    /** Confirms zero visited of a known total is still the visible measuring phase. */
    @Test
    fun measuringAtStart() {
        /** Model produced before the first track finishes. */
        val model: ScanIndicatorModel = scanIndicatorFor(loading = false, measured = 0, total = 1218)
        assertEquals(ScanIndicatorPhase.MEASURING_TRUE_PEAK, model.phase)
        assertEquals(0, model.done)
        assertTrue(model.visible)
    }

    // What:     `completeWhenMeasuredEqualsTotal` checks the last track finishes the sweep.
    // Why:      Reaching the total ends the measurement, so the indicator leaves.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("complete at total", () => { ... });
    // ```
    /** Confirms a finished sweep is done and not visible. */
    @Test
    fun completeWhenMeasuredEqualsTotal() {
        /** Model produced after the final track. */
        val model: ScanIndicatorModel = scanIndicatorFor(loading = false, measured = 1218, total = 1218)
        assertEquals(ScanIndicatorPhase.DONE, model.phase)
        assertEquals(1218, model.done)
        assertFalse(model.visible)
    }

    // What:     `zeroTotalWithMeasuredCountIsIdle` checks counts with no total do not show a bar.
    // Why:      A measured count without a total has no meaningful denominator, so nothing is shown.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("zero total is idle even with counts", () => { ... });
    // ```
    /** Confirms a zero total with a non-zero measured count stays idle. */
    @Test
    fun zeroTotalWithMeasuredCountIsIdle() {
        /** Model produced from a zero total. */
        val model: ScanIndicatorModel = scanIndicatorFor(loading = false, measured = 5, total = 0)
        assertEquals(ScanIndicatorPhase.IDLE, model.phase)
        assertFalse(model.visible)
    }

    // What:     `measuredAboveTotalClamps` checks an overshooting count stops at the total.
    // Why:      A cached or double-counted visit must never show more tracks than exist.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("measured above total clamps", () => { ... });
    // ```
    /** Confirms a measured count above the total is clamped and reads as done. */
    @Test
    fun measuredAboveTotalClamps() {
        /** Model produced from an overshooting count. */
        val model: ScanIndicatorModel = scanIndicatorFor(loading = false, measured = 15, total = 10)
        assertEquals(ScanIndicatorPhase.DONE, model.phase)
        assertEquals(10, model.done)
        assertEquals(10, model.total)
    }

    // What:     `negativeMeasuredClamps` checks a negative count stops at zero.
    // Why:      A negative visit count must not reach the bar or its fraction.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("negative measured clamps to zero", () => { ... });
    // ```
    /** Confirms a negative measured count is clamped to zero while measuring. */
    @Test
    fun negativeMeasuredClamps() {
        /** Model produced from a negative count. */
        val model: ScanIndicatorModel = scanIndicatorFor(loading = false, measured = -3, total = 10)
        assertEquals(ScanIndicatorPhase.MEASURING_TRUE_PEAK, model.phase)
        assertEquals(0, model.done)
    }

    // What:     `statusTextWhileScanning` checks the library read line.
    // Why:      The scanning phase has its own line so the user can tell it from measurement.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("scanning text", () => { ... });
    // ```
    /** Confirms the scanning phase draws the library status line. */
    @Test
    fun statusTextWhileScanning() {
        /** Model produced while loading. */
        val model: ScanIndicatorModel = scanIndicatorFor(loading = true, measured = 0, total = 0)
        assertEquals("Scanning library", scanIndicatorStatusText(model))
    }

    // What:     `statusTextWhileMeasuring` checks the accepted copy with grouped counts.
    // Why:      The study's line is "Analysing true peak · 412 of 1,218" and the text must match it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("measuring text", () => { ... });
    // ```
    /** Confirms the measuring phase draws the accepted count line. */
    @Test
    fun statusTextWhileMeasuring() {
        /** Model produced from the accepted study counts. */
        val model: ScanIndicatorModel = scanIndicatorFor(loading = false, measured = 412, total = 1218)
        assertEquals("Analysing true peak · 412 of 1,218", scanIndicatorStatusText(model))
    }

    // What:     `statusTextWideCount` checks the widest count the study stresses.
    // Why:      Wider counts must keep comma grouping and ASCII digits in the same line.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("wide count text", () => { ... });
    // ```
    /** Confirms a seven-digit count groups into millions and thousands. */
    @Test
    fun statusTextWideCount() {
        /** Model produced from the widest study count. */
        val model: ScanIndicatorModel = scanIndicatorFor(loading = false, measured = 9999998, total = 9999999)
        assertEquals("Analysing true peak · 9,999,998 of 9,999,999", scanIndicatorStatusText(model))
    }

    // What:     `statusTextEmptyWhenHidden` checks idle and done produce no text.
    // Why:      A hidden indicator must not leave a stale line for the caller to draw.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("hidden phases have empty text", () => { ... });
    // ```
    /** Confirms idle and done phases produce an empty status line. */
    @Test
    fun statusTextEmptyWhenHidden() {
        /** Model produced from an idle library. */
        val idle: ScanIndicatorModel = scanIndicatorFor(loading = false, measured = 0, total = 0)
        /** Model produced from a finished sweep. */
        val done: ScanIndicatorModel = scanIndicatorFor(loading = false, measured = 4, total = 4)
        assertEquals("", scanIndicatorStatusText(idle))
        assertEquals("", scanIndicatorStatusText(done))
    }

    // What:     `countTextGroupsThousands` checks grouping at the digit boundaries.
    // Why:      Grouping must start only above three digits and never add a leading comma.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("count grouping", () => { ... });
    // ```
    /** Confirms counts from zero through the largest Int group with ASCII commas. */
    @Test
    fun countTextGroupsThousands() {
        assertEquals("0", scanIndicatorCountText(0))
        assertEquals("999", scanIndicatorCountText(999))
        assertEquals("1,000", scanIndicatorCountText(1000))
        assertEquals("2,147,483,647", scanIndicatorCountText(Int.MAX_VALUE))
    }
}
