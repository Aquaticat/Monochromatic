//region Checked synthetic transitions, no worker or storage callback
// What: Package shares the validated authored scan record.
// Why: Native input can be tested against pure transitions without starting analysis.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

/**
 * What: A function accepts an immutable state and a checked event name.
 * The data-class copy method constructs a validated replacement instead of mutating the original.
 * Why: Pause freezes synthetic progress, Resume retains counts, and the last step removes active presentation.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function scanIndicatorEvent(input: { state: ScanIndicatorState; event: string }): ScanIndicatorState;
 * // Returning { ...state, phase: 'paused' } replaces the record without a side effect.
 * ```
 */
internal fun scanIndicatorEvent(state: ScanIndicatorState, event: String): ScanIndicatorState {
    if (event == "start" && state.phase == "idle") return state.copy(phase = "running")
    if (event == "pause" && state.phase == "running") return state.copy(phase = "paused")
    if (event == "resume" && state.phase == "paused") return state.copy(phase = "running")
    if (event == "advance" && state.phase == "paused") return state
    if (event == "advance" && state.phase == "running") {
        // What: val binds a whole-number successor; validated active states have done strictly less than total.
        // Why: Adding one cannot overflow Int even when the positive total is Int.MAX_VALUE.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const next = state.done + 1;
        // ```
        val next: Int = state.done + 1
        if (next == state.total) return state.copy(phase = "complete", done = next)
        return state.copy(done = next)
    }
    throw IllegalArgumentException("Invalid authored scan event: $event in ${state.phase}")
}
//endregion
