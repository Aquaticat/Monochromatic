// What:     `package dev.monochromatic.musicplayer` names the namespace this test lives under,
//           the SAME package as `PlayerController`, `Track`, `FinishLoadResult`, and
//           `FakeAudioEngine`, so all of those are reachable here without imports.
// Why:      The test drives `PlayerController` directly and constructs `Track`/`FakeAudioEngine`
//           by their short names.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path IS the module; here it shares the SUT's namespace.
// ```
package dev.monochromatic.musicplayer

// What:     `import dev.monochromatic.musicplayer.core.Session` imports the persistable
//           "where the user left off" model from the `.core` sub-package (a different package, so
//           it must be imported).
// Why:      The controller's `applySettings`/`finishLoad` take a `Session`, and the tests build
//           saved sessions to feed them.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Session } from "./core/Session";
// ```
import dev.monochromatic.musicplayer.core.Session

// What:     `import dev.monochromatic.musicplayer.core.ShuffleMode` imports the three-value
//           shuffle enum from `.core`.
// Why:      The settings-survival test sets and asserts shuffle modes.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ShuffleMode } from "./core/ShuffleMode";
// ```
import dev.monochromatic.musicplayer.core.ShuffleMode

// What:     `import org.junit.Assert.assertEquals` imports the static `assertEquals(expected, actual)`
//           value-equality assertion from JUnit 4.
// Why:      Most assertions below compare an expected value to an actual one.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertEquals } from "@junit/assert";
// ```
import org.junit.Assert.assertEquals

// What:     `import org.junit.Assert.assertFalse` imports the static `assertFalse(condition)`
//           assertion (fails unless the `Boolean` is false).
// Why:      The "loading flag cleared" assertions need it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertFalse } from "@junit/assert";
// ```
import org.junit.Assert.assertFalse

// What:     `import org.junit.Assert.assertTrue` imports the static `assertTrue(condition)`
//           assertion (fails unless the `Boolean` is true).
// Why:      The "loading flag set after beginLoad" assertion needs it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertTrue } from "@junit/assert";
// ```
import org.junit.Assert.assertTrue

// What:     `import org.junit.Assert.assertNull` imports the static `assertNull(value)` assertion
//           (fails unless the value is null).
// Why:      The "no selection" assertions need it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertNull } from "@junit/assert";
// ```
import org.junit.Assert.assertNull

// What:     `import org.junit.Test` imports the `Test` ANNOTATION class used as the `@Test`
//           marker on each test method.
// Why:      The runner discovers and runs every `@Test`-marked method.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from "vitest";
// ```
import org.junit.Test

// =============================================================================
// File summary (for a TypeScript-only reader)
// =============================================================================
//
// Host-JVM unit tests for `PlayerController`'s streaming-load behaviour, using
// `FakeAudioEngine` as a stand-in for the real engine. `PlayerController` is not
// in the pure `core` package and uses Compose snapshot state (`mutableStateOf`),
// but snapshot get/set work outside a composition, so each test drives the
// controller and reads back `uiState` (and `currentSession()`) after each call.
//
// The cases mirror the ordering-sensitive guarantees the streaming plan relies
// on: `finishLoad` keeps a mid-load tap, reselects the saved track when there is
// no tap, does not re-stamp settings the user changed during the load, clears
// the selection when the saved track vanished, and clears the loading flag on an
// empty terminal; a streaming batch preserves a tapped selection by URI across
// growth; and the viewed page is preserved by label while streaming.

