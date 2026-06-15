// What:     `package dev.monochromatic.musicplayer.core` names the namespace this test file
//           lives under. It is the SAME package as the code under test (`Session.kt`,
//           `ShuffleMode`), so this file uses `Session` and `ShuffleMode` by their short
//           names with no import. The package must mirror the directory path.
// Why:      Sharing the package lets the tests reach the `Session` data class and the
//           `ShuffleMode` enum without importing them; test and main source sets merge into
//           one package at compile time.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path IS the module; here it shares a namespace with the SUT.
// ```
package dev.monochromatic.musicplayer.core

// What:     `import org.junit.Assert.assertEquals` imports the static `assertEquals` function
//           from JUnit 4's `org.junit.Assert` class, callable unqualified.
// Why:      The field and structural equality assertions below need it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertEquals } from "@junit/assert";
// ```
import org.junit.Assert.assertEquals

// What:     `import org.junit.Assert.assertNull` imports the static `assertNull` function,
//           which FAILS unless its argument is `null`.
// Why:      The default and null-selected assertions below check the nullable `selected`
//           field is `null`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertNull } from "@junit/assert";
// ```
import org.junit.Assert.assertNull

// What:     `import org.junit.Test` imports the `Test` ANNOTATION class (a type) used as the
//           `@Test` marker on each test method; the runner runs every method tagged with it.
// Why:      Without it we could not write `@Test`, and the runner would find no tests.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from "vitest"; // each @Test method becomes a test("...", () => {...})
// ```
import org.junit.Test

// =============================================================================
// File summary
// =============================================================================
//
// Host-JVM unit tests for the redesigned `Session`. The model dropped the materialized
// queue (`tracks` + `current` + `pruneUnplayable`) in favor of the single SELECTED TRACK
// plus settings and resume position; the queue is re-derived by re-scanning the source on
// restore, so there is no in-model pruning to test. These cases mirror the desktop's
// `session_tests.rs` survivors: the `impl Default` values, a full field-by-field round
// trip (the stand-in for the JSON save/reload, since this pure core has no serializer), and
// a null-selected round trip. (The `isAudioFile` case the old session suite re-pinned moved
// out: the new Session no longer references it, and `AudioExtensionsTest` already covers it.)

