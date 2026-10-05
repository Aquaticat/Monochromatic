//region Pure Settings presentation boundaries, not persistence or native fit acceptance
// What: Package shares internal debug-only Settings fixtures and transitions.
// Why: Testing switch positions never opens a preference store or starts analysis.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named JUnit imports expose value and Boolean assertions plus the test marker.
// Why: Host-JVM checks can reject wrong copy and wrong toggle ownership before native capture.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test, expect } from 'test';
// ```
import org.junit.Assert.assertEquals
// Boolean absence assertion.
import org.junit.Assert.assertFalse
// Boolean presence assertion.
import org.junit.Assert.assertTrue
// Host test registration marker.
import org.junit.Test

/**
 * What: A class groups annotated test methods, without an Android activity.
 * Why: Authored switch behaviour is verified separately from native controls and real preferences.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * describe('authored settings pane', () => { ... });
 * ```
 */
class SettingsPaneFixtureTest {
    /**
     * What: @Test registers a named function; assertEquals compares two data-class values field by field.
     * Why: The default capture scene must be exactly D11's mock: prefixes stripped, resume on, analysis off.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('accepted', () => expect(fixture('accepted')).toEqual({ stripCommonPrefixes: true, resumeWhereLeftOff: true, analyseInBackground: false }));
     * ```
     */
    @Test fun acceptedSceneMatchesTheAcceptedMock() {
        assertEquals(SettingsPaneState(true, true, false), settingsPaneFixture("accepted"))
    }
    /** The second scene draws every switch in the position the accepted mock does not show. */
    @Test fun inverseSceneFlipsEveryRow() {
        assertEquals(SettingsPaneState(false, false, true), settingsPaneFixture("inverse"))
    }
    /**
     * What: `expected = IllegalArgumentException::class` tells the runner the test passes only if that
     * exception type is thrown; `::class` is Kotlin's way to name a type as a value.
     * Why: An unplanned scene name must stop the study instead of drawing a default arrangement.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('unknown scene', () => expect(() => fixture('unplanned')).toThrow(IllegalArgumentError));
     * ```
     */
    @Test(expected = IllegalArgumentException::class) fun unknownSceneIsRejected() {
        settingsPaneFixture("unplanned")
    }
    /**
     * What: val binds a read-only local list; `rows[0]` reads by index and `rows.size` is its length.
     * Why: D11 fixes the row order and wording, so a reordered or reworded row fails here by name.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * const rows = settingsPaneRows(fixture('accepted'));
     * expect(rows.map(row => row.id)).toEqual(['strip-common-prefixes', 'resume-where-left-off', 'analyse-in-background']);
     * ```
     */
    @Test fun rowsKeepAcceptedOrderAndCopy() {
        val rows = settingsPaneRows(settingsPaneFixture("accepted"))
        assertEquals(3, rows.size)
        assertEquals("strip-common-prefixes", rows[0].id)
        assertEquals("Strip common prefixes from filenames", rows[0].title)
        assertEquals("Shows “Another Xronixle” instead of “かめりあ(Camellia) - Another Xronixle.flac”.", rows[0].supporting)
        assertEquals("resume-where-left-off", rows[1].id)
        assertEquals("Resume where I left off", rows[1].title)
        assertEquals("Restores the folder, track and position on launch, paused.", rows[1].supporting)
        assertEquals("analyse-in-background", rows[2].id)
        assertEquals("Analyse true peak in the background", rows[2].title)
        assertEquals(
            "Off means each track is measured just before it plays instead — under a second, but no head start.",
            rows[2].supporting,
        )
    }
    /** Each row's switch position is read from its own state field in both scenes. */
    @Test fun rowPositionsFollowState() {
        val accepted = settingsPaneRows(settingsPaneFixture("accepted"))
        assertTrue(accepted[0].checked)
        assertTrue(accepted[1].checked)
        assertFalse(accepted[2].checked)
        val inverse = settingsPaneRows(settingsPaneFixture("inverse"))
        assertFalse(inverse[0].checked)
        assertFalse(inverse[1].checked)
        assertTrue(inverse[2].checked)
    }
    /** The header and closing paragraph keep the accepted settings-a wording. */
    @Test fun titleAndClosingKeepAcceptedCopy() {
        assertEquals("Settings", settingsPaneTitle())
        assertEquals(
            "That's everything. There is no library to configure, no tags to read, and no audio processing " +
                "beyond normalisation — so this pane stays short until the app grows.",
            settingsPaneClosing(),
        )
    }
    /** Toggling the first row changes that field and neither of the others. */
    @Test fun stripToggleChangesOnlyItsRow() {
        val next = settingsPaneEvent(settingsPaneFixture("accepted"), "toggle:strip-common-prefixes")
        assertEquals(SettingsPaneState(false, true, false), next)
    }
    /** Toggling the second row changes that field and neither of the others. */
    @Test fun resumeToggleChangesOnlyItsRow() {
        val next = settingsPaneEvent(settingsPaneFixture("accepted"), "toggle:resume-where-left-off")
        assertEquals(SettingsPaneState(true, false, false), next)
    }
    /** Toggling the third row changes that field and neither of the others. */
    @Test fun analyseToggleChangesOnlyItsRow() {
        val next = settingsPaneEvent(settingsPaneFixture("accepted"), "toggle:analyse-in-background")
        assertEquals(SettingsPaneState(true, true, true), next)
    }
    /**
     * What: A `for (row in rows)` loop visits each list element in order, like TypeScript's `for...of`;
     * the `"toggle:" + row.id` expression joins two strings.
     * Why: Every drawn row must own exactly one event, and applying it twice must return the original
     * record, so no row can be drawn without a working, reversible switch.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * for (const row of rows) { const once = event({ state, event: 'toggle:' + row.id }); expect(event({ state: once, event: 'toggle:' + row.id })).toEqual(state); }
     * ```
     */
    @Test fun everyRowHasOneReversibleToggle() {
        val original = settingsPaneFixture("accepted")
        val rows = settingsPaneRows(original)
        for (row in rows) {
            val once = settingsPaneEvent(original, "toggle:" + row.id)
            val changed = settingsPaneRows(once)
            for (other in changed) {
                val before = rows[changed.indexOf(other)]
                if (other.id == row.id) {
                    assertEquals(!before.checked, other.checked)
                } else {
                    assertEquals(before.checked, other.checked)
                }
            }
            assertEquals(original, settingsPaneEvent(once, "toggle:" + row.id))
        }
    }
    /** A transition returns a new record and leaves the record it was given untouched. */
    @Test fun toggleLeavesInputUnchanged() {
        val original = settingsPaneFixture("accepted")
        settingsPaneEvent(original, "toggle:resume-where-left-off")
        assertEquals(SettingsPaneState(true, true, false), original)
    }
    /** An event name outside the three row toggles stops the study instead of being ignored. */
    @Test(expected = IllegalArgumentException::class) fun unknownEventIsRejected() {
        settingsPaneEvent(settingsPaneFixture("accepted"), "toggle:command-bar-hotkey")
    }
}
//endregion
