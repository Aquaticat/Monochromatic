// ===========================================================================================
// FILE SUMMARY (folded in from the old KDoc on the class below)
//
// This is an on-device (instrumented) test for the background "peak sweep". The sweep's job is
// to walk the user's music library, decode each track just enough to measure its loudest sample
// ("true peak"), and remember that number in a shared cache file (`peaks.json`) so playback can
// normalize volume without re-decoding. The sweep is only meaningful end to end: it enumerates the
// exact same source playback uses, decodes through a REAL Android hardware/software codec
// (`android.media.MediaCodec`), and writes the real cache. None of that machinery exists on a plain
// desktop JVM, so this test must run ON A DEVICE/EMULATOR ("connected"/"instrumented") via the
// Android `am instrument` runner, NOT as an ordinary unit test.
//
// Important operational notes the original KDoc captured:
//   - It is run via `am instrument` against the ALREADY-INSTALLED app. The off-the-shelf Gradle
//     `connectedAndroidTest` task uninstalls the app afterward, which would also wipe the persisted
//     folder-access grant the library scan depends on. So this is launched a different way.
//   - The decode is silent: it is decode-only with NO `android.media.AudioTrack`, so no audio plays
//     while the sweep runs.
//   - Both tests are bounded to a SINGLE track (the worker via a `KEY_MAX_TRACKS` input bound; the
//     helper via one explicit URI) so an instrumented run finishes in seconds instead of decoding
//     the whole device library.
//   - Writing the measured peak into the real cache is the CORRECT production behavior, not a side
//     effect to clean up afterward.
//
// Audience note for this whole file: comments are written for a reader who knows ONLY TypeScript.
// Every Kotlin-specific symbol is translated into "what would I write in TS to get the same idea".
// ===========================================================================================