// What:     `class SessionTest { ... }` declares a JUnit 4 test class the runner instantiates
//           to invoke each `@Test`-marked method.
// Why:      Groups every session test.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("Session", () => { /* each @Test fun becomes a test(...) inside here */ });
// ```
class SessionTest {
    // What:     `@Test` is an ANNOTATION (metadata, no code) marking the method below as a
    //           test the JUnit runner executes and reports.
    // Why:      Registers `defaultsMatchDesktop` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("defaults match desktop", () => {
    // ```
    @Test
    // What:     `fun defaultsMatchDesktop() { ... }` declares a no-parameter test method
    //           returning `Unit` (Kotlin's "void"), block body.
    // Why:      Pins the `impl Default for Session` values: nothing selected, zero position,
    //           full volume, shuffle off, no repeat-track. A blank install must restore these.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertions below... *\/ }
    // ```
    fun defaultsMatchDesktop() {
        // What:     `val session = Session()` constructs a `Session` with NO arguments, so every
        //           field takes its declared default. No `new` keyword; `Session()` IS the
        //           constructor call.
        // Why:      Observe the defaults directly.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const session = makeSession();
        // ```
        val session = Session()
        // What:     `assertNull(session.selected)` asserts the nullable `selected` field is
        //           `null`.
        // Why:      The default is "nothing selected".
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(session.selected).toBeNull();
        // ```
        assertNull(session.selected)
        // What:     `assertEquals(0.0, session.positionSecs, 0.0)` is the 3-arg
        //           `assertEquals(expected, actual, delta)` for `Double`: EXPECTED `0.0`, ACTUAL
        //           the position, `delta` `0.0` (exact). The trailing `0.0` is a TOLERANCE, not a
        //           third value.
        // Why:      The default position is the start of the track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(session.positionSecs).toBe(0.0);
        // ```
        assertEquals(0.0, session.positionSecs, 0.0)
        // What:     `assertEquals(1.0f, session.volume, 0.0f)` is the 3-arg `Float` overload
        //           (note the `0.0f` `Float` delta matching the `Float` field): EXPECTED full
        //           gain `1.0f`, exact tolerance.
        // Why:      The default volume is full gain.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(session.volume).toBe(1.0);
        // ```
        assertEquals(1.0f, session.volume, 0.0f)
        // What:     `assertEquals(ShuffleMode.OFF, session.shuffle)` compares the `ShuffleMode`
        //           enum field against the `OFF` constant (`assertEquals(expected, actual)`).
        // Why:      The default shuffle mode is off.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(session.shuffle).toEqual(ShuffleMode.OFF);
        // ```
        assertEquals(ShuffleMode.OFF, session.shuffle)
        // What:     `assertEquals(false, session.repeatTrack)` compares the `Boolean` field
        //           against `false`.
        // Why:      The default repeat-track flag is off.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(session.repeatTrack).toBe(false);
        // ```
        assertEquals(false, session.repeatTrack)
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `roundTripPreservesFields` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("round trip preserves fields", () => {
    // ```
    @Test
    // What:     `fun roundTripPreservesFields() { ... }` declares a no-parameter test method
    //           returning `Unit`, block body.
    // Why:      Pins that a fully-populated `Session` survives a copy unchanged, field by field
    //           AND as a whole value. This stands in for the desktop's JSON save/reload round
    //           trip, which this pure core has no serializer for.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun roundTripPreservesFields() {
        // What:     `val original = Session( selected = ..., positionSecs = 12.5, ... )` declares
        //           a read-only local constructed via the `Session` DATA CLASS constructor using
        //           NAMED ARGUMENTS (`name = value`, passed by name, order-independent). The
        //           values: a content-URI-shaped `selected` string, a `Double` position, a
        //           `Float` volume (the `f` suffix), an enum mode, and a `Boolean`.
        // Why:      A fully-populated session to copy and compare, so every field is exercised.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const original = makeSession({
        //   selected: "content://media/external/audio/media/42", positionSecs: 12.5,
        //   volume: 0.7, shuffle: ShuffleMode.WITHIN_PAGE, repeatTrack: true,
        // });
        // ```
        val original = Session(
            selected = "content://media/external/audio/media/42",
            positionSecs = 12.5,
            volume = 0.7f,
            shuffle = ShuffleMode.WITHIN_PAGE,
            repeatTrack = true,
        )
        // What:     `val back = original.copy()` declares a read-only local. `.copy()` is the
        //           method the `data` modifier AUTO-GENERATES: it makes a new instance with all
        //           fields copied (none overridden here).
        // Why:      Produce a structural duplicate to compare against, standing in for the
        //           deserialized session in the desktop round trip.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const back = { ...original };
        // ```
        val back = original.copy()
        // What:     `assertEquals(original.selected, back.selected)` compares the two nullable
        //           `String?` identity fields by value.
        // Why:      The selected-track identity must survive the copy.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back.selected).toEqual(original.selected);
        // ```
        assertEquals(original.selected, back.selected)
        // What:     `assertEquals(original.positionSecs, back.positionSecs, 0.0)` is the 3-arg
        //           `Double` overload with an exact `0.0` tolerance.
        // Why:      The saved position must survive the copy bit-for-bit.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back.positionSecs).toBe(original.positionSecs);
        // ```
        assertEquals(original.positionSecs, back.positionSecs, 0.0)
        // What:     `assertEquals(original.volume, back.volume, 0.0f)` is the 3-arg `Float`
        //           overload (the `0.0f` `Float` delta) with exact tolerance.
        // Why:      The saved volume must survive the copy exactly.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back.volume).toBe(original.volume);
        // ```
        assertEquals(original.volume, back.volume, 0.0f)
        // What:     `assertEquals(original.shuffle, back.shuffle)` compares the two `ShuffleMode`
        //           enum fields; equal enum constants compare equal.
        // Why:      The shuffle mode must survive the copy.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back.shuffle).toEqual(original.shuffle);
        // ```
        assertEquals(original.shuffle, back.shuffle)
        // What:     `assertEquals(original.repeatTrack, back.repeatTrack)` compares the two
        //           `Boolean` fields.
        // Why:      The repeat-track flag must survive the copy.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back.repeatTrack).toEqual(original.repeatTrack);
        // ```
        assertEquals(original.repeatTrack, back.repeatTrack)
        // What:     `assertEquals(original, back)` compares the two WHOLE `Session` values. The
        //           generated `equals` compares ALL fields structurally, so this asserts the
        //           entire object is preserved.
        // Why:      Beyond per-field checks, confirm the objects are equal as values (the
        //           structural-equality stand-in for a JSON round trip).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back).toEqual(original);
        // ```
        assertEquals(original, back)
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `nullSelectedRoundTrips` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("null selected round trips", () => {
    // ```
    @Test
    // What:     `fun nullSelectedRoundTrips() { ... }` declares a no-parameter `Unit`-returning
    //           test method, block body.
    // Why:      Pins that a session with NOTHING selected (but non-default settings) round-trips
    //           with `selected` staying `null`. This mirrors the desktop's
    //           `none_root_and_selection_round_trip`: a restored library with no chosen track
    //           still carries the user's volume/shuffle/repeat.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun nullSelectedRoundTrips() {
        // What:     `val original = Session( selected = null, ... )` constructs a session with no
        //           selected track but a non-default volume, shuffle mode, and repeat flag.
        // Why:      Exercise the "settings without a selection" shape, the common restore case
        //           after a folder change clears the selection but keeps the user's settings.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const original = makeSession({
        //   selected: null, positionSecs: 0.0, volume: 0.4,
        //   shuffle: ShuffleMode.ALL, repeatTrack: true,
        // });
        // ```
        val original = Session(
            selected = null,
            positionSecs = 0.0,
            volume = 0.4f,
            shuffle = ShuffleMode.ALL,
            repeatTrack = true,
        )
        // What:     `val back = original.copy()` makes the structural duplicate (see the
        //           round-trip block).
        // Why:      Compare the no-selection session against its copy.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const back = { ...original };
        // ```
        val back = original.copy()
        // What:     `assertNull(back.selected)` asserts the copied `selected` is still `null`.
        // Why:      A null identity must survive the copy as null, not become an empty string.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back.selected).toBeNull();
        // ```
        assertNull(back.selected)
        // What:     `assertEquals(original, back)` compares the whole values, confirming the
        //           non-default settings carried over alongside the null selection.
        // Why:      The settings must round-trip even when nothing is selected.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(back).toEqual(original);
        // ```
        assertEquals(original, back)
    }
}
