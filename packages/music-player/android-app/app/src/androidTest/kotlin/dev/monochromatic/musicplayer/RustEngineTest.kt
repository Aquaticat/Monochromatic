// File summary (folds in the old class KDoc's domain content):
//
// This file is an on-device instrumentation test for the full-Rust audio engine. It runs on a real
// GrapheneOS phone (not on the JVM on your laptop), wired up by Android's instrumentation harness, and
// drives the native playback stack end to end through the Kotlin/JNI boundary the real app uses.
//
// Two tests live here:
//   1. `playsPausesSeeksThroughRustEngine` loads a real `content://` MediaStore track straight into a
//      `RustEngine`, plays it, pauses it, seeks it, and asserts position advances while playing, freezes
//      while paused, and jumps after a seek, and that duration was read. It exercises the whole native
//      stack the variant exists to measure: fd dup -> symphonia/libopus decode -> single-producer
//      single-consumer ring buffer -> AAudio output -> position counter.
//   2. `autoAdvancesOnceOnNaturalEnd` drives the production `PlayerController` (the layer above the raw
//      engine) over a `RustEngine`, seeks to just before a track's end, and asserts the controller
//      advances to exactly the next track once (not twice) when the track ends naturally.
//
// Resident-noise rule: the engine's volume is set to 0 before playing, so the AAudio output stream
// genuinely runs (the output path is exercised) but emits pure silence; nothing is audible and no
// Android MediaSession is involved, so no media session ever reports the PLAYING state. The engine is
// created and driven on the Android main thread (via `runOnMainSync`) so the engine and its internal
// poller stay single-threaded; the `Thread.sleep` calls run on the separate test thread so the main
// looper keeps ticking. The test needs the READ_MEDIA_AUDIO permission (granted out-of-band via
// `adb shell pm grant`) and skips itself when no music library is indexed on the device.

// What:     `package dev.monochromatic.musicplayer` declares which package (a namespace, i.e. a named
//           grouping that controls naming and visibility) this file's top-level `class` belongs to. The
//           dotted name must match the directory path on disk under the source root.
// Why:      Other files in the same package can refer to this test's class and to siblings like
//           `RustEngine`, `PlayerController`, and `Track` without an explicit `import`; tooling also uses
//           the package to place the compiled class.
//
// In TS you'd write (pseudocode):
// ```ts
// // No 1:1 equivalent — TS infers a module from the file path; nothing is written at the top.
// // Mentally: `namespace dev.monochromatic.musicplayer { ... }`
// ```
package dev.monochromatic.musicplayer

// What:     `import android.app.Instrumentation` pulls the `Instrumentation` type (Android's test
//           harness object that can talk to the app process and the device) into scope so we can name it
//           below without writing its full `android.app.Instrumentation` path.
// Why:      Several functions below take an `Instrumentation` parameter; the import lets us write the
//           short name `Instrumentation`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Instrumentation } from "android/app";
// ```
import android.app.Instrumentation

// What:     `import android.content.ContentUris` pulls in the `ContentUris` helper object (a class of
//           static-style utility functions for building `content://` URIs that point at a row by id).
// Why:      `audioUris` below calls `ContentUris.withAppendedId(...)` to turn a numeric MediaStore id
//           into a full content URI.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ContentUris } from "android/content";
// ```
import android.content.ContentUris

// What:     `import android.net.Uri` pulls in the `Uri` type (Android's parsed representation of a URI
//           string such as `content://media/external/audio/media/42`).
// Why:      The track locations we load are `Uri` values; `audioUris` returns a list of them.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Uri } from "android/net";
// ```
import android.net.Uri

// What:     `import android.provider.MediaStore` pulls in `MediaStore`, the Android system database of
//           indexed media (the on-device catalog of audio/video/images the OS has scanned).
// Why:      `audioUris` queries `MediaStore.Audio.Media` to find playable music tracks.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MediaStore } from "android/provider";
// ```
import android.provider.MediaStore

// What:     `import android.util.Log` pulls in `Log`, Android's logcat logging facility (writes lines to
//           the device's system log, viewable with `adb logcat`).
// Why:      The tests log measured positions/durations under a tag so a human can read them after the run.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Log } from "android/util";
// ```
import android.util.Log

// What:     `import androidx.test.platform.app.InstrumentationRegistry` pulls in `InstrumentationRegistry`,
//           a registry object the test framework populates with the running `Instrumentation` instance.
// Why:      Each test calls `InstrumentationRegistry.getInstrumentation()` to obtain the harness it needs.
//
// In TS you'd write (pseudocode):
// ```ts
// import { InstrumentationRegistry } from "androidx/test/platform/app";
// ```
import androidx.test.platform.app.InstrumentationRegistry

// What:     `import org.junit.Assert.assertTrue` imports a single member function `assertTrue` (not a
//           whole class) out of JUnit's `Assert` class, so it can be called bare as `assertTrue(...)`.
//           `assertTrue` fails the test if the boolean argument is false.
// Why:      The first test asserts several boolean conditions; importing the function lets us write
//           `assertTrue(...)` without the `Assert.` prefix.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertTrue } from "org/junit/Assert";
// ```
import org.junit.Assert.assertTrue

// What:     `import org.junit.Assume.assumeTrue` imports the member function `assumeTrue` from JUnit's
//           `Assume` class. `assumeTrue` does NOT fail the test when its condition is false; it marks the
//           test as skipped (assumption-not-met) so an environment that can't run it is not a failure.
// Why:      The tests skip themselves when the device has no indexed music; `assumeTrue` expresses that.
// Gotcha:   `assumeTrue` and `assertTrue` look almost identical but behave oppositely on false: assume =
//           skip, assert = fail. Don't confuse them.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assumeTrue } from "org/junit/Assume";
// ```
import org.junit.Assume.assumeTrue

// What:     `import org.junit.Test` imports the `Test` annotation type (a marker you attach with `@Test`
//           to tell the test runner "this method is a test case to execute").
// Why:      The two test methods below are tagged `@Test`; the import lets us write `@Test`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Test } from "org/junit";
// ```
import org.junit.Test

// What:     `import java.util.concurrent.atomic.AtomicReference` pulls in `AtomicReference<T>`, a thread-
//           safe single-slot holder: a box around one value of type `T` whose reads and writes are safe to
//           perform from different threads without extra locking.
// Why:      Engine objects are created on the main thread but read from the test thread; an
//           `AtomicReference` is a safe hand-off box between those two threads. It is also used inside
//           `onMain` to ferry a block's result back across the thread boundary.
//
// In TS you'd write (pseudocode):
// ```ts
// import { AtomicReference } from "java/util/concurrent/atomic";
// // Mentally: a `{ get(): T; set(v: T): void }` box that's safe to touch from two threads.
// ```
import java.util.concurrent.atomic.AtomicReference