// What:     `package dev.monochromatic.musicplayer` declares the namespace this file's class lives
//           in. Every other file using the same `package` line shares this namespace and can refer
//           to types here by short name (e.g. `Track` instead of a fully-qualified name).
// Why:      Kotlin/Java resolve types by package; the test must sit in the same package as the
//           production classes it pokes at (`PeakSweepWorker`, `Track`, `LibrarySource`, …) so it
//           can reach their `internal`/package-visible members without an import.
//
// In TS you'd write (pseudocode):
// ```ts
// // No 1:1 equivalent. Conceptually: this file belongs to the
// // "dev/monochromatic/musicplayer" module folder.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` pulls in the `Context` type. In Android, a `Context`
//           is the app's handle to the operating system: it is how you reach app resources, files,
//           the content resolver (for `content://` URIs), system services, and so on.
// Why:      The test needs a `Context` to hand to the production code (the library scanner, the
//           cache store, the fingerprinter), all of which need OS access.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Context } from "android/content";
// ```
import android.content.Context
// What:     `import android.net.Uri` pulls in `Uri`, Android's parsed-URI type. A `Uri` is the
//           structured form of a string locator like `content://media/external/audio/123` or a SAF
//           document URI. It is NOT a plain `String`; it is a parsed object.
// Why:      The sweep identifies and opens tracks by `Uri`, so the test builds and passes `Uri`s.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Uri } from "android/net";
// ```
import android.net.Uri
// What:     `import androidx.core.net.toUri` imports a Kotlin EXTENSION FUNCTION named `toUri`. An
//           extension function is a free function that Kotlin lets you call with method syntax on a
//           receiver type it was declared for. Here `toUri` is declared "on" `String`, so you can
//           write `"some string".toUri()` and it returns a parsed `Uri`.
// Why:      The library stores each track's locator as a plain `String` (see `Track.uri: String`);
//           to open it the test must parse that string into a `Uri` via `.toUri()`.
// Gotcha:   `someString.toUri()` LOOKS like a method that lives on the string, but `String` has no
//           such method; the import is what makes the call resolve. Remove the import and the call
//           fails to compile.
//
// In TS you'd write (pseudocode):
// ```ts
// import { toUri } from "androidx/core/net"; // call as toUri(str), not str.toUri()
// ```
import androidx.core.net.toUri
// What:     `import androidx.test.core.app.ApplicationProvider` imports a test-only helper object
//           that can hand back the running app's `Context` during an instrumented test.
// Why:      The test needs the real app `Context`; `ApplicationProvider.getApplicationContext()`
//           supplies it (used below in the `context` property).
//
// In TS you'd write (pseudocode):
// ```ts
// import { ApplicationProvider } from "androidx/test/core/app";
// ```
import androidx.test.core.app.ApplicationProvider
// What:     `import androidx.test.ext.junit.runners.AndroidJUnit4` imports the JUnit "runner" class
//           for Android. A runner is the object the test framework uses to actually drive a test
//           class (create it, invoke its `@Test` methods, report pass/fail).
// Why:      The class below is annotated `@RunWith(AndroidJUnit4::class)` so it runs on a device
//           with Android wiring available; this import names that runner.
//
// In TS you'd write (pseudocode):
// ```ts
// import { AndroidJUnit4 } from "androidx/test/ext/junit/runners";
// ```
import androidx.test.ext.junit.runners.AndroidJUnit4
// What:     `import androidx.work.ListenableWorker` imports the base "worker result" type family.
//           A WorkManager worker reports back a `ListenableWorker.Result` (success / failure /
//           retry). This import brings in `ListenableWorker` so the test can name
//           `ListenableWorker.Result.Success`.
// Why:      The worker test asserts the worker returned a SUCCESS result; that result type is
//           nested under `ListenableWorker`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ListenableWorker } from "androidx/work";
// ```
import androidx.work.ListenableWorker
// What:     `import androidx.work.testing.TestListenableWorkerBuilder` imports a test-only builder
//           that constructs a real worker instance wired to a fake/test WorkManager environment, so
//           you can call `doWork()` directly without scheduling it on a real queue.
// Why:      The second test builds the `PeakSweepWorker` with this and runs it inline.
//
// In TS you'd write (pseudocode):
// ```ts
// import { TestListenableWorkerBuilder } from "androidx/work/testing";
// ```
import androidx.work.testing.TestListenableWorkerBuilder
// What:     `import androidx.work.workDataOf` imports a free helper that builds a `Data` object (a
//           small typed key->value bag WorkManager uses to pass inputs to a worker) from
//           `key to value` pairs.
// Why:      The worker test passes an input bound (`KEY_MAX_TRACKS to 1`) so the worker only sweeps
//           one track; `workDataOf` packages that pair into the worker's input `Data`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { workDataOf } from "androidx/work";
// ```
import androidx.work.workDataOf
// What:     `import kotlinx.coroutines.runBlocking` imports `runBlocking`, a bridge that runs a
//           `suspend` (async) block and BLOCKS the current thread until it finishes, returning its
//           result synchronously.
// Why:      The production functions under test are `suspend` (async) functions; a JUnit `@Test`
//           method is an ordinary synchronous method, so the test uses `runBlocking { ... }` to
//           call the async code and wait for it right here.
// Gotcha:   `runBlocking` actually PARKS the thread until the async work completes. In JS you would
//           always reach for `await` inside an `async` function instead; blocking is impossible.
//
// In TS you'd write (pseudocode):
// ```ts
// // No real equivalent. Pretend: function runBlocking<T>(block: () => Promise<T>): T
// // that synchronously waits. In real TS you'd make the test `async` and use `await`.
// ```
import kotlinx.coroutines.runBlocking
// What:     `import org.junit.Assert.assertTrue` imports the `assertTrue` assertion (fails the test
//           unless the given boolean is `true`); it also accepts a message shown on failure.
// Why:      Used several times to check outcomes and value ranges.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertTrue } from "org/junit/Assert";
// ```
import org.junit.Assert.assertTrue
// What:     `import org.junit.Assume.assumeTrue` imports `assumeTrue`. An "assume" is different from
//           an "assert": if the condition is FALSE, the test is SKIPPED (reported as ignored), not
//           FAILED.
// Why:      If the device library is empty there is nothing to sweep, so the test should be skipped
//           rather than fail; `assumeTrue(tracksNotEmpty)` does exactly that.
// Gotcha:   `assumeTrue(false)` SKIPS the test (green-ish "ignored"); `assertTrue(false)` FAILS it
//           (red). Same shape, opposite consequence.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assumeTrue } from "org/junit/Assume";
// ```
import org.junit.Assume.assumeTrue
// What:     `import org.junit.Test` imports the `@Test` annotation marker. Methods tagged with it
//           are the ones the runner executes as individual tests.
// Why:      Both test methods below are annotated `@Test`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Test } from "org/junit"; // used as the @Test decorator-like marker
// ```
import org.junit.Test
// What:     `import org.junit.runner.RunWith` imports the `@RunWith` annotation, which tells JUnit
//           WHICH runner class should drive this test class.
// Why:      The class below uses `@RunWith(AndroidJUnit4::class)` to select the Android runner.
//
// In TS you'd write (pseudocode):
// ```ts
// import { RunWith } from "org/junit/runner";
// ```
import org.junit.runner.RunWith

