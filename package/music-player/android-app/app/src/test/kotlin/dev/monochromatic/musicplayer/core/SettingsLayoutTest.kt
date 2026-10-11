// What:     `package dev.monochromatic.musicplayer.core` places this test beside the Settings layout rules.
// Why:      The test reaches the public pure function in the same package as the code under test.
//
// In TS you'd write (pseudocode):
// ```ts
// // File path supplies the test module namespace.
// ```
package dev.monochromatic.musicplayer.core

// What:     Imports from JUnit bring in the assertion and the test annotation.
// Why:      Each row's radii are compared with an explicit expected value.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect, test } from "test";
// ```
import org.junit.Assert.assertEquals
import org.junit.Test

// What:     `class SettingsLayoutTest` groups the pure corner tests for the Settings template rows.
// Why:      Which corners round for a row at each position can be verified on the host JVM, without Compose.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("settingsRowRadii", () => { ... });
// ```
/** Verifies which corners of each Settings row take the group radius and which take the joint radius. */
class SettingsLayoutTest {
    // What:     `singleRowRoundsAllCorners` checks that a group of one row takes the group radius on top and bottom.
    // Why:      A lone row is both the first and the last row, so all four of its corners are group ends.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("single row takes group radius on top and bottom", () => { ... });
    // ```
    /** Confirms a one-row group rounds both its top and its bottom with the group radius. */
    @Test
    fun singleRowRoundsAllCorners() {
        assertEquals(
            SettingsRowRadii(topDp = SETTINGS_GROUP_RADIUS_DP, bottomDp = SETTINGS_GROUP_RADIUS_DP),
            settingsRowRadii(index = 0, count = 1),
        )
    }

    // What:     `firstOfTwoRowsRoundsTopOnly` checks that the first of two rows rounds only its top.
    // Why:      The first row's top is the group's outer top edge, and its bottom meets the second row.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("first of two rows: group top, joint bottom", () => { ... });
    // ```
    /** Confirms the first of two rows takes the group radius on top and the joint radius on bottom. */
    @Test
    fun firstOfTwoRowsRoundsTopOnly() {
        assertEquals(
            SettingsRowRadii(topDp = SETTINGS_GROUP_RADIUS_DP, bottomDp = SETTINGS_JOINT_RADIUS_DP),
            settingsRowRadii(index = 0, count = 2),
        )
    }

    // What:     `lastOfTwoRowsRoundsBottomOnly` checks that the last of two rows rounds only its bottom.
    // Why:      The last row's bottom is the group's outer bottom edge, and its top meets the first row.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("last of two rows: joint top, group bottom", () => { ... });
    // ```
    /** Confirms the last of two rows takes the joint radius on top and the group radius on bottom. */
    @Test
    fun lastOfTwoRowsRoundsBottomOnly() {
        assertEquals(
            SettingsRowRadii(topDp = SETTINGS_JOINT_RADIUS_DP, bottomDp = SETTINGS_GROUP_RADIUS_DP),
            settingsRowRadii(index = 1, count = 2),
        )
    }

    // What:     `firstOfThreeRowsRoundsTopOnly` checks that the first of three rows rounds only its top.
    // Why:      Only the group's first row touches the group's top edge, so the other rows keep joint corners on top.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("first of three rows: group top, joint bottom", () => { ... });
    // ```
    /** Confirms the first of three rows takes the group radius on top and the joint radius on bottom. */
    @Test
    fun firstOfThreeRowsRoundsTopOnly() {
        assertEquals(
            SettingsRowRadii(topDp = SETTINGS_GROUP_RADIUS_DP, bottomDp = SETTINGS_JOINT_RADIUS_DP),
            settingsRowRadii(index = 0, count = 3),
        )
    }

    // What:     `middleOfThreeRowsRoundsJointsOnly` checks that a row between two others takes joint radii only.
    // Why:      A middle row touches no group edge, so all four of its corners stay at the small joint radius.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("middle of three rows: joint on all corners", () => { ... });
    // ```
    /** Confirms a row with neighbours on both sides takes the joint radius on top and bottom. */
    @Test
    fun middleOfThreeRowsRoundsJointsOnly() {
        assertEquals(
            SettingsRowRadii(topDp = SETTINGS_JOINT_RADIUS_DP, bottomDp = SETTINGS_JOINT_RADIUS_DP),
            settingsRowRadii(index = 1, count = 3),
        )
    }

    // What:     `lastOfThreeRowsRoundsBottomOnly` checks that the last of three rows rounds only its bottom.
    // Why:      The last row is the only one that touches the group's bottom edge.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("last of three rows: joint top, group bottom", () => { ... });
    // ```
    /** Confirms the last of three rows takes the joint radius on top and the group radius on bottom. */
    @Test
    fun lastOfThreeRowsRoundsBottomOnly() {
        assertEquals(
            SettingsRowRadii(topDp = SETTINGS_JOINT_RADIUS_DP, bottomDp = SETTINGS_GROUP_RADIUS_DP),
            settingsRowRadii(index = 2, count = 3),
        )
    }
}
