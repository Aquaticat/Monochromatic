// ===========================================================================
// File summary (domain, for a TypeScript-only reader)
//
// This file holds the PURE decision rule for "streaming" a long library scan:
// instead of waiting for a whole folder/MediaStore scan to finish and then
// showing every track at once, the scan emits the tracks it has found so far
// in growing, already-sorted batches, so the screen fills in as the scan runs.
//
// The rule itself is tiny and has NOTHING to do with Android, audio, files, or
// coroutines: given the running total of items found and how many were in the
// last emitted batch, decide whether enough NEW items have piled up to be
// worth another repaint, and if so produce a sorted snapshot of everything
// found so far. Keeping that rule here, free of any I/O, is what lets it be
// unit-tested on a plain JVM (see `BatchEmitGateTest`), where the real sources
// (`SafTreeSource`, `MediaStoreSource`) cannot run because they need a device.
//
// Each scan creates its OWN gate (a fresh instance), because two scans can run
// at once (foreground playback and the background peak sweep both call the
// shared `LibrarySource`), and a shared running-total would corrupt across
// them.
// ===========================================================================

// What:     `package dev.monochromatic.musicplayer.core` names the namespace
//           (Kotlin's dotted grouping name, mirroring the folder path) that the
//           types in this file belong to. Other files reach these names by
//           importing `dev.monochromatic.musicplayer.core.BatchEmitGate` or by
//           living in the same package.
// Why:      So the source files in the parent package can import the gate and
//           the batch-size constant by a stable, fully-qualified name.
// Gotcha:   Unlike a TS `import`, this line imports NOTHING and runs no code; it
//           only NAMES this file's namespace and must be the first non-comment
//           line.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword for this. The file path is the namespace:
// //   src/core/BatchEmitGate.ts -> imported as "@app/core/BatchEmitGate"
// ```
package dev.monochromatic.musicplayer.core

// What:     `const val LIBRARY_BATCH_SIZE: Int = 128` declares a TOP-LEVEL
//           compile-time constant. `const` = known at compile time and inlined
//           at every use site; `val` = never reassigned; `: Int` is Kotlin's
//           32-bit signed integer (siblings the reader might expect: `Long`
//           64-bit, `Short` 16-bit). The value is the number of NEWLY found
//           tracks that must accumulate before the scan emits another batch.
// Why:      Both sources share one streaming policy, so the threshold lives in
//           one named place rather than as a bare `128` repeated per source.
//           Around 128 keeps the repaint count low (a few thousand tracks emit
//           a couple dozen times) while still showing the first rows quickly.
// Gotcha:   `const` here is a Kotlin compile-time constant (only primitives and
//           `String` qualify), NOT TS's block-scoped `const`.
//
// In TS you'd write (pseudocode):
// ```ts
// export const LIBRARY_BATCH_SIZE = 128;
// ```
/**
 * Defines library batch size value for this music-player component; the TypeScript-oriented notes above explain
 * its source and use.
 */
const val LIBRARY_BATCH_SIZE: Int = 128

// What:     `class BatchEmitGate<T>( ... ) { ... }` declares a class with ONE
//           type parameter `T` (the `<T>` after the name): the element type of
//           the list it gates, left abstract so the same rule works for tracks,
//           strings, or anything. Its two constructor parameters are both
//           `private val` (read-only fields, hidden outside the class):
//           `threshold` (an `Int`) and `comparator` (a `Comparator<T>`).
// Why:      The streaming sources each create one gate per scan and ask it,
//           after each appended item, "is it time to emit, and if so, what is
//           the sorted snapshot?" Keeping it a normal class with one short
//           method makes the rule testable in isolation.
// Gotcha:   `Comparator<T>` is Kotlin/Java's "compare function" interface: a
//           single method `compare(left, right)` returning a negative/zero/
//           positive `Int`, exactly like a JS `(a, b) => number` sort callback.
//           Kotlin lets you pass a plain lambda where a `Comparator<T>` is
//           expected (SAM conversion), so callers write `{ l, r -> ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// class BatchEmitGate<T> {
//   private lastEmittedCount = 0;
//   constructor(
//     private readonly threshold: number,
//     private readonly comparator: (left: T, right: T) => number,
//   ) {}
//   // nextBatch defined below
// }
// ```
/**
 * Defines batch emit gate type for this music-player component; the TypeScript-oriented notes above explain its
 * role.
 */
