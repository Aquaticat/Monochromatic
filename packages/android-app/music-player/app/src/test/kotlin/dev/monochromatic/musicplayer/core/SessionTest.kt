// What:     `package dev.monochromatic.musicplayer.core` names the namespace this test file
//           lives under. It is the SAME package as the code under test (`Session.kt`,
//           `AudioExtensions.kt`, `ShuffleMode`), so this file uses `Session`, `isAudioFile`,
//           and `ShuffleMode` by their short names with no import. The package must mirror the
//           directory path.
// Why:      Sharing the package lets the tests reach the `Session` data class, the `isAudioFile`
//           function, and the `ShuffleMode` enum without importing them; test and main source
//           sets merge into one package at compile time.
// TS map:   No `package` keyword; a file's path IS its module. Equivalent would be
//           `import { Session, isAudioFile, ShuffleMode } from ".../core/..."`, made implicit by
//           the same-package rule.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path IS the module; here it shares a namespace with the SUT.
// ```
package dev.monochromatic.musicplayer.core

// What:     `import org.junit.Assert.assertEquals` imports the static `assertEquals` function
//           from JUnit 4's `org.junit.Assert` class, callable unqualified.
// Why:      The field and structural equality assertions below need it.
// TS map:   `import { assertEquals } from "...";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertEquals } from "@junit/assert";
// ```
import org.junit.Assert.assertEquals

// What:     `import org.junit.Assert.assertFalse` imports the static `assertFalse` function
//           (asserts a `Boolean` is `false`).
// Why:      The non-audio assertions below (`assertFalse(isAudioFile("cover.jpg"))`) need it.
// TS map:   `import { assertFalse } from "...";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertFalse } from "@junit/assert";
// ```
import org.junit.Assert.assertFalse

// What:     `import org.junit.Assert.assertNull` imports the static `assertNull` function, which
//           FAILS unless its argument is `null`.
// Why:      The prune assertions below (`assertNull(pruned.current)`) need it, because a pruned
//           session's `current` is a nullable `Int?`.
// TS map:   `import { assertNull } from "...";` — equivalently `expect(x).toBeNull()`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertNull } from "@junit/assert";
// ```
import org.junit.Assert.assertNull

// What:     `import org.junit.Assert.assertTrue` imports the static `assertTrue` function
//           (asserts a `Boolean` is `true`).
// Why:      The audio-predicate assertions below (`assertTrue(isAudioFile("a.flac"))`) need it.
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
// Host-JVM unit tests for `Session` and `isAudioFile`, ported from the desktop player's
// `session_tests.rs` (and the `is_audio_file` case in `playback_tests.rs`) so the Kotlin port
// stays faithful to the Rust behaviour. The desktop's prune tests write real temp files so
// `Path::exists` is true; here that filesystem check is supplied as a PREDICATE over a set of
// "present" paths, keeping the same path vectors and the same expected survivors and cursor
// remapping WITHOUT touching disk. The JSON round-trip test becomes a field-by-field plus
// structural-equality check, since this core carries no serialisation library. The cases pin:
// round-trip field preservation, pruning of missing/non-audio tracks with cursor remap, and
// clearing the position when the current track is gone.

