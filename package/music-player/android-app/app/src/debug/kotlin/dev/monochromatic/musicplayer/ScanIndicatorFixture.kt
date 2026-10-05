//region Authored scan state, never a real worker, permission or persisted outcome
// What: Package groups the isolated study's immutable inputs with its future native host.
// Why: No production service or decoder is needed to exercise the accepted scan bar.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

/**
 * What: A data class gives read-only val fields, value equality and copy-with-changes.
 * String names a closed phase; Int holds whole counters, rather than fractional Double or wider Long.
 * Why: Authored counts stay within the positive 32-bit fixture range and never represent live analysis.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type ScanIndicatorState = Readonly<{ phase: 'idle' | 'running' | 'paused' | 'complete'; done: number; total: number }>;
 * ```
 */
internal data class ScanIndicatorState(
    /** Closed presentation phase, not a service state. */
    val phase: String,
    /** Whole completed fixture count, constrained by the positive total. */
    val done: Int,
    /** Positive known authored total, not an indeterminate discovery estimate. */
    val total: Int,
) {
    // What: init executes during construction, including data-class copy calls.
    // Why: Invalid phase/count combinations cannot enter rendering through a different constructor path.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // constructor(input) { validate(input); }
    // ```
    init {
        if (phase != "idle" && phase != "running" && phase != "paused" && phase != "complete") {
            throw IllegalArgumentException("Unknown authored scan phase: $phase")
        }
        if (total <= 0 || done < 0 || done > total) {
            throw IllegalArgumentException("Invalid authored scan count: $done of $total")
        }
        if ((phase == "complete") != (done == total) || (phase == "idle" && done != 0)) {
            throw IllegalArgumentException("Authored scan phase and count disagree: $phase, $done of $total")
        }
    }
}

/**
 * What: A named function returns one immutable fixture or throws for an unrecognized scene.
 * Why: Capture scenes cannot silently fall through to running analysis or claim a completed worker result.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function scanIndicatorFixture(scene: string): ScanIndicatorState;
 * ```
 */
internal fun scanIndicatorFixture(scene: String): ScanIndicatorState {
    if (scene == "idle") return ScanIndicatorState("idle", 0, 1218)
    if (scene == "running") return ScanIndicatorState("running", 412, 1218)
    if (scene == "paused") return ScanIndicatorState("paused", 412, 1218)
    if (scene == "near-complete") return ScanIndicatorState("running", 1217, 1218)
    if (scene == "complete") return ScanIndicatorState("complete", 1218, 1218)
    if (scene == "wide-count") return ScanIndicatorState("running", 9999998, 9999999)
    throw IllegalArgumentException("Unknown authored scan scene: $scene")
}

/**
 * What: A Boolean result distinguishes active presentation from idle and terminal states.
 * Why: Completion removes the whole bar rather than leaving a permanent status row or blank slot.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function scanIndicatorVisible(state: ScanIndicatorState): boolean;
 * ```
 */
internal fun scanIndicatorVisible(state: ScanIndicatorState): Boolean {
    return state.phase == "running" || state.phase == "paused"
}

/**
 * What: A String result names the available native button action, with no idle fallback.
 * Why: Pause and Resume share the same fixed slot while absent bars expose no active control.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function scanIndicatorControl(state: ScanIndicatorState): 'Pause' | 'Resume';
 * ```
 */
internal fun scanIndicatorControl(state: ScanIndicatorState): String {
    if (state.phase == "running") return "Pause"
    if (state.phase == "paused") return "Resume"
    throw IllegalArgumentException("Authored scan has no control: ${state.phase}")
}
//endregion