// What:     `class RustEngineTest { ... }` declares a class named `RustEngineTest`. In JUnit, a test
//           class is a plain container; the runner instantiates it and calls each method tagged `@Test`.
// Why:      Groups the two on-device test methods plus the private helpers and shared constants they use.
//           This is the entry point the Android instrumentation runner discovers and runs on the device.
//
// In TS you'd write (pseudocode):
// ```ts
// class RustEngineTest {
//   // ...test methods and helpers...
// }
// ```
class RustEngineTest {
    // What:     `@Test` is an annotation (a compile-time marker attached to the next declaration) telling
    //           the JUnit runner "treat the following method as a test case to execute".
    // Why:      Without `@Test` the runner would ignore `playsPausesSeeksThroughRustEngine` entirely.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // @Test
    // ```
    @Test
    // What:     `fun playsPausesSeeksThroughRustEngine() { ... }` declares a method (a function that lives
    //           on the class) named `playsPausesSeeksThroughRustEngine`, taking no parameters and
    //           returning nothing (`Unit`, Kotlin's "no meaningful value" type, is implied).
    // Why:      This is the first test body: load a track into a bare `RustEngine`, play/pause/seek it, and
    //           assert position behaves correctly.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // playsPausesSeeksThroughRustEngine(): void {
    //   // ...
    // }
    // ```
    fun playsPausesSeeksThroughRustEngine() {
        // What:     `val instrumentation = InstrumentationRegistry.getInstrumentation()` declares an
        //           immutable local (`val` = cannot be reassigned) and calls the registry's
        //           `getInstrumentation()` to fetch the running harness object. Type is inferred as
        //           `Instrumentation`.
        // Why:      Everything below (the content resolver, running code on the main thread) flows through
        //           this `Instrumentation` handle.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const instrumentation = InstrumentationRegistry.getInstrumentation();
        // ```
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        // What:     `val context = instrumentation.targetContext` reads the `targetContext` property: the
        //           Android `Context` of the app under test (the object you ask for system services, the
        //           content resolver, resources, etc.). Immutable local, inferred type `Context`.
        // Why:      We need the app's context to reach its content resolver and to construct a `RustEngine`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const context = instrumentation.targetContext;
        // ```
        val context = instrumentation.targetContext
        // What:     `val uri: Uri? = audioUris(instrumentation, 1).firstOrNull()`. The explicit type
        //           annotation `Uri?` is a NULLABLE `Uri`: the trailing `?` makes "no value" (`null`) a
        //           legal value of the type. (Sibling: a plain `Uri` with no `?` can never be null.)
        //           `audioUris(...)` returns a `List<Uri>`; `.firstOrNull()` returns the first element, or
        //           `null` if the list is empty (rather than throwing on an empty list).
        // Why:      Grab one playable track; if the library is empty, `firstOrNull()` yields `null` and the
        //           next line skips the test instead of crashing.
        // Gotcha:   `Uri?` is enforced by the compiler: you cannot call most methods on `uri` until you've
        //           proven it's non-null (the `assumeTrue` below does that proof).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const uri: Uri | null = audioUris(instrumentation, 1)[0] ?? null;
        // ```
        val uri: Uri? = audioUris(instrumentation, 1).firstOrNull()
        // What:     `assumeTrue("...", uri != null)` checks the condition `uri != null`. If it's false,
        //           JUnit SKIPS this test (marks it as assumption-not-met) with the given message, rather
        //           than failing it. After this line the compiler also knows `uri` is non-null below.
        // Why:      A device with no indexed music can't run this test; skipping (not failing) is correct.
        //           It also smart-casts `uri` from `Uri?` to `Uri` for the rest of the method.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (uri == null) { return markSkipped("no indexed MediaStore audio (grant READ_MEDIA_AUDIO)"); }
        // ```
        assumeTrue("no indexed MediaStore audio (grant READ_MEDIA_AUDIO)", uri != null)

        // What:     `val engineRef = AtomicReference<RustEngine>()`. `AtomicReference<RustEngine>` is the
        //           generic type (one type parameter, `<RustEngine>`, the kind of value the box holds);
        //           `()` calls its no-arg constructor, producing an empty box (its slot starts as `null`).
        // Why:      The `RustEngine` is built on the main thread but read on the test thread; this thread-
        //           safe box hands it across that boundary.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const engineRef = new AtomicReference<RustEngine>();
        // ```
        val engineRef = AtomicReference<RustEngine>()
        // What:     `instrumentation.runOnMainSync { ... }` runs the trailing lambda (the `{ ... }` block,
        //           Kotlin's anonymous function) on Android's main/UI thread and blocks the caller until it
        //           finishes (`Sync`). When a lambda is the last argument, Kotlin lets you write it outside
        //           the parentheses as a trailing block.
        // Why:      The native engine must be created and touched on one thread; the main thread is that
        //           thread, so we build and prime the engine there.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // instrumentation.runOnMainSync(() => {
        //   // ...build and prime engine...
        // });
        // ```
        instrumentation.runOnMainSync {
            // What:     `val engine = RustEngine(context)` constructs a `RustEngine`, passing the app
            //           `context`. In Kotlin you call a constructor like a plain function (no `new`).
            // Why:      This is the object under test; it owns the native playback handle.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const engine = new RustEngine(context);
            // ```
            val engine = RustEngine(context)
            // What:     `engine.setVolume(0.0f)` calls `setVolume` with the float literal `0.0f`. The
            //           trailing `f` makes this a 32-bit `Float` (single precision), NOT a 64-bit `Double`
            //           (double precision). Sibling: `0.0` with no suffix would be a `Double`.
            // Why:      Set volume to zero so the output runs silently (the resident-noise rule). `Float`
            //           (not `Double`) because the engine's volume API takes a 32-bit `Float`, matching the
            //           native/AAudio side; passing a `Double` would not type-check.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // engine.setVolume(0.0);
            // ```
            engine.setVolume(0.0f)
            // What:     `engine.load(uri.toString(), true)`. `uri.toString()` converts the `Uri` object to
            //           its `String` form (the textual `content://...` URI). `true` is a plain boolean
            //           literal (here meaning "play when ready", i.e. start playback once loaded).
            // Why:      The native loader takes a string URL plus a "begin playing immediately" flag; we
            //           hand it the track and tell it to play.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // engine.load(uri.toString(), true);
            // ```
            engine.load(uri.toString(), true)
            // What:     `engineRef.set(engine)` stores `engine` into the thread-safe box's single slot.
            //           `.set(...)` is the box's write method.
            // Why:      Publish the just-built engine so the test thread can later read it back out of the
            //           box.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // engineRef.set(engine);
            // ```
            engineRef.set(engine)
        }

        // What:     `Thread.sleep(SETTLE_MS)` blocks the CURRENT thread (the test thread, not the main
        //           thread) for `SETTLE_MS` milliseconds. `SETTLE_MS` is a `Long` constant defined in the
        //           companion object below.
        // Why:      Give the worker time to open the file, start AAudio, and let the position counter move,
        //           while the main looper keeps ticking on its own thread.
        // Gotcha:   This is a real blocking sleep, not a non-blocking `await`; it freezes only the test
        //           thread, which is why the engine's own thread must be separate.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // await wait(SETTLE_MS); // non-blocking timer; the Kotlin version truly blocks this thread
        // ```
        Thread.sleep(SETTLE_MS)
        // What:     `val positionPlaying: Double = onMain(instrumentation) { engineRef.get().positionSec() }`.
        //           The explicit type `Double` is a 64-bit double-precision float (sibling: 32-bit `Float`).
        //           `onMain(...) { ... }` is our helper that runs the trailing lambda on the main thread and
        //           returns its result. Inside, `engineRef.get()` reads the engine out of the box (`.get()`
        //           is the box's read method) and `.positionSec()` asks the engine for the current playback
        //           position in seconds.
        // Why:      Read the playback position while playing, on the main thread (the thread that owns the
        //           native handle). `Double` (not `Float`) because `positionSec()` returns a `Double`; using
        //           the wider type keeps seconds-with-fractions precise and matches the engine API.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const positionPlaying: number = onMain(instrumentation, () => engineRef.get().positionSec());
        // ```
        val positionPlaying: Double = onMain(instrumentation) { engineRef.get().positionSec() }
        // What:     `val duration: Double = onMain(instrumentation) { engineRef.get().durationSec() }`.
        //           Same shape as above: `Double` 64-bit float; `onMain` runs the lambda on the main thread;
        //           `engineRef.get()` reads the engine from the box; `.durationSec()` returns the track's
        //           total length in seconds.
        // Why:      Capture the track duration (used later to compute a mid-point seek target and to assert
        //           duration was read). `Double` to match the engine's `durationSec()` return type.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const duration: number = onMain(instrumentation, () => engineRef.get().durationSec());
        // ```
        val duration: Double = onMain(instrumentation) { engineRef.get().durationSec() }
        // What:     `val playWhenReady: Boolean = onMain(instrumentation) { engineRef.get().playWhenReady() }`.
        //           `Boolean` is the plain true/false type. `onMain` runs the lambda on the main thread;
        //           `engineRef.get()` reads the engine; `.playWhenReady()` returns whether the engine is set
        //           to play as soon as it's ready.
        // Why:      Confirm the engine actually entered the "play when ready" state after `load(..., true)`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const playWhenReady: boolean = onMain(instrumentation, () => engineRef.get().playWhenReady());
        // ```
        val playWhenReady: Boolean = onMain(instrumentation) { engineRef.get().playWhenReady() }
        // What:     `Log.i(BENCH_TAG, "RustEngine playing: pos=$positionPlaying dur=$duration playWhenReady=$playWhenReady")`.
        //           `Log.i` writes an info-level logcat line under `BENCH_TAG`. The string is a Kotlin
        //           template: `$positionPlaying`, `$duration`, `$playWhenReady` splice each variable's value
        //           into the text (the `$name` form, with no braces for a simple identifier).
        // Why:      Record the measured numbers so a human reading logcat can see what the device produced.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // Log.i(BENCH_TAG, `RustEngine playing: pos=${positionPlaying} dur=${duration} playWhenReady=${playWhenReady}`);
        // ```
        Log.i(BENCH_TAG, "RustEngine playing: pos=$positionPlaying dur=$duration playWhenReady=$playWhenReady")

        // What:     `instrumentation.runOnMainSync { engineRef.get().pause() }` runs the trailing lambda on
        //           the main thread and blocks until done. Inside, `engineRef.get()` reads the engine from
        //           the box and `.pause()` pauses playback.
        // Why:      Pause on the engine-owning thread so the next position samples should stay frozen.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // instrumentation.runOnMainSync(() => engineRef.get().pause());
        // ```
        instrumentation.runOnMainSync { engineRef.get().pause() }
        // What:     `Thread.sleep(STEP_MS)` blocks the test thread for `STEP_MS` milliseconds (a short
        //           dwell). `STEP_MS` is a `Long` constant in the companion object.
        // Why:      Wait a beat between the two paused samples so any unwanted drift would have time to show.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // await wait(STEP_MS);
        // ```
        Thread.sleep(STEP_MS)
        // What:     `val pausedA: Double = onMain(instrumentation) { engineRef.get().positionSec() }`.
        //           `Double` 64-bit float; `onMain` runs on the main thread; `engineRef.get()` reads the
        //           engine; `.positionSec()` returns the current position.
        // Why:      First paused-position sample; compared with the second to prove playback didn't advance.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const pausedA: number = onMain(instrumentation, () => engineRef.get().positionSec());
        // ```
        val pausedA: Double = onMain(instrumentation) { engineRef.get().positionSec() }
        // What:     `Thread.sleep(STEP_MS)` blocks the test thread again for the same short dwell.
        // Why:      Let real time pass between the two paused samples; a still-advancing position would grow.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // await wait(STEP_MS);
        // ```
        Thread.sleep(STEP_MS)
        // What:     `val pausedB: Double = onMain(instrumentation) { engineRef.get().positionSec() }`.
        //           Second paused sample, same shape as `pausedA`: `Double`; `onMain` on the main thread;
        //           `engineRef.get().positionSec()` reads position.
        // Why:      Second paused-position sample; `pausedB - pausedA` should be ~0 while truly paused.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const pausedB: number = onMain(instrumentation, () => engineRef.get().positionSec());
        // ```
        val pausedB: Double = onMain(instrumentation) { engineRef.get().positionSec() }
        // What:     `Log.i(BENCH_TAG, "RustEngine paused: a=$pausedA b=$pausedB")` logs the two paused
        //           samples; `$pausedA` / `$pausedB` splice their values into the string template.
        // Why:      Make the paused samples visible in logcat for after-the-fact inspection.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // Log.i(BENCH_TAG, `RustEngine paused: a=${pausedA} b=${pausedB}`);
        // ```
        Log.i(BENCH_TAG, "RustEngine paused: a=$pausedA b=$pausedB")

        // What:     `val seekTarget: Double = duration / 2.0`. `Double` 64-bit float; `2.0` is a `Double`
        //           literal (no `f` suffix), so `duration / 2.0` is plain double division yielding the
        //           midpoint of the track in seconds.
        // Why:      We seek to the middle so the post-seek position is clearly distinguishable from the
        //           starting position. `Double` to match `duration`'s type and keep fractional seconds.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const seekTarget: number = duration / 2.0;
        // ```
        val seekTarget: Double = duration / 2.0
        // What:     `val seekable: Boolean = duration > MIN_SEEKABLE_SECONDS`. `Boolean` true/false;
        //           compares the track's `duration` against the `MIN_SEEKABLE_SECONDS` `Double` constant.
        // Why:      Only seek-test tracks long enough that a mid-point seek is meaningful; very short tracks
        //           are skipped for the seek portion.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const seekable: boolean = duration > MIN_SEEKABLE_SECONDS;
        // ```
        val seekable: Boolean = duration > MIN_SEEKABLE_SECONDS
        // What:     `if (seekable) { ... }` is a plain conditional: run the block only when `seekable` is
        //           true.
        // Why:      Guard the seek/resume steps behind the "this track is long enough" check.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (seekable) { ... }
        // ```
        if (seekable) {
            // What:     `instrumentation.runOnMainSync { ... }` runs the trailing lambda on the main thread,
            //           blocking until it finishes.
            // Why:      The seek and resume must happen on the engine-owning main thread.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // instrumentation.runOnMainSync(() => { ... });
            // ```
            instrumentation.runOnMainSync {
                // What:     `engineRef.get().seekTo(seekTarget)`. `engineRef.get()` reads the engine from
                //           the box; `.seekTo(seekTarget)` jumps playback to `seekTarget` seconds.
                // Why:      Move the playhead to the track midpoint so we can later confirm the jump landed.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // engineRef.get().seekTo(seekTarget);
                // ```
                engineRef.get().seekTo(seekTarget)
                // What:     `engineRef.get().play()`. `engineRef.get()` reads the engine; `.play()` resumes
                //           playback (the engine was paused earlier).
                // Why:      Resume after seeking so the position counter advances from the new spot, proving
                //           the seek took effect.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // engineRef.get().play();
                // ```
                engineRef.get().play()
            }
            // What:     `Thread.sleep(SETTLE_MS)` blocks the test thread for the settle interval again.
            // Why:      Let AAudio resume and the position advance past the seek point before we sample it.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // await wait(SETTLE_MS);
            // ```
            Thread.sleep(SETTLE_MS)
        }
        // What:     `val positionSeek: Double = onMain(instrumentation) { engineRef.get().positionSec() }`.
        //           `Double` 64-bit float; `onMain` runs on the main thread; `engineRef.get().positionSec()`
        //           reads the current position.
        // Why:      Sample where the playhead ended up after the seek (or, for short tracks that skipped the
        //           seek, just wherever it is); asserted later against the seek target.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const positionSeek: number = onMain(instrumentation, () => engineRef.get().positionSec());
        // ```
        val positionSeek: Double = onMain(instrumentation) { engineRef.get().positionSec() }
        // What:     `Log.i(BENCH_TAG, "RustEngine after seek to $seekTarget (seekable=$seekable): pos=$positionSeek")`
        //           logs the seek target, whether the track was seekable, and the resulting position; the
        //           `$seekTarget` / `$seekable` / `$positionSeek` placeholders splice in those values.
        // Why:      Record the seek outcome in logcat.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // Log.i(BENCH_TAG, `RustEngine after seek to ${seekTarget} (seekable=${seekable}): pos=${positionSeek}`);
        // ```
        Log.i(BENCH_TAG, "RustEngine after seek to $seekTarget (seekable=$seekable): pos=$positionSeek")

        // What:     `instrumentation.runOnMainSync { ... }` runs the trailing lambda on the main thread,
        //           blocking until done.
        // Why:      Tear-down (pause then release) must run on the engine-owning thread.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // instrumentation.runOnMainSync(() => { ... });
        // ```
        instrumentation.runOnMainSync {
            // What:     `engineRef.get().pause()`. `engineRef.get()` reads the engine; `.pause()` halts
            //           playback before releasing.
            // Why:      Stop audio cleanly before freeing native resources.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // engineRef.get().pause();
            // ```
            engineRef.get().pause()
            // What:     `engineRef.get().release()`. `engineRef.get()` reads the engine; `.release()` frees
            //           the native handle/resources the engine holds.
            // Why:      Avoid leaking the native engine; on-device resources must be returned.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // engineRef.get().release();
            // ```
            engineRef.get().release()
        }

        // What:     `assertTrue("...", positionPlaying > 0.0)` fails the test (with the message) unless
        //           `positionPlaying > 0.0`. `0.0` is a `Double` literal.
        // Why:      Prove playback genuinely advanced while playing: a position greater than zero seconds.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertTrue(`position did not advance while playing (pos=${positionPlaying})`, positionPlaying > 0.0);
        // ```
        assertTrue("position did not advance while playing (pos=$positionPlaying)", positionPlaying > 0.0)
        // What:     `assertTrue("...", duration > 0.0)` fails unless `duration` is positive.
        // Why:      Prove the engine actually read a real (positive) track duration.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertTrue(`duration not positive (dur=${duration})`, duration > 0.0);
        // ```
        assertTrue("duration not positive (dur=$duration)", duration > 0.0)
        // What:     `assertTrue("...", playWhenReady)` fails unless the boolean `playWhenReady` is true.
        // Why:      Prove the engine entered the "play when ready" state after being told to play on load.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertTrue("playWhenReady should be true after play", playWhenReady);
        // ```
        assertTrue("playWhenReady should be true after play", playWhenReady)
        // What:     `assertTrue("...", pausedB - pausedA < PAUSE_TOLERANCE)` fails unless the difference
        //           between the two paused samples is below `PAUSE_TOLERANCE` (a `Double` constant).
        // Why:      Prove the position did NOT advance while paused (small slop is allowed for scheduling).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertTrue(`position advanced while paused (a=${pausedA} b=${pausedB})`, pausedB - pausedA < PAUSE_TOLERANCE);
        // ```
        assertTrue("position advanced while paused (a=$pausedA b=$pausedB)", pausedB - pausedA < PAUSE_TOLERANCE)
        // What:     `if (seekable) { ... }` runs the seek assertion only when the track was long enough to
        //           have been seeked above.
        // Why:      Skip asserting on the seek for short tracks where no seek happened.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (seekable) { ... }
        // ```
        if (seekable) {
            // What:     `assertTrue("...", positionSeek >= seekTarget - SEEK_TOLERANCE)` fails unless the
            //           post-seek position is at or above `seekTarget` minus a tolerance (`SEEK_TOLERANCE`
            //           is a `Double` constant; subtraction yields the lower bound we accept).
            // Why:      Prove the seek landed near the requested midpoint, allowing a small undershoot.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // assertTrue(`seek did not reach near ${seekTarget} (pos=${positionSeek})`, positionSeek >= seekTarget - SEEK_TOLERANCE);
            // ```
            assertTrue("seek did not reach near $seekTarget (pos=$positionSeek)", positionSeek >= seekTarget - SEEK_TOLERANCE)
        }
    }

