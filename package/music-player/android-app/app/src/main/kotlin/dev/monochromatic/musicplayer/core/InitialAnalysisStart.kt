// When the initial true-peak analysis may start (decisions D84 and D107).

// What:     `package ...core` places the rule beside the other platform-independent decisions.
// Why:      The rule is a pure function of two facts, so JVM tests cover every combination.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer.core

// What:     `fun shouldStartInitialAnalysis(...)` says whether the foreground analysis service starts now.
// Why:      D84 makes the first analysis automatic, so it starts as soon as a music source can be read, whenever
//           that happens: at launch when access is already held, or in the middle of a session right after the
//           person grants access. A launch without access must not start it, because the service would find no
//           library, stop at once, and leave nothing to start it again until the next launch.
//
// In TS you'd write (pseudocode):
// ```ts
// function shouldStartInitialAnalysis(a): boolean { return a.sourceReadable && !a.initialSweepDone; }
// ```
/**
 * Decides whether to start the initial analysis service.
 *
 * @param sourceReadable whether music access is held or a folder grant is held, so the library can be listed
 * @param initialSweepDone whether an earlier run already analysed the whole library
 * @return true only when a library can be read and the first full analysis has not completed
 */
fun shouldStartInitialAnalysis(sourceReadable: Boolean, initialSweepDone: Boolean): Boolean =
    sourceReadable && !initialSweepDone
