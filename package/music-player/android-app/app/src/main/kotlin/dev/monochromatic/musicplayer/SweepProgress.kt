// What:     `package dev.monochromatic.musicplayer` places the sweep progress beside the sweep service and the player.
// Why:      The service writes the progress and the player host reads it, and both live in this package.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     `import androidx.compose.runtime.getValue` and `setValue` let the delegated snapshot be read and written.
// Why:      The snapshot is a Compose state, so reading it in composition redraws the scan indicator on change.
//
// In TS you'd write (pseudocode):
// ```ts
// // A delegated property backed by an observable value.
// ```
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue

// What:     `import androidx.compose.runtime.mutableStateOf` creates the observable snapshot.
// Why:      The snapshot must notify composition when the sweep reports a new count.
//
// In TS you'd write (pseudocode):
// ```ts
// import { observable } from "mobx";
// ```
import androidx.compose.runtime.mutableStateOf

// What:     `data class SweepProgressSnapshot(...)` holds the visited and total counts of the sweep as one value.
// Why:      One immutable value keeps the two counts consistent, so the UI never draws a done count from one report
//           beside a total from another.
//
// In TS you'd write (pseudocode):
// ```ts
// type SweepProgressSnapshot = { readonly done: number; readonly total: number };
// ```
/** Visited and total counts of the true-peak sweep, read together as one value. */
data class SweepProgressSnapshot(
    // What:     `val done: Int` is the number of tracks the sweep has visited.
    // Why:      The scan indicator shows this count against the total.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly done: number;
    // ```
    /** Tracks the sweep has visited, never more than the total. */
    val done: Int,
    // What:     `val total: Int` is the number of tracks the sweep will visit.
    // Why:      Zero means the total is not known yet, and the indicator stays hidden until it is known.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly total: number;
    // ```
    /** Tracks the sweep will visit, or zero when the total is not known yet. */
    val total: Int,
)

// What:     `internal val SWEEP_PROGRESS_IDLE: SweepProgressSnapshot` is the snapshot before any sweep reports.
// Why:      Before the first report the total is unknown, so the indicator has nothing to draw.
//
// In TS you'd write (pseudocode):
// ```ts
// const SWEEP_PROGRESS_IDLE: SweepProgressSnapshot = { done: 0, total: 0 };
// ```
/** Snapshot of a sweep that has not reported a total. */
internal val SWEEP_PROGRESS_IDLE: SweepProgressSnapshot = SweepProgressSnapshot(done = 0, total = 0)

// What:     `internal fun sweepProgressMerge(...)` merges one reported count into the current snapshot.
// Why:      The parallel workers report out of order, so a lower done count must never move the bar back; a new total
//           starts a new count; and both counts are clamped so the bar never passes its total.
//
// In TS you'd write (pseudocode):
// ```ts
// function sweepProgressMerge(current, reportedDone, reportedTotal): SweepProgressSnapshot { /* max, clamp */ }
// ```
/**
 * Returns the snapshot after one report, keeping the done count from moving backwards within one total.
 *
 * @param current snapshot before the report
 * @param reportedDone visited count reported by a worker, which may arrive out of order
 * @param reportedTotal total reported with the count, negative values count as zero
 * @return the clamped snapshot with the larger done count when the total is unchanged
 */
internal fun sweepProgressMerge(
    current: SweepProgressSnapshot,
    reportedDone: Int,
    reportedTotal: Int,
): SweepProgressSnapshot {
    /** Total with negative values treated as zero, so an unknown total never reaches the counts. */
    val total: Int = reportedTotal.coerceAtLeast(0)
    /** Reported done count clamped into the total, so overshoot cannot pass the bar. */
    val clampedDone: Int = reportedDone.coerceIn(0, total)
    if (total != current.total) {
        return SweepProgressSnapshot(done = clampedDone, total = total)
    }
    return SweepProgressSnapshot(done = maxOf(clampedDone, current.done), total = total)
}

// What:     `object SweepProgress` is the process-wide holder of the sweep's counts.
// Why:      The sweep runs in the app process and the player host draws it, so one holder carries the counts between
//           them without a binder; the sweep writes it and the UI only reads it.
//
// In TS you'd write (pseudocode):
// ```ts
// const SweepProgress = { snapshot, report(done, total), reset() };
// ```
/**
 * Process-wide sweep progress, written from the sweep service and read by the player host.
 *
 * The sweep reports from its parallel workers, so [report] is synchronized; composition reads [snapshot]
 * and redraws when it changes.
 */
object SweepProgress {
    // What:     `var snapshot: SweepProgressSnapshot by mutableStateOf(SWEEP_PROGRESS_IDLE)` is the observable count.
    // Why:      A Compose state lets the host read the counts in composition and redraw the scan indicator on change.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let snapshot = observable(SWEEP_PROGRESS_IDLE);
    // ```
    /** Current counts, read by the player host and written only through [report] and [reset]. */
    var snapshot: SweepProgressSnapshot by mutableStateOf(SWEEP_PROGRESS_IDLE)
        private set

    // What:     `@Synchronized fun report(done: Int, total: Int)` records one count from the sweep.
    // Why:      The parallel workers call it at the same time, so the read-merge-write runs under one lock.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // report(done: number, total: number): void { this.snapshot = merge(this.snapshot, done, total); }
    // ```
    /**
     * Records the visited and total counts that the sweep reports.
     *
     * @param done tracks visited so far, which the merge clamps into the total
     * @param total tracks the sweep will visit
     */
    @Synchronized
    fun report(done: Int, total: Int) {
        snapshot = sweepProgressMerge(current = snapshot, reportedDone = done, reportedTotal = total)
    }

    // What:     `fun reset()` returns the holder to the idle snapshot.
    // Why:      A sweep that ends early or is stopped must not leave a stale count on screen.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // reset(): void { this.snapshot = SWEEP_PROGRESS_IDLE; }
    // ```
    /** Clears the counts so the scan indicator has no total to draw. */
    fun reset() {
        snapshot = SWEEP_PROGRESS_IDLE
    }
}