    // What:     `@Test` annotation marks the next method as a JUnit test case to run.
    // Why:      Register `autoAdvancesOnceOnNaturalEnd` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // @Test
    // ```
    @Test
    // What:     `fun autoAdvancesOnceOnNaturalEnd() { ... }` declares a no-arg, no-return test method named
    //           `autoAdvancesOnceOnNaturalEnd`.
    // Why:      Second test body: drive the production `PlayerController` over a `RustEngine` and assert it
    //           advances to exactly the next track once when a track ends naturally (the pull-based
    //           adaptation: the poller turns native `ended` into `onTrackEnded`, and the controller loads
    //           the next track). A direct-engine test can't reach this controller-level path.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // autoAdvancesOnceOnNaturalEnd(): void { ... }
    // ```
    fun autoAdvancesOnceOnNaturalEnd() {
        // What:     `val instrumentation = InstrumentationRegistry.getInstrumentation()` fetches the running
        //           test harness, same as in the first test.
        // Why:      Need it for the content resolver and for running code on the main thread.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const instrumentation = InstrumentationRegistry.getInstrumentation();
        // ```
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        // What:     `val context = instrumentation.targetContext` reads the app-under-test `Context`.
        // Why:      Needed to construct the `RustEngine` and to reach MediaStore via the resolver.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const context = instrumentation.targetContext;
        // ```
        val context = instrumentation.targetContext
        // What:     `val uris = audioUris(instrumentation, ADVANCE_TRACK_COUNT)` calls our helper for up to
        //           `ADVANCE_TRACK_COUNT` (an `Int` constant) track URIs; inferred type `List<Uri>`.
        // Why:      We need several tracks so a natural end can advance through a page and a double-advance
        //           bug would overshoot.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const uris = audioUris(instrumentation, ADVANCE_TRACK_COUNT);
        // ```
        val uris = audioUris(instrumentation, ADVANCE_TRACK_COUNT)
        // What:     `assumeTrue("...", uris.size >= ADVANCE_TRACK_COUNT)` SKIPS the test (not fails) unless
        //           the device returned at least `ADVANCE_TRACK_COUNT` tracks. `uris.size` is the list's
        //           length property.
        // Why:      The auto-advance test needs enough tracks; on a device with too few, skip cleanly.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (uris.length < ADVANCE_TRACK_COUNT) return markSkipped(`need >= ${ADVANCE_TRACK_COUNT} indexed tracks`);
        // ```
        assumeTrue("need >= $ADVANCE_TRACK_COUNT indexed tracks", uris.size >= ADVANCE_TRACK_COUNT)
        // Same folder, so all three share one page: under ShuffleMode.OFF the playback scope is the
        // current page, so a natural end advances through the page (a different folder per track would
        // make three one-track pages that each loop on themselves).
        // What:     `val tracks = uris.mapIndexed { index, uri -> Track(uri = uri.toString(), displayPath = "probe/track$index.flac") }`.
        //           `.mapIndexed { index, uri -> ... }` walks the list producing a new list, giving the
        //           lambda both the element (`uri`) and its position (`index`). The `index, uri ->` part is
        //           the lambda's parameter list (Kotlin's arrow lambda). Inside, `Track(uri = ..., displayPath = ...)`
        //           constructs a `Track` using NAMED arguments (`uri =` / `displayPath =` label which
        //           parameter each value fills). `uri.toString()` converts the `Uri` to its string form, and
        //           `"probe/track$index.flac"` is a template string with `$index` spliced in.
        // Why:      Build the controller's playlist: one `Track` per URI, each with a fake same-folder
        //           display path so all three land in one page (so a natural end advances within the page).
        // Gotcha:   Kotlin's `mapIndexed` lambda receives `(index, element)`; TS's `Array.map` callback
        //           receives `(element, index)`. The order is flipped.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const tracks = uris.map((uri, index) => new Track(uri.toString(), `probe/track${index}.flac`));
        // ```
        val tracks = uris.mapIndexed { index, uri -> Track(uri = uri.toString(), displayPath = "probe/track$index.flac") }

        // What:     `val controllerRef = AtomicReference<PlayerController>()` constructs an empty thread-safe
        //           box (`<PlayerController>` is the generic type argument; `()` calls the no-arg constructor)
        //           that will hold the controller.
        // Why:      The controller is built on the main thread and read on the test thread; the box hands it
        //           across safely.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const controllerRef = new AtomicReference<PlayerController>();
        // ```
        val controllerRef = AtomicReference<PlayerController>()
        // What:     `instrumentation.runOnMainSync { ... }` runs the trailing lambda on the main thread,
        //           blocking until it finishes.
        // Why:      Build and start the controller on the engine-owning thread.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // instrumentation.runOnMainSync(() => { ... });
        // ```
        instrumentation.runOnMainSync {
            // What:     `val controller = PlayerController(RustEngine(context))` constructs a
            //           `PlayerController`, passing a freshly constructed `RustEngine(context)` as its
            //           engine (both are constructor calls, written without `new`).
            // Why:      The controller is the production layer above the raw engine; we test that layer's
            //           auto-advance behavior over a real native engine.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const controller = new PlayerController(new RustEngine(context));
            // ```
            val controller = PlayerController(RustEngine(context))
            // What:     `controller.setVolume(0.0f)` sets volume using the `Float` literal `0.0f` (the `f`
            //           suffix = 32-bit single precision; sibling `0.0` would be a 64-bit `Double`).
            // Why:      Silence again (resident-noise rule). `Float` because the volume API takes a 32-bit
            //           `Float` to match the native side.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // controller.setVolume(0.0);
            // ```
            controller.setVolume(0.0f)
            // What:     `controller.openLibrary(tracks)` hands the controller the `List<Track>` playlist
            //           built above.
            // Why:      Load the playlist so the controller has a page to advance through.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // controller.openLibrary(tracks);
            // ```
            controller.openLibrary(tracks)
            // What:     `controller.playIndex(0)` tells the controller to start playing the track at index
            //           `0` (the first track).
            // Why:      Begin playback at the start so we can later seek near its end and watch the advance.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // controller.playIndex(0);
            // ```
            controller.playIndex(0)
            // What:     `controllerRef.set(controller)` writes the controller into the thread-safe box's
            //           slot via `.set(...)`.
            // Why:      Publish the controller so the test thread can read it back out.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // controllerRef.set(controller);
            // ```
            controllerRef.set(controller)
        }

        // What:     `Thread.sleep(SETTLE_MS)` blocks the test thread for the settle interval.
        // Why:      Let the first track open and start so its duration becomes known.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // await wait(SETTLE_MS);
        // ```
        Thread.sleep(SETTLE_MS)
        // What:     `val firstDuration: Double = onMain(instrumentation) { controllerRef.get().durationSec() }`.
        //           `Double` 64-bit float; `onMain` runs the lambda on the main thread; `controllerRef.get()`
        //           reads the controller from the box; `.durationSec()` returns the current track's length.
        // Why:      We need track 0's duration to compute a seek that lands just before its end.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const firstDuration: number = onMain(instrumentation, () => controllerRef.get().durationSec());
        // ```
        val firstDuration: Double = onMain(instrumentation) { controllerRef.get().durationSec() }
        // What:     `Log.i(BENCH_TAG, "auto-advance: track0 dur=$firstDuration")` logs track 0's duration;
        //           `$firstDuration` splices the value into the template.
        // Why:      Record the measured first-track duration in logcat.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // Log.i(BENCH_TAG, `auto-advance: track0 dur=${firstDuration}`);
        // ```
        Log.i(BENCH_TAG, "auto-advance: track0 dur=$firstDuration")
        // What:     `assumeTrue("track0 duration unknown", firstDuration > MIN_SEEKABLE_SECONDS)` SKIPS the
        //           test unless track 0 is long enough (`MIN_SEEKABLE_SECONDS` is a `Double` constant) to
        //           seek near its end meaningfully.
        // Why:      If the first track is too short (or duration unknown), the near-end seek isn't sensible,
        //           so skip rather than fail.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!(firstDuration > MIN_SEEKABLE_SECONDS)) return markSkipped("track0 duration unknown");
        // ```
        assumeTrue("track0 duration unknown", firstDuration > MIN_SEEKABLE_SECONDS)

        // What:     `instrumentation.runOnMainSync { controllerRef.get().seek(firstDuration - NEAR_END_SECONDS) }`
        //           runs the lambda on the main thread. Inside, `controllerRef.get()` reads the controller,
        //           and `.seek(firstDuration - NEAR_END_SECONDS)` jumps to `NEAR_END_SECONDS` (a `Double`
        //           constant) before the track's end (plain double subtraction).
        // Why:      Position playback just before the end so the track finishes within a couple of poll
        //           cycles, triggering the natural-end auto-advance quickly.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // instrumentation.runOnMainSync(() => controllerRef.get().seek(firstDuration - NEAR_END_SECONDS));
        // ```
        instrumentation.runOnMainSync { controllerRef.get().seek(firstDuration - NEAR_END_SECONDS) }
        // What:     `Thread.sleep(ADVANCE_WAIT_MS)` blocks the test thread for `ADVANCE_WAIT_MS`
        //           milliseconds (a `Long` constant), covering several poll cycles.
        // Why:      Give the poller time to detect the natural end and the controller time to land the
        //           advance to the next track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // await wait(ADVANCE_WAIT_MS);
        // ```
        Thread.sleep(ADVANCE_WAIT_MS)
        // What:     `val scopeIndex: Int? = onMain(instrumentation) { controllerRef.get().currentScopeIndex() }`.
        //           The explicit type `Int?` is a NULLABLE 32-bit signed integer (the trailing `?` allows
        //           `null`; sibling `Int` with no `?` can never be null). `onMain` runs the lambda on the
        //           main thread; `controllerRef.get()` reads the controller; `.currentScopeIndex()` returns
        //           the controller's position within the current playback scope, or `null` when there is no
        //           current track.
        // Why:      After the natural end, we read which scope slot is current; `1` means it advanced once.
        //           `Int?` because the controller legitimately reports "no current index" as `null`, which
        //           must be representable.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const scopeIndex: number | null = onMain(instrumentation, () => controllerRef.get().currentScopeIndex());
        // ```
        val scopeIndex: Int? = onMain(instrumentation) { controllerRef.get().currentScopeIndex() }
        // What:     `Log.i(BENCH_TAG, "auto-advance: after natural end scopeIndex=$scopeIndex")` logs the
        //           observed scope index; `$scopeIndex` splices the (possibly null) value into the template.
        // Why:      Record the post-advance scope index in logcat for inspection.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // Log.i(BENCH_TAG, `auto-advance: after natural end scopeIndex=${scopeIndex}`);
        // ```
        Log.i(BENCH_TAG, "auto-advance: after natural end scopeIndex=$scopeIndex")
        // What:     `instrumentation.runOnMainSync { controllerRef.get().release() }` runs the lambda on the
        //           main thread; `controllerRef.get()` reads the controller and `.release()` frees its
        //           native resources.
        // Why:      Clean up the controller (and its engine) on the owning thread before the test ends.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // instrumentation.runOnMainSync(() => controllerRef.get().release());
        // ```
        instrumentation.runOnMainSync { controllerRef.get().release() }

        // What:     `assertTrue("...", scopeIndex == 1)` fails the test unless `scopeIndex` equals `1`. The
        //           comparison `scopeIndex == 1` works even though `scopeIndex` is `Int?` (nullable): if it's
        //           `null`, the equality is simply false, so a null result fails the assertion as intended.
        // Why:      Prove the controller advanced EXACTLY once (to scope index 1), not zero times and not
        //           twice (a double-advance would land on a higher index).
        // Gotcha:   In Kotlin `==` on a nullable handles `null` safely (no exception); in TS use `=== 1`,
        //           where `null === 1` is likewise just `false`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertTrue(`expected a single advance to scope index 1, got ${scopeIndex}`, scopeIndex === 1);
        // ```
        assertTrue("expected a single advance to scope index 1, got $scopeIndex", scopeIndex == 1)
    }

