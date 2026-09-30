// What: Keep host-JVM fixture checks in the debug namespace.
// Why: Production sources and the user's library remain untouched.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module location supplies the namespace.
// ```
package dev.monochromatic.musicplayer

// What: JUnit's assertEquals compares complete values and throws on mismatch.
// Why: Capture labels and order must not drift silently.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect } from 'test';
// ```
import org.junit.Assert.assertEquals

// What: JUnit's Test annotation registers each method with the host test runner.
// Why: Verify literal data without booting Android or opening a keyboard.
//
// In TS you'd write (pseudocode):
// ```ts
// test('fixture', () => { /* assertions */ });
// ```
import org.junit.Test

/**
 * What: Group filename witness checks in a class, rather than a singleton object.
 * Why: JUnit creates a fresh test instance for each independent method.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * describe('filename witnesses', () => { /* tests */ });
 * ```
 */
class SearchFilenameFixtureTest {
    /** Check that a same-parent pair keeps its distinct suffixes and the dotted folder stays a folder. */
    @Test
    fun shortSceneRetainsFilenameAndKind() {
        // listOf makes a read-only list; map transforms each result with a Kotlin trailing lambda.
        val hits = searchFilenameHits("rankfileshort")
        assertEquals(listOf("Cam.flac", "Cam.mp3", "Camellia.flac", "Cam.opus"), hits.map { it.title })
        assertEquals(listOf("Track", "Track", "Folder", "Track"), hits.map { it.kind })
        assertEquals(hits[0].detail, hits[1].detail)
    }

    /** Check that the long pair differs only in its filename suffix, not supporting parent context. */
    @Test
    fun longSceneRetainsBothSuffixes() {
        val hits = searchFilenameHits("rankfilelong")
        val stem = "Camellia Waltz (Live at Miraikan 2026, Extended Archive Version)"
        assertEquals(listOf("$stem.flac", "$stem.mp3", "Camellia"), hits.map { it.title })
        assertEquals(hits[0].detail, hits[1].detail)
    }

    /** Check that literal edge names are neither parsed nor normalized by this fixture. */
    @Test
    fun edgeSceneRetainsLiteralNames() {
        val hits = searchFilenameHits("rankfileedge")
        assertEquals(listOf("Cam.mix.2026.FLAC", ".Cam.session.opus",
            "かめりあ(Camellia) - Camellia Waltz.flac", "Cam"), hits.map { it.title })
    }

    /** Check the shared renderer's fixture entry point against every filename scene. */
    @Test
    fun existingResultEntryPointReturnsFilenameScenes() {
        // Kotlin's for loop visits the read-only scene list, like for...of in TypeScript.
        for (variant in listOf("rankfileshort", "rankfilelong", "rankfileedge")) {
            assertEquals(searchFilenameHits(variant), searchRankingHits(variant, includeParent = false))
        }
    }

    /** Check that an unknown scene throws rather than substituting a different label witness. */
    @Test
    fun unknownSceneIsRejected() {
        // try/catch uses the caught failure's message, like TypeScript's error narrowing.
        try {
            searchFilenameHits("rankfilemissing")
        } catch (error: IllegalArgumentException) {
            assertEquals("Unknown filename presentation fixture: rankfilemissing", error.message)
            return
        }
        // AssertionError fails this test if the guard stops throwing.
        throw AssertionError("Unknown filename scene did not throw.")
    }
}
