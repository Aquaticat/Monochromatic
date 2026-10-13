// A file that cannot be decoded is reported once, in plain words, and the report must reach the screen even though the
// analysis runs in a service (D113 and D83).

// What:     `package dev.monochromatic.musicplayer` places the hand-off beside the analysis service that fills it.
// Why:      The service and the player host live in one process, so a plain observable list carries the report.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

// What:     `object AnalysisFailures` is the in-process list of files whose analysis just failed for the first time.
// Why:      The player host shows one message for the list and then empties it, so each file is reported once. A report
//           made while no screen is open waits in the list until a screen appears.
//
// In TS you'd write (pseudocode):
// ```ts
// export const AnalysisFailures = { pending: observable<string[]>([]), report(names) {}, take() {} };
// ```
/** Names of files that failed to decode in the analysis and have not been shown to the user yet. */
object AnalysisFailures {
    /** The unreported file names, observed by the player host. */
    var pending: List<String> by mutableStateOf(emptyList())
        private set

    /**
     * Adds files whose analysis failed for the first time.
     *
     * @param fileNames bare file names, without their folders
     */
    fun report(fileNames: List<String>) {
        if (fileNames.isEmpty()) {
            return
        }
        pending = pending + fileNames
    }

    /** Hands the pending names to the caller and empties the list, so they are shown once. */
    fun take(): List<String> {
        /** The names waiting to be shown. */
        val names: List<String> = pending
        pending = emptyList()
        return names
    }
}

// What:     `object MeasureInvalidation` is the in-process list of tracks whose measures the analysis just recomputed.
// Why:      A replaced or edited file keeps its URI, so a row that already shows the old duration and peak must read
//           them again. The player host drops the old measures of these tracks,
//           and the page refresh reads the new ones.
//
// In TS you'd write (pseudocode):
// ```ts
// export const MeasureInvalidation = { pending: observable<string[]>([]), report(uris) {}, take() {} };
// ```
/** URIs of tracks the analysis measured again and whose shown measures are therefore stale. */
object MeasureInvalidation {
    /** The stale URIs, observed by the player host. */
    var pending: Set<String> by mutableStateOf(emptySet())
        private set

    /**
     * Marks tracks whose measures were just recomputed.
     *
     * @param uris track URIs of the pass's fresh tracks
     */
    fun report(uris: Collection<String>) {
        if (uris.isEmpty()) {
            return
        }
        pending = pending + uris
    }

    /** Hands the pending URIs to the caller and empties the set. */
    fun take(): Set<String> {
        /** The URIs waiting to be dropped. */
        val uris: Set<String> = pending
        pending = emptySet()
        return uris
    }
}