    // What:     `private fun audioUris(instrumentation: Instrumentation, count: Int): List<Uri> { ... }`
    //           declares a PRIVATE method (callable only from within this class) named `audioUris`. It takes
    //           two parameters: `instrumentation` (the test harness, used to reach the content resolver) and
    //           `count` (an `Int`, the maximum number of URIs to return). It returns a `List<Uri>` (a
    //           read-only list of `Uri`; possibly fewer than `count` when the library is small). `Int` is a
    //           32-bit signed integer; sibling `Long` is 64-bit. `List<Uri>` is the read-only list type;
    //           sibling `MutableList<Uri>` allows adding/removing.
    // Why:      Centralize the MediaStore query that finds playable music tracks, so both tests get URIs the
    //           same way. `Int` (not `Long`) because a small in-memory count never approaches the 2-billion
    //           `Int` ceiling and `count` is compared against list sizes, which are `Int`. Return type
    //           `List<Uri>` (read-only, not `MutableList`) because callers only iterate it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private audioUris(instrumentation: Instrumentation, count: number): Uri[] { ... }
    // ```
    private fun audioUris(instrumentation: Instrumentation, count: Int): List<Uri> {
        // What:     `val resolver = instrumentation.targetContext.contentResolver` reads the app's
        //           `ContentResolver` (the object you use to query content providers like MediaStore).
        // Why:      We query MediaStore through the resolver to enumerate audio rows.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const resolver = instrumentation.targetContext.contentResolver;
        // ```
        val resolver = instrumentation.targetContext.contentResolver
        // What:     `val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)` calls
        //           a static-style helper to get the base content URI for audio on the external storage
        //           volume; `MediaStore.VOLUME_EXTERNAL` is a constant naming that volume.
        // Why:      This base URI is both what we query and the prefix we append each row id to.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
        // ```
        val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        // What:     `val projection = arrayOf(MediaStore.Audio.Media._ID)` builds an `Array<String>` (the
        //           `arrayOf(...)` builder makes a fixed-size array) containing one column name, `_ID` (the
        //           row's numeric primary key). A "projection" is the list of columns a query should return.
        // Why:      We only need each row's id to construct its URI, so we ask for just the `_ID` column.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const projection = [MediaStore.Audio.Media._ID];
        // ```
        val projection = arrayOf(MediaStore.Audio.Media._ID)
        // What:     `val uris = mutableListOf<Uri>()` constructs an empty MUTABLE list of `Uri`
        //           (`mutableListOf<Uri>()` is the builder; `<Uri>` is the element type). `MutableList<Uri>`
        //           allows `add`; sibling `listOf<Uri>()` would be read-only and could not be appended to.
        // Why:      We accumulate result URIs as we walk the cursor, so we need an appendable list.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const uris: Uri[] = [];
        // ```
        val uris = mutableListOf<Uri>()
        // What:     `resolver.query(collection, projection, "${MediaStore.Audio.Media.IS_MUSIC} != 0", null, null)?.use { cursor -> ... }`.
        //           `resolver.query(...)` runs a query and returns a `Cursor?` (NULLABLE: `null` if the
        //           query fails). The `?.` is the SAFE-CALL operator: it calls `.use { ... }` ONLY when the
        //           cursor is non-null, otherwise the whole expression is `null` and the block is skipped.
        //           `.use { cursor -> ... }` runs the trailing lambda with the cursor bound to `cursor` and
        //           guarantees the cursor is CLOSED afterward (even on exception). The query's third argument
        //           is a SQL-like selection string built with a template (`${MediaStore.Audio.Media.IS_MUSIC} != 0`
        //           means "only rows where the IS_MUSIC column is non-zero", i.e. actual music); the two
        //           trailing `null`s are "no selection args" and "default sort order".
        // Why:      Enumerate only music rows and ensure the cursor (a native-backed result set) is always
        //           released. The `?.` guards against a failed query returning `null`.
        // Gotcha:   `?.` here is Kotlin's null-safe call (like TS optional chaining `?.`), and `use {}` is
        //           an auto-close construct (like a TS `using` declaration or a `try/finally` that closes).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const cursor = resolver.query(collection, projection, `${MediaStore.Audio.Media.IS_MUSIC} != 0`, null, null);
        // if (cursor != null) {
        //   try {
        //     // ...body using cursor...
        //   } finally {
        //     cursor.close();
        //   }
        // }
        // ```
        resolver.query(collection, projection, "${MediaStore.Audio.Media.IS_MUSIC} != 0", null, null)?.use { cursor ->
            // What:     `val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)` looks up
            //           the integer column index of the `_ID` column in this cursor's result set, THROWING if
            //           that column is absent (the `OrThrow` suffix means "fail loudly rather than return a
            //           sentinel like -1").
            // Why:      Reading a value from a cursor needs the column's numeric index; we resolve it once,
            //           up front, and let a missing column be a hard error.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
            // ```
            val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            // What:     `while (cursor.moveToNext() && uris.size < count) { ... }` loops while BOTH conditions
            //           hold: `cursor.moveToNext()` advances to the next row and returns false when there are
            //           none left, and `uris.size < count` stops once we've collected `count` URIs.
            // Why:      Walk rows one at a time, collecting URIs until we either run out of rows or reach the
            //           requested maximum.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // while (cursor.moveToNext() && uris.length < count) { ... }
            // ```
            while (cursor.moveToNext() && uris.size < count) {
                // What:     `uris.add(ContentUris.withAppendedId(collection, cursor.getLong(idColumn)))`.
                //           `cursor.getLong(idColumn)` reads the `_ID` value at the resolved column as a
                //           `Long` (64-bit integer; sibling `getInt` would read a 32-bit `Int`).
                //           `ContentUris.withAppendedId(collection, id)` builds a full row URI by appending
                //           that id to the base `collection` URI. `uris.add(...)` appends the new URI to our
                //           mutable list.
                // Why:      Turn each numeric row id into a playable `content://` URI and collect it. `getLong`
                //           (not `getInt`) because MediaStore ids are 64-bit and `withAppendedId` expects a
                //           `Long`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // uris.push(ContentUris.withAppendedId(collection, cursor.getLong(idColumn)));
                // ```
                uris.add(ContentUris.withAppendedId(collection, cursor.getLong(idColumn)))
            }
        }
        // What:     `return uris` returns the accumulated `MutableList<Uri>`. It satisfies the declared
        //           `List<Uri>` return type because a mutable list IS-A read-only list (the read-only type is
        //           a supertype); callers just see the read-only view.
        // Why:      Hand the collected URIs back to the caller.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return uris;
        // ```
        return uris
    }