// What:     `class SessionTest { ... }` declares a JUnit 4 test class the runner instantiates to
//           invoke each `@Test`-marked method. It also holds one private HELPER (`existsAmong`)
//           that builds a stand-in for the desktop's filesystem-exists check.
// Why:      Groups every session test plus the predicate builder they share.
// TS map:   `describe("Session", () => { ... })`; the helper would be a plain function inside it.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("Session", () => {
//   // ...helper + each @Test fun become a function / test(...) calls inside here...
// });
// ```
class SessionTest {
    // What:     `private fun existsAmong(present: Set<String>): (String) -> Boolean = { it in present }`
    //           declares a PRIVATE HIGHER-ORDER helper, expression body. Several pieces:
    //           - parameter `present: Set<String>` is the set of paths to treat as existing.
    //           - the return type `(String) -> Boolean` is a FUNCTION TYPE: the helper returns a
    //             VALUE THAT IS ITSELF A FUNCTION taking one `String` and giving a `Boolean`.
    //           - the body `{ it in present }` is a LAMBDA (the returned function). `it` is the
    //             implicit name for the lambda's single `String` parameter; `it in present` uses
    //             the `in` MEMBERSHIP operator (compiles to `present.contains(it)`), returning
    //             `true` when the path is in the set.
    // Why:      Build a deterministic, disk-free stand-in for the desktop's `Path::exists`: a
    //           predicate that reports `true` exactly for the explicitly-listed `present` paths,
    //           so prune tests stay reproducible without touching the filesystem.
    // TS map:   `function existsAmong(present: Set<string>): (s: string) => boolean { return (s) => present.has(s); }`
    //           — Kotlin's `(String) -> Boolean` return type is TS's `(s: string) => boolean`, and
    //           `{ it in present }` is the arrow `(s) => present.has(s)`.
    // Gotcha:   Kotlin's `in` is MEMBERSHIP (`.contains`), NOT JavaScript/TypeScript's `in`
    //           (object-property-key) operator; translate it to `.has(...)`, never to JS `in`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function existsAmong(present: Set<string>): (s: string) => boolean {
    //   return (s) => present.has(s);
    // }
    // ```
    private fun existsAmong(present: Set<String>): (String) -> Boolean = { it in present }

