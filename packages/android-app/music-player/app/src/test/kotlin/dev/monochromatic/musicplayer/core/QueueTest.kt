// What:     `package dev.monochromatic.musicplayer.core` names the namespace this test file
//           lives under. It is the SAME package as the code under test (`Queue.kt`,
//           `ShuffleMode`), so this file uses `Queue` and `ShuffleMode` by their short names
//           with no import. The package must mirror the directory path.
// Why:      Sharing the package lets the tests reach the `Queue` class, its companion factory,
//           and the `ShuffleMode` enum without importing them; test and main source sets merge
//           into one package at compile time.
// TS map:   No `package` keyword; a file's path IS its module. Equivalent would be
//           `import { Queue, ShuffleMode } from ".../core/Queue"`, made implicit by the
//           same-package rule.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path IS the module; here it shares a namespace with the SUT.
// ```
package dev.monochromatic.musicplayer.core

// What:     `import org.junit.Assert.assertEquals` imports the static `assertEquals` function
//           from JUnit 4's `org.junit.Assert` class, callable unqualified.
// Why:      The value-equality assertions below need it.
// TS map:   `import { assertEquals } from "...";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertEquals } from "@junit/assert";
// ```
import org.junit.Assert.assertEquals

// What:     `import org.junit.Assert.assertFalse` imports the static `assertFalse` function
//           (asserts a `Boolean` is `false`).
// Why:      The page-confinement assertions below (`assertFalse(seen.contains(3))`) need it.
// TS map:   `import { assertFalse } from "...";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertFalse } from "@junit/assert";
// ```
import org.junit.Assert.assertFalse

// What:     `import org.junit.Assert.assertNull` imports the static `assertNull` function, which
//           FAILS unless its argument is `null`.
// Why:      The empty-queue and out-of-range assertions below (`assertNull(q.currentIndex())`,
//           `assertNull(q.playIndex(99))`) need it, because those return nullable `Int?`.
// TS map:   `import { assertNull } from "...";` — equivalently `expect(x).toBeNull()`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertNull } from "@junit/assert";
// ```
import org.junit.Assert.assertNull

// What:     `import org.junit.Assert.assertTrue` imports the static `assertTrue` function
//           (asserts a `Boolean` is `true`).
// Why:      The emptiness and membership assertions below (`assertTrue(q.isEmpty())`,
//           `assertTrue(seen.contains(2))`) need it.
// TS map:   `import { assertTrue } from "...";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertTrue } from "@junit/assert";
// ```
import org.junit.Assert.assertTrue

// What:     `import org.junit.Test` imports the `Test` ANNOTATION class (a type) used as the
//           `@Test` marker on each test method; the runner runs every method tagged with it.
// Why:      Without it we could not write `@Test`, and the runner would find no tests.
// TS map:   No JUnit-style annotation; mentally each `@Test fun foo()` is a
//           `test("foo", () => { ... })`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from "vitest"; // each @Test method becomes a test("...", () => {...})
// ```
import org.junit.Test

// =============================================================================
// File summary (folds in the old class KDoc's domain content)
// =============================================================================
//
// Host-JVM unit tests for `Queue`, ported from the desktop player's `queue_tests.rs` so the
// Kotlin port stays faithful to the Rust behaviour. The cursor/scope tests carry the Rust
// vectors verbatim. The shuffle tests already assert RNG-INDEPENDENT invariants (coverage and
// page confinement) in the oracle, so they port unchanged. Two extra tests pin the
// seeded-shuffle invariants the RNG caveat calls for: a shuffled scope is a PERMUTATION of
// exactly the in-scope tracks, and the SAME seed yields the SAME order (the Kotlin port shuffles
// with a seeded `kotlin.random.Random`, NOT the desktop's xorshift, so only within-Kotlin
// determinism is guaranteed; see `Queue.kt`'s portability note). The cases pin: empty-queue
// behaviour, set-tracks anchoring, within-scope advance looping, repeat-track on natural end
// only, prev with wrap, playIndex selection and page switching, the three shuffle modes' scope
// confinement/coverage, the MediaSession-oriented playbackOrder/cursorPosition/moveCursorTo, and
// common-prefix stripping in displayPaths.

// What:     `class QueueTest { ... }` declares a JUnit 4 test class the runner instantiates to
//           invoke each `@Test`-marked method. It also holds two private HELPER methods
//           (`paths`, `trackPaths`) that build fixture path lists for the tests.
// Why:      Groups every queue test plus the two fixture builders they share.
// TS map:   `describe("Queue", () => { ... })`; the helpers would be plain functions inside it.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("Queue", () => {
//   // ...helpers + each @Test fun become functions / test(...) calls inside here...
// });
// ```
class QueueTest {
    // What:     `private fun paths(n: Int): List<String> = (0 until n).map { it.toString() }`
    //           declares a PRIVATE helper taking one `Int` parameter `n` and returning a
    //           read-only `List<String>`, as an EXPRESSION BODY (`=`, no braces; the single
    //           expression IS the return). Pieces:
    //           - `(0 until n)` builds an `IntRange` from 0 up to but NOT including `n`. `until`
    //             is an INFIX function (called without a dot: `0 until n`). Sibling: `0..n`
    //             (the CLOSED range, which WOULD include `n`); `until` is half-open.
    //           - `.map { it.toString() }` runs a TRAILING LAMBDA over each `Int` in the range;
    //             `it` is the implicit single parameter (one `Int`); `.toString()` is a
    //             type-CONVERSION call turning that `Int` into its decimal `String`. The result
    //             is a `List<String>`.
    // Why:      Build `n` fake root-level paths "0".."n-1" (no folder, so they all share one `#`
    //           letter page), mirroring the Rust `paths` helper, in load order.
    // TS map:   `function paths(n: number): string[] { return Array.from({ length: n }, (_, i) => String(i)); }`
    //           — TS has no range type, so `Array.from({length})` stands in for `0 until n`;
    //           `it.toString()` is `String(i)`.
    // Gotcha:   `0 until n` is HALF-OPEN (excludes `n`), exactly like a TS `for (i = 0; i < n; i++)`;
    //           `0..n` would be the off-by-one CLOSED range.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function paths(n: number): string[] {
    //   return Array.from({ length: n }, (_, i) => String(i));
    // }
    // ```
    private fun paths(n: Int): List<String> = (0 until n).map { it.toString() }

    // What:     `private fun trackPaths(vararg list: String): List<String> = list.toList()`
    //           declares a private helper, expression body. The parameter `vararg list: String`
    //           is a VARIADIC parameter: the caller passes any number of `String` arguments
    //           (`trackPaths("A/1.flac", "A/2.flac")`) and Kotlin collects them into an
    //           `Array<out String>` named `list`. `.toList()` is a type-CONVERSION call copying
    //           that array into a read-only `List<String>` (the return type).
    // Why:      Turn string literals (often with folders like "A/1.flac") into a path list,
    //           mirroring the Rust `track_paths` helper, preserving folders.
    // TS map:   `function trackPaths(...list: string[]): string[] { return [...list]; }` — Kotlin's
    //           `vararg` is TS's rest parameter `...list`; `.toList()` is the spread copy `[...list]`.
    // Gotcha:   `vararg` is Kotlin's rest/spread parameter (collects many args into an array),
    //           NOT a single array argument; the house style normally avoids rest params, but this
    //           is finished, tested code being explained, not rewritten.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function trackPaths(...list: string[]): string[] {
    //   return [...list];
    // }
    // ```
    private fun trackPaths(vararg list: String): List<String> = list.toList()

