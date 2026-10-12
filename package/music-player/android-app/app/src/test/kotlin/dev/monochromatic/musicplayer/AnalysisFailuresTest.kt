package dev.monochromatic.musicplayer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** D113: a failure waits for a screen, is shown once, and is never shown again. */
class AnalysisFailuresTest {
    @Test
    fun reportedNamesAreTakenOnceAndThenGone() {
        AnalysisFailures.take()
        AnalysisFailures.report(listOf("a.mp3"))
        AnalysisFailures.report(listOf("b.mp3"))
        assertEquals(listOf("a.mp3", "b.mp3"), AnalysisFailures.pending)
        assertEquals(listOf("a.mp3", "b.mp3"), AnalysisFailures.take())
        assertTrue(AnalysisFailures.take().isEmpty())
    }

    @Test
    fun anEmptyReportChangesNothing() {
        AnalysisFailures.take()
        AnalysisFailures.report(emptyList())
        assertTrue(AnalysisFailures.pending.isEmpty())
    }

    @Test
    fun measuredTracksAreHandedToTheHostOnceSoItReadsTheirNewMeasures() {
        MeasureInvalidation.take()
        MeasureInvalidation.report(listOf("content://a/1", "content://a/2"))
        MeasureInvalidation.report(listOf("content://a/2"))
        assertEquals(setOf("content://a/1", "content://a/2"), MeasureInvalidation.take())
        assertTrue(MeasureInvalidation.take().isEmpty())
        MeasureInvalidation.report(emptyList())
        assertTrue(MeasureInvalidation.pending.isEmpty())
    }
}