    // What:     `private fun <T> onMain(instrumentation: Instrumentation, block: () -> T): T { ... }`
    //           declares a PRIVATE GENERIC method named `onMain`. `<T>` introduces a type parameter `T` (a
    //           placeholder for "whatever type the caller's block returns"). Parameters: `instrumentation`
    //           (supplies `runOnMainSync`) and `block: () -> T` (a function value taking no args and
    //           returning a `T`, i.e. a callback). The return type is `T`: whatever the block produced.
    // Why:      Run an engine read on the main thread (the thread that owns the native handle) and ferry its
    //           result back to the calling thread, generically for any return type.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private onMain<T>(instrumentation: Instrumentation, block: () => T): T { ... }
    // ```
    private fun <T> onMain(instrumentation: Instrumentation, block: () -> T): T {
        // What:     `val holder = AtomicReference<T>()` constructs an empty thread-safe box (`<T>` is the
        //           generic element type; `()` calls the no-arg constructor) to carry the block's result of
        //           type `T` across the thread boundary.
        // Why:      The block runs on the main thread, but we must return its value to THIS thread; the box
        //           is the safe hand-off.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const holder = new AtomicReference<T>();
        // ```
        val holder = AtomicReference<T>()
        // What:     `instrumentation.runOnMainSync { holder.set(block()) }` runs the trailing lambda on the
        //           main thread and blocks until done. Inside, `block()` invokes the caller's callback and
        //           `holder.set(...)` stores its result into the box.
        // Why:      Execute the engine read on the correct thread and publish its result for retrieval below.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // instrumentation.runOnMainSync(() => holder.set(block()));
        // ```
        instrumentation.runOnMainSync { holder.set(block()) }
        // What:     `return holder.get()` reads the stored value out of the box (`.get()` is the box's read
        //           method) and returns it as the method's `T` result.
        // Why:      Hand the main-thread-produced value back to the test thread that called `onMain`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return holder.get();
        // ```
        return holder.get()
    }

