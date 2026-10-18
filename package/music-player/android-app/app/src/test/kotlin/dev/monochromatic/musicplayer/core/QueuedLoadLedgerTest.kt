// Cases of the queued-load ledger: which failure number the worker publishes leads to a report, and which does not.
// Every URI here is invented.

// What:     `package dev.monochromatic.musicplayer.core` places this test beside the ledger it verifies.
// Why:      The ledger has no Android type in it, so the test needs no device.
//
// In TS you'd write (pseudocode):
// ```ts
// // File path supplies the test module namespace.
// ```
package dev.monochromatic.musicplayer.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Verifies that a decode failure of the latest queued load is reported once, and nothing else is. */
class QueuedLoadLedgerTest {
    /** Reports nothing while the worker has failed no load. */
    @Test
    fun noFailureReportsNothing() {
        /** Ledger with one queued load. */
        val ledger = QueuedLoadLedger().also { it.queued("u1") }
        assertNull(ledger.failureToReport(0L))
    }

    /** Reports the file of the latest load when the worker fails that load. */
    @Test
    fun theFailureOfTheLatestLoadIsReportedWithItsUri() {
        /** Ledger with two queued loads. */
        val ledger = QueuedLoadLedger().also {
            it.queued("u1")
            it.queued("u2")
        }
        assertEquals("u2", ledger.failureToReport(2L))
    }

    /** The worker keeps publishing the same failure number, so every poll after the first reports nothing. */
    @Test
    fun theSameFailureIsReportedOnce() {
        /** Ledger with one queued load. */
        val ledger = QueuedLoadLedger().also { it.queued("u1") }
        assertEquals("u1", ledger.failureToReport(1L))
        assertNull(ledger.failureToReport(1L))
    }

    /** A newer request replaced the failed load, so its failure is not the user's concern any more. */
    @Test
    fun theFailureOfAReplacedLoadIsDropped() {
        /** Ledger with two queued loads, the first of which the worker failed. */
        val ledger = QueuedLoadLedger().also {
            it.queued("u1")
            it.queued("u2")
        }
        assertNull(ledger.failureToReport(1L))
        assertNull("a dropped failure is not reported later either", ledger.failureToReport(1L))
    }

    /** A load queued after a reported failure can fail and be reported on its own. */
    @Test
    fun aLaterLoadThatFailsIsReportedAfterAnEarlierOne() {
        /** Ledger with one queued load that failed. */
        val ledger = QueuedLoadLedger().also { it.queued("u1") }
        assertEquals("u1", ledger.failureToReport(1L))
        ledger.queued("u2")
        assertEquals("u2", ledger.failureToReport(2L))
    }
}
