package dev.monochromatic.musicplayer.core

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** D113: the library follows the disk by itself, and no change signal is lost to a running load. */
class RescanPlanTest {
    @Test
    fun aSignalWhileIdleStartsARescanAtOnce() {
        assertTrue(RescanPlan().signal())
    }

    @Test
    fun aSignalDuringALoadWaitsAndFiresOnceWhenTheLoadEnds() {
        val plan = RescanPlan()
        plan.loadStarted()
        assertFalse(plan.signal())
        assertFalse(plan.signal())
        assertTrue("one rescan is owed however many signals came", plan.loadFinished())
        assertFalse("and only one", plan.loadFinished())
    }

    @Test
    fun aLoadWithoutSignalsOwesNothing() {
        val plan = RescanPlan()
        plan.loadStarted()
        assertFalse(plan.loadFinished())
        assertTrue(plan.signal())
    }

    @Test
    fun theRescanThatIsOwedIsItselfALoadThatCanQueueAgain() {
        val plan = RescanPlan()
        plan.loadStarted()
        plan.signal()
        assertTrue(plan.loadFinished())
        plan.loadStarted()
        assertFalse(plan.signal())
        assertTrue(plan.loadFinished())
    }
}