    // What:     `companion object { ... }` declares the companion object: a single, class-level object whose
    //           members are accessed via the class name (`RustEngineTest.SETTLE_MS`), the Kotlin way to
    //           express "static" members that don't belong to any instance.
    // Why:      Hold the shared constants (timings and tolerances) used by both tests, in one place, without
    //           tying them to a particular test instance.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // inside the class body:
    // static readonly BENCH_TAG = "NativeBench";
    // static readonly SETTLE_MS = 600;
    // // ...etc...
    // ```
    companion object {
        // What:     `private const val BENCH_TAG: String = "NativeBench"` declares a compile-time constant
        //           (`const val` = a true compile-time constant, inlined where used) named `BENCH_TAG` of
        //           type `String`. `String` is Kotlin's text type (sibling `CharArray` would be a raw array
        //           of characters, not used here).
        // Why:      Shared logcat tag for all of this file's native on-device checks; one place to change it.
        //           `String` (not `CharArray`) because logging APIs take a `String` tag.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly BENCH_TAG: string = "NativeBench";
        // ```
        private const val BENCH_TAG: String = "NativeBench"

        // What:     `private const val SETTLE_MS: Long = 600L` declares a compile-time constant `SETTLE_MS`
        //           of type `Long` (64-bit signed integer). The literal `600L` has a trailing `L` forcing a
        //           `Long`; sibling `Int` (32-bit) would be `600` with no suffix.
        // Why:      Settle time (in milliseconds) for the worker to open the file, start AAudio, and let
        //           position advance. `Long` (not `Int`) because `Thread.sleep` takes a `Long` argument;
        //           matching the parameter type avoids a widening conversion at each call.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly SETTLE_MS: number = 600;
        // ```
        private const val SETTLE_MS: Long = 600L

        // What:     `private const val STEP_MS: Long = 200L` declares a `Long` (64-bit) constant `STEP_MS`;
        //           `200L` is a `Long` literal (the `L` suffix; sibling `Int` would be `200`).
        // Why:      Short dwell (milliseconds) between the two paused-position samples. `Long` to match
        //           `Thread.sleep`'s parameter type.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly STEP_MS: number = 200;
        // ```
        private const val STEP_MS: Long = 200L

        // What:     `private const val PAUSE_TOLERANCE: Double = 0.1` declares a `Double` (64-bit double-
        //           precision float) constant `PAUSE_TOLERANCE`; `0.1` is a `Double` literal (no `f` suffix;
        //           sibling `Float` 32-bit would be `0.1f`).
        // Why:      Maximum position drift (seconds) tolerated while paused (should be exactly zero, but a
        //           little scheduling slop is allowed). `Double` (not `Float`) because it's compared against
        //           `Double` positions; mixing `Float` would force a conversion.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly PAUSE_TOLERANCE: number = 0.1;
        // ```
        private const val PAUSE_TOLERANCE: Double = 0.1

        // What:     `private const val SEEK_TOLERANCE: Double = 1.5` declares a `Double` constant
        //           `SEEK_TOLERANCE`; `1.5` is a `Double` literal (sibling `Float` would be `1.5f`).
        // Why:      How far below the seek target the post-seek position may land and still pass (seconds).
        //           `Double` to match the `Double` seek/position math.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly SEEK_TOLERANCE: number = 1.5;
        // ```
        private const val SEEK_TOLERANCE: Double = 1.5

        // What:     `private const val MIN_SEEKABLE_SECONDS: Double = 4.0` declares a `Double` constant
        //           `MIN_SEEKABLE_SECONDS`; `4.0` is a `Double` literal (sibling `Float` would be `4.0f`).
        // Why:      Only seek-test tracks at least this long (seconds), so a mid-point seek is meaningful.
        //           `Double` to compare against `Double` durations without conversion.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly MIN_SEEKABLE_SECONDS: number = 4.0;
        // ```
        private const val MIN_SEEKABLE_SECONDS: Double = 4.0

        // What:     `private const val ADVANCE_TRACK_COUNT: Int = 3` declares an `Int` (32-bit signed
        //           integer) constant `ADVANCE_TRACK_COUNT`; `3` is an `Int` literal (sibling `Long` 64-bit
        //           would be `3L`).
        // Why:      Number of tracks the auto-advance test loads; at least 3 so a double-advance bug would
        //           overshoot index 1. `Int` (not `Long`) because it's compared against `List.size`, which
        //           is an `Int`, and a small count never nears the `Int` ceiling.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly ADVANCE_TRACK_COUNT: number = 3;
        // ```
        private const val ADVANCE_TRACK_COUNT: Int = 3

        // What:     `private const val NEAR_END_SECONDS: Double = 0.4` declares a `Double` constant
        //           `NEAR_END_SECONDS`; `0.4` is a `Double` literal (sibling `Float` would be `0.4f`).
        // Why:      How far before the end (seconds) to seek so the track finishes within a couple of poll
        //           cycles. `Double` to match the `Double` duration arithmetic it's subtracted from.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly NEAR_END_SECONDS: number = 0.4;
        // ```
        private const val NEAR_END_SECONDS: Double = 0.4

        // What:     `private const val ADVANCE_WAIT_MS: Long = 2500L` declares a `Long` (64-bit) constant
        //           `ADVANCE_WAIT_MS`; `2500L` is a `Long` literal (the `L` suffix; sibling `Int` would be
        //           `2500`).
        // Why:      How long (milliseconds) to wait for the natural end to be detected and the advance to
        //           land (several ~200 ms polls). `Long` to match `Thread.sleep`'s parameter type.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly ADVANCE_WAIT_MS: number = 2500;
        // ```
        private const val ADVANCE_WAIT_MS: Long = 2500L
    }
}
