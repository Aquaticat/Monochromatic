// Tests use synthetic paths and the actual controller, never a source provider or native audio.

// What: Share the app namespace in the test-debug source set.
// Why: Host JVM tests can inspect debug-only setup without exposing it in release builds.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity is the source path.
// ```
package dev.monochromatic.musicplayer

// What: Test is JUnit's method annotation, unlike a production callback.
// Why: The existing package task discovers each independently verifiable fixture check.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from 'test';
// ```
import org.junit.Test

// What: JUnit assertions fail the host test with the mismatched value.
// Why: Verify controller state and literal row text rather than compilation alone.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect } from 'test';
// ```
import org.junit.Assert.assertEquals
// Boolean state must be observed as false rather than inferred from missing audio.
import org.junit.Assert.assertFalse
// Setup requires actual controller callback registration and explicit failure evidence.
import org.junit.Assert.assertTrue

// What: rowDisplay is the production relative-row text function.
// Why: The baseline's actual page context must preserve the matched filename suffixes.
//
// In TS you'd write (pseudocode):
// ```ts
// import { rowDisplay } from './core/Pagination';
// ```
import dev.monochromatic.musicplayer.core.rowDisplay

/**
 * What: Declare a plain test class; annotations identify its runnable methods.
 * Why: Check the actual-renderer input seam without launching MainActivity or a service.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * describe('FilenameBaselineFixture', () => { /* tests */ });
 * ```
 */
class FilenameBaselineFixtureTest {
    // What: ArrayList stores events at this owned test boundary, not in Android Log.
    // Why: Tests verify logging without making a platform call or silencing its failures.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly diagnosticEvents: FilenameBaselineEvent[] = [];
    // ```
    private val diagnosticEvents: ArrayList<FilenameBaselineEvent> = ArrayList<FilenameBaselineEvent>()

    /**
     * What: Declare an event-to-Unit method before passing its bound reference.
     * Why: Every emitted event stays inspectable by the host test without a no-op logger.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * private recordDiagnostic(event: FilenameBaselineEvent): void { this.diagnosticEvents.push(event); }
     * ```
     */
    private fun recordDiagnostic(event: FilenameBaselineEvent) {
        diagnosticEvents.add(event)
    }

    /**
     * What: Test annotation marks a no-argument Unit method for JUnit.
     * Why: Both authored scenes preserve their real parent/page text without autoplay.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('authored scenes keep literal row names and no current selection', () => { /* ... */ });
     * ```
     */
    @Test fun scenesKeepLiteralRowNamesWithoutSelection() {
        // What: listOf is an ordered read-only List, not MutableList or a fixed Array.
        // Why: Exercise both independent fixture branches with the same state assertions.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const scene of ['long', 'short']) { /* ... */ }
        // ```
        for (scene in listOf("long", "short")) {
            // What: Construct the immutable request and read the seeded controller record.
            // Why: Tests use the same public setup path as the debug activity.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const fixture = filenameBaselineFixture({ scene, selection: 'none' });
            // ```
            // What: ::recordDiagnostic is a bound function reference, not a method invocation.
            // Why: The fixture writes real events to this test-owned recorder.
            //
            // In TS you\'d write (pseudocode):
            // ```ts
            // const report = (event: FilenameBaselineEvent) => this.recordDiagnostic(event);
            // ```
            val fixture = filenameBaselineFixture(FilenameBaselineRequest(scene, "none", ::recordDiagnostic))
            val state = fixture.controller.uiState
            assertEquals("Cult of Luna", state.pageLabels[state.selectedPage])
            assertEquals(2, state.pageItems.size)
            assertEquals(null, state.currentIndex)
            assertEquals(null, fixture.engine.loadedUri)
            assertEquals(0, fixture.engine.loadCount)
            assertEquals(0.0, fixture.engine.positionSec(), 0.0)
            assertEquals(0.0, fixture.engine.durationSec(), 0.0)
            assertFalse(fixture.engine.playWhenReady())
            assertTrue(fixture.engine.callbacksRegistered())
            assertFalse(diagnosticEvents.isEmpty())
            // What: A for loop visits the two bounded row indices.
            // Why: Both distinct suffixes survive real common-root and active-page trimming.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // for (let index = 0; index < 2; index++) { /* compare exact authored row text */ }
            // ```
            for (index in 0..1) {
                val expected = fixture.displayPaths[index].removePrefix("StudyLibrary/Cult of Luna/")
                assertEquals(expected, rowDisplay("Cult of Luna", state.pageItems[index].name))
            }
            fixture.engine.release()
            assertFalse(fixture.engine.callbacksRegistered())
        }
    }

    /**
     * What: Declare a second JUnit method with an explicit Unit body.
     * Why: Selection-swap captures can isolate current-row decoration without audio.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('first and second selections restore the intended identity paused', () => { /* ... */ });
     * ```
     */
    @Test fun selectionsRestoreCorrectIdentityPaused() {
        // Reuse bounded list iteration for the scene and independently authored selection values.
        for (scene in listOf("long", "short")) {
            for (selection in listOf("first", "second")) {
                val fixture = filenameBaselineFixture(FilenameBaselineRequest(scene, selection, ::recordDiagnostic))
                // What: Int is a bounded array index; an if/else expression chooses its literal value.
                // Why: The expected identity is independent of the controller under test.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const index = selection === 'first' ? 0 : 1;
                // ```
                val index: Int = if (selection == "first") 0 else 1
                assertEquals("fixture://filename-player/$scene/$index", fixture.selectedUri)
                assertEquals(fixture.selectedUri, fixture.engine.loadedUri)
                assertEquals(index, fixture.controller.uiState.currentIndex)
                assertEquals(1, fixture.engine.loadCount)
                assertEquals(66.0, fixture.engine.positionSec(), 0.0)
                assertEquals(275.0, fixture.engine.durationSec(), 0.0)
                assertFalse(fixture.engine.playWhenReady())
                fixture.engine.pause()
                // What: 0.5f is a 32-bit Float literal; bare 0.5 would be wider Double.
                // Why: Match AudioEngine's gain type without an implicit narrowing conversion.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // fixture.engine.setVolume(0.5);
                // ```
                fixture.engine.setVolume(0.5f)
                assertFalse(fixture.engine.playWhenReady())
                fixture.engine.release()
            }
        }
    }

    /**
     * What: JUnit runs this method expecting failure to be caught and explicitly checked.
     * Why: Unknown source-routing values cannot silently substitute a different baseline.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('unknown scene is rejected', () => { /* catch and assert */ });
     * ```
     */
    @Test fun unknownSceneIsRejected() {
        var rejected: Boolean = false
        try {
            filenameBaselineFixture(FilenameBaselineRequest("unknown", "none", ::recordDiagnostic))
        } catch (error: IllegalArgumentException) {
            assertEquals("Unknown actual-player filename scene: unknown", error.message)
            rejected = true
        }
        assertTrue("Unknown actual-player filename scene did not throw.", rejected)
    }

    /**
     * What: Declare another guarded JUnit method instead of conflating unknown inputs.
     * Why: Selection routing is checked separately from scene routing.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('unknown selection is rejected', () => { /* catch and assert */ });
     * ```
     */
    @Test fun unknownSelectionIsRejected() {
        var rejected: Boolean = false
        try {
            filenameBaselineFixture(FilenameBaselineRequest("long", "unknown", ::recordDiagnostic))
        } catch (error: IllegalArgumentException) {
            assertEquals("Unknown actual-player filename selection: unknown", error.message)
            rejected = true
        }
        assertTrue("Unknown actual-player filename selection did not throw.", rejected)
    }

    /**
     * What: @Test(expected = IllegalStateException::class) passes a class reference,
     *       not an exception object; ::class is Kotlin's type-reference spelling.
     * Why: The transport guard must fail with the intended exception, not any error.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('play is rejected', () => expect(() => engine.play()).toThrow());
     * ```
     */
    @Test(expected = IllegalStateException::class)
    fun playbackLoadIsRejected() {
        FilenameBaselineEngine(::recordDiagnostic).load("fixture://filename-player/long/0", true)
    }

    /**
     * What: Reuse the expected exception annotation for the other engine playback entry.
     * Why: Direct play and autoplay-load are separate guarded paths.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('direct play is rejected', () => expect(() => engine.play()).toThrow());
     * ```
     */
    @Test(expected = IllegalStateException::class)
    fun directPlayIsRejected() {
        FilenameBaselineEngine(::recordDiagnostic).play()
    }

    /**
     * What: The expected exception class is a Kotlin class reference, not an exception instance.
     * Why: Real file URIs cannot enter this synthetic renderer double.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('nonfixture URI is rejected', () => expect(() => engine.load('file:///sample', false)).toThrow());
     * ```
     */
    @Test(expected = IllegalArgumentException::class)
    fun nonfixtureUriIsRejected() {
        FilenameBaselineEngine(::recordDiagnostic).load("file:///sample.flac", false)
    }

    /**
     * What: JUnit invokes the lifecycle guard using a released engine instance.
     * Why: A late setup load cannot reuse a destroyed baseline.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('released engine rejects load', () => { engine.release(); expect(() => engine.load(...)).toThrow(); });
     * ```
     */
    @Test(expected = IllegalStateException::class)
    fun releasedEngineIsRejected() {
        val engine = FilenameBaselineEngine(::recordDiagnostic)
        engine.release()
        engine.load("fixture://filename-player/long/0", false)
    }
}
