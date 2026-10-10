// What:     `package dev.monochromatic.musicplayer.core` places the scan indicator model beside the
//           queue, session, and playback mode types.
// Why:      The phase and text rules are platform-independent and can be tested on the host JVM.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer.core

// What:     `enum class ScanIndicatorPhase` declares the four closed phases of the scan indicator.
// Why:      A closed set lets the composable and the text rule handle every phase explicitly.
//
// In TS you'd write (pseudocode):
// ```ts
// type ScanIndicatorPhase = "idle" | "scanning_library" | "measuring_true_peak" | "done";
// ```
/** Phases the scan indicator passes through, from nothing running to measurement finished. */
enum class ScanIndicatorPhase {
    // What:     `IDLE` is the state with no library scan and no true-peak work to show.
    // Why:      Nothing is visible, so an idle library never reserves a status row.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const idle = "idle";
    // ```
    /** No library scan and no true-peak measurement is pending. */
    IDLE,

    // What:     `SCANNING_LIBRARY` is the phase while the music library is being read.
    // Why:      The total is not known yet, so the bar shows an indeterminate progress line.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const scanningLibrary = "scanning_library";
    // ```
    /** The library is being read and no track count is known yet. */
    SCANNING_LIBRARY,

    // What:     `MEASURING_TRUE_PEAK` is the phase while each track's true peak is measured.
    // Why:      A known total lets the bar show a determinate "done of total" count.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const measuringTruePeak = "measuring_true_peak";
    // ```
    /** True peaks are being measured, and the done and total counts are known. */
    MEASURING_TRUE_PEAK,

    // What:     `DONE` is the phase after every track has been visited.
    // Why:      The indicator leaves once measurement finishes, so no permanent status row remains.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const done = "done";
    // ```
    /** Measurement finished, so the indicator is removed. */
    DONE,
}

// What:     `data class ScanIndicatorModel(...)` holds the phase plus the done and total counts.
// Why:      An immutable record lets the composable render from one value without reading the sweep.
//
// In TS you'd write (pseudocode):
// ```ts
// type ScanIndicatorModel = Readonly<{ phase: ScanIndicatorPhase; done: number; total: number }>;
// ```
/**
 * Immutable snapshot of what the scan indicator shows. [done] and [total] are zero when the total
 * is unknown, and [done] never exceeds [total] when a total is known.
 */
data class ScanIndicatorModel(
    /** Phase the indicator is currently in. */
    val phase: ScanIndicatorPhase,
    /** Tracks whose visit has finished, inside the known total. */
    val done: Int,
    /** Number of tracks the sweep will visit, or zero when not yet known. */
    val total: Int,
) {
    // What:     `val visible: Boolean` is a computed property with a getter.
    // Why:      Visibility follows the phase, so the flag cannot disagree with it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // get visible(): boolean { return phase === "scanning_library" || phase === "measuring_true_peak"; }
    // ```
    /** True only while the library is being scanned or true peaks are being measured. */
    val visible: Boolean
        get() = phase == ScanIndicatorPhase.SCANNING_LIBRARY || phase == ScanIndicatorPhase.MEASURING_TRUE_PEAK
}

// What:     `fun scanIndicatorFor(...)` derives the indicator model from the library and sweep state.
// Why:      A loading library takes precedence, then a known total decides between measuring and done.
//
// In TS you'd write (pseudocode):
// ```ts
// function scanIndicatorFor(loading: boolean, measured: number, total: number): ScanIndicatorModel;
// ```
/**
 * Chooses the scan indicator phase from the library loading flag and the sweep counts.
 *
 * @param loading true while the library is being read
 * @param measured tracks visited so far, including cached and failed ones, out of the capped total
 * @param total capped number of tracks the sweep will visit, zero when unknown
 * @return the model to render
 */
fun scanIndicatorFor(loading: Boolean, measured: Int, total: Int): ScanIndicatorModel {
    if (loading) {
        return ScanIndicatorModel(phase = ScanIndicatorPhase.SCANNING_LIBRARY, done = 0, total = 0)
    }
    /** Total with negative values treated as zero, so an unknown total never reaches the counts. */
    val knownTotal: Int = total.coerceAtLeast(0)
    if (knownTotal == 0) {
        return ScanIndicatorModel(phase = ScanIndicatorPhase.IDLE, done = 0, total = 0)
    }
    /** Visited count clamped into the known total, so overshoot cannot exceed the bar. */
    val done: Int = measured.coerceIn(0, knownTotal)
    if (done == knownTotal) {
        return ScanIndicatorModel(phase = ScanIndicatorPhase.DONE, done = done, total = knownTotal)
    }
    return ScanIndicatorModel(phase = ScanIndicatorPhase.MEASURING_TRUE_PEAK, done = done, total = knownTotal)
}

// What:     `private const val COUNT_GROUP_SIZE: Int = 3` names the digits per comma group.
// Why:      Thousands grouping is three digits, and naming it keeps the grouping rule readable.
//
// In TS you'd write (pseudocode):
// ```ts
// const COUNT_GROUP_SIZE = 3;
// ```
/** Number of decimal digits between two grouping commas. */
private const val COUNT_GROUP_SIZE: Int = 3

// What:     `fun scanIndicatorCountText(...)` formats a non-negative count with comma grouping.
// Why:      ASCII digits and fixed commas keep the text identical on every device locale.
//
// In TS you'd write (pseudocode):
// ```ts
// const countText = (value: number): string => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
// ```
/**
 * Formats [value] with a comma between each group of three digits, using ASCII digits only.
 *
 * @param value non-negative count to format
 * @return the grouped decimal text
 */
fun scanIndicatorCountText(value: Int): String {
    /** Decimal digits of the count, least significant first after reversing. */
    val reversedDigits: String = value.toString().reversed()
    return reversedDigits.chunked(COUNT_GROUP_SIZE).joinToString(",").reversed()
}

// What:     `fun scanIndicatorStatusText(...)` returns the single status line the indicator draws.
// Why:      The authored copy lives in one pure function so the composable only places text.
//
// In TS you'd write (pseudocode):
// ```ts
// function scanIndicatorStatusText(model: ScanIndicatorModel): string;
// ```
/**
 * Returns the status line for [model], or an empty string when the indicator is not visible.
 *
 * @param model indicator state to describe
 * @return one line of text in the accepted copy
 */
fun scanIndicatorStatusText(model: ScanIndicatorModel): String {
    if (model.phase == ScanIndicatorPhase.SCANNING_LIBRARY) {
        return "Scanning library"
    }
    if (model.phase == ScanIndicatorPhase.MEASURING_TRUE_PEAK) {
        /** Done count formatted with grouped ASCII digits. */
        val doneText: String = scanIndicatorCountText(model.done)
        /** Total count formatted with grouped ASCII digits. */
        val totalText: String = scanIndicatorCountText(model.total)
        return "Analysing true peak · $doneText of $totalText"
    }
    return ""
}
