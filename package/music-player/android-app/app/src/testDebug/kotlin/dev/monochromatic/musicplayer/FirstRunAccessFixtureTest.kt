//region Host tests, authored state boundaries rather than real file or permission operations
// What: Package gives these tests access to debug-only internal fixture helpers.
// Why: No test needs production services, files or Android permission changes.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: JUnit's Test annotation registers each independent no-argument test method.
// Why: The package's existing unit task executes the first-run boundary checks.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from 'test';
// ```
import org.junit.Test
// Exact literal copy and action labels are compared without platform rendering.
import org.junit.Assert.assertEquals
// The positive empty-claim fixture must return true.
import org.junit.Assert.assertTrue
// Partial or failed reads must return false, including when their count is zero.
import org.junit.Assert.assertFalse
// What: assertNull passes only for null, like TS `expect(value).toBeNull()`.
// Why: No-audio scenes must draw no secondary button, which the fixture marks with null.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect } from 'test';
// ```
import org.junit.Assert.assertNull

/**
 * What: A plain class groups JUnit methods; it is not a singleton object or Android activity.
 * Why: Test discovery can instantiate the suite without loading native libraries.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * describe('authored first-run states', () => { ... });
 * ```
 */
class FirstRunAccessFixtureTest {
    /**
     * What: @Test marks a method that asserts a complete authored inventory with zero audio.
     * Why: A positive control proves the classifier is capable of accepting the intended premise.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('complete zero-audio scope permits scoped claim', () => expect(...).toBe(true));
     * ```
     */
    @Test fun completeZeroAudioPermitsScopedClaim() {
        assertTrue(firstRunCanClaimNoAudio(FirstRunDiscoveryFixture("complete", 0)))
    }

    /** Complete discovery with an eligible item is not empty. */
    @Test fun completeWithAudioDoesNotPermitEmptyClaim() {
        assertFalse(firstRunCanClaimNoAudio(FirstRunDiscoveryFixture("complete", 1)))
    }

    /** An empty partial batch is not a completed inventory. */
    @Test fun partialZeroDoesNotPermitEmptyClaim() {
        assertFalse(firstRunCanClaimNoAudio(FirstRunDiscoveryFixture("partial", 0)))
    }

    /** Partial results do not make the assessed scope complete. */
    @Test fun partialWithAudioDoesNotPermitEmptyClaim() {
        assertFalse(firstRunCanClaimNoAudio(FirstRunDiscoveryFixture("partial", 1)))
    }

    /** Failed and unread scopes remain unknown, with or without an authored audio item. */
    @Test fun failedAndUnreadDoNotPermitEmptyClaim() {
        // What: A for loop iterates a read-only list with Kotlin's `in` syntax.
        // Why: Exercise zero and positive counts for both non-complete coverage branches.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const coverage of ['failed', 'unread']) for (const count of [0, 1]) { ... }
        // ```
        for (coverage in listOf("failed", "unread")) {
            // Iterate the boundary counts without changing any real inventory.
            for (count in listOf(0, 1)) {
                assertFalse(firstRunCanClaimNoAudio(FirstRunDiscoveryFixture(coverage, count)))
            }
        }
    }

    /**
     * What: expected declares which exception class JUnit must observe; ::class is a type token.
     * Why: Unknown state data must throw, not silently appear as a credible empty result.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('unknown coverage throws', () => expect(() => firstRunCanClaimNoAudio(...)).toThrow());
     * ```
     */
    @Test(expected = IllegalArgumentException::class)
    fun unknownCoverageIsRejected() {
        firstRunCanClaimNoAudio(FirstRunDiscoveryFixture("assumed", 0))
    }

    /** A negative count is malformed fixture data rather than a special empty sentinel. */
    @Test(expected = IllegalArgumentException::class)
    fun negativeCountIsRejected() {
        firstRunCanClaimNoAudio(FirstRunDiscoveryFixture("complete", -1))
    }

    /** Declined access leaves the device library open but unreadable, offering access or a folder (D95, D100). */
    @Test fun declinedIsOpenButUnreadable() {
        // What: val binds one immutable scene record; String is literal text rather than a parsed path.
        // Why: Inspect the authored declined scene without querying LibraryRoot or permissions.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const fixture = firstRunAccessFixture('declined');
        // ```
        val fixture: FirstRunAccessFixture = firstRunAccessFixture("declined")
        assertEquals("The device music library can't be read", fixture.title)
        assertEquals(
            "It is open as your library, but access to music on this device was not granted. Allow access, or open a folder instead.",
            fixture.body,
        )
        assertEquals("Allow access", fixture.primary)
        assertEquals("allow-access", fixture.primaryEvent)
        assertEquals("Open a folder", fixture.secondary)
        assertTrue(fixture.analysis)
    }

    /**
     * What: expected requires IllegalArgumentException from the retired scene name.
     * Why: D100 leaves no state without a source, so `not-opened` must throw like any unknown scene.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('not-opened is rejected', () => expect(() => firstRunAccessFixture('not-opened')).toThrow());
     * ```
     */
    @Test(expected = IllegalArgumentException::class)
    fun notOpenedIsRejected() {
        firstRunAccessFixture("not-opened")
    }

    /** Zero eligible audio in the authored system scope does not mean zero files on the device. */
    @Test fun systemZeroAudioNamesAssessedScope() {
        val fixture: FirstRunAccessFixture = firstRunAccessFixture("system-no-audio")
        assertEquals("No audio found in the device music library", fixture.title)
        assertTrue(fixture.body.contains("checked completely"))
        assertFalse(fixture.analysis)
        // The filled button opens a folder, and no secondary button is drawn.
        assertEquals("open-folder", fixture.primaryEvent)
        assertNull(fixture.secondary)
    }

    /** Opening another folder changes scope rather than repairing or widening the old source. */
    @Test fun folderZeroAudioRetainsChosenScope() {
        val fixture: FirstRunAccessFixture = firstRunAccessFixture("folder-no-audio")
        assertEquals("No audio found in Cult of Luna", fixture.title)
        assertTrue(fixture.body.contains("changes the music source"))
        assertFalse(fixture.analysis)
        // The filled button opens a different folder, and no secondary button is drawn.
        assertEquals("open-folder", fixture.primaryEvent)
        assertNull(fixture.secondary)
    }

    /** Unknown route input cannot render a fallback scene. */
    @Test(expected = IllegalArgumentException::class)
    fun unknownSceneIsRejected() {
        firstRunAccessFixture("declined-extra")
    }
}
//endregion
