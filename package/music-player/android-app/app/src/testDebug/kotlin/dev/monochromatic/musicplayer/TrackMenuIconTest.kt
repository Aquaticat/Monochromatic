//region Native vector mapping is closed to the accepted action identities
// What: Package shares the debug-only icon resolver.
// Why: Host-JVM tests never launch an activity or perform an operation.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose the installed icon properties used as expected values.
// Why: A known action cannot silently receive another action's decorative vector.
//
// In TS you'd write (pseudocode):
// ```ts
// import { icons } from 'material-icons';
// ```
import androidx.compose.material.icons.Icons
// Playback vector.
import androidx.compose.material.icons.filled.PlayArrow
// Shuffle vector.
import androidx.compose.material.icons.filled.Shuffle
// Analysis vector.
import androidx.compose.material.icons.filled.Refresh
// File-manager vector.
import androidx.compose.material.icons.filled.FolderOpen
// Copy vector.
import androidx.compose.material.icons.filled.ContentCopy
// Information vector.
import androidx.compose.material.icons.outlined.Info
// Destructive vector.
import androidx.compose.material.icons.outlined.Delete
// Expected-value assertion.
import org.junit.Assert.assertEquals
// Host-JVM test declaration.
import org.junit.Test

/**
 * What: A class groups native-vector mapping tests without a Compose window.
 * Why: Pure mapping coverage stays separate from glyph appearance or native activation proof.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * describe('authored action icons', () => { ... });
 * ```
 */
class TrackMenuIconTest {
    /**
     * What: listOf creates expected values; map invokes a trailing lambda for each action.
     * Why: Every accepted action exercises its exact mapping branch.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * expect(actions.map(action => icon(action.id))).toEqual(expectedIcons);
     * ```
     */
    @Test fun acceptedIconsMatchNativeVectors() {
        assertEquals(listOf(Icons.Filled.PlayArrow, Icons.Filled.Shuffle, Icons.Outlined.Info,
            Icons.Filled.Refresh, Icons.Filled.FolderOpen, Icons.Filled.ContentCopy, Icons.Outlined.Delete),
            trackMenuActions.map { action -> trackMenuActionIcon(action.id) })
    }
    /**
     * What: expected uses ::class as an exception-type token.
     * Why: Unknown input cannot silently acquire a plausible playback symbol.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * expect(() => icon('unknown')).toThrow();
     * ```
     */
    @Test(expected = IllegalArgumentException::class)
    fun unknownIconIsRejected() { trackMenuActionIcon("unknown") }
}
//endregion