    // What:     `@Test` is an ANNOTATION (metadata, no code) marking the method below as a test
    //           the JUnit runner executes and reports.
    // Why:      Registers `emptyQueueHasNoCurrentAndAdvanceIsNone` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("empty queue has no current and advance is none", () => {
    // ```
    @Test
    // What:     `fun emptyQueueHasNoCurrentAndAdvanceIsNone() { ... }` declares a no-parameter
    //           test method returning `Unit` (Kotlin's "void"), block body.
    // Why:      Pins that a brand-new (empty) queue reports no current track, returns `null` from
    //           `advance`, and is empty. The empty-queue boundary must not crash or invent a
    //           cursor.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun emptyQueueHasNoCurrentAndAdvanceIsNone() {
        // What:     `val q = Queue.withRngSeed(1)` declares a read-only local `q` and constructs a
        //           `Queue` via its COMPANION factory `withRngSeed`. `Queue.withRngSeed(...)` is a
        //           static-like call on the class (the companion object hosts it). The argument `1`
        //           is an integer LITERAL; the parameter type is `Long`, so Kotlin types this
        //           literal as `Long` (`1L`), not `Int`.
        // Why:      A deterministic, empty queue seeded with a fixed value, so any shuffle is
        //           reproducible.
        // TS map:   `const q = Queue.withRngSeed(1n);` — a static factory; Kotlin omits `new`, and
        //           the `Long` seed maps to a `bigint`.
        // Gotcha:   The bare literal `1` is a `Long` here ONLY because it is a literal in a
        //           `Long`-typed position; a non-literal `Int` variable would need `.toLong()`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(1n);
        // ```
        val q = Queue.withRngSeed(1)
        // What:     `assertNull(q.currentIndex())` asserts the argument is `null`. `q.currentIndex()`
        //           returns `Int?` (the current track's load index, or `null`); on an empty queue
        //           it is `null`.
        // Why:      An empty queue has no current track.
        // TS map:   `expect(q.currentIndex()).toBeNull();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toBeNull();
        // ```
        assertNull(q.currentIndex())
        // What:     `assertNull(q.advance(false))` asserts `null`. `q.advance(false)` (the `false`
        //           means "not a natural end", i.e. a manual Next) returns `Int?`; on an empty
        //           queue it is `null`.
        // Why:      Advancing an empty queue yields nothing to play.
        // TS map:   `expect(q.advance(false)).toBeNull();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toBeNull();
        // ```
        assertNull(q.advance(false))
        // What:     `assertTrue(q.isEmpty())` is the single-arg `assertTrue(condition)`.
        //           `q.isEmpty()` returns `Boolean`, true when the queue has zero tracks.
        // Why:      Confirm the queue really is empty.
        // TS map:   `expect(q.isEmpty()).toBe(true);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.isEmpty()).toBe(true);
        // ```
        assertTrue(q.isEmpty())
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `setTracksStartsAtFirst` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("set tracks starts at first", () => {
    // ```
    @Test
    // What:     `fun setTracksStartsAtFirst() { ... }` declares a no-arg `Unit`-returning test
    //           method, block body.
    // Why:      Pins that loading tracks anchors the cursor on the FIRST track (index 0) and sets
    //           the length. Opening files should start playback at the top.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun setTracksStartsAtFirst() {
        // What:     `val q = Queue.withRngSeed(1)` constructs a seeded empty queue (companion
        //           factory, literal `1` typed as `Long`; see the first such block).
        // Why:      A deterministic queue to load tracks into.
        // TS map:   `const q = Queue.withRngSeed(1n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(1n);
        // ```
        val q = Queue.withRngSeed(1)
        // What:     `q.setTracks(paths(3))` calls the `setTracks` mutator with the helper result
        //           `paths(3)` (a `List<String>` of three fake root paths "0","1","2").
        // Why:      Load three tracks so the cursor and length can be checked.
        // TS map:   `q.setTracks(paths(3));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(paths(3));
        // ```
        q.setTracks(paths(3))
        // What:     `assertEquals(0, q.currentIndex())` is `assertEquals(expected, actual)`:
        //           EXPECTED `Int` `0`; ACTUAL `q.currentIndex()` (`Int?`), here `0`.
        // Why:      After loading, the cursor anchors on the first track (index 0).
        // TS map:   `expect(q.currentIndex()).toEqual(0);` (expected-first in JUnit).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toEqual(0);
        // ```
        assertEquals(0, q.currentIndex())
        // What:     `assertEquals(3, q.len())` is `assertEquals(expected, actual)`: EXPECTED `Int`
        //           `3`; ACTUAL `q.len()`, the track count.
        // Why:      Confirm all three tracks were loaded.
        // TS map:   `expect(q.len()).toEqual(3);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.len()).toEqual(3);
        // ```
        assertEquals(3, q.len())
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `advanceLoopsWithinScopeWhenRepeatTrackOff` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("advance loops within scope when repeat track off", () => {
    // ```
    @Test
    // What:     `fun advanceLoopsWithinScopeWhenRepeatTrackOff() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that, with repeat-track OFF and shuffle OFF, `advance` steps 0 -> 1 -> 2 then
    //           LOOPS back to 0 (and on to 1). The scope always loops; there is no "stop at end".
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun advanceLoopsWithinScopeWhenRepeatTrackOff() {
        // What:     `val q = Queue.withRngSeed(1)` constructs a seeded empty queue.
        // Why:      A deterministic queue to load and advance.
        // TS map:   `const q = Queue.withRngSeed(1n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(1n);
        // ```
        val q = Queue.withRngSeed(1)
        // What:     `q.setTracks(paths(3))` loads three root tracks (indices 0,1,2).
        // Why:      A three-track scope to walk and loop.
        // TS map:   `q.setTracks(paths(3));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(paths(3));
        // ```
        q.setTracks(paths(3))
        // What:     `assertEquals(1, q.advance(false))` is `assertEquals(expected, actual)`:
        //           EXPECTED `Int` `1`; ACTUAL `q.advance(false)` (manual Next), which moves from
        //           track 0 to track 1.
        // Why:      First forward step lands on index 1.
        // TS map:   `expect(q.advance(false)).toEqual(1);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(1);
        // ```
        assertEquals(1, q.advance(false))
        // What:     `assertEquals(2, q.advance(false))` — next manual step moves to index 2.
        // Why:      Second forward step lands on index 2 (the last track).
        // TS map:   `expect(q.advance(false)).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(2);
        // ```
        assertEquals(2, q.advance(false))
        // What:     `assertEquals(0, q.advance(false))` — stepping past the last track WRAPS to
        //           index 0.
        // Why:      The scope loops: advancing off the end returns to the start.
        // TS map:   `expect(q.advance(false)).toEqual(0);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(0);
        // ```
        assertEquals(0, q.advance(false))
        // What:     `assertEquals(1, q.advance(false))` — confirms looping continues normally past
        //           the wrap, back to index 1.
        // Why:      After wrapping, advance keeps stepping forward (0 -> 1).
        // TS map:   `expect(q.advance(false)).toEqual(1);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(1);
        // ```
        assertEquals(1, q.advance(false))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `repeatTrackReplaysOnNaturalEndOnly` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("repeat track replays on natural end only", () => {
    // ```
    @Test
    // What:     `fun repeatTrackReplaysOnNaturalEndOnly() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that with repeat-track ON, a NATURAL end (`advance(true)`) replays the SAME
    //           track, but a MANUAL Next (`advance(false)`) still moves on. Only a natural end
    //           honours repeat-track.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun repeatTrackReplaysOnNaturalEndOnly() {
        // What:     `val q = Queue.withRngSeed(1)` constructs a seeded empty queue.
        // Why:      A deterministic queue for the repeat-track checks.
        // TS map:   `const q = Queue.withRngSeed(1n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(1n);
        // ```
        val q = Queue.withRngSeed(1)
        // What:     `q.setTracks(paths(3))` loads three tracks (cursor starts at 0).
        // Why:      A scope to replay within.
        // TS map:   `q.setTracks(paths(3));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(paths(3));
        // ```
        q.setTracks(paths(3))
        // What:     `q.setRepeatTrack(true)` turns the repeat-track flag ON via the mutator.
        // Why:      Enable the "replay same track on natural end" behaviour under test.
        // TS map:   `q.setRepeatTrack(true);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setRepeatTrack(true);
        // ```
        q.setRepeatTrack(true)
        // What:     `assertEquals(0, q.advance(true))` is `assertEquals(expected, actual)`:
        //           EXPECTED `Int` `0`; ACTUAL `q.advance(true)` (the `true` means a NATURAL end),
        //           which, with repeat-track on, REPLAYS the current track 0 (cursor unchanged).
        // Why:      A natural end under repeat-track replays the same track (stays at 0).
        // TS map:   `expect(q.advance(true)).toEqual(0);`
        // Gotcha:   The `true` argument is what distinguishes a natural end from a manual Next; it
        //           is the only case repeat-track acts on.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(true)).toEqual(0);
        // ```
        assertEquals(0, q.advance(true))
        // What:     `assertEquals(1, q.advance(false))` — a MANUAL Next (`false`) ignores
        //           repeat-track and moves forward to index 1.
        // Why:      Prove a manual Next is NOT replayed even with repeat-track on.
        // TS map:   `expect(q.advance(false)).toEqual(1);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(1);
        // ```
        assertEquals(1, q.advance(false))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `prevStepsBackThenWrapsToLast` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("prev steps back then wraps to last", () => {
    // ```
    @Test
    // What:     `fun prevStepsBackThenWrapsToLast() { ... }` declares a no-arg `Unit`-returning
    //           test method, block body.
    // Why:      Pins that `prev` steps backward and, from the scope's start, WRAPS to the last
    //           track. Previous mirrors Next's looping at the other end.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun prevStepsBackThenWrapsToLast() {
        // What:     `val q = Queue.withRngSeed(1)` constructs a seeded empty queue.
        // Why:      A deterministic queue to walk backward.
        // TS map:   `const q = Queue.withRngSeed(1n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(1n);
        // ```
        val q = Queue.withRngSeed(1)
        // What:     `q.setTracks(paths(3))` loads three tracks (cursor at 0).
        // Why:      A three-track scope to step back through.
        // TS map:   `q.setTracks(paths(3));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(paths(3));
        // ```
        q.setTracks(paths(3))
        // What:     `assertEquals(1, q.advance(false))` moves forward to index 1 first.
        // Why:      Position the cursor at 1 so `prev` has somewhere to step back to.
        // TS map:   `expect(q.advance(false)).toEqual(1);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(1);
        // ```
        assertEquals(1, q.advance(false))
        // What:     `assertEquals(0, q.prev())` is `assertEquals(expected, actual)`: EXPECTED `0`;
        //           ACTUAL `q.prev()` steps backward from 1 to 0.
        // Why:      A normal backward step from 1 lands on 0.
        // TS map:   `expect(q.prev()).toEqual(0);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.prev()).toEqual(0);
        // ```
        assertEquals(0, q.prev())
        // What:     `assertEquals(2, q.prev())` — stepping back from the start (0) WRAPS to the
        //           last track (2).
        // Why:      Previous from the scope's start loops to its end.
        // TS map:   `expect(q.prev()).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.prev()).toEqual(2);
        // ```
        assertEquals(2, q.prev())
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `playIndexSelectsTrack` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("play index selects track", () => {
    // ```
    @Test
    // What:     `fun playIndexSelectsTrack() { ... }` declares a no-arg `Unit`-returning test
    //           method, block body.
    // Why:      Pins that `playIndex` selects a valid track (returns its index and moves the
    //           cursor) and IGNORES an out-of-range click (returns `null`, cursor unchanged).
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun playIndexSelectsTrack() {
        // What:     `val q = Queue.withRngSeed(1)` constructs a seeded empty queue.
        // Why:      A deterministic queue to click into.
        // TS map:   `const q = Queue.withRngSeed(1n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(1n);
        // ```
        val q = Queue.withRngSeed(1)
        // What:     `q.setTracks(paths(5))` loads five tracks (indices 0..4).
        // Why:      Enough tracks to select a middle one and an out-of-range one.
        // TS map:   `q.setTracks(paths(5));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(paths(5));
        // ```
        q.setTracks(paths(5))
        // What:     `assertEquals(3, q.playIndex(3))` is `assertEquals(expected, actual)`: EXPECTED
        //           `3`; ACTUAL `q.playIndex(3)` selects track 3 and returns its index.
        // Why:      A valid click returns the clicked index.
        // TS map:   `expect(q.playIndex(3)).toEqual(3);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.playIndex(3)).toEqual(3);
        // ```
        assertEquals(3, q.playIndex(3))
        // What:     `assertEquals(3, q.currentIndex())` confirms the cursor now points at track 3.
        // Why:      Selecting a track makes it current.
        // TS map:   `expect(q.currentIndex()).toEqual(3);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toEqual(3);
        // ```
        assertEquals(3, q.currentIndex())
        // What:     `assertNull(q.playIndex(99))` asserts `null`. `q.playIndex(99)` is an
        //           out-of-range index (only 0..4 exist), so it returns the `null` variant of
        //           `Int?` and moves nothing.
        // Why:      An out-of-range click is ignored.
        // TS map:   `expect(q.playIndex(99)).toBeNull();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.playIndex(99)).toBeNull();
        // ```
        assertNull(q.playIndex(99))
        // What:     `assertEquals(3, q.currentIndex())` re-confirms the cursor STILL points at 3
        //           after the ignored click.
        // Why:      The out-of-range click did not disturb the current track.
        // TS map:   `expect(q.currentIndex()).toEqual(3);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toEqual(3);
        // ```
        assertEquals(3, q.currentIndex())
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `shuffleAllKeepsCurrentTrackAndCoversAll` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("shuffle all keeps current track and covers all", () => {
    // ```
    @Test
    // What:     `fun shuffleAllKeepsCurrentTrackAndCoversAll() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that switching to `ShuffleMode.ALL` KEEPS the currently-playing track current
    //           and that advancing through the whole queue COVERS every track exactly once. These
    //           are RNG-independent invariants (no exact order asserted).
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun shuffleAllKeepsCurrentTrackAndCoversAll() {
        // What:     `val q = Queue.withRngSeed(12345)` constructs a queue seeded with `12345` (a
        //           `Long` literal). A fixed seed makes the shuffle reproducible.
        // Why:      A deterministic queue whose shuffle is repeatable across runs.
        // TS map:   `const q = Queue.withRngSeed(12345n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(12345n);
        // ```
        val q = Queue.withRngSeed(12345)
        // What:     `q.setTracks(paths(6))` loads six tracks (indices 0..5).
        // Why:      A six-track queue to shuffle and cover.
        // TS map:   `q.setTracks(paths(6));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(paths(6));
        // ```
        q.setTracks(paths(6))
        // What:     `assertEquals(1, q.advance(false))` moves the cursor to index 1.
        // Why:      Step forward before shuffling so the "current" track is not the first.
        // TS map:   `expect(q.advance(false)).toEqual(1);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(1);
        // ```
        assertEquals(1, q.advance(false))
        // What:     `assertEquals(2, q.advance(false))` moves the cursor to index 2.
        // Why:      Now track 2 is current; switching shuffle must keep it current.
        // TS map:   `expect(q.advance(false)).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(2);
        // ```
        assertEquals(2, q.advance(false))
        // What:     `q.setShuffle(ShuffleMode.ALL)` switches the mode to `ShuffleMode.ALL`.
        //           `ShuffleMode.ALL` names one constant of the sibling `ShuffleMode` enum (the
        //           others being `OFF` and `WITHIN_PAGE`).
        // Why:      Enable whole-queue shuffle while keeping the current track current.
        // TS map:   `q.setShuffle(ShuffleMode.ALL);` — a Kotlin enum constant is closest to a TS
        //           string-literal-union member.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setShuffle(ShuffleMode.ALL);
        // ```
        q.setShuffle(ShuffleMode.ALL)
        // What:     `assertEquals(2, q.currentIndex())` confirms track 2 is STILL current after the
        //           shuffle switch.
        // Why:      Switching shuffle must not interrupt the playing track.
        // TS map:   `expect(q.currentIndex()).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toEqual(2);
        // ```
        assertEquals(2, q.currentIndex())
        // What:     `val seen: MutableSet<Int> = mutableSetOf()` declares a read-only binding
        //           `seen` (the `val` locks the BINDING) of explicit type `MutableSet<Int>` — a
        //           set whose contents CAN change (`.add`). Sibling: the read-only `Set<Int>`
        //           (no `.add`). `mutableSetOf()` is the factory that allocates an empty mutable
        //           set.
        // Why:      A scratch set to record which track indices playback visits, so coverage can
        //           be counted.
        // TS map:   `const seen = new Set<number>();`
        // Gotcha:   `val seen` does NOT make the set immutable; `val` only locks the binding, while
        //           the `MutableSet` type still allows `.add`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const seen = new Set<number>();
        // ```
        val seen: MutableSet<Int> = mutableSetOf()
        // What:     `seen.add(2)` inserts the index `2` into the set.
        // Why:      Record the current track (2) before advancing, so coverage includes it.
        // TS map:   `seen.add(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // seen.add(2);
        // ```
        seen.add(2)
        // What:     `repeat(6) { q.advance(false)?.let { seen.add(it) } }`. `repeat(n) { ... }` is
        //           a stdlib higher-order function that runs the trailing lambda `n` times (here
        //           6); the lambda's implicit `it` (the iteration index) is unused. Inside:
        //           `q.advance(false)` returns `Int?`; `?.let { seen.add(it) }` is the SAFE-CALL
        //           (`?.`) + scope function `.let`: when the advance result is non-null, run the
        //           lambda with that value as `it` and add it to `seen`; when null, do nothing.
        // Why:      Advance six times, collecting every visited track index, to verify the shuffle
        //           covers the whole queue.
        // TS map:   `for (let i = 0; i < 6; i++) { const x = q.advance(false); if (x !== null) seen.add(x); }`
        //           — `repeat(6)` is the loop; `?.let { seen.add(it) }` is the null guard plus add.
        // Gotcha:   The INNER `it` (in `.let`) shadows `repeat`'s OUTER `it` (the index); here the
        //           inner `it` is the non-null advance result, the one we add.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (let i = 0; i < 6; i++) {
        //   const x = q.advance(false);
        //   if (x !== null) seen.add(x);
        // }
        // ```
        repeat(6) {
            // What:     `q.advance(false)?.let { seen.add(it) }` is the loop body. `q.advance(false)`
            //           returns `Int?`; `?.` is the SAFE-CALL operator, so the `.let { ... }` runs
            //           ONLY when the advance result is non-null. `.let` is a scope function that
            //           invokes the trailing lambda with that non-null value as `it` (the implicit
            //           single parameter); `seen.add(it)` records it. When advance is null, the whole
            //           expression short-circuits and nothing is added.
            // Why:      Collect each visited track index, skipping a null (which cannot happen on a
            //           non-empty queue, but the safe-call keeps the body total either way).
            // TS map:   `const x = q.advance(false); if (x !== null) seen.add(x);` — `?.let { seen.add(it) }`
            //           is the null-guard plus add; `it` is the non-null value.
            // Gotcha:   This INNER `it` (the `.let` receiver, the non-null advance result) shadows
            //           `repeat`'s OWN implicit `it` (the iteration index).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const x = q.advance(false);
            // if (x !== null) seen.add(x);
            // ```
            q.advance(false)?.let { seen.add(it) }
        }
        // What:     `assertEquals(6, seen.size)` is `assertEquals(expected, actual)`: EXPECTED `Int`
        //           `6`; ACTUAL `seen.size`, the count of DISTINCT indices visited (a set dedupes).
        // Why:      All six tracks were covered exactly once (the set has six members).
        // TS map:   `expect(seen.size).toEqual(6);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(seen.size).toEqual(6);
        // ```
        assertEquals(6, seen.size)
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `turningShuffleOffRestoresLoadOrder` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("turning shuffle off restores load order", () => {
    // ```
    @Test
    // What:     `fun turningShuffleOffRestoresLoadOrder() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that after shuffling ALL and then turning shuffle OFF, the queue returns to
    //           load order (0,1,2,3) anchored at the current track. Turning shuffle off restores
    //           the original sequence.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun turningShuffleOffRestoresLoadOrder() {
        // What:     `val q = Queue.withRngSeed(999)` constructs a queue seeded with `999`.
        // Why:      A deterministic queue to shuffle then un-shuffle.
        // TS map:   `const q = Queue.withRngSeed(999n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(999n);
        // ```
        val q = Queue.withRngSeed(999)
        // What:     `q.setTracks(paths(4))` loads four tracks (indices 0..3).
        // Why:      A four-track queue to reorder and restore.
        // TS map:   `q.setTracks(paths(4));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(paths(4));
        // ```
        q.setTracks(paths(4))
        // What:     `q.setShuffle(ShuffleMode.ALL)` switches to whole-queue shuffle.
        // Why:      Scramble the order first, so turning it off has something to restore.
        // TS map:   `q.setShuffle(ShuffleMode.ALL);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setShuffle(ShuffleMode.ALL);
        // ```
        q.setShuffle(ShuffleMode.ALL)
        // What:     `q.setShuffle(ShuffleMode.OFF)` switches back to no shuffle. `ShuffleMode.OFF`
        //           is the enum constant for sequential, page-confined playback.
        // Why:      Turn shuffle off to restore load order.
        // TS map:   `q.setShuffle(ShuffleMode.OFF);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setShuffle(ShuffleMode.OFF);
        // ```
        q.setShuffle(ShuffleMode.OFF)
        // What:     `assertEquals(0, q.currentIndex())` confirms the cursor is back at index 0.
        // Why:      With these root tracks the current track is the first, so off restores 0.
        // TS map:   `expect(q.currentIndex()).toEqual(0);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toEqual(0);
        // ```
        assertEquals(0, q.currentIndex())
        // What:     `assertEquals(1, q.advance(false))` — load order resumes: 0 -> 1.
        // Why:      After off, advance steps in load order.
        // TS map:   `expect(q.advance(false)).toEqual(1);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(1);
        // ```
        assertEquals(1, q.advance(false))
        // What:     `assertEquals(2, q.advance(false))` — load order continues: 1 -> 2.
        // Why:      Confirm sequential order is fully restored.
        // TS map:   `expect(q.advance(false)).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(2);
        // ```
        assertEquals(2, q.advance(false))
        // What:     `assertEquals(3, q.advance(false))` — load order continues: 2 -> 3.
        // Why:      The full load-order sequence (0,1,2,3) is back.
        // TS map:   `expect(q.advance(false)).toEqual(3);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(3);
        // ```
        assertEquals(3, q.advance(false))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `shuffleOffConfinesToTopFolderPage` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("shuffle off confines to top folder page", () => {
    // ```
    @Test
    // What:     `fun shuffleOffConfinesToTopFolderPage() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that with shuffle OFF, playback is CONFINED to the current track's top-folder
    //           page (`A`), looping within it (0 -> 1 -> 0 -> 1) and never reaching the `B` page
    //           (index 2). Off keeps the user inside the current page.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun shuffleOffConfinesToTopFolderPage() {
        // What:     `val q = Queue.withRngSeed(1)` constructs a seeded empty queue.
        // Why:      A deterministic queue for the page-confinement check.
        // TS map:   `const q = Queue.withRngSeed(1n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(1n);
        // ```
        val q = Queue.withRngSeed(1)
        // What:     `q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"))` loads three
        //           folder tracks via the `trackPaths` vararg helper: two on page `A` (indices
        //           0,1) and one on page `B` (index 2).
        // Why:      Two pages so confinement to page `A` can be observed.
        // TS map:   `q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"));
        // ```
        q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"))
        // What:     `assertEquals(0, q.currentIndex())` confirms the cursor starts at index 0
        //           (first track, on page `A`).
        // Why:      Playback begins on page `A`.
        // TS map:   `expect(q.currentIndex()).toEqual(0);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toEqual(0);
        // ```
        assertEquals(0, q.currentIndex())
        // What:     `assertEquals(1, q.advance(false))` — advance within page `A`: 0 -> 1.
        // Why:      The second `A` track follows the first.
        // TS map:   `expect(q.advance(false)).toEqual(1);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(1);
        // ```
        assertEquals(1, q.advance(false))
        // What:     `assertEquals(0, q.advance(false))` — past the last `A` track, playback LOOPS
        //           back to index 0 (NOT on to index 2 / page `B`).
        // Why:      Page confinement: the `A` page loops to its own start, never crossing to `B`.
        // TS map:   `expect(q.advance(false)).toEqual(0);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(0);
        // ```
        assertEquals(0, q.advance(false))
        // What:     `assertEquals(1, q.advance(false))` — confirms the loop continues within page
        //           `A`: 0 -> 1 again.
        // Why:      Playback stays inside page `A` indefinitely.
        // TS map:   `expect(q.advance(false)).toEqual(1);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(1);
        // ```
        assertEquals(1, q.advance(false))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `shuffleWithinPageCoversOnlyCurrentPage` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("shuffle within page covers only current page", () => {
    // ```
    @Test
    // What:     `fun shuffleWithinPageCoversOnlyCurrentPage() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that `ShuffleMode.WITHIN_PAGE` shuffles ONLY the current page's tracks and
    //           never reaches another page (index 3 on page `B` is never seen). Coverage equals
    //           the page size, RNG-independently.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun shuffleWithinPageCoversOnlyCurrentPage() {
        // What:     `val q = Queue.withRngSeed(777)` constructs a queue seeded with `777`.
        // Why:      A deterministic within-page shuffle.
        // TS map:   `const q = Queue.withRngSeed(777n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(777n);
        // ```
        val q = Queue.withRngSeed(777)
        // What:     `q.setTracks(trackPaths("A/1.flac", "A/2.flac", "A/3.flac", "B/4.flac"))` loads
        //           three `A`-page tracks (indices 0,1,2) and one `B`-page track (index 3).
        // Why:      A three-track page `A` plus an off-page track to prove confinement.
        // TS map:   `q.setTracks(trackPaths("A/1.flac", "A/2.flac", "A/3.flac", "B/4.flac"));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(trackPaths("A/1.flac", "A/2.flac", "A/3.flac", "B/4.flac"));
        // ```
        q.setTracks(trackPaths("A/1.flac", "A/2.flac", "A/3.flac", "B/4.flac"))
        // What:     `q.setShuffle(ShuffleMode.WITHIN_PAGE)` switches to per-page shuffle.
        //           `ShuffleMode.WITHIN_PAGE` is the enum constant that shuffles within the page
        //           while staying page-confined.
        // Why:      Enable the within-page shuffle under test.
        // TS map:   `q.setShuffle(ShuffleMode.WITHIN_PAGE);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setShuffle(ShuffleMode.WITHIN_PAGE);
        // ```
        q.setShuffle(ShuffleMode.WITHIN_PAGE)
        // What:     `assertEquals(0, q.currentIndex())` confirms the cursor anchors at index 0 on
        //           page `A`.
        // Why:      Playback starts on page `A`.
        // TS map:   `expect(q.currentIndex()).toEqual(0);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toEqual(0);
        // ```
        assertEquals(0, q.currentIndex())
        // What:     `val seen: MutableSet<Int> = mutableSetOf()` declares a mutable `Int` set
        //           (`val` binding, `MutableSet` contents; `mutableSetOf()` allocates it empty;
        //           sibling read-only `Set`).
        // Why:      Collect the distinct indices visited to verify page-only coverage.
        // TS map:   `const seen = new Set<number>();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const seen = new Set<number>();
        // ```
        val seen: MutableSet<Int> = mutableSetOf()
        // What:     `seen.add(q.currentIndex()!!)`. `q.currentIndex()` returns `Int?`; the `!!`
        //           NON-NULL ASSERTION operator unwraps it to a plain `Int`, THROWING a
        //           `NullPointerException` if it were null. The unwrapped index is added to `seen`.
        // Why:      Record the starting track. `!!` is safe here because the queue is non-empty, so
        //           `currentIndex()` cannot be null.
        // TS map:   `seen.add(q.currentIndex()!);` — Kotlin's `!!` is TS's non-null assertion `!`.
        // Gotcha:   `!!` THROWS at runtime on null (a real NPE), unlike TS's `!`, which is a
        //           compile-time-only assertion erased at runtime.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // seen.add(q.currentIndex()!);
        // ```
        seen.add(q.currentIndex()!!)
        // What:     `repeat(3) { seen.add(q.advance(false)!!) }` runs the lambda 3 times.
        //           `q.advance(false)` returns `Int?`; `!!` unwraps it to `Int` (throwing on null),
        //           and the result is added to `seen`. `repeat`'s implicit index `it` is unused.
        // Why:      Advance three more times (page `A` has three tracks), collecting every visited
        //           index. `!!` is safe because a non-empty scope always yields a next track.
        // TS map:   `for (let i = 0; i < 3; i++) { seen.add(q.advance(false)!); }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (let i = 0; i < 3; i++) {
        //   seen.add(q.advance(false)!);
        // }
        // ```
        repeat(3) {
            // What:     `seen.add(q.advance(false)!!)` is the loop body. `q.advance(false)` returns
            //           `Int?`; `!!` is the NON-NULL ASSERTION operator, unwrapping it to a plain
            //           `Int` and THROWING a `NullPointerException` if it were null. `seen.add(...)`
            //           records the unwrapped index.
            // Why:      Collect each visited track index. `!!` is safe here because a non-empty scope
            //           always yields a next track, so advance is never null.
            // TS map:   `seen.add(q.advance(false)!);` — Kotlin's `!!` is TS's non-null assertion `!`.
            // Gotcha:   `!!` THROWS at runtime on null (a real NPE), unlike TS's `!`, which is a
            //           compile-time-only assertion erased at runtime.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // seen.add(q.advance(false)!);
            // ```
            seen.add(q.advance(false)!!)
        }
        // What:     `assertFalse(seen.contains(3))` is the single-arg `assertFalse(condition)`.
        //           `seen.contains(3)` asks whether index 3 (the off-page `B` track) was visited.
        // Why:      Confirm the within-page shuffle NEVER crossed to page `B` (index 3 unseen).
        // TS map:   `expect(seen.has(3)).toBe(false);` — Kotlin's `.contains` is TS's `.has`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(seen.has(3)).toBe(false);
        // ```
        assertFalse(seen.contains(3))
        // What:     `assertEquals(3, seen.size)` is `assertEquals(expected, actual)`: EXPECTED `3`;
        //           ACTUAL `seen.size` (distinct indices visited).
        // Why:      Exactly the three page-`A` tracks were covered (no more, no fewer).
        // TS map:   `expect(seen.size).toEqual(3);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(seen.size).toEqual(3);
        // ```
        assertEquals(3, seen.size)
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `shuffleAllCrossesPages` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("shuffle all crosses pages", () => {
    // ```
    @Test
    // What:     `fun shuffleAllCrossesPages() { ... }` declares a no-arg `Unit`-returning test
    //           method, block body.
    // Why:      Pins that `ShuffleMode.ALL` scopes playback to the WHOLE queue, so it DOES reach a
    //           track on another page (index 2 on page `B`), unlike `WITHIN_PAGE`. Coverage spans
    //           all pages.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun shuffleAllCrossesPages() {
        // What:     `val q = Queue.withRngSeed(55)` constructs a queue seeded with `55`.
        // Why:      A deterministic whole-queue shuffle.
        // TS map:   `const q = Queue.withRngSeed(55n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(55n);
        // ```
        val q = Queue.withRngSeed(55)
        // What:     `q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"))` loads two
        //           `A`-page tracks (0,1) and one `B`-page track (2).
        // Why:      Two pages so crossing can be observed.
        // TS map:   `q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"));
        // ```
        q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"))
        // What:     `q.setShuffle(ShuffleMode.ALL)` switches to whole-queue shuffle.
        // Why:      Enable cross-page coverage.
        // TS map:   `q.setShuffle(ShuffleMode.ALL);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setShuffle(ShuffleMode.ALL);
        // ```
        q.setShuffle(ShuffleMode.ALL)
        // What:     `val seen: MutableSet<Int> = mutableSetOf()` declares a mutable `Int` set
        //           (see the earlier such block).
        // Why:      Collect visited indices to verify the `B` page is reached.
        // TS map:   `const seen = new Set<number>();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const seen = new Set<number>();
        // ```
        val seen: MutableSet<Int> = mutableSetOf()
        // What:     `seen.add(q.currentIndex()!!)` records the starting track. `!!` unwraps the
        //           `Int?` from `currentIndex()` to `Int` (throwing on null; safe, queue is
        //           non-empty).
        // Why:      Seed the coverage set with the current track.
        // TS map:   `seen.add(q.currentIndex()!);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // seen.add(q.currentIndex()!);
        // ```
        seen.add(q.currentIndex()!!)
        // What:     `repeat(3) { seen.add(q.advance(false)!!) }` advances three times, unwrapping
        //           each `Int?` with `!!` and collecting it.
        // Why:      Walk the whole three-track queue, recording every visited index.
        // TS map:   `for (let i = 0; i < 3; i++) { seen.add(q.advance(false)!); }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (let i = 0; i < 3; i++) {
        //   seen.add(q.advance(false)!);
        // }
        // ```
        repeat(3) {
            // What:     `seen.add(q.advance(false)!!)` is the loop body. `q.advance(false)` returns
            //           `Int?`; `!!` is the NON-NULL ASSERTION operator, unwrapping it to a plain
            //           `Int` and THROWING a `NullPointerException` if it were null. `seen.add(...)`
            //           records the unwrapped index.
            // Why:      Collect each visited track index. `!!` is safe here because a non-empty scope
            //           always yields a next track, so advance is never null.
            // TS map:   `seen.add(q.advance(false)!);` — Kotlin's `!!` is TS's non-null assertion `!`.
            // Gotcha:   `!!` THROWS at runtime on null (a real NPE), unlike TS's `!`, which is a
            //           compile-time-only assertion erased at runtime.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // seen.add(q.advance(false)!);
            // ```
            seen.add(q.advance(false)!!)
        }
        // What:     `assertEquals(3, seen.size)` — EXPECTED `3`, ACTUAL the distinct-index count.
        // Why:      All three tracks across both pages were covered.
        // TS map:   `expect(seen.size).toEqual(3);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(seen.size).toEqual(3);
        // ```
        assertEquals(3, seen.size)
        // What:     `assertTrue(seen.contains(2))` is the single-arg `assertTrue(condition)`.
        //           `seen.contains(2)` asks whether index 2 (the page-`B` track) was visited.
        // Why:      Confirm whole-queue shuffle DID cross to page `B` (index 2 seen), the key
        //           difference from `WITHIN_PAGE`.
        // TS map:   `expect(seen.has(2)).toBe(true);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(seen.has(2)).toBe(true);
        // ```
        assertTrue(seen.contains(2))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `playIndexSwitchesPageScope` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("play index switches page scope", () => {
    // ```
    @Test
    // What:     `fun playIndexSwitchesPageScope() { ... }` declares a no-arg `Unit`-returning test
    //           method, block body.
    // Why:      Pins that clicking a track on ANOTHER page (`playIndex(2)`, page `B`) switches the
    //           playback scope to that page, after which advancing loops within `B` (index 2
    //           repeats). Selecting an off-page track moves the scope.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun playIndexSwitchesPageScope() {
        // What:     `val q = Queue.withRngSeed(1)` constructs a seeded empty queue.
        // Why:      A deterministic queue for the page-switch check.
        // TS map:   `const q = Queue.withRngSeed(1n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(1n);
        // ```
        val q = Queue.withRngSeed(1)
        // What:     `q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"))` loads two
        //           `A`-page tracks (0,1) and one `B`-page track (2).
        // Why:      Two pages so a click can switch scope from `A` to `B`.
        // TS map:   `q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"));
        // ```
        q.setTracks(trackPaths("A/1.flac", "A/2.flac", "B/3.flac"))
        // What:     `assertEquals(2, q.playIndex(2))` — EXPECTED `2`; `q.playIndex(2)` selects the
        //           page-`B` track (index 2) and returns it.
        // Why:      Clicking the `B` track selects it and switches scope to page `B`.
        // TS map:   `expect(q.playIndex(2)).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.playIndex(2)).toEqual(2);
        // ```
        assertEquals(2, q.playIndex(2))
        // What:     `assertEquals(2, q.currentIndex())` confirms track 2 is now current.
        // Why:      The selected `B` track becomes current.
        // TS map:   `expect(q.currentIndex()).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toEqual(2);
        // ```
        assertEquals(2, q.currentIndex())
        // What:     `assertEquals(2, q.advance(false))` — page `B` has only the one track, so
        //           advancing LOOPS back to index 2.
        // Why:      The single-track `B` page loops onto itself.
        // TS map:   `expect(q.advance(false)).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(2);
        // ```
        assertEquals(2, q.advance(false))
        // What:     `assertEquals(2, q.advance(false))` — confirms it keeps looping on index 2.
        // Why:      Scope is confined to page `B`, which loops on its single track.
        // TS map:   `expect(q.advance(false)).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toEqual(2);
        // ```
        assertEquals(2, q.advance(false))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `playbackOrderAndCursorTrackTheTimelineWindow` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("playback order and cursor track the timeline window", () => {
    // ```
    @Test
    // What:     `fun playbackOrderAndCursorTrackTheTimelineWindow() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins the MediaSession-oriented accessors: `playbackOrder()` reports the scope's
    //           index sequence, `cursorPosition()` is the position WITHIN that sequence, and
    //           `playbackOrder()[cursorPosition()] == currentIndex()` ties them together.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun playbackOrderAndCursorTrackTheTimelineWindow() {
        // What:     `val q = Queue.withRngSeed(1)` constructs a seeded empty queue.
        // Why:      A deterministic queue for the timeline-window checks.
        // TS map:   `const q = Queue.withRngSeed(1n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(1n);
        // ```
        val q = Queue.withRngSeed(1)
        // What:     `q.setTracks(paths(4))` loads four root tracks (indices 0..3).
        // Why:      A four-track timeline to inspect.
        // TS map:   `q.setTracks(paths(4));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(paths(4));
        // ```
        q.setTracks(paths(4))
        // What:     `assertEquals(listOf(0, 1, 2, 3), q.playbackOrder())` is
        //           `assertEquals(expected, actual)`: EXPECTED `listOf(0, 1, 2, 3)` (an immutable
        //           `List<Int>` factory); ACTUAL `q.playbackOrder()` (the scope's load-order
        //           sequence, here sequential because shuffle is off).
        // Why:      With shuffle off, the playback order is load order 0,1,2,3.
        // TS map:   `expect(q.playbackOrder()).toEqual([0, 1, 2, 3]);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.playbackOrder()).toEqual([0, 1, 2, 3]);
        // ```
        assertEquals(listOf(0, 1, 2, 3), q.playbackOrder())
        // What:     `assertEquals(0, q.cursorPosition())` — EXPECTED `0`; `q.cursorPosition()`
        //           (`Int?`) is the position within `playbackOrder`, here 0.
        // Why:      The cursor starts at the first timeline slot.
        // TS map:   `expect(q.cursorPosition()).toEqual(0);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.cursorPosition()).toEqual(0);
        // ```
        assertEquals(0, q.cursorPosition())
        // What:     `q.advance(false)` advances one step. Its return value is IGNORED here (the
        //           call is used only for its side effect of moving the cursor).
        // Why:      Move the cursor to position 1 so the next assertions can observe it.
        // TS map:   `q.advance(false);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.advance(false);
        // ```
        q.advance(false)
        // What:     `assertEquals(1, q.cursorPosition())` — confirms the cursor position is now 1.
        // Why:      Advancing moved the timeline window index to 1.
        // TS map:   `expect(q.cursorPosition()).toEqual(1);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.cursorPosition()).toEqual(1);
        // ```
        assertEquals(1, q.cursorPosition())
        // What:     `assertEquals(q.playbackOrder()[q.cursorPosition()!!], q.currentIndex())` is
        //           `assertEquals(expected, actual)`.
        //           - EXPECTED `q.playbackOrder()[q.cursorPosition()!!]` indexes the playback-order
        //             list at the cursor position. `q.cursorPosition()` is `Int?`; `!!` unwraps it
        //             to a plain `Int` (throwing on null; safe, queue non-empty) so it can be used
        //             as a list index.
        //           - ACTUAL `q.currentIndex()` is the current track's load index.
        // Why:      Tie the two accessors together: the track at the cursor's position in the
        //           playback order IS the current track, which is exactly the invariant a
        //           MediaSession timeline relies on.
        // TS map:   `expect(q.currentIndex()).toEqual(q.playbackOrder()[q.cursorPosition()!]);`
        // Gotcha:   `!!` unwraps the nullable cursor so it can index the list; it throws if the
        //           cursor were null (it is not, here).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toEqual(q.playbackOrder()[q.cursorPosition()!]);
        // ```
        assertEquals(q.playbackOrder()[q.cursorPosition()!!], q.currentIndex())
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `emptyQueueHasNoCursor` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("empty queue has no cursor", () => {
    // ```
    @Test
    // What:     `fun emptyQueueHasNoCursor() { ... }` declares a no-arg `Unit`-returning test
    //           method, block body.
    // Why:      Pins that an empty queue reports an empty playback order and a `null` cursor
    //           position, the MediaSession-facing empty state.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun emptyQueueHasNoCursor() {
        // What:     `val q = Queue.withRngSeed(1)` constructs a seeded empty queue (never loaded).
        // Why:      An empty queue to inspect.
        // TS map:   `const q = Queue.withRngSeed(1n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(1n);
        // ```
        val q = Queue.withRngSeed(1)
        // What:     `assertTrue(q.playbackOrder().isEmpty())` is the single-arg
        //           `assertTrue(condition)`. `q.playbackOrder()` returns `List<Int>`; `.isEmpty()`
        //           is true when it has zero elements.
        // Why:      An empty queue has no playback order.
        // TS map:   `expect(q.playbackOrder().length === 0).toBe(true);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.playbackOrder().length === 0).toBe(true);
        // ```
        assertTrue(q.playbackOrder().isEmpty())
        // What:     `assertNull(q.cursorPosition())` asserts `null`. `q.cursorPosition()` returns
        //           `Int?`, which is `null` for an empty queue.
        // Why:      An empty queue has no cursor position.
        // TS map:   `expect(q.cursorPosition()).toBeNull();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.cursorPosition()).toBeNull();
        // ```
        assertNull(q.cursorPosition())
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `moveCursorToJumpsToScopePositionAndRejectsOutOfRange` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("move cursor to jumps to scope position and rejects out of range", () => {
    // ```
    @Test
    // What:     `fun moveCursorToJumpsToScopePositionAndRejectsOutOfRange() { ... }` declares a
    //           no-arg `Unit`-returning test method, block body.
    // Why:      Pins that `moveCursorTo` jumps the cursor to a valid scope position (returning the
    //           track index) and REJECTS out-of-range targets (returns `null`, cursor unchanged),
    //           matching the framework's `C.INDEX_UNSET` no-op.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun moveCursorToJumpsToScopePositionAndRejectsOutOfRange() {
        // What:     `val q = Queue.withRngSeed(1)` constructs a seeded empty queue.
        // Why:      A deterministic queue for the cursor-jump check.
        // TS map:   `const q = Queue.withRngSeed(1n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(1n);
        // ```
        val q = Queue.withRngSeed(1)
        // What:     `q.setTracks(paths(4))` loads four root tracks (indices 0..3).
        // Why:      A four-slot scope to jump within.
        // TS map:   `q.setTracks(paths(4));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(paths(4));
        // ```
        q.setTracks(paths(4))
        // What:     `assertEquals(2, q.moveCursorTo(2))` — EXPECTED `2`; `q.moveCursorTo(2)` jumps
        //           the cursor to scope position 2 and returns the track index there (2, since
        //           order is sequential).
        // Why:      A valid jump returns the resulting track index.
        // TS map:   `expect(q.moveCursorTo(2)).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.moveCursorTo(2)).toEqual(2);
        // ```
        assertEquals(2, q.moveCursorTo(2))
        // What:     `assertEquals(2, q.currentIndex())` confirms the current track is now 2.
        // Why:      The jump made track 2 current.
        // TS map:   `expect(q.currentIndex()).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toEqual(2);
        // ```
        assertEquals(2, q.currentIndex())
        // What:     `assertEquals(2, q.cursorPosition())` confirms the cursor POSITION is 2.
        // Why:      Position and index coincide here because the order is sequential.
        // TS map:   `expect(q.cursorPosition()).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.cursorPosition()).toEqual(2);
        // ```
        assertEquals(2, q.cursorPosition())
        // What:     `assertNull(q.moveCursorTo(4))` asserts `null`. Scope positions are 0..3, so
        //           `4` is out of range; `moveCursorTo` returns the `null` variant of `Int?`.
        // Why:      An out-of-range target past the end moves nothing.
        // TS map:   `expect(q.moveCursorTo(4)).toBeNull();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.moveCursorTo(4)).toBeNull();
        // ```
        assertNull(q.moveCursorTo(4))
        // What:     `assertNull(q.moveCursorTo(-1))` asserts `null`. A NEGATIVE target is also out
        //           of range, so the result is `null`.
        // Why:      An out-of-range target below 0 moves nothing.
        // TS map:   `expect(q.moveCursorTo(-1)).toBeNull();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.moveCursorTo(-1)).toBeNull();
        // ```
        assertNull(q.moveCursorTo(-1))
        // What:     `assertEquals(2, q.cursorPosition())` re-confirms the cursor STILL sits at 2
        //           after both rejected jumps.
        // Why:      The out-of-range jumps did not disturb the cursor.
        // TS map:   `expect(q.cursorPosition()).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.cursorPosition()).toEqual(2);
        // ```
        assertEquals(2, q.cursorPosition())
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `moveCursorToFollowsScopeOrderUnderShuffle` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("move cursor to follows scope order under shuffle", () => {
    // ```
    @Test
    // What:     `fun moveCursorToFollowsScopeOrderUnderShuffle() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that under shuffle, `moveCursorTo(i)` resolves to the track at SCOPE position
    //           `i` in the SHUFFLED order (not load order), so it returns `playbackOrder()[i]`.
    //           The cursor follows the framework-reported (shuffled) timeline.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun moveCursorToFollowsScopeOrderUnderShuffle() {
        // What:     `val q = Queue.withRngSeed(31)` constructs a queue seeded with `31`.
        // Why:      A deterministic shuffle to resolve positions against.
        // TS map:   `const q = Queue.withRngSeed(31n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(31n);
        // ```
        val q = Queue.withRngSeed(31)
        // What:     `q.setTracks(paths(6))` loads six root tracks (indices 0..5).
        // Why:      A six-track scope to shuffle and index into.
        // TS map:   `q.setTracks(paths(6));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(paths(6));
        // ```
        q.setTracks(paths(6))
        // What:     `q.setShuffle(ShuffleMode.ALL)` switches to whole-queue shuffle.
        // Why:      Produce a shuffled playback order whose positions differ from load order.
        // TS map:   `q.setShuffle(ShuffleMode.ALL);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setShuffle(ShuffleMode.ALL);
        // ```
        q.setShuffle(ShuffleMode.ALL)
        // What:     `val order: List<Int> = q.playbackOrder()` declares a read-only local `order`
        //           of explicit type `List<Int>`, holding the current shuffled playback order.
        // Why:      Capture the shuffled order so the assertion can reference position 3 directly
        //           rather than guessing the RNG output.
        // TS map:   `const order: number[] = q.playbackOrder();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const order: number[] = q.playbackOrder();
        // ```
        val order: List<Int> = q.playbackOrder()
        // What:     `assertEquals(order[3], q.moveCursorTo(3))` is `assertEquals(expected, actual)`.
        //           EXPECTED `order[3]` indexes the captured shuffled order at position 3; ACTUAL
        //           `q.moveCursorTo(3)` jumps to scope position 3 and returns the track index
        //           there.
        // Why:      Prove `moveCursorTo(3)` follows the SHUFFLED order, returning `order[3]`, not
        //           the load-order index 3.
        // TS map:   `expect(q.moveCursorTo(3)).toEqual(order[3]);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.moveCursorTo(3)).toEqual(order[3]);
        // ```
        assertEquals(order[3], q.moveCursorTo(3))
        // What:     `assertEquals(order[3], q.currentIndex())` confirms the current track is now
        //           `order[3]` (the shuffled-position-3 track).
        // Why:      The jump made the shuffled-order track current.
        // TS map:   `expect(q.currentIndex()).toEqual(order[3]);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toEqual(order[3]);
        // ```
        assertEquals(order[3], q.currentIndex())
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `displayPathsStripsCommonPrefix` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("display paths strips common prefix", () => {
    // ```
    @Test
    // What:     `fun displayPathsStripsCommonPrefix() { ... }` declares a no-arg `Unit`-returning
    //           test method, block body.
    // Why:      Pins that `displayPaths` strips the queue's common root prefix (`/music/`), so the
    //           UI shows each track relative to that shared root.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertion below... *\/ }
    // ```
    fun displayPathsStripsCommonPrefix() {
        // What:     `val q = Queue.withRngSeed(1)` constructs a seeded empty queue.
        // Why:      A deterministic queue to load full paths into.
        // TS map:   `const q = Queue.withRngSeed(1n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(1n);
        // ```
        val q = Queue.withRngSeed(1)
        // What:     `q.setTracks(listOf("/music/A/Alb/01.flac", "/music/B/Alb/01.flac"))` loads two
        //           absolute paths sharing the `/music/` prefix, via the `listOf` immutable-list
        //           factory.
        // Why:      Two paths with a common prefix so the stripping can be observed.
        // TS map:   `q.setTracks(["/music/A/Alb/01.flac", "/music/B/Alb/01.flac"]);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(["/music/A/Alb/01.flac", "/music/B/Alb/01.flac"]);
        // ```
        q.setTracks(listOf("/music/A/Alb/01.flac", "/music/B/Alb/01.flac"))
        // What:     `assertEquals(listOf("A/Alb/01.flac", "B/Alb/01.flac"), q.displayPaths())` is
        //           `assertEquals(expected, actual)` spanning multiple lines. EXPECTED is an
        //           immutable `List<String>` of the relative paths (prefix stripped); ACTUAL is
        //           `q.displayPaths()`.
        // Why:      Confirm the shared `/music/` root is removed, leaving `A/Alb/01.flac` and
        //           `B/Alb/01.flac`.
        // TS map:   `expect(q.displayPaths()).toEqual(["A/Alb/01.flac", "B/Alb/01.flac"]);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.displayPaths()).toEqual(["A/Alb/01.flac", "B/Alb/01.flac"]);
        // ```
        assertEquals(
            listOf("A/Alb/01.flac", "B/Alb/01.flac"),
            q.displayPaths(),
        )
    }

    //region Seeded-shuffle invariants (replace the Rust RNG's exact-order coverage with
    // RNG-independent checks per the port's RNG caveat)
    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only). It sits
    //           inside the `//region` ... `//endregion` fold above/below, which groups the two
    //           seeded-shuffle invariant tests; the region markers are structural comments and are
    //           preserved verbatim.
    // Why:      Registers `shuffleAllScopeIsPermutationOfWholeQueue` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("shuffle all scope is permutation of whole queue", () => {
    // ```
    @Test
    // What:     `fun shuffleAllScopeIsPermutationOfWholeQueue() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that an ALL-shuffled scope is a PERMUTATION of exactly the in-scope tracks:
    //           every index 0..7 appears exactly once, no more, no fewer. This replaces the Rust
    //           RNG's exact-order check with an RNG-independent set-equality check.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertion below... *\/ }
    // ```
    fun shuffleAllScopeIsPermutationOfWholeQueue() {
        // What:     `val q = Queue.withRngSeed(2024)` constructs a queue seeded with `2024`.
        // Why:      A deterministic whole-queue shuffle to check for permutation completeness.
        // TS map:   `const q = Queue.withRngSeed(2024n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(2024n);
        // ```
        val q = Queue.withRngSeed(2024)
        // What:     `q.setTracks(paths(8))` loads eight root tracks (indices 0..7).
        // Why:      An eight-track queue whose shuffle should be a full permutation.
        // TS map:   `q.setTracks(paths(8));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(paths(8));
        // ```
        q.setTracks(paths(8))
        // What:     `q.setShuffle(ShuffleMode.ALL)` switches to whole-queue shuffle.
        // Why:      Produce the shuffled scope to verify.
        // TS map:   `q.setShuffle(ShuffleMode.ALL);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setShuffle(ShuffleMode.ALL);
        // ```
        q.setShuffle(ShuffleMode.ALL)
        // What:     `val seen: MutableSet<Int> = mutableSetOf()` declares a mutable `Int` set (see
        //           the earlier such block).
        // Why:      Collect every visited index to compare against the full expected set.
        // TS map:   `const seen = new Set<number>();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const seen = new Set<number>();
        // ```
        val seen: MutableSet<Int> = mutableSetOf()
        // What:     `seen.add(q.currentIndex()!!)` records the starting track; `!!` unwraps the
        //           `Int?` to `Int` (throwing on null; safe, queue non-empty).
        // Why:      Seed coverage with the current track.
        // TS map:   `seen.add(q.currentIndex()!);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // seen.add(q.currentIndex()!);
        // ```
        seen.add(q.currentIndex()!!)
        // What:     `repeat(8) { seen.add(q.advance(false)!!) }` advances eight times, unwrapping
        //           each `Int?` with `!!` and collecting it.
        // Why:      Walk the whole eight-track queue, recording every visited index.
        // TS map:   `for (let i = 0; i < 8; i++) { seen.add(q.advance(false)!); }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (let i = 0; i < 8; i++) {
        //   seen.add(q.advance(false)!);
        // }
        // ```
        repeat(8) {
            // What:     `seen.add(q.advance(false)!!)` is the loop body. `q.advance(false)` returns
            //           `Int?`; `!!` is the NON-NULL ASSERTION operator, unwrapping it to a plain
            //           `Int` and THROWING a `NullPointerException` if it were null. `seen.add(...)`
            //           records the unwrapped index.
            // Why:      Collect each visited track index. `!!` is safe here because a non-empty scope
            //           always yields a next track, so advance is never null.
            // TS map:   `seen.add(q.advance(false)!);` — Kotlin's `!!` is TS's non-null assertion `!`.
            // Gotcha:   `!!` THROWS at runtime on null (a real NPE), unlike TS's `!`, which is a
            //           compile-time-only assertion erased at runtime.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // seen.add(q.advance(false)!);
            // ```
            seen.add(q.advance(false)!!)
        }
        // What:     `assertEquals((0 until 8).toSet(), seen)` is `assertEquals(expected, actual)`.
        //           EXPECTED `(0 until 8).toSet()` builds the half-open `IntRange` 0..7 and
        //           CONVERTS it to a `Set<Int>` via `.toSet()`; ACTUAL is the `seen` set.
        // Why:      Prove the shuffle visited EXACTLY the set {0,1,...,7} once each: a true
        //           permutation of the whole queue, independent of the RNG's particular order.
        // TS map:   `expect(seen).toEqual(new Set([0,1,2,3,4,5,6,7]));` — `(0 until 8).toSet()` is
        //           that expected set; set equality compares membership.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(seen).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7]));
        // ```
        assertEquals((0 until 8).toSet(), seen)
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only); also
    //           inside the seeded-shuffle `//region` fold.
    // Why:      Registers `sameSeedYieldsSameShuffleOrder` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("same seed yields same shuffle order", () => {
    // ```
    @Test
    // What:     `fun sameSeedYieldsSameShuffleOrder() { ... }` declares a no-arg `Unit`-returning
    //           test method, block body.
    // Why:      Pins the determinism guarantee the RNG caveat relies on: two queues built with the
    //           SAME seed produce the SAME shuffled order. (Only within-Kotlin determinism is
    //           promised, NOT parity with the desktop's xorshift sequence.)
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertion below... *\/ }
    // ```
    fun sameSeedYieldsSameShuffleOrder() {
        // What:     `val first = Queue.withRngSeed(424242)` constructs the FIRST queue seeded with
        //           `424242`.
        // Why:      One of two independently-built queues that share a seed.
        // TS map:   `const first = Queue.withRngSeed(424242n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const first = Queue.withRngSeed(424242n);
        // ```
        val first = Queue.withRngSeed(424242)
        // What:     `first.setTracks(paths(10))` loads ten root tracks into the first queue.
        // Why:      A ten-track queue to shuffle.
        // TS map:   `first.setTracks(paths(10));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // first.setTracks(paths(10));
        // ```
        first.setTracks(paths(10))
        // What:     `first.setShuffle(ShuffleMode.ALL)` shuffles the first queue's whole scope.
        // Why:      Produce the first shuffled order.
        // TS map:   `first.setShuffle(ShuffleMode.ALL);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // first.setShuffle(ShuffleMode.ALL);
        // ```
        first.setShuffle(ShuffleMode.ALL)
        // What:     `val firstOrder: List<Int> = (0 until 10).map { first.advance(false)!! }`
        //           declares a read-only `List<Int>` local `firstOrder`. `(0 until 10)` is the
        //           half-open range 0..9; `.map { ... }` runs a trailing lambda for each (implicit
        //           index `it` unused) and collects the results; inside, `first.advance(false)`
        //           returns `Int?` and `!!` unwraps it to `Int` (throwing on null; safe). The
        //           result is the first queue's full advance sequence.
        // Why:      Capture the first queue's shuffled order by advancing ten times.
        // TS map:   `const firstOrder = Array.from({ length: 10 }, () => first.advance(false)!);`
        // Gotcha:   `.map` over a RANGE here is used to repeat a side-effecting call ten times and
        //           gather its results; the loop variable `it` is not used.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const firstOrder = Array.from({ length: 10 }, () => first.advance(false)!);
        // ```
        val firstOrder: List<Int> = (0 until 10).map { first.advance(false)!! }

        // What:     `val second = Queue.withRngSeed(424242)` constructs a SECOND queue with the
        //           SAME seed `424242` as `first`.
        // Why:      The other queue that must reproduce the first's order.
        // TS map:   `const second = Queue.withRngSeed(424242n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const second = Queue.withRngSeed(424242n);
        // ```
        val second = Queue.withRngSeed(424242)
        // What:     `second.setTracks(paths(10))` loads the same ten tracks into the second queue.
        // Why:      Identical input to the first queue.
        // TS map:   `second.setTracks(paths(10));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // second.setTracks(paths(10));
        // ```
        second.setTracks(paths(10))
        // What:     `second.setShuffle(ShuffleMode.ALL)` shuffles the second queue's whole scope.
        // Why:      Same shuffle operation as the first queue.
        // TS map:   `second.setShuffle(ShuffleMode.ALL);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // second.setShuffle(ShuffleMode.ALL);
        // ```
        second.setShuffle(ShuffleMode.ALL)
        // What:     `val secondOrder: List<Int> = (0 until 10).map { second.advance(false)!! }`
        //           captures the second queue's advance sequence, same shape as `firstOrder`
        //           (range `.map` with `!!`-unwrapped `Int?`).
        // Why:      Capture the second queue's shuffled order for comparison.
        // TS map:   `const secondOrder = Array.from({ length: 10 }, () => second.advance(false)!);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const secondOrder = Array.from({ length: 10 }, () => second.advance(false)!);
        // ```
        val secondOrder: List<Int> = (0 until 10).map { second.advance(false)!! }

        // What:     `assertEquals(firstOrder, secondOrder)` is `assertEquals(expected, actual)`:
        //           compares the two captured `List<Int>` orders by structural (element-by-element)
        //           equality.
        // Why:      Prove the same seed yields the same shuffle order (within-Kotlin determinism).
        // TS map:   `expect(secondOrder).toEqual(firstOrder);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(secondOrder).toEqual(firstOrder);
        // ```
        assertEquals(firstOrder, secondOrder)
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `clearSelectionDeselectsButKeepsTracks` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("clear selection deselects but keeps tracks", () => {
    // ```
    @Test
    // What:     `fun clearSelectionDeselectsButKeepsTracks() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that `clearSelection` drops the current track (so a fresh open
    //           auto-selects nothing) while KEEPING every track, and that tapping selects
    //           again. Mirrors the desktop's `clear_selection_deselects_but_keeps_tracks`.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun clearSelectionDeselectsButKeepsTracks() {
        // What:     `val q = Queue.withRngSeed(1)` constructs a seeded empty queue.
        // Why:      A deterministic queue to load and clear.
        // TS map:   `const q = Queue.withRngSeed(1n);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const q = Queue.withRngSeed(1n);
        // ```
        val q = Queue.withRngSeed(1)
        // What:     `q.setTracks(paths(3))` loads three root tracks, anchoring the cursor on
        //           track 0.
        // Why:      Set up a non-empty queue with a selection to clear.
        // TS map:   `q.setTracks(paths(3));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.setTracks(paths(3));
        // ```
        q.setTracks(paths(3))
        // What:     `assertEquals(0, q.currentIndex())` confirms the cursor anchored on track 0.
        // Why:      Establish the pre-clear state so the clear is meaningful.
        // TS map:   `expect(q.currentIndex()).toEqual(0);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toEqual(0);
        // ```
        assertEquals(0, q.currentIndex())
        // What:     `q.clearSelection()` drops the cursor and the scope.
        // Why:      The behaviour under test (a normal open auto-selects nothing).
        // TS map:   `q.clearSelection();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // q.clearSelection();
        // ```
        q.clearSelection()
        // What:     `assertNull(q.currentIndex())` asserts the current index is now `null`.
        // Why:      Nothing is auto-selected once cleared.
        // TS map:   `expect(q.currentIndex()).toBeNull();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toBeNull();
        // ```
        assertNull(q.currentIndex())
        // What:     `assertEquals(3, q.len())` confirms all three tracks survive the clear.
        // Why:      The UI list still shows every track; only the selection is gone.
        // TS map:   `expect(q.len()).toEqual(3);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.len()).toEqual(3);
        // ```
        assertEquals(3, q.len())
        // What:     `assertNull(q.advance(false))` asserts advancing yields `null` with no
        //           cursor.
        // Why:      Next / auto-advance must not invent a track when nothing is selected.
        // TS map:   `expect(q.advance(false)).toBeNull();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.advance(false)).toBeNull();
        // ```
        assertNull(q.advance(false))
        // What:     `assertEquals(2, q.playIndex(2))` confirms tapping track 2 returns its index.
        // Why:      Selection works after a clear (rebuilds the scope around the tapped track).
        // TS map:   `expect(q.playIndex(2)).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.playIndex(2)).toEqual(2);
        // ```
        assertEquals(2, q.playIndex(2))
        // What:     `assertEquals(2, q.currentIndex())` confirms the cursor moved to track 2.
        // Why:      The tapped track is now current.
        // TS map:   `expect(q.currentIndex()).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(q.currentIndex()).toEqual(2);
        // ```
        assertEquals(2, q.currentIndex())
    }
    //endregion
}
