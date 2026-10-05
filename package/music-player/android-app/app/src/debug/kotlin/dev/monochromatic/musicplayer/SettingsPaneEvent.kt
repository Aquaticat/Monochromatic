//region Checked authored switch transitions, no preference store or production callback
// What: Package shares the validated authored Settings record.
// Why: Native switch input can be tested against pure transitions without saving anything.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

/**
 * What: A function accepts an immutable state and a checked event name.
 * The data-class copy method constructs a replacement record instead of mutating the original,
 * and the `!` prefix negates a Boolean exactly as it does in TypeScript.
 * Why: One tap flips exactly one row, and an unknown event name fails loudly instead of
 * leaving the pane looking unchanged.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function settingsPaneEvent(input: { state: SettingsPaneState; event: string }): SettingsPaneState;
 * // Returning { ...state, resumeWhereLeftOff: !state.resumeWhereLeftOff } replaces the record without a side effect.
 * ```
 */
internal fun settingsPaneEvent(state: SettingsPaneState, event: String): SettingsPaneState {
    if (event == "toggle:strip-common-prefixes") return state.copy(stripCommonPrefixes = !state.stripCommonPrefixes)
    if (event == "toggle:resume-where-left-off") return state.copy(resumeWhereLeftOff = !state.resumeWhereLeftOff)
    if (event == "toggle:analyse-in-background") return state.copy(analyseInBackground = !state.analyseInBackground)
    throw IllegalArgumentException("Unknown authored Settings event: $event")
}
//endregion
