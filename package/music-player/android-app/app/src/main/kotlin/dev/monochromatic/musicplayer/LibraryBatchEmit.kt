// What:     `package dev.monochromatic.musicplayer` declares the namespace this file's
//           declarations belong to.
// Why:      The MediaStore and SAF sources share the same streaming batch helper.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword; the file path is the module.
// ```
package dev.monochromatic.musicplayer

// What:     `import dev.monochromatic.musicplayer.core.BatchEmitGate` brings in the batch gate type.
// Why:      The shared helper receives the source-specific gate instance and asks it for batches.
//
// In TS you'd write (pseudocode):
// ```ts
// import { BatchEmitGate } from "./core/BatchEmitGate";
// ```
import dev.monochromatic.musicplayer.core.BatchEmitGate

// What:     `suspend fun emitLibraryBatchIfReady(...)` declares a coroutine helper.
// Why:      Both library sources append tracks one at a time and need the same
//           gate-controlled streaming behavior.
//
// In TS you'd write (pseudocode):
// ```ts
// async function emitLibraryBatchIfReady(opts: {...}): Promise<void> { ... }
// ```
/**
 * Emits the sorted-so-far [tracks] through [onBatch] only when [gate] says a
 * batch threshold was crossed. Null [onBatch] keeps a scan atomic.
 */
suspend fun emitLibraryBatchIfReady(
    onBatch: (suspend (List<Track>) -> Unit)?,
    gate: BatchEmitGate<Track>,
    tracks: MutableList<Track>,
) {
    if (onBatch != null) {
        /** Batch selected by the gate, or null when the scan has not crossed the next threshold. */
        val batch: List<Track>? = gate.nextBatch(tracks)
        if (batch != null) {
            onBatch(batch)
        }
    }
}