class BatchEmitGate<T>(
    // What:     `private val threshold: Int` is the first constructor parameter
    //           AND a read-only private field: how many newly found items must
    //           pile up since the last emit before the next batch fires.
    // Why:      The gate compares the running total against the last emitted
    //           total and this threshold to decide whether to emit.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly threshold: number,
    // ```
    private val threshold: Int,
    // What:     `private val comparator: Comparator<T>` is the second
    //           constructor parameter AND a read-only private field: the compare
    //           function used to sort the snapshot before emitting it.
    // Why:      Each emitted batch must already be sorted (the pagination keeps
    //           each page's rows in arrival order), so the gate sorts the
    //           accumulated items with this comparator on the way out.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly comparator: (left: T, right: T) => number,
    // ```
    private val comparator: Comparator<T>,
) {
    // What:     `private var lastEmittedCount: Int = 0` declares a private,
    //           REASSIGNABLE (`var`, not the read-only `val`) `Int` field
    //           initialised to 0: the running total at the moment of the most
    //           recent emit.
    // Why:      Tracking the last emitted size is what keeps the gate from
    //           firing on EVERY call once the first threshold is crossed; it
    //           only fires again after another `threshold` items arrive.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private lastEmittedCount = 0;
    // ```
    /**
     * Defines last emitted count value for this music-player component; the TypeScript-oriented notes above
     * explain its source and use.
     */
    private var lastEmittedCount: Int = 0

    // What:     `fun nextBatch(accumulated: List<T>): List<T>? { ... }` declares
    //           a method taking the full list found SO FAR (`accumulated`, a
    //           read-only `List<T>`) and returning a NULLABLE `List<T>?` (the
    //           trailing `?` means "a list OR null"). It returns a sorted
    //           snapshot when it is time to emit, or `null` when it is not.
    // Why:      The caller asks this after each appended item; a non-null result
    //           is the batch to hand to the screen, and `null` means "keep
    //           scanning, not enough new items yet".
    // Gotcha:   The method MUTATES `lastEmittedCount` as a side effect when it
    //           decides to emit; calling it is not free of consequence, so the
    //           caller must call it exactly once per appended item.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // nextBatch(accumulated: readonly T[]): readonly T[] | null { ... }
    // ```
    /**
     * Defines next batch behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    fun nextBatch(accumulated: List<T>): List<T>? {
        // What:     `if (accumulated.size - lastEmittedCount < threshold) { return null }`
        //           subtracts the last emitted total from the current total to
        //           get the count of NEW items since the last emit, and returns
        //           `null` early when that is still below the threshold. `.size`
        //           is Kotlin's `.length`.
        // Why:      Most calls fall here: not enough new items have arrived, so
        //           there is nothing to emit yet.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (accumulated.length - this.lastEmittedCount < this.threshold) return null;
        // ```
        if (accumulated.size - lastEmittedCount < threshold) {
            return null
        }
        // What:     `lastEmittedCount = accumulated.size` records the current
        //           total as the new "last emitted" mark, so the next emit needs
        //           another `threshold` items beyond this point.
        // Why:      Without advancing this mark, every later call would re-emit,
        //           repainting on every item past the first threshold.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.lastEmittedCount = accumulated.length;
        // ```
        lastEmittedCount = accumulated.size
        // What:     `return accumulated.sortedWith(comparator)`. `sortedWith`
        //           returns a NEW sorted `List<T>` (it does NOT mutate
        //           `accumulated`) ordered by the gate's `comparator`.
        // Why:      The emitted batch must be sorted-so-far, because pagination
        //           keeps each page's rows in arrival order; an unsorted stream
        //           would scramble rows and then jerk into place at the end.
        // Gotcha:   `sortedWith` is non-mutating (returns a copy), unlike TS's
        //           in-place `Array.prototype.sort`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return [...accumulated].sort(this.comparator);
        // ```
        return accumulated.sortedWith(comparator)
    }
}
