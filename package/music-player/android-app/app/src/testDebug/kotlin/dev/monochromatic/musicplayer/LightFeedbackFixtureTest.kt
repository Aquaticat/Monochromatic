//region Authored operation-result controls, never real storage or permission mutations
// What: Package grants access to this debug-only fixture's internal helpers.
// Why: Host-JVM tests can reject false success without Android storage providers.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: JUnit Test registers independent fixture checks.
// Why: The package's unit task exercises these outcome boundaries with no device.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from 'test';
// ```
import org.junit.Test
// Literal output and omitted-row sets must agree with each exact authored scene.
import org.junit.Assert.assertEquals
// Completed-with-handle is the positive Undo control.
import org.junit.Assert.assertTrue
// Noncompleted or expired operations cannot offer successful Undo.
import org.junit.Assert.assertFalse

/**
 * What: A plain test class groups methods rather than owning an Android lifecycle.
 * Why: No fixture proof needs a real provider, player or filesystem handle.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * describe('light feedback outcomes', () => { ... });
 * ```
 */
class LightFeedbackFixtureTest {
    /**
     * What: @Test marks a no-argument method whose assertions throw on mismatch.
     * Why: Positive completion must be demonstrably reachable before trusting rejection cases.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('completed operation with handle permits Undo', () => expect(...).toBe(true));
     * ```
     */
    @Test fun verifiedSuccessWithHandlePermitsUndo() {
        assertTrue(lightFeedbackCanOfferUndo(LightTrashOutcomeFixture("verified-success", true, false)))
    }

    /** Completion alone supplies no restoration operation. */
    @Test fun verifiedSuccessWithoutHandleRejectsUndo() {
        assertFalse(lightFeedbackCanOfferUndo(LightTrashOutcomeFixture("verified-success", false, false)))
    }

    /** An expired authored interval does not keep an actionable Undo. */
    @Test fun expiredVerifiedSuccessHandleRejectsUndo() {
        assertFalse(lightFeedbackCanOfferUndo(LightTrashOutcomeFixture("verified-success", true, true)))
    }

    /** Request creation or pending Android approval is not operation completion. */
    @Test fun pendingEvenWithHandleRejectsUndo() {
        assertFalse(lightFeedbackCanOfferUndo(LightTrashOutcomeFixture("pending", true, false)))
    }

    /** Accepted or completed request receipt is not authored per-item verified success. */
    @Test fun approvedUnverifiedEvenWithHandleRejectsUndo() {
        assertFalse(lightFeedbackCanOfferUndo(LightTrashOutcomeFixture("approved-but-unverified", true, false)))
    }

    /**
     * What: expected names the required exception class; ::class supplies its runtime type token.
     * Why: Completion-only wording cannot silently acquire a per-item verified-success meaning.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('retired completion marker throws', () => expect(() => ...).toThrow());
     * ```
     */
    @Test(expected = IllegalArgumentException::class)
    fun completionOnlyMarkerIsRejected() {
        lightFeedbackCanOfferUndo(LightTrashOutcomeFixture("completed", true, false))
    }

    /** Cancelled provider requests cannot show successful-trash feedback. */
    @Test fun cancelledEvenWithHandleRejectsUndo() {
        assertFalse(lightFeedbackCanOfferUndo(LightTrashOutcomeFixture("cancelled", true, false)))
    }

    /** Failed provider requests cannot show successful-trash feedback. */
    @Test fun failedEvenWithHandleRejectsUndo() {
        assertFalse(lightFeedbackCanOfferUndo(LightTrashOutcomeFixture("failed", true, false)))
    }

    /** Unknown operation state must fail rather than borrow a success-looking fallback. */
    @Test(expected = IllegalArgumentException::class)
    fun unknownOutcomeIsRejected() {
        lightFeedbackCanOfferUndo(LightTrashOutcomeFixture("assumed", true, false))
    }

    /** A known vanished row disappears without inventing a trash-Undo relationship. */
    @Test fun missingRowNamesInputAndHasNoUndo() {
        // What: val holds one immutable display record with a read-only List<String>.
        // Why: Compare complete scene content without mutating any real library.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const fixture = lightFeedbackFixture('missing');
        // ```
        val fixture: LightFeedbackFixture = lightFeedbackFixture("missing")
        assertEquals(listOf("Burning Aquamarine"), fixture.omittedTitles)
        assertTrue(fixture.error.contains("Burning Aquamarine"))
        assertFalse(fixture.undo)
    }

    /** Successful authored trash removes only its own row and provides the separate Undo premise. */
    @Test fun undoOnlyHasNoErrorBar() {
        val fixture: LightFeedbackFixture = lightFeedbackFixture("undo")
        assertEquals("", fixture.error)
        assertEquals(listOf("Ghost"), fixture.omittedTitles)
        assertTrue(fixture.undo)
    }

    /** Multiple missing rows and successful trash stay separate incidents in the combined layout. */
    @Test fun combinedKeepsFailureCountSeparateFromTrash() {
        val fixture: LightFeedbackFixture = lightFeedbackFixture("combined")
        assertEquals("3 unavailable files were removed from this list.", fixture.error)
        assertEquals(4, fixture.omittedTitles.size)
        assertTrue(fixture.omittedTitles.contains("Ghost"))
        assertTrue(fixture.undo)
    }

    /** Failed trash leaves the row in place and never offers a success toast. */
    @Test fun failedTrashKeepsRowAndRejectsUndo() {
        val fixture: LightFeedbackFixture = lightFeedbackFixture("trash-failed")
        assertTrue(fixture.omittedTitles.isEmpty())
        assertTrue(fixture.error.contains("Ghost was not moved to trash"))
        assertFalse(fixture.undo)
    }

    /** Pending approval changes neither the row list nor successful feedback. */
    @Test fun pendingTrashKeepsRowsAndNoSuccessFeedback() {
        val fixture: LightFeedbackFixture = lightFeedbackFixture("trash-pending")
        assertTrue(fixture.omittedTitles.isEmpty())
        assertEquals("", fixture.error)
        assertFalse(fixture.undo)
    }

    /** Unknown route strings do not get a permissive normal-player fallback. */
    @Test(expected = IllegalArgumentException::class)
    fun unknownFeedbackSceneIsRejected() {
        lightFeedbackFixture("combined-later")
    }
}
//endregion