// What:     `@RunWith(AndroidJUnit4::class)` is an ANNOTATION applied to the class right below it.
//           It tells JUnit to run this class with the `AndroidJUnit4` runner. The `::class` suffix
//           is Kotlin's "class reference" / "class literal" operator: `AndroidJUnit4::class`
//           evaluates to a runtime object describing the `AndroidJUnit4` TYPE (a `KClass`), not an
//           instance of it.
//           Then `class PeakSweepWorkerTest { ... }` declares a class named `PeakSweepWorkerTest`
//           with no constructor parameters and no superclass; its body holds the test methods.
// Why:      The annotation makes these tests run inside an Android process with Android APIs
//           available (instrumented), instead of as plain JVM unit tests. The class groups the two
//           sweep tests and their shared helpers.
// Gotcha:   `AndroidJUnit4::class` is NOT a constructor call. There is no `new`. It hands the runner
//           the type's metadata so JUnit can instantiate it itself.
//
// In TS you'd write (pseudocode):
// ```ts
// @RunWith(AndroidJUnit4) // AndroidJUnit4 here is the class value, not `new AndroidJUnit4()`
// class PeakSweepWorkerTest {
//   // ...test methods...
// }
// ```
@RunWith(AndroidJUnit4::class)
class PeakSweepWorkerTest {
    // What:     `private val context: Context get() = ApplicationProvider.getApplicationContext()`
    //           declares a READ-ONLY property named `context` of type `Context`, with a CUSTOM
    //           GETTER. `private` limits it to this class. `val` means read-only (no setter). The
    //           `get() = expr` part means: there is no stored field; every time someone reads
    //           `context`, this expression runs and returns its result.
    //           `ApplicationProvider.getApplicationContext()` calls a static method that returns the
    //           app's `Context`. Its declared return type is a generic `<T>`; Kotlin infers `T` here
    //           as `Context` from the property's `: Context` annotation, so no cast is needed.
    // Why:      Each test needs the real app `Context`; exposing it as a computed property means
    //           every read fetches a fresh, valid context without storing one as a field.
    // Gotcha:   Because it is `get() = ...` (no backing field), reading `context` RE-CALLS
    //           `getApplicationContext()` every time; it is recomputed, not memoized. For this app
    //           helper that returns the same context, so it is harmless.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private get context(): Context {
    //   return ApplicationProvider.getApplicationContext<Context>();
    // }
    // ```
    private val context: Context get() = ApplicationProvider.getApplicationContext()

