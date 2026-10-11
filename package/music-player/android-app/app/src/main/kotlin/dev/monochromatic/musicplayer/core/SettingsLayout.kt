// Pure corner rules for the Settings template rows: which radius each row of a grouped card gets. This file has no
// Compose imports, so it is unit-tested on the JVM.

// What:     `package dev.monochromatic.musicplayer.core` places these rules beside the other pure page helpers.
// Why:      The rules take plain numbers only, so they share the core package and need no import.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer.core

// What:     `internal const val SETTINGS_GROUP_RADIUS_DP: Float = 14f` is the corner radius at the outer ends of
//           a group.
// Why:      The stock Settings captures measure about 14 dp at the first row's top and the last row's bottom.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_GROUP_RADIUS_DP = 14;
// ```
/** Corner radius in dp at the outer ends of a grouped card: the top of its first row and the bottom of its last. */
internal const val SETTINGS_GROUP_RADIUS_DP: Float = 14f

// What:     `internal const val SETTINGS_JOINT_RADIUS_DP: Float = 2f` is the corner radius where two rows meet.
// Why:      The stock captures show rows separated by a small gap with only slightly rounded inner corners.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_JOINT_RADIUS_DP = 2;
// ```
/** Corner radius in dp at the edges where two rows of one group meet. */
internal const val SETTINGS_JOINT_RADIUS_DP: Float = 2f

// What:     `internal data class SettingsRowRadii` holds the top and bottom corner radius of one row.
// Why:      A row needs two radii, one for its top corners and one for its bottom corners, and a pure pair
//           keeps them testable.
//
// In TS you'd write (pseudocode):
// ```ts
// type SettingsRowRadii = { topDp: number; bottomDp: number };
// ```
/** Top and bottom corner radii of one grouped row, both in dp. */
internal data class SettingsRowRadii(
    /** Radius in dp applied to both top corners of the row. */
    val topDp: Float,
    /** Radius in dp applied to both bottom corners of the row. */
    val bottomDp: Float,
)

// What:     `internal fun settingsRowRadii(index: Int, count: Int): SettingsRowRadii` gives the row at [index]
//           of [count] rows its corner radii.
// Why:      A group's first row rounds its top and its last row rounds its bottom, while rows in between take
//           the small joint radius, so the gap between rows shows the page background. A group of one row
//           rounds all four corners.
//
// In TS you'd write (pseudocode):
// ```ts
// const settingsRowRadii = (index: number, count: number) => ({
//   topDp: index === 0 ? 14 : 2,
//   bottomDp: index === count - 1 ? 14 : 2,
// });
// ```
/** Radii for the row at [index] of [count] rows, where [index] lies in 0 until [count]. */
internal fun settingsRowRadii(index: Int, count: Int): SettingsRowRadii {
    /** Whether this row is the first of its group, which takes the group radius on top. */
    val isFirst: Boolean = index == 0
    /** Whether this row is the last of its group, which takes the group radius on the bottom. */
    val isLast: Boolean = index == count - 1
    return SettingsRowRadii(
        topDp = if (isFirst) SETTINGS_GROUP_RADIUS_DP else SETTINGS_JOINT_RADIUS_DP,
        bottomDp = if (isLast) SETTINGS_GROUP_RADIUS_DP else SETTINGS_JOINT_RADIUS_DP,
    )
}
