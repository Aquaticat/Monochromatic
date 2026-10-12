package dev.monochromatic.musicplayer.core

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Verifies when the initial analysis service starts, across every input that the rule reads. */
class InitialAnalysisStartTest {
    /** Confirms a readable library with no completed analysis starts the service. */
    @Test
    fun startsWhenTheLibraryCanBeReadAndIsNotAnalysed() {
        assertTrue(shouldStartInitialAnalysis(sourceReadable = true, initialSweepDone = false))
    }

    /** Confirms a launch without access starts nothing, because the service would find no library. */
    @Test
    fun doesNotStartWithoutAccess() {
        assertFalse(shouldStartInitialAnalysis(sourceReadable = false, initialSweepDone = false))
    }

    /** Confirms a completed first analysis is never started again. */
    @Test
    fun doesNotStartAgainAfterTheFirstAnalysisCompleted() {
        assertFalse(shouldStartInitialAnalysis(sourceReadable = true, initialSweepDone = true))
        assertFalse(shouldStartInitialAnalysis(sourceReadable = false, initialSweepDone = true))
    }
}