    // What:     `@Test` marks the method below as one runnable test case.
    // Why:      Tells the runner to execute `measureAndCacheMeasuresThenCachesOneTrack` as a test.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // @Test
    // test("measureAndCacheMeasuresThenCachesOneTrack", () => { /* body */ });
    // ```
    @Test
    // What:     `fun measureAndCacheMeasuresThenCachesOneTrack() { ... }` declares a method named
    //           `measureAndCacheMeasuresThenCachesOneTrack` taking no parameters and returning
    //           nothing (Kotlin's implicit `Unit`, the equivalent of `void`). `fun` is Kotlin's
    //           function/method keyword. The `{ ... }` is the body.
    //           Domain intent (folded from the old KDoc): this exercises the engine-agnostic sweep
    //           body `measureAndCache` against ONE real track. First call should MEASURE (or find it
    //           already CACHED); afterward the track's peak must be in the cache; a second call must
    //           be a pure CACHE hit. It pins the seam the worker loops over: fingerprint, cache
    //           lookup, decode-on-miss, write.
    // Why:      Verifies the measure->memoize->cache-hit lifecycle end to end on a device.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function measureAndCacheMeasuresThenCachesOneTrack(): void { /* body */ }
    // ```
    fun measureAndCacheMeasuresThenCachesOneTrack() {
        // What:     `val tracks: List<Track> = runBlocking { LibrarySource.load(context) }` declares
        //           a read-only local `tracks` of type `List<Track>` (an immutable, read-only list
        //           of `Track`). `runBlocking { ... }` runs the async block on this thread and waits
        //           for its result. Inside, `LibrarySource.load(context)` is a `suspend` (async)
        //           call returning `List<Track>`; its result becomes the value of the whole
        //           `runBlocking { ... }` expression and thus of `tracks`.
        //           `List<Track>` (not `MutableList<Track>`) is the read-only list interface: you
        //           can read/iterate it but its API has no `add`/`set`. Sibling the reader might
        //           expect: `MutableList<Track>` (read+write), or the array type `Array<Track>`.
        // Why:      The test needs the device's real library to pick a track from; `LibrarySource`
        //           is async (it touches storage), so we block until it returns the list.
        // Gotcha:   `runBlocking` blocks the test thread until the Promise-like work finishes; this
        //           is the synchronous-await that JS does not allow.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const tracks: readonly Track[] = await LibrarySource.load(context);
        // ```
        val tracks: List<Track> = runBlocking { LibrarySource.load(context) }
        // What:     `assumeTrue("device library is empty; nothing to sweep", tracks.isNotEmpty())`.
        //           `assumeTrue(message, condition)` SKIPS the test (does not fail it) when the
        //           condition is false, printing `message`. `tracks.isNotEmpty()` returns `true`
        //           when the list has at least one element.
        // Why:      If there are no tracks on the device there is nothing to measure, so the test
        //           should be skipped rather than counted as a failure.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assumeTrue("device library is empty; nothing to sweep", tracks.length > 0);
        // ```
        assumeTrue("device library is empty; nothing to sweep", tracks.isNotEmpty())
        // What:     `val uri: Uri = tracks.first().uri.toUri()` declares a read-only local `uri` of
        //           type `Uri`. `tracks.first()` returns the first element of the list (a `Track`);
        //           `.uri` reads that track's `uri` field, which is a plain `String`; `.toUri()` is
        //           the imported extension that PARSES that string into a `Uri` object.
        // Why:      The sweep functions operate on a parsed `Uri`, so the test turns the first
        //           track's stored string locator into one to pass them.
        // Gotcha:   `.first()` THROWS if the list is empty; this line only runs after the
        //           `assumeTrue(... isNotEmpty())` above guaranteed at least one element.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const uri: Uri = toUri(tracks[0].uri);
        // ```
        val uri: Uri = tracks.first().uri.toUri()

        // What:     `val first: SweepOutcome = runBlocking { measureAndCache(context, uri) }`
        //           declares a read-only local `first` of type `SweepOutcome` (an enum with values
        //           `CACHED`, `MEASURED`, `UNFINGERPRINTABLE`, `FAILED`). `runBlocking { ... }` runs
        //           the async block and waits; inside, `measureAndCache(context, uri)` is the async
        //           production helper that measures-and-caches one track and returns which branch ran.
        //           `SweepOutcome` is a closed set of named constants; its sibling the reader might
        //           expect from other languages is a string-union, or a numeric `enum`.
        // Why:      Run the real sweep on the chosen track and capture the outcome so we can assert
        //           it measured or was already cached.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const first: SweepOutcome = await measureAndCache(context, uri);
        // ```
        val first: SweepOutcome = runBlocking { measureAndCache(context, uri) }
        // What:     `assertTrue(message, condition)` fails the test unless `condition` is `true`.
        //           The `message` here is a Kotlin STRING TEMPLATE: `"... was $first"`. Inside a
        //           double-quoted string, `$first` is interpolation: it inserts the runtime value of
        //           `first` (its enum name) into the string.
        //           The condition `first == SweepOutcome.MEASURED || first == SweepOutcome.CACHED`
        //           checks the outcome was one of those two. `==` in Kotlin is STRUCTURAL equality
        //           (it calls `.equals()`), which for enum constants behaves like identity.
        // Why:      On a fresh track the first pass should MEASURE it; if a previous run already
        //           cached it, CACHED is also acceptable. Anything else (skipped/failed) is a bug.
        // Gotcha:   Kotlin `==` is `.equals()` (structural), NOT JS `===` reference identity; but for
        //           enum constants the two coincide, so reading it as `===` is fine here.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertTrue(
        //   `first pass should measure the track or find it already cached, was ${first}`,
        //   first === "MEASURED" || first === "CACHED",
        // );
        // ```
        assertTrue(
            "first pass should measure the track or find it already cached, was $first",
            first == SweepOutcome.MEASURED || first == SweepOutcome.CACHED,
        )

        // What:     `val second = runBlocking { measureAndCache(context, uri) }` runs the sweep on the
        //           SAME track again.
        // Why:      The decision cache now lives in Rust: Kotlin can no longer look a peak up (there is
        //           no Kotlin cache), so this test only proves the sweep still succeeds on a re-run.
        //           The native side skips an already-exact track internally, surfaced to Kotlin as
        //           `MEASURED`; the cache round-trip itself is covered by the shared crate's
        //           `DecisionCache` tests.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const second: SweepOutcome = await measureAndCache(context, uri);
        // ```
        val second: SweepOutcome = runBlocking { measureAndCache(context, uri) }
        // What:     `assertTrue(..., second == MEASURED || second == CACHED)`. A re-run must still
        //           report a successful outcome.
        // Why:      Prove a warm re-sweep does not fail; the native cache handles the skip.
        assertTrue(
            "second pass should still succeed, was $second",
            second == SweepOutcome.MEASURED || second == SweepOutcome.CACHED,
        )
    }