// What:     `class PlayerControllerTest { ... }` declares a JUnit 4 test class the runner
//           instantiates to invoke each `@Test` method.
// Why:      Groups the controller's streaming-load tests.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("PlayerController streaming", () => { /* ...tests... */ });
// ```
class PlayerControllerTest {
    // What:     `private fun track(uri: String, path: String): Track = Track(uri = uri, displayPath = path)`
    //           declares a small private helper, expression body, that builds a `Track` from a URI
    //           and a display path. `Track(...)` is the constructor (no `new`); the `name = value`
    //           pairs are named arguments.
    // Why:      The tests build many tracks; a one-liner keeps each case readable.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const track = (uri: string, path: string): Track => ({ uri, displayPath: path });
    // ```
    private fun track(uri: String, path: String): Track = Track(uri = uri, displayPath = path)

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `finishLoadKeepsAMidLoadTap` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("finishLoad keeps a mid-load tap", () => {
    // ```
    @Test
    // What:     `fun finishLoadKeepsAMidLoadTap() { ... }` declares a no-arg `Unit`-returning test
    //           method, block body.
    // Why:      Pins that a track tapped while the library was still streaming survives `finishLoad`
    //           (kept by URI) and reports the kept-tap path, instead of being overridden by the
    //           saved track.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions... *\/ }
    // ```
    fun finishLoadKeepsAMidLoadTap() {
        // What:     `val controller = PlayerController(FakeAudioEngine())` constructs the controller
        //           under test with a fresh fake engine. `PlayerController(...)` and
        //           `FakeAudioEngine()` are constructors (no `new`).
        // Why:      Each test gets an isolated controller + engine.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const controller = new PlayerController(new FakeAudioEngine());
        // ```
        val controller = PlayerController(FakeAudioEngine())
        // What:     `controller.applySettings(Session())` applies an EMPTY saved session (all
        //           defaults: nothing selected). `Session()` is the constructor using every default.
        // Why:      Mirror the cold-start order: settings applied before the load (here, defaults).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.applySettings(makeSession());
        // ```
        controller.applySettings(Session())
        // What:     `controller.beginLoad()` marks the load in progress (sets the loading flag and
        //           repaints).
        // Why:      Mirror the cold-start order before any batch arrives.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.beginLoad();
        // ```
        controller.beginLoad()
        // What:     `controller.reconcileLibrary(listOf(track("u1", "a.mp3")))` delivers the first
        //           streaming batch (one track). `listOf(...)` builds a read-only `List<Track>`.
        // Why:      Make the list interactive with one row present, as streaming does.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.reconcileLibrary([track("u1", "a.mp3")]);
        // ```
        controller.reconcileLibrary(listOf(track("u1", "a.mp3")))
        // What:     `controller.playIndex(0)` taps the row at load-order index 0 (the only row),
        //           which loads and plays it and sets the controller's loaded URI.
        // Why:      Simulate the user tapping a track while the library is still streaming.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.playIndex(0);
        // ```
        controller.playIndex(0)
        // What:     `val result = controller.finishLoad(listOf(track("u1", "a.mp3"), track("u2", "b.mp3")), Session())`
        //           runs the terminal step with the full two-track list and an empty saved session,
        //           capturing the returned `FinishLoadResult`.
        // Why:      Finish the streamed load after a mid-load tap.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const result = controller.finishLoad([track("u1","a.mp3"), track("u2","b.mp3")], makeSession());
        // ```
        val result = controller.finishLoad(listOf(track("u1", "a.mp3"), track("u2", "b.mp3")), Session())
        // What:     `assertEquals(FinishLoadResult.KeptUserSelectionDuringLoad, result)` asserts the
        //           kept-tap path ran. `FinishLoadResult.KeptUserSelectionDuringLoad` reads a named
        //           enum constant.
        // Why:      The tap must win over the (empty) saved selection.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(result).toEqual("KeptUserSelectionDuringLoad");
        // ```
        assertEquals(FinishLoadResult.KeptUserSelectionDuringLoad, result)
        // What:     `assertEquals("u1", controller.currentSession().selected)` asserts the current
        //           selection is still the tapped track's URI. `currentSession().selected` is the
        //           current track's URI (or null).
        // Why:      The tapped track must remain selected after the full list is adopted.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.currentSession().selected).toEqual("u1");
        // ```
        assertEquals("u1", controller.currentSession().selected)
        // What:     `assertFalse(controller.uiState.loading)` asserts the loading flag is cleared.
        // Why:      `finishLoad` clears loading on the kept-tap path (reconcileLibrary does not).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.uiState.loading).toBe(false);
        // ```
        assertFalse(controller.uiState.loading)
    }

    // What:     `@Test` annotation marking the next method (metadata only).
    // Why:      Registers `finishLoadReselectsTheSavedTrackWhenNoTap` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("finishLoad reselects the saved track when no tap", () => {
    // ```
    @Test
    // What:     `fun finishLoadReselectsTheSavedTrackWhenNoTap() { ... }` declares a no-arg test.
    // Why:      Pins that with no mid-load tap, `finishLoad` reselects the saved track by URI and
    //           seeks to the saved position, reporting the restore path.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions... *\/ }
    // ```
    fun finishLoadReselectsTheSavedTrackWhenNoTap() {
        // What:     `val engine = FakeAudioEngine()` keeps a reference to the fake so the test can
        //           inspect the seek it recorded.
        // Why:      We assert on `engine.lastSeek` below.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const engine = new FakeAudioEngine();
        // ```
        val engine = FakeAudioEngine()
        // What:     `val controller = PlayerController(engine)` wires the controller to that engine.
        // Why:      Drive the controller while watching the engine.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const controller = new PlayerController(engine);
        // ```
        val controller = PlayerController(engine)
        // What:     `val saved = Session(selected = "u2", positionSecs = 42.0)` builds a saved session
        //           naming track `u2` at 42 seconds (other fields default). `42.0` is a `Double`.
        // Why:      The restore must reselect `u2` and seek to 42s.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const saved = makeSession({ selected: "u2", positionSecs: 42.0 });
        // ```
        val saved = Session(selected = "u2", positionSecs = 42.0)
        // What:     `controller.applySettings(saved)` then `controller.beginLoad()` mirror the
        //           cold-start order.
        // Why:      Apply settings early, then begin loading.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.applySettings(saved); controller.beginLoad();
        // ```
        controller.applySettings(saved)
        controller.beginLoad()
        // What:     `val result = controller.finishLoad(listOf(track("u1","a.mp3"), track("u2","b.mp3"), track("u3","c.mp3")), saved)`
        //           finishes with a three-track full list and the saved session, with NO tap.
        // Why:      Exercise the no-tap restore path.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const result = controller.finishLoad([track("u1","a.mp3"), track("u2","b.mp3"), track("u3","c.mp3")], saved);
        // ```
        val result = controller.finishLoad(
            listOf(track("u1", "a.mp3"), track("u2", "b.mp3"), track("u3", "c.mp3")),
            saved,
        )
        // What:     `assertEquals(FinishLoadResult.RestoredSavedSession, result)` asserts the restore
        //           path ran.
        // Why:      No tap means the saved track is reselected.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(result).toEqual("RestoredSavedSession");
        // ```
        assertEquals(FinishLoadResult.RestoredSavedSession, result)
        // What:     `assertEquals("u2", controller.currentSession().selected)` asserts the saved
        //           track became current.
        // Why:      The saved selection must be restored by URI.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.currentSession().selected).toEqual("u2");
        // ```
        assertEquals("u2", controller.currentSession().selected)
        // What:     `assertEquals(42.0, engine.lastSeek)` asserts the engine was seeked to the saved
        //           position. The actual `engine.lastSeek` is a nullable `Double?`; comparing it to
        //           the `Double` `42.0` uses the `assertEquals(Object, Object)` overload (both boxed).
        // Why:      The restore must issue the saved-position seek.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(engine.lastSeek).toEqual(42.0);
        // ```
        assertEquals(42.0, engine.lastSeek)
        // What:     `assertFalse(controller.uiState.loading)` asserts the loading flag is cleared.
        // Why:      `restoreSelectedTrack` clears loading on delivery.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.uiState.loading).toBe(false);
        // ```
        assertFalse(controller.uiState.loading)
    }

    // What:     `@Test` annotation marking the next method (metadata only).
    // Why:      Registers `finishLoadRestorePathDoesNotReapplySettings` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("finishLoad restore path does not reapply settings", () => {
    // ```
    @Test
    // What:     `fun finishLoadRestorePathDoesNotReapplySettings() { ... }` declares a no-arg test.
    // Why:      Pins that a setting changed AFTER `applySettings` (during the load) survives the
    //           terminal restore, which must not re-stamp the saved settings.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions... *\/ }
    // ```
    fun finishLoadRestorePathDoesNotReapplySettings() {
        // What:     `val controller = PlayerController(FakeAudioEngine())` constructs the controller.
        // Why:      Isolated controller for this case.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const controller = new PlayerController(new FakeAudioEngine());
        // ```
        val controller = PlayerController(FakeAudioEngine())
        // What:     `val saved = Session(selected = "u1", shuffle = ShuffleMode.OFF, volume = 0.3f)`
        //           builds a saved session with shuffle OFF and volume 0.3 (a `Float`, the `f`
        //           suffix). `ShuffleMode.OFF` reads a named enum constant.
        // Why:      Establish the saved baseline the user will override mid-load.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const saved = makeSession({ selected: "u1", shuffle: "Off", volume: 0.3 });
        // ```
        val saved = Session(selected = "u1", shuffle = ShuffleMode.OFF, volume = 0.3f)
        // What:     `controller.applySettings(saved)` then `controller.beginLoad()` apply the saved
        //           settings early, then begin loading.
        // Why:      The saved settings become the baseline.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.applySettings(saved); controller.beginLoad();
        // ```
        controller.applySettings(saved)
        controller.beginLoad()
        // What:     `controller.setShuffle(ShuffleMode.ALL)` then `controller.setVolume(0.9f)` change
        //           the settings mid-load, as a user could while the controls are live.
        // Why:      These changes must survive the terminal restore.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.setShuffle("All"); controller.setVolume(0.9);
        // ```
        controller.setShuffle(ShuffleMode.ALL)
        controller.setVolume(0.9f)
        // What:     `controller.finishLoad(listOf(track("u1","a.mp3"), track("u2","b.mp3")), saved)`
        //           finishes the load (no tap), which reselects `u1` but must NOT re-stamp settings.
        // Why:      Run the terminal restore over the mid-load changes.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.finishLoad([track("u1","a.mp3"), track("u2","b.mp3")], saved);
        // ```
        controller.finishLoad(listOf(track("u1", "a.mp3"), track("u2", "b.mp3")), saved)
        // What:     `assertEquals(ShuffleMode.ALL, controller.uiState.shuffle)` asserts the mid-load
        //           shuffle change survived (not reset to the saved OFF).
        // Why:      The restore must not undo a mid-load setting change.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.uiState.shuffle).toEqual("All");
        // ```
        assertEquals(ShuffleMode.ALL, controller.uiState.shuffle)
        // What:     `assertEquals(0.9f, controller.uiState.volume)` asserts the mid-load volume change
        //           survived (not reset to the saved 0.3). Both are `Float`.
        // Why:      Volume changed mid-load leaves no settings re-stamp, so it must persist.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.uiState.volume).toEqual(0.9);
        // ```
        assertEquals(0.9f, controller.uiState.volume)
    }

    // What:     `@Test` annotation marking the next method (metadata only).
    // Why:      Registers `finishLoadWithAVanishedSavedTrackClearsTheSelection` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("finishLoad with a vanished saved track clears the selection", () => {
    // ```
    @Test
    // What:     `fun finishLoadWithAVanishedSavedTrackClearsTheSelection() { ... }` declares a no-arg
    //           test.
    // Why:      Pins the restore auto-correction: a saved track absent from the scan leaves nothing
    //           selected, not a dangling selection.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions... *\/ }
    // ```
    fun finishLoadWithAVanishedSavedTrackClearsTheSelection() {
        // What:     `val controller = PlayerController(FakeAudioEngine())` constructs the controller.
        // Why:      Isolated controller.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const controller = new PlayerController(new FakeAudioEngine());
        // ```
        val controller = PlayerController(FakeAudioEngine())
        // What:     `val saved = Session(selected = "u-gone")` names a track that the scan will NOT
        //           contain.
        // Why:      Model a track deleted since the last run.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const saved = makeSession({ selected: "u-gone" });
        // ```
        val saved = Session(selected = "u-gone")
        // What:     `controller.applySettings(saved)` then `controller.beginLoad()` mirror the order.
        // Why:      Apply settings early, then begin loading.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.applySettings(saved); controller.beginLoad();
        // ```
        controller.applySettings(saved)
        controller.beginLoad()
        // What:     `val result = controller.finishLoad(listOf(track("u1", "a.mp3")), saved)` finishes
        //           with a list that lacks `u-gone`.
        // Why:      Exercise the vanished-track branch.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const result = controller.finishLoad([track("u1","a.mp3")], saved);
        // ```
        val result = controller.finishLoad(listOf(track("u1", "a.mp3")), saved)
        // What:     `assertEquals(FinishLoadResult.RestoredSavedSession, result)` asserts the restore
        //           path ran (it is still the no-tap path, it just found nothing).
        // Why:      A vanished track is handled on the restore path.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(result).toEqual("RestoredSavedSession");
        // ```
        assertEquals(FinishLoadResult.RestoredSavedSession, result)
        // What:     `assertNull(controller.currentSession().selected)` asserts nothing is selected.
        // Why:      The vanished saved track must leave the selection empty.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.currentSession().selected).toBeNull();
        // ```
        assertNull(controller.currentSession().selected)
        // What:     `assertFalse(controller.uiState.loading)` asserts loading is cleared.
        // Why:      Delivery clears loading even when nothing was reselected.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.uiState.loading).toBe(false);
        // ```
        assertFalse(controller.uiState.loading)
    }

    // What:     `@Test` annotation marking the next method (metadata only).
    // Why:      Registers `finishLoadOnAnEmptyTerminalClearsLoading` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("finishLoad on an empty terminal clears loading", () => {
    // ```
    @Test
    // What:     `fun finishLoadOnAnEmptyTerminalClearsLoading() { ... }` declares a no-arg test.
    // Why:      Pins that an empty library finishes with the spinner cleared (so the screen shows
    //           "no music" rather than a stuck spinner).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions... *\/ }
    // ```
    fun finishLoadOnAnEmptyTerminalClearsLoading() {
        // What:     `val controller = PlayerController(FakeAudioEngine())` constructs the controller.
        // Why:      Isolated controller.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const controller = new PlayerController(new FakeAudioEngine());
        // ```
        val controller = PlayerController(FakeAudioEngine())
        // What:     `controller.applySettings(Session())` then `controller.beginLoad()` set up the
        //           loading state.
        // Why:      Begin a load so the loading flag is true before finishing.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.applySettings(makeSession()); controller.beginLoad();
        // ```
        controller.applySettings(Session())
        controller.beginLoad()
        // What:     `assertTrue(controller.uiState.loading)` asserts the loading flag is set after
        //           `beginLoad`.
        // Why:      Establish the precondition we expect `finishLoad` to clear.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.uiState.loading).toBe(true);
        // ```
        assertTrue(controller.uiState.loading)
        // What:     `val result = controller.finishLoad(emptyList(), Session())` finishes with an
        //           EMPTY list. `emptyList()` returns a shared empty `List<Track>` (element type
        //           inferred from the parameter).
        // Why:      Exercise the empty-library terminal.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const result = controller.finishLoad([], makeSession());
        // ```
        val result = controller.finishLoad(emptyList(), Session())
        // What:     `assertEquals(FinishLoadResult.RestoredSavedSession, result)` asserts the no-tap
        //           path ran.
        // Why:      An empty terminal with no tap is the restore path (which found nothing).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(result).toEqual("RestoredSavedSession");
        // ```
        assertEquals(FinishLoadResult.RestoredSavedSession, result)
        // What:     `assertFalse(controller.uiState.loading)` asserts the spinner is cleared.
        // Why:      An empty library must not be stuck on the spinner.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.uiState.loading).toBe(false);
        // ```
        assertFalse(controller.uiState.loading)
        // What:     `assertEquals(0, controller.uiState.queueSize)` asserts the queue is empty. `0`
        //           is an `Int` literal, matching the `Int` `queueSize`.
        // Why:      Confirm the empty terminal really left no tracks.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.uiState.queueSize).toEqual(0);
        // ```
        assertEquals(0, controller.uiState.queueSize)
    }

    // What:     `@Test` annotation marking the next method (metadata only).
    // Why:      Registers `aStreamingBatchPreservesATappedSelectionByUri` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("a streaming batch preserves a tapped selection by URI", () => {
    // ```
    @Test
    // What:     `fun aStreamingBatchPreservesATappedSelectionByUri() { ... }` declares a no-arg test.
    // Why:      Pins that once a track is tapped mid-load, a later, larger batch (where that track
    //           sits at a different index) keeps it selected by URI.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions... *\/ }
    // ```
    fun aStreamingBatchPreservesATappedSelectionByUri() {
        // What:     `val controller = PlayerController(FakeAudioEngine())` constructs the controller.
        // Why:      Isolated controller.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const controller = new PlayerController(new FakeAudioEngine());
        // ```
        val controller = PlayerController(FakeAudioEngine())
        // What:     `controller.applySettings(Session())` then `controller.beginLoad()` set up the
        //           streaming load.
        // Why:      Mirror the cold-start order.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.applySettings(makeSession()); controller.beginLoad();
        // ```
        controller.applySettings(Session())
        controller.beginLoad()
        // What:     `controller.reconcileLibrary(listOf(track("u1","a.mp3"), track("u2","b.mp3")))`
        //           delivers the first batch (two tracks).
        // Why:      Make `u1` tappable.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.reconcileLibrary([track("u1","a.mp3"), track("u2","b.mp3")]);
        // ```
        controller.reconcileLibrary(listOf(track("u1", "a.mp3"), track("u2", "b.mp3")))
        // What:     `controller.playIndex(0)` taps `u1` (load-order index 0).
        // Why:      Select `u1` mid-load.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.playIndex(0);
        // ```
        controller.playIndex(0)
        // What:     `assertEquals("u1", controller.currentSession().selected)` asserts `u1` is the
        //           current selection right after the tap.
        // Why:      Establish the precondition before the next batch.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.currentSession().selected).toEqual("u1");
        // ```
        assertEquals("u1", controller.currentSession().selected)
        // What:     `controller.reconcileLibrary(listOf(track("u3","c.mp3"), track("u1","a.mp3"), track("u2","b.mp3")))`
        //           delivers a larger batch where `u1` now sits at load-order index 1.
        // Why:      Exercise growth that moves the tapped track's index.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.reconcileLibrary([track("u3","c.mp3"), track("u1","a.mp3"), track("u2","b.mp3")]);
        // ```
        controller.reconcileLibrary(listOf(track("u3", "c.mp3"), track("u1", "a.mp3"), track("u2", "b.mp3")))
        // What:     `assertEquals("u1", controller.currentSession().selected)` asserts `u1` is STILL
        //           selected after the growth.
        // Why:      The tapped track is preserved by URI, not by its shifting index.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.currentSession().selected).toEqual("u1");
        // ```
        assertEquals("u1", controller.currentSession().selected)
    }

    // What:     `@Test` annotation marking the next method (metadata only).
    // Why:      Registers `streamingPreservesTheViewedPageByLabel` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("streaming preserves the viewed page by label", () => {
    // ```
    @Test
    // What:     `fun streamingPreservesTheViewedPageByLabel() { ... }` declares a no-arg test.
    // Why:      Pins that while streaming with nothing selected, an inserted earlier-sorting folder
    //           does not jump the viewed tab: it is re-resolved by label, not by numeric index.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions... *\/ }
    // ```
    fun streamingPreservesTheViewedPageByLabel() {
        // What:     `val controller = PlayerController(FakeAudioEngine())` constructs the controller.
        // Why:      Isolated controller.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const controller = new PlayerController(new FakeAudioEngine());
        // ```
        val controller = PlayerController(FakeAudioEngine())
        // What:     `controller.applySettings(Session())` then `controller.beginLoad()` set up the
        //           streaming load.
        // Why:      Mirror the cold-start order.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.applySettings(makeSession()); controller.beginLoad();
        // ```
        controller.applySettings(Session())
        controller.beginLoad()
        // What:     `controller.reconcileLibrary(listOf(track("u-bruno","Bruno/x.mp3"), track("u-charon","Charon/a.mp3")))`
        //           delivers a first batch with two top-level folders, so pagination yields two
        //           folder pages labelled "Bruno" and "Charon".
        // Why:      Set up a viewable folder tab that a later batch will shift.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.reconcileLibrary([track("u-bruno","Bruno/x.mp3"), track("u-charon","Charon/a.mp3")]);
        // ```
        controller.reconcileLibrary(listOf(track("u-bruno", "Bruno/x.mp3"), track("u-charon", "Charon/a.mp3")))
        // What:     `val charonIndex = controller.uiState.pageLabels.indexOf("Charon")` finds the tab
        //           index of the "Charon" page. `.indexOf(x)` returns the first matching index or -1.
        // Why:      We need that index to select the Charon tab.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const charonIndex = controller.uiState.pageLabels.indexOf("Charon");
        // ```
        val charonIndex = controller.uiState.pageLabels.indexOf("Charon")
        // What:     `controller.selectPage(charonIndex)` switches the viewed tab to "Charon".
        // Why:      Make "Charon" the page the user is looking at.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.selectPage(charonIndex);
        // ```
        controller.selectPage(charonIndex)
        // What:     `assertEquals("Charon", controller.uiState.pageLabels[controller.uiState.selectedPage])`
        //           asserts the selected tab's label is "Charon". The `[i]` indexes the labels list at
        //           the selected page.
        // Why:      Establish the precondition: we are viewing "Charon".
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.uiState.pageLabels[controller.uiState.selectedPage]).toEqual("Charon");
        // ```
        assertEquals("Charon", controller.uiState.pageLabels[controller.uiState.selectedPage])
        // What:     `controller.reconcileLibrary(listOf(track("u-ado","Ado/b.mp3"), track("u-bruno","Bruno/x.mp3"), track("u-charon","Charon/a.mp3")))`
        //           delivers a later batch that ADDS an earlier-sorting "Ado" folder, so "Charon"
        //           shifts to a higher index.
        // Why:      Exercise the re-pagination that would jump a numeric-index-based tab.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // controller.reconcileLibrary([track("u-ado","Ado/b.mp3"), track("u-bruno","Bruno/x.mp3"), track("u-charon","Charon/a.mp3")]);
        // ```
        controller.reconcileLibrary(
            listOf(
                track("u-ado", "Ado/b.mp3"),
                track("u-bruno", "Bruno/x.mp3"),
                track("u-charon", "Charon/a.mp3"),
            ),
        )
        // What:     `assertEquals("Charon", controller.uiState.pageLabels[controller.uiState.selectedPage])`
        //           asserts the viewed tab is STILL "Charon" after the shift.
        // Why:      The viewed page is preserved by label, so the inserted "Ado" did not jump the tab.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(controller.uiState.pageLabels[controller.uiState.selectedPage]).toEqual("Charon");
        // ```
        assertEquals("Charon", controller.uiState.pageLabels[controller.uiState.selectedPage])
    }
}
