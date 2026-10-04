//region Two-line message gate tests, authored line metrics only
// What: Package shares the pure debug feedback helpers' namespace.
// Why: Host-JVM assertions cannot trigger storage, logs capture or native service work.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose JUnit assertions and test declarations.
// Why: Measured line-fit decisions get independent positive and rejection cases.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test, expect } from 'test';
// ```
import org.junit.Assert.assertEquals
// Boolean acceptance assertion.
import org.junit.Assert.assertFalse
// Boolean rejection/log-direction assertion.
import org.junit.Assert.assertTrue
// Test marks runnable host-JVM cases.
import org.junit.Test

/**
 * What: A class groups named test methods without native UI or Android state.
 * Why: A two-line boundary must not be mistaken for successful provider handling or typography proof.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * describe('authored feedback message gate', () => { ... });
 * ```
 */
class LightFeedbackMessageTest {
    /** One measured line retains full copy. */
    @Test fun oneLineRetainsMessage() { assertFalse(lightFeedbackNeedsLogs(1, false)) }
    /** Two measured lines retain full copy. */
    @Test fun twoLinesRetainMessage() { assertFalse(lightFeedbackNeedsLogs(2, false)) }
    /** Third line directs detail to Android logs. */
    @Test fun thirdLineRequiresLogs() { assertTrue(lightFeedbackNeedsLogs(3, false)) }
    /** Native overflow requires logs even if reported line count is capped. */
    @Test fun cappedOverflowRequiresLogs() { assertTrue(lightFeedbackNeedsLogs(2, true)) }
    /** One-line horizontal overflow cannot silently be accepted. */
    @Test fun oneLineOverflowRequiresLogs() { assertTrue(lightFeedbackNeedsLogs(1, true)) }
    /**
     * What: expected identifies the exception class; ::class supplies its runtime type token.
     * Why: Missing measurement is not evidence that a message fits.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('zero lines throws', () => expect(() => gate(0, false)).toThrow());
     * ```
     */
    @Test(expected = IllegalArgumentException::class)
    fun zeroLinesAreRejected() { lightFeedbackNeedsLogs(0, false) }
    /** Negative authored line counts are rejected for the same measurement boundary. */
    @Test(expected = IllegalArgumentException::class)
    fun negativeLinesAreRejected() { lightFeedbackNeedsLogs(-1, false) }
    /** Short summaries retain exact authored scene meanings. */
    @Test fun briefMessagesMatchAuthoredScenes() {
        assertEquals("Track unavailable.", lightFeedbackBriefMessage("missing"))
        assertEquals("3 unavailable files.", lightFeedbackBriefMessage("combined"))
        assertEquals("Ghost was not moved to trash.", lightFeedbackBriefMessage("trash-failed"))
        assertEquals("Operation unavailable.", lightFeedbackBriefMessage("detail-heavy"))
        assertEquals("Ghost moved to trash", lightFeedbackBriefMessage("undo"))
        assertEquals("", lightFeedbackBriefMessage("trash-pending"))
    }
    /** Unknown scene cannot select a generic failure-looking fallback. */
    @Test(expected = IllegalArgumentException::class)
    fun unknownBriefSceneIsRejected() { lightFeedbackBriefMessage("unknown") }
}
//endregion