    // What:     `@Test` marks the next method as a runnable test case.
    // Why:      Tells the runner to execute `workerSweepsBoundedShareAndSucceeds`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // @Test
    // test("workerSweepsBoundedShareAndSucceeds", () => { /* body */ });
    // ```
    @Test
    // What:     `fun workerSweepsBoundedShareAndSucceeds() { ... }` declares a no-arg, `Unit`-returning
    //           (void) test method.
    //           Domain intent (folded from the old KDoc): drive the REAL `PeakSweepWorker` through
    //           WorkManager's own test harness so it enumerates the library, processes its bounded
    //           share (here capped to one track), and reports SUCCESS so periodic scheduling keeps
    //           going. Bounding to one track keeps the run short while still crossing the real
    //           enumerate -> decode -> flush -> result path.
    // Why:      Verifies the worker's success-reporting contract end to end on a device.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function workerSweepsBoundedShareAndSucceeds(): void { /* body */ }
    // ```
    fun workerSweepsBoundedShareAndSucceeds() {
        // What:     `val worker: PeakSweepWorker = TestListenableWorkerBuilder.from(...).setInputData(...).build()`
        //           declares a read-only local `worker` of type `PeakSweepWorker` built via a
        //           BUILDER CHAIN (each call returns the builder so you can keep configuring, then
        //           `.build()` produces the worker). Step by step:
        //           - `TestListenableWorkerBuilder.from(context, PeakSweepWorker::class.java)` starts
        //             a builder for our worker type. `PeakSweepWorker::class` is the Kotlin class
        //             reference (a `KClass`); `.java` converts it to the Java `Class<>` object the
        //             WorkManager API actually wants.
        //           - `.setInputData(workDataOf(PeakSweepWorker.KEY_MAX_TRACKS to 1))` sets the
        //             worker's input. `workDataOf(...)` builds the input `Data` from a single pair.
        //             `PeakSweepWorker.KEY_MAX_TRACKS to 1` is a Kotlin `Pair`: the `to` INFIX
        //             function makes a key->value pair, here `"max_tracks" to 1`.
        //           - `.build()` constructs the configured `PeakSweepWorker` instance.
        // Why:      The test must run the real worker but bound it to ONE track so the instrumented
        //           run stays seconds long; the builder wires it to the test environment and injects
        //           that `max_tracks = 1` input.
        //           ```
        //           `a to b` ≈ a tuple/entry `[a, b]` or `{ [a]: b }`.
        // Gotcha:   `::class.java` is two conversions: Kotlin class reference -> Java `Class`. There is
        //           no TS analogue; you would just pass the class/constructor itself. And `to` is not
        //           an operator but an infix function that builds a `Pair`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const worker: PeakSweepWorker = TestListenableWorkerBuilder
        //   .from(context, PeakSweepWorker)
        //   .setInputData(workDataOf([PeakSweepWorker.KEY_MAX_TRACKS, 1]))
        //   .build();
        // ```
        val worker: PeakSweepWorker = TestListenableWorkerBuilder
            .from(context, PeakSweepWorker::class.java)
            .setInputData(workDataOf(PeakSweepWorker.KEY_MAX_TRACKS to 1))
            .build()
        // What:     `val result: ListenableWorker.Result = runBlocking { worker.doWork() }` declares a
        //           read-only local `result` of type `ListenableWorker.Result` (the nested result
        //           type: a success/failure/retry value). `runBlocking { ... }` runs the async block
        //           and waits; inside, `worker.doWork()` is the worker's `suspend` (async) entry
        //           point that performs the whole sweep and returns its `Result`.
        // Why:      We invoke the worker's real work function directly and capture what it reports so
        //           we can assert success.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const result: ListenableWorker.Result = await worker.doWork();
        // ```
        val result: ListenableWorker.Result = runBlocking { worker.doWork() }
        // What:     `assertTrue("a normal sweep run must report success, was $result", result is ListenableWorker.Result.Success)`
        //           fails the test unless the condition is true. The message is a string template;
        //           `$result` interpolates the result's runtime value. The condition
        //           `result is ListenableWorker.Result.Success` is Kotlin's `is` TYPE-CHECK operator:
        //           it returns `true` when `result` is an instance of the `Success` subtype.
        // Why:      The worker's contract is to always report SUCCESS for a normal run (so periodic
        //           scheduling continues without backoff); this asserts that exact subtype came back.
        // Gotcha:   `is` is a runtime type test that ALSO smart-casts `result` to `Success` in the
        //           true branch (not used here). It is the analogue of `instanceof`, not of `===`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertTrue(
        //   `a normal sweep run must report success, was ${result}`,
        //   result instanceof ListenableWorker.Result.Success,
        // );
        // ```
        assertTrue("a normal sweep run must report success, was $result", result is ListenableWorker.Result.Success)
    }
}