    // What:     `@Test` is an ANNOTATION (metadata, no code) marking the method below as a test
    //           the JUnit runner executes and reports.
    // Why:      Registers `roundTripPreservesFields` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("round trip preserves fields", () => {
    // ```
    @Test
    // What:     `fun roundTripPreservesFields() { ... }` declares a no-parameter test method
    //           returning `Unit` (Kotlin's "void"), block body.
    // Why:      Pins that a `Session` survives a copy unchanged, field by field AND as a whole
    //           value. This stands in for the desktop's JSON save/reload round-trip, which this
    //           pure core has no serialiser for.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun roundTripPreservesFields() {
        // What:     `val original = Session( tracks = ..., current = 1, positionSecs = 12.5, ... )`
        //           declares a read-only local `original` constructed via the `Session` DATA CLASS
        //           constructor using NAMED ARGUMENTS (`name = value`). Named arguments pass each
        //           constructor parameter by its name, independent of order. The values:
        //           - `tracks = listOf("/a.flac", "/b.opus")` — an immutable `List<String>`.
        //           - `current = 1` — an `Int` (the saved cursor; the field type is `Int?`, and a
        //             non-null `Int` is a valid `Int?`).
        //           - `positionSecs = 12.5` — a `Double` literal (64-bit float; sibling `12.5f`
        //             would be a 32-bit `Float`). The field is `Double` for sub-second seek
        //             precision.
        //           - `volume = 0.7f` — a `Float` literal (the `f` suffix; sibling `0.7` is a
        //             `Double`). The field is `Float` to match the desktop's `f32` gain.
        //           - `shuffle = ShuffleMode.WITHIN_PAGE` — an enum constant.
        //           - `repeatTrack = true` — a `Boolean`.
        // Why:      A fully-populated session to copy and compare, so every field is exercised.
        // TS map:   `const original = new Session({ tracks: ["/a.flac", "/b.opus"], current: 1, positionSecs: 12.5, volume: 0.7, shuffle: ShuffleMode.WITHIN_PAGE, repeatTrack: true });`
        //           — Kotlin named args become an options-object literal; TS has only `number`, so
        //           the `Double` vs `Float` (`12.5` vs `0.7f`) distinction collapses.
        // Gotcha:   No `new` keyword; `Session(...)` IS the constructor call. Kotlin's named args
        //           are not a single object literal but per-parameter labels.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const original = new Session({
        //   tracks: ["/a.flac", "/b.opus"], current: 1, positionSecs: 12.5,
        //   volume: 0.7, shuffle: ShuffleMode.WITHIN_PAGE, repeatTrack: true,
        // });
        // ```
        val original = Session(
            tracks = listOf("/a.flac", "/b.opus"),
            current = 1,
            positionSecs = 12.5,
            volume = 0.7f,
            shuffle = ShuffleMode.WITHIN_PAGE,
            repeatTrack = true,
        )
        // What:     `val back = original.copy()` declares a read-only local `back`. `.copy()` is a
        //           method the `data` modifier AUTO-GENERATES on a data class: it makes a new
        //           instance with all fields copied (optionally overriding some, none here).
        // Why:      Produce a structural duplicate of `original` to compare against, standing in
        //           for the deserialised session in the Rust JSON round-trip.
        // TS map:   `const back = { ...original };` — a shallow spread copy; Kotlin's generated
        //           `.copy()` is that field-by-field clone.
        // Gotcha:   `.copy()` is generated ONLY because `Session` is a `data class`; a plain class
        //           would have no `.copy()`. The copy is shallow, but all `Session` fields are
        //           immutable, so it behaves as a value clone.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const back = { ...original };
        // ```
        val back = original.copy()
        // What:     `assertEquals(original.tracks, back.tracks)` is `assertEquals(expected, actual)`
        //           comparing the two `List<String>` fields by structural (element-by-element)
        //           equality.
        // Why:      The track list must survive the copy unchanged.
        // TS map:   `expect(back.tracks).toEqual(original.tracks);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back.tracks).toEqual(original.tracks);
        // ```
        assertEquals(original.tracks, back.tracks)
        // What:     `assertEquals(original.current, back.current)` compares the two `Int?` cursor
        //           fields (`assertEquals(expected, actual)`); both are `1` here.
        // Why:      The cursor must survive the copy.
        // TS map:   `expect(back.current).toEqual(original.current);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back.current).toEqual(original.current);
        // ```
        assertEquals(original.current, back.current)
        // What:     `assertEquals(original.positionSecs, back.positionSecs, 0.0)` calls the
        //           THREE-argument floating-point overload `assertEquals(expected, actual, delta)`,
        //           which passes when `|expected - actual| <= delta`. The `delta` is `0.0` (a
        //           `Double`), demanding EXACT equality. Both fields are `Double`.
        // Why:      The saved position must survive the copy bit-for-bit; the 3-arg form exists
        //           because exact `==` on floats is fragile, but with `delta = 0.0` we still
        //           require exactness (safe here, since copy does no arithmetic).
        // TS map:   `expect(back.positionSecs).toBeCloseTo(original.positionSecs);` — TS uses a
        //           closeness matcher; the JUnit `delta` is the explicit tolerance (0 = exact).
        // Gotcha:   This 3-arg overload is DIFFERENT from the 2-arg `assertEquals`; the trailing
        //           `0.0` is a TOLERANCE, not a third value to compare.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back.positionSecs).toBe(original.positionSecs); // delta 0.0 => exact
        // ```
        assertEquals(original.positionSecs, back.positionSecs, 0.0)
        // What:     `assertEquals(original.volume, back.volume, 0.0f)` is the 3-arg
        //           `assertEquals(expected, actual, delta)` for `Float` (note the `0.0f` `Float`
        //           delta, matching the `Float` `volume` fields). Delta `0.0f` demands exact
        //           equality.
        // Why:      The saved volume must survive the copy exactly.
        // TS map:   `expect(back.volume).toBe(original.volume); // exact`
        // Gotcha:   The `Float` overload takes a `Float` delta (`0.0f`), distinct from the `Double`
        //           overload's `0.0`; the `f` suffix picks the right one.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back.volume).toBe(original.volume); // delta 0.0f => exact
        // ```
        assertEquals(original.volume, back.volume, 0.0f)
        // What:     `assertEquals(original.shuffle, back.shuffle)` compares the two `ShuffleMode`
        //           enum fields (`assertEquals(expected, actual)`); equal enum constants compare
        //           equal.
        // Why:      The shuffle mode must survive the copy.
        // TS map:   `expect(back.shuffle).toEqual(original.shuffle);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back.shuffle).toEqual(original.shuffle);
        // ```
        assertEquals(original.shuffle, back.shuffle)
        // What:     `assertEquals(original.repeatTrack, back.repeatTrack)` compares the two
        //           `Boolean` fields.
        // Why:      The repeat-track flag must survive the copy.
        // TS map:   `expect(back.repeatTrack).toEqual(original.repeatTrack);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back.repeatTrack).toEqual(original.repeatTrack);
        // ```
        assertEquals(original.repeatTrack, back.repeatTrack)
        // What:     `assertEquals(original, back)` compares the two WHOLE `Session` values.
        //           Because `Session` is a `data class`, its generated `equals` compares ALL fields
        //           structurally, so this asserts the entire object is preserved.
        // Why:      Beyond the per-field checks, confirm the objects are equal as values (the
        //           structural-equality stand-in for a JSON round-trip).
        // TS map:   `expect(back).toEqual(original);` — TS deep-equal over the whole object.
        // Gotcha:   `assertEquals` on two data-class values uses the generated structural `equals`,
        //           NOT reference identity; this is what makes whole-object comparison meaningful.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back).toEqual(original);
        // ```
        assertEquals(original, back)
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `pruneDropsMissingAndRemapsCurrent` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("prune drops missing and remaps current", () => {
    // ```
    @Test
    // What:     `fun pruneDropsMissingAndRemapsCurrent() { ... }` declares a no-arg `Unit`-returning
    //           test method, block body.
    // Why:      Pins that `pruneUnplayable` DROPS a track the filesystem predicate reports as
    //           missing and REMAPS the cursor to the surviving track's new index. A session
    //           restored after a file moved must not point at a gone track.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun pruneDropsMissingAndRemapsCurrent() {
        // What:     `val present = "/tmp/player_prune_test_present.wav"` declares a read-only
        //           `String` local naming the path the predicate will treat as existing.
        // Why:      The track that should survive pruning.
        // TS map:   `const present = "/tmp/player_prune_test_present.wav";`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const present = "/tmp/player_prune_test_present.wav";
        // ```
        val present = "/tmp/player_prune_test_present.wav"
        // What:     `val missing = "/tmp/player_prune_test_missing_xyz.wav"` declares a read-only
        //           `String` local naming the path the predicate will report as NOT existing.
        // Why:      The track that should be pruned away.
        // TS map:   `const missing = "/tmp/player_prune_test_missing_xyz.wav";`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const missing = "/tmp/player_prune_test_missing_xyz.wav";
        // ```
        val missing = "/tmp/player_prune_test_missing_xyz.wav"
        // What:     `val session = Session( tracks = listOf(missing, present), current = 1, ... )`
        //           constructs a `Session` via named arguments (see the round-trip block for the
        //           construct). The track list is `[missing, present]` and the cursor `current = 1`
        //           points at `present` (index 1).
        // Why:      A session whose cursor is on the SURVIVING track but whose list also holds a
        //           missing one, so pruning must drop one track and shift the cursor.
        // TS map:   `const session = new Session({ tracks: [missing, present], current: 1, positionSecs: 5.0, volume: 1.0, shuffle: ShuffleMode.OFF, repeatTrack: false });`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const session = new Session({
        //   tracks: [missing, present], current: 1, positionSecs: 5.0,
        //   volume: 1.0, shuffle: ShuffleMode.OFF, repeatTrack: false,
        // });
        // ```
        val session = Session(
            tracks = listOf(missing, present),
            current = 1,
            positionSecs = 5.0,
            volume = 1.0f,
            shuffle = ShuffleMode.OFF,
            repeatTrack = false,
        )
        // What:     `val pruned = session.pruneUnplayable(existsAmong(setOf(present)))` declares a
        //           read-only `Session` local `pruned`. `existsAmong(setOf(present))` builds the
        //           exists-predicate from a `setOf(present)` (an immutable `Set<String>` factory
        //           holding just the present path); `pruneUnplayable(...)` then returns a NEW
        //           `Session` with unplayable tracks removed and the cursor remapped.
        // Why:      Run the prune with only `present` "existing", so `missing` is dropped.
        // TS map:   `const pruned = session.pruneUnplayable(existsAmong(new Set([present])));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const pruned = session.pruneUnplayable(existsAmong(new Set([present])));
        // ```
        val pruned = session.pruneUnplayable(existsAmong(setOf(present)))
        // What:     `assertEquals(1, pruned.tracks.size)` is `assertEquals(expected, actual)`:
        //           EXPECTED `Int` `1`; ACTUAL `pruned.tracks.size`, the surviving track count.
        // Why:      One of the two tracks (the missing one) was dropped, leaving one.
        // TS map:   `expect(pruned.tracks.length).toEqual(1);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(pruned.tracks.length).toEqual(1);
        // ```
        assertEquals(1, pruned.tracks.size)
        // What:     `assertEquals(present, pruned.tracks[0])` is `assertEquals(expected, actual)`:
        //           EXPECTED is the `present` path; ACTUAL `pruned.tracks[0]` indexes the surviving
        //           list at position 0.
        // Why:      The surviving track is exactly `present`.
        // TS map:   `expect(pruned.tracks[0]).toEqual(present);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(pruned.tracks[0]).toEqual(present);
        // ```
        assertEquals(present, pruned.tracks[0])
        // What:     `assertEquals(0 as Int?, pruned.current)` is `assertEquals(expected, actual)`.
        //           `0 as Int?` is a TYPE CAST: `as` casts the `Int` literal `0` to the NULLABLE
        //           type `Int?`. This makes the EXPECTED value's type match `pruned.current`'s
        //           `Int?`, so the call binds to the `(Object, Object)` overload of `assertEquals`
        //           and compares the boxed values, rather than a primitive-`int` overload.
        // Why:      After dropping the missing track at index 0, the surviving track (was index 1)
        //           is now at index 0, so the cursor must remap from 1 to 0.
        // TS map:   `expect(pruned.current).toEqual(0);` — TS needs no cast; `number | null`
        //           compares against `0` directly.
        // Gotcha:   `as` here is a WIDENING cast (`Int` -> `Int?`), always safe; it is only there to
        //           steer JUnit's overload resolution, NOT to change the value. Kotlin's `as` is a
        //           real runtime cast, unlike TS's compile-time-only `as`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(pruned.current).toEqual(0);
        // ```
        assertEquals(0 as Int?, pruned.current)
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `pruneClearsPositionWhenCurrentTrackGone` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("prune clears position when current track gone", () => {
    // ```
    @Test
    // What:     `fun pruneClearsPositionWhenCurrentTrackGone() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that when the CURRENT track itself is pruned, the cursor becomes `null` AND
    //           the saved position resets to 0, so a restored session does not resume into a gone
    //           track at a stale offset.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun pruneClearsPositionWhenCurrentTrackGone() {
        // What:     `val session = Session( tracks = listOf("/definitely/not/here_404.flac"), current = 0, ... )`
        //           constructs a one-track session (named args) whose only track is the current one,
        //           with a non-zero saved `positionSecs = 9.0` (a `Double`).
        // Why:      A session whose current track will be pruned, so both cursor and position must
        //           clear.
        // TS map:   `const session = new Session({ tracks: ["/definitely/not/here_404.flac"], current: 0, positionSecs: 9.0, volume: 1.0, shuffle: ShuffleMode.OFF, repeatTrack: false });`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const session = new Session({
        //   tracks: ["/definitely/not/here_404.flac"], current: 0, positionSecs: 9.0,
        //   volume: 1.0, shuffle: ShuffleMode.OFF, repeatTrack: false,
        // });
        // ```
        val session = Session(
            tracks = listOf("/definitely/not/here_404.flac"),
            current = 0,
            positionSecs = 9.0,
            volume = 1.0f,
            shuffle = ShuffleMode.OFF,
            repeatTrack = false,
        )
        // What:     `val pruned = session.pruneUnplayable(existsAmong(emptySet()))` prunes with an
        //           EMPTY existence set. `emptySet()` is a stdlib factory returning a shared
        //           zero-element read-only `Set` (sibling: `setOf(...)` for a populated set), so
        //           NO path exists and every track is dropped.
        // Why:      Force the only (current) track to be pruned, to observe cursor/position clearing.
        // TS map:   `const pruned = session.pruneUnplayable(existsAmong(new Set()));` — `emptySet()`
        //           is `new Set()`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const pruned = session.pruneUnplayable(existsAmong(new Set()));
        // ```
        val pruned = session.pruneUnplayable(existsAmong(emptySet()))
        // What:     `assertEquals(0, pruned.tracks.size)` — EXPECTED `Int` `0`, ACTUAL the surviving
        //           track count.
        // Why:      With nothing existing, all tracks are dropped, leaving an empty list.
        // TS map:   `expect(pruned.tracks.length).toEqual(0);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(pruned.tracks.length).toEqual(0);
        // ```
        assertEquals(0, pruned.tracks.size)
        // What:     `assertNull(pruned.current)` asserts `null`. With no tracks left, the cursor
        //           `current` (`Int?`) is `null`.
        // Why:      An empty pruned session has no current track.
        // TS map:   `expect(pruned.current).toBeNull();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(pruned.current).toBeNull();
        // ```
        assertNull(pruned.current)
        // What:     `assertEquals(0.0, pruned.positionSecs, 0.0)` is the 3-arg
        //           `assertEquals(expected, actual, delta)` for `Double`: EXPECTED `0.0`, ACTUAL
        //           `pruned.positionSecs`, `delta` `0.0` (exact). The saved position must have been
        //           reset to zero.
        // Why:      Confirm the stale position was cleared when the current track vanished.
        // TS map:   `expect(pruned.positionSecs).toBe(0.0); // delta 0.0 => exact`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(pruned.positionSecs).toBe(0.0);
        // ```
        assertEquals(0.0, pruned.positionSecs, 0.0)
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `pruneDropsPresentNonAudioAndRemapsCurrent` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("prune drops present non-audio and remaps current", () => {
    // ```
    @Test
    // What:     `fun pruneDropsPresentNonAudioAndRemapsCurrent() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that pruning drops a track that EXISTS but is NOT audio (a `.jpg` cover) as
    //           well as missing ones, and remaps the cursor. Existence alone is not enough; the
    //           file must also pass `isAudioFile`.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun pruneDropsPresentNonAudioAndRemapsCurrent() {
        // What:     `val junk = "/tmp/player_prune_cover_xyz.jpg"` declares a read-only `String`
        //           local naming a present-but-non-audio path (a `.jpg`).
        // Why:      A track that exists on disk but is not playable audio, to be pruned.
        // TS map:   `const junk = "/tmp/player_prune_cover_xyz.jpg";`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const junk = "/tmp/player_prune_cover_xyz.jpg";
        // ```
        val junk = "/tmp/player_prune_cover_xyz.jpg"
        // What:     `val audio = "/tmp/player_prune_song_xyz.flac"` declares a read-only `String`
        //           local naming a present audio path (a `.flac`).
        // Why:      The track that should survive pruning.
        // TS map:   `const audio = "/tmp/player_prune_song_xyz.flac";`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const audio = "/tmp/player_prune_song_xyz.flac";
        // ```
        val audio = "/tmp/player_prune_song_xyz.flac"
        // What:     `val session = Session( tracks = listOf(junk, audio), current = 1, ... )`
        //           constructs a session (named args) with `[junk, audio]` and the cursor on
        //           `audio` (index 1).
        // Why:      A session whose cursor is on the audio track, with a present-but-junk track
        //           before it, so pruning must drop the junk and shift the cursor.
        // TS map:   `const session = new Session({ tracks: [junk, audio], current: 1, positionSecs: 3.0, volume: 1.0, shuffle: ShuffleMode.OFF, repeatTrack: false });`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const session = new Session({
        //   tracks: [junk, audio], current: 1, positionSecs: 3.0,
        //   volume: 1.0, shuffle: ShuffleMode.OFF, repeatTrack: false,
        // });
        // ```
        val session = Session(
            tracks = listOf(junk, audio),
            current = 1,
            positionSecs = 3.0,
            volume = 1.0f,
            shuffle = ShuffleMode.OFF,
            repeatTrack = false,
        )
        // What:     `val pruned = session.pruneUnplayable(existsAmong(setOf(junk, audio)))` prunes
        //           with BOTH paths reported as existing (`setOf(junk, audio)` is an immutable
        //           two-element `Set<String>`). Because both exist, only the non-audio extension
        //           check can drop `junk`.
        // Why:      Make both files "exist", so the only reason `junk` is dropped is the audio
        //           check, isolating that behaviour.
        // TS map:   `const pruned = session.pruneUnplayable(existsAmong(new Set([junk, audio])));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const pruned = session.pruneUnplayable(existsAmong(new Set([junk, audio])));
        // ```
        val pruned = session.pruneUnplayable(existsAmong(setOf(junk, audio)))
        // What:     `assertEquals(listOf(audio), pruned.tracks)` is `assertEquals(expected, actual)`:
        //           EXPECTED `listOf(audio)` (an immutable one-element `List<String>`); ACTUAL
        //           `pruned.tracks`. The lists compare structurally.
        // Why:      Only the audio track survives; the present-but-junk `.jpg` was dropped.
        // TS map:   `expect(pruned.tracks).toEqual([audio]);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(pruned.tracks).toEqual([audio]);
        // ```
        assertEquals(listOf(audio), pruned.tracks)
        // What:     `assertEquals(0 as Int?, pruned.current)` is `assertEquals(expected, actual)`
        //           with `0 as Int?` casting the `Int` literal to the nullable type to match
        //           `pruned.current`'s `Int?` (see the earlier such block for why the cast steers
        //           overload resolution).
        // Why:      Dropping the junk at index 0 shifts the surviving audio track from index 1 to
        //           index 0, so the cursor remaps to 0.
        // TS map:   `expect(pruned.current).toEqual(0);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(pruned.current).toEqual(0);
        // ```
        assertEquals(0 as Int?, pruned.current)
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `isAudioFileMatchesExtensionsCaseInsensitively` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("is audio file matches extensions case-insensitively", () => {
    // ```
    @Test
    // What:     `fun isAudioFileMatchesExtensionsCaseInsensitively() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body. (This duplicates the predicate test in
    //           `AudioExtensionsTest`; the session suite re-pins it because session restore also
    //           relies on `isAudioFile` to decide what counts as a playable track.)
    // Why:      Pins that `isAudioFile` accepts known audio extensions case-insensitively and
    //           rejects non-audio, dotfiles, and extensionless names, the same contract the prune
    //           logic above depends on.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertions below... *\/ }
    // ```
    fun isAudioFileMatchesExtensionsCaseInsensitively() {
        // What:     `assertTrue(isAudioFile("a.flac"))` is the single-arg `assertTrue(condition)`;
        //           the condition is the predicate on a lowercase `.flac` name.
        // Why:      A plain lowercase `.flac` is recognised as audio (baseline).
        // TS map:   `expect(isAudioFile("a.flac")).toBe(true);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile("a.flac")).toBe(true);
        // ```
        assertTrue(isAudioFile("a.flac"))
        // What:     `assertTrue(isAudioFile("A.FLAC"))` asserts `true` for an all-uppercase name.
        // Why:      Case-insensitivity: `A.FLAC` matches the lowercased allowlist entry.
        // TS map:   `expect(isAudioFile("A.FLAC")).toBe(true);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile("A.FLAC")).toBe(true);
        // ```
        assertTrue(isAudioFile("A.FLAC"))
        // What:     `assertTrue(isAudioFile("/x/y/b.OpUs"))` asserts `true` for a path with parent
        //           directories and a mixed-case extension `OpUs`.
        // Why:      Confirms the final component is isolated past the `/`s and the extension folded
        //           to lowercase before lookup.
        // TS map:   `expect(isAudioFile("/x/y/b.OpUs")).toBe(true);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile("/x/y/b.OpUs")).toBe(true);
        // ```
        assertTrue(isAudioFile("/x/y/b.OpUs"))
        // What:     `assertFalse(isAudioFile("cover.jpg"))` asserts `false` for cover art.
        // Why:      `jpg` is not in the allowlist, so it is not audio.
        // TS map:   `expect(isAudioFile("cover.jpg")).toBe(false);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile("cover.jpg")).toBe(false);
        // ```
        assertFalse(isAudioFile("cover.jpg"))
        // What:     `assertFalse(isAudioFile(".DS_Store"))` asserts `false` for a leading-dot
        //           dotfile.
        // Why:      A leading dot means "no extension", so the dotfile is rejected.
        // TS map:   `expect(isAudioFile(".DS_Store")).toBe(false);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile(".DS_Store")).toBe(false);
        // ```
        assertFalse(isAudioFile(".DS_Store"))
        // What:     `assertFalse(isAudioFile("noext"))` asserts `false` for a name with no dot.
        // Why:      No extension means not audio.
        // TS map:   `expect(isAudioFile("noext")).toBe(false);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile("noext")).toBe(false);
        // ```
        assertFalse(isAudioFile("noext"))
    }
}
