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
// TS map:   There is no exact equivalent. The closest mental model is "this file is part of the
//           `dev.monochromatic.musicplayer` module/folder", similar to how a TS file's location on
//           disk + its `import` lines decide what names it sees. Unlike a TS `import`, this line
//           pulls in NOTHING by itself; it only names where THIS file belongs.
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
// TS map:   A plain named import. Picture `import { Context } from "android/content";` — except
//           Java/Kotlin imports name a SINGLE type per line (the last dotted segment), not a set of
//           named bindings in braces.
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
// TS map:   `import { Uri } from "android/net";`. Think of the browser's `URL` class: a parsed
//           wrapper around a locator string, not the raw string itself.
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
// TS map:   TS has no method-syntax extensions, so this is a free helper you must import and call:
//           `import { toUri } from "androidx/core/net";` then `toUri("some string")`. Kotlin's
//           `"x".toUri()` is sugar for `toUri("x")`.
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
// TS map:   `import { ApplicationProvider } from "androidx/test/core/app";` — a namespace-like
//           object with a static method.
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
// TS map:   `import { AndroidJUnit4 } from "androidx/test/ext/junit/runners";`. There is no direct
//           TS analogue; mentally it is "the test harness/adapter that knows how to execute these
//           tests in an Android process", a bit like choosing a Jest environment.
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
// TS map:   `import { ListenableWorker } from "androidx/work";`. Picture a type
//           `type Result = Success | Failure | Retry` whose variants are reached as
//           `ListenableWorker.Result.Success`.
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
// TS map:   `import { TestListenableWorkerBuilder } from "androidx/work/testing";` — a factory you
//           configure step by step (`.from(...).setInputData(...).build()`), i.e. the builder
//           pattern.
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
// TS map:   `import { workDataOf } from "androidx/work";` then `workDataOf(["max_tracks", 1])` —
//           roughly building a small record/map: `{ max_tracks: 1 }`.
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
// TS map:   `import { runBlocking } from "kotlinx/coroutines";`. There is no real TS equivalent —
//           JS cannot block the thread to await a Promise. The closest mental model is an imaginary
//           `awaitSync(promise)` that synchronously returns the resolved value (which JS forbids).
// Gotcha:   `runBlocking` actually PARKS the thread until the async work completes. In JS you would
//           always reach for `await` inside an `async` function instead; blocking is impossible.
//
// In TS you'd write (pseudocode):
// ```ts
// // No real equivalent. Pretend: function runBlocking<T>(block: () => Promise<T>): T
// // that synchronously waits. In real TS you'd make the test `async` and use `await`.
// ```
import kotlinx.coroutines.runBlocking
// What:     `import org.junit.Assert.assertEquals` imports the `assertEquals` assertion (fails the
//           test unless two values are equal). This imports a STATIC method directly by name.
// Why:      Used to assert the second sweep pass returns exactly `SweepOutcome.CACHED`.
// TS map:   `import { assertEquals } from "org/junit/Assert";`. Like importing `expect`'s
//           `toEqual` as a standalone function.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertEquals } from "org/junit/Assert";
// ```
import org.junit.Assert.assertEquals
// What:     `import org.junit.Assert.assertNotNull` imports the `assertNotNull` assertion (fails the
//           test if the given value is `null`).
// Why:      Used to assert a fingerprint key and a cached peak both exist (are non-null) after the
//           first pass.
// TS map:   `import { assertNotNull } from "org/junit/Assert";`. Like asserting
//           `expect(value).not.toBeNull()`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertNotNull } from "org/junit/Assert";
// ```
import org.junit.Assert.assertNotNull
// What:     `import org.junit.Assert.assertTrue` imports the `assertTrue` assertion (fails the test
//           unless the given boolean is `true`); it also accepts a message shown on failure.
// Why:      Used several times to check outcomes and value ranges.
// TS map:   `import { assertTrue } from "org/junit/Assert";`. Like `expect(cond).toBe(true)` with a
//           custom failure message.
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
// TS map:   `import { assumeTrue } from "org/junit/Assume";`. There is no built-in Jest equivalent;
//           closest is `test.skip(...)` chosen at runtime, e.g. `if (!cond) return; // skip`.
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
// TS map:   `import { Test } from "org/junit";`. There is no annotation system in plain TS; the
//           closest analogue is registering a test via a function call like `test("name", fn)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Test } from "org/junit"; // used as the @Test decorator-like marker
// ```
import org.junit.Test
// What:     `import org.junit.runner.RunWith` imports the `@RunWith` annotation, which tells JUnit
//           WHICH runner class should drive this test class.
// Why:      The class below uses `@RunWith(AndroidJUnit4::class)` to select the Android runner.
// TS map:   `import { RunWith } from "org/junit/runner";`. No plain-TS analogue; think of it as
//           "choose the test environment/adapter for this file".
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
// TS map:   The `::class` part has no direct TS equivalent; the closest is passing the CLASS ITSELF
//           as a value, like `AndroidJUnit4` (the constructor function) rather than `new AndroidJUnit4()`.
//           The whole construct maps to decorating a class:
//             `@RunWith(AndroidJUnit4)`
//             `class PeakSweepWorkerTest { ... }`
//           or, more like real test frameworks, a `describe("PeakSweepWorkerTest", () => { ... })`
//           block configured to use a given environment.
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
    // TS map:   A getter on the class, computed each access:
    //             `private get context(): Context { return ApplicationProvider.getApplicationContext(); }`
    //           `val` = no setter (like a TS getter with no matching setter).
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
    // TS map:   Like `test("measureAndCacheMeasuresThenCachesOneTrack", () => { ... })` or a
    //           `@Test`/`@test` decorator on the method.
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
    // TS map:   `function measureAndCacheMeasuresThenCachesOneTrack(): void { ... }`. Note: in TS a
    //           test that awaits async work would be `async () => { ... }`; here Kotlin stays sync
    //           and uses `runBlocking` inside instead.
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
        // TS map:   `const tracks: readonly Track[] = await LibrarySource.load(context);`
        //           inside an async test. `List<Track>` ≈ `readonly Track[]`; `val` ≈ `const`.
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
        // TS map:   `if (!tracks.length) return; // skip` — or a real "assume" helper:
        //           `assumeTrue("device library is empty; nothing to sweep", tracks.length > 0);`
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
        // TS map:   `const uri: Uri = toUri(tracks[0].uri);` (using the free `toUri` helper). In
        //           Kotlin the call reads as method syntax `tracks.first().uri.toUri()`.
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
        // TS map:   `const first: SweepOutcome = await measureAndCache(context, uri);` where
        //           `type SweepOutcome = "CACHED" | "MEASURED" | "UNFINGERPRINTABLE" | "FAILED";`.
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
        // TS map:   `assertTrue(\`first pass ... was ${first}\`, first === "MEASURED" || first === "CACHED");`
        //           `$first` ≈ template literal `${first}`.
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

        // What:     `val key: String? = runBlocking { TrackFingerprint.of(context, uri) }` declares a
        //           read-only local `key` whose type is `String?`. The trailing `?` makes it a
        //           NULLABLE type: `key` may hold a `String` OR `null`. `runBlocking { ... }` waits
        //           on the async `TrackFingerprint.of(context, uri)`, which returns `String?` (null
        //           when the track can't be fingerprinted, e.g. the provider didn't report a size).
        //           Sibling type: the NON-nullable `String` (no trailing `?`), which can never be null.
        // Why:      The cache is keyed by a fingerprint; the test re-derives that key so it can look
        //           the cached peak up directly and confirm the sweep stored it.
        // TS map:   `const key: string | null = await TrackFingerprint.of(context, uri);`
        //           Kotlin's `String?` ≈ TS `string | null`.
        // Gotcha:   In Kotlin nullability is part of the TYPE. `String` can NEVER be null; only
        //           `String?` can. The compiler forces you to handle the null case (see `key!!` below).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const key: string | null = await TrackFingerprint.of(context, uri);
        // ```
        val key: String? = runBlocking { TrackFingerprint.of(context, uri) }
        // What:     `assertNotNull("a library track must be fingerprintable", key)` fails the test if
        //           `key` is `null`, printing the message otherwise.
        // Why:      A real library track that we just selected must produce a fingerprint; if it does
        //           not, the cache key path is broken and the rest of the test is meaningless.
        // TS map:   `assertNotNull("a library track must be fingerprintable", key);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertNotNull("a library track must be fingerprintable", key);
        // ```
        assertNotNull("a library track must be fingerprintable", key)
        // What:     `val cachedPeak: Float? = runBlocking { PeakCacheStore.get(context, key!!) }`.
        //           `cachedPeak` is a read-only local of nullable type `Float?` (a 32-bit IEEE-754
        //           floating-point number, OR null). `runBlocking { ... }` waits on the async
        //           `PeakCacheStore.get(context, key!!)`, which returns `Float?` (null on a cache
        //           miss). `key!!` is Kotlin's NOT-NULL ASSERTION operator: it takes the nullable
        //           `key: String?` and yields a non-null `String`, THROWING a
        //           `NullPointerException` at runtime if `key` is actually null.
        //           `Float` is 32-bit; its sibling is `Double` (64-bit), which is what a plain JS
        //           `number` actually is. The audio peak is stored as 32-bit `Float` to match the
        //           sample precision and keep the cache compact.
        // Why:      `get` expects a non-null `String` key, but `key` is typed `String?`; we just
        //           asserted it is non-null above, so `!!` converts the type for the call. The result
        //           is the peak the sweep should have stored.
        // TS map:   `const cachedPeak: number | null = await PeakCacheStore.get(context, key!);`
        //           Kotlin `!!` ≈ TS non-null assertion `key!` — BUT Kotlin's `!!` actually THROWS at
        //           runtime if null, whereas TS `!` is only a compile-time hint that erases at runtime.
        // Gotcha:   `key!!` is not free: if `key` were null this line would crash. It is safe here
        //           ONLY because `assertNotNull(..., key)` ran first. Also note `Float` ≠ JS `number`
        //           precision (JS `number` is a `Double`).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // `key!` asserts non-null to the type checker; Kotlin's `!!` would also throw if null.
        // const cachedPeak: number | null = await PeakCacheStore.get(context, key!);
        // ```
        val cachedPeak: Float? = runBlocking { PeakCacheStore.get(context, key!!) }
        // What:     `assertNotNull("the peak must be cached after the first pass", cachedPeak)` fails
        //           the test if `cachedPeak` is `null`.
        // Why:      After a MEASURED (or already-CACHED) first pass, the peak MUST be present in the
        //           cache; a null here means the sweep did not persist what it measured.
        // TS map:   `assertNotNull("the peak must be cached after the first pass", cachedPeak);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertNotNull("the peak must be cached after the first pass", cachedPeak);
        // ```
        assertNotNull("the peak must be cached after the first pass", cachedPeak)
        // What:     `assertTrue(message, condition)` with a string-template `message` and a compound
        //           `condition`. Breaking the condition down:
        //           - `cachedPeak!!` not-null-asserts the nullable `Float?` into a non-null `Float`
        //             (would throw if null; safe because of the `assertNotNull` directly above).
        //           - `.isFinite()` is a `Float` method returning `true` unless the value is NaN or
        //             +/- infinity.
        //           - `cachedPeak >= 0.0f` compares the peak to the float literal `0.0f`. The `f`
        //             suffix makes it a 32-bit `Float` literal (not a 64-bit `Double`); without `f`,
        //             `0.0` would be a `Double` and Kotlin would not let you compare it to a `Float`
        //             without conversion.
        //           - `cachedPeak < SANE_PEAK_UPPER_BOUND` compares against the named constant
        //             declared in the companion object below (4.0f).
        //           The `$cachedPeak` in the message interpolates the runtime value.
        // Why:      A real measured true-peak must be a finite, non-negative level below a physically
        //           plausible ceiling; this catches a garbage measurement (NaN/infinite/absurd).
        // TS map:   ```ts
        //           assertTrue(
        //             `cached peak ${cachedPeak} should be a sane, finite level`,
        //             Number.isFinite(cachedPeak!) && cachedPeak! >= 0.0 && cachedPeak! < SANE_PEAK_UPPER_BOUND,
        //           );
        //           ```
        //           In TS there is no `Float` vs `Double`; `0.0f` is just `0`. `.isFinite()` ≈
        //           `Number.isFinite(...)`.
        // Gotcha:   The `f` suffix matters in Kotlin: `0.0f` is `Float`, `0.0` is `Double`; mixing
        //           them is a type error. TS has only one number type, so this distinction vanishes.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertTrue(
        //   `cached peak ${cachedPeak} should be a sane, finite level`,
        //   Number.isFinite(cachedPeak!) && cachedPeak! >= 0 && cachedPeak! < SANE_PEAK_UPPER_BOUND,
        // );
        // ```
        assertTrue(
            "cached peak $cachedPeak should be a sane, finite level",
            cachedPeak!!.isFinite() && cachedPeak >= 0.0f && cachedPeak < SANE_PEAK_UPPER_BOUND,
        )

        // What:     `val second: SweepOutcome = runBlocking { measureAndCache(context, uri) }` runs
        //           the same async sweep helper on the SAME `uri` a second time and stores its
        //           outcome in the read-only local `second` (enum `SweepOutcome`). `runBlocking`
        //           waits for the async result.
        // Why:      Now that the peak is cached, a second pass must NOT decode again; capturing the
        //           outcome lets us assert it short-circuited to a cache hit.
        // TS map:   `const second: SweepOutcome = await measureAndCache(context, uri);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const second: SweepOutcome = await measureAndCache(context, uri);
        // ```
        val second: SweepOutcome = runBlocking { measureAndCache(context, uri) }
        // What:     `assertEquals("the second pass must be a pure cache hit", SweepOutcome.CACHED, second)`
        //           fails the test unless `second` equals `SweepOutcome.CACHED`. JUnit's
        //           `assertEquals` takes (message, expected, actual) in that order:
        //           `SweepOutcome.CACHED` is the expected, `second` is the actual.
        // Why:      The whole point of the cache is that the second measurement of an already-known
        //           track does zero decoding and reports CACHED; this asserts that contract.
        // TS map:   `assertEquals("the second pass must be a pure cache hit", "CACHED", second);`
        // Gotcha:   Argument order is (expected, actual). It is easy to flip these; the message and
        //           the constant make the intent explicit.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertEquals("the second pass must be a pure cache hit", "CACHED", second);
        // ```
        assertEquals("the second pass must be a pure cache hit", SweepOutcome.CACHED, second)
    }

    // What:     `@Test` marks the next method as a runnable test case.
    // Why:      Tells the runner to execute `workerSweepsBoundedShareAndSucceeds`.
    // TS map:   Like `test("workerSweepsBoundedShareAndSucceeds", () => { ... })`.
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
    // TS map:   `function workerSweepsBoundedShareAndSucceeds(): void { ... }`.
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
        // TS map:   ```ts
        //           const worker: PeakSweepWorker = TestListenableWorkerBuilder
        //             .from(context, PeakSweepWorker) // pass the class value, not `.class.java`
        //             .setInputData(workDataOf([PeakSweepWorker.KEY_MAX_TRACKS, 1]))
        //             .build();
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
        // TS map:   `const result: ListenableWorker.Result = await worker.doWork();`
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
        // TS map:   `assertTrue(\`... was ${result}\`, result instanceof ListenableWorker.Result.Success);`
        //           Kotlin `x is T` ≈ TS `x instanceof T`.
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

    // What:     `private companion object { ... }` declares a COMPANION OBJECT for this class. A
    //           companion object is a single, lazily-created singleton tied to the class itself; its
    //           members are accessed on the CLASS (like `static` members in Java/TS), e.g.
    //           `PeakSweepWorkerTest`-level constants. `private` keeps it visible only inside this
    //           class. A Kotlin class may have at most ONE companion object.
    // Why:      It is the idiomatic place to hang class-level (static) constants the test methods
    //           share, here the sanity ceiling for a measured peak.
    // TS map:   There is no separate companion concept; static members live directly on the class:
    //             `class PeakSweepWorkerTest { private static readonly SANE_PEAK_UPPER_BOUND = 4.0; }`
    //           Mentally, `companion object { X }` ≈ "the `static` section of the class".
    // Gotcha:   Members here are accessed WITHOUT an instance (`PeakSweepWorkerTest.SANE_...` from
    //           outside, or just `SANE_...` from inside the class), unlike normal instance members.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // (these become `static` members of the class)
    // private static readonly SANE_PEAK_UPPER_BOUND: number = 4.0;
    // ```
    private companion object {
        // What:     `private const val SANE_PEAK_UPPER_BOUND: Float = 4.0f` declares a compile-time
        //           CONSTANT named `SANE_PEAK_UPPER_BOUND` of type `Float` (32-bit float) with value
        //           `4.0f`. `const val` means the value is known at compile time and inlined at use
        //           sites (stronger than a plain `val`, which is merely read-only at runtime). The
        //           `f` suffix makes `4.0f` a 32-bit `Float` literal (not a 64-bit `Double` `4.0`).
        //           `Float` (32-bit) vs sibling `Double` (64-bit, == JS `number`): the cached peaks
        //           are `Float`, so the ceiling is a `Float` to compare without conversion.
        //           Domain meaning (from the old KDoc): true peaks above this are physically
        //           implausible. A few dB of inter-sample overshoot above 1.0 is normal, so 4.0 is a
        //           comfortable ceiling, anything beyond it signals a broken measurement.
        // Why:      Gives the range assertion a single named ceiling instead of a magic number, and
        //           documents WHY 4.0 (overshoot is expected; absurd values are not).
        // TS map:   `private static readonly SANE_PEAK_UPPER_BOUND: number = 4.0;`
        //           TS has no `const`-vs-`val` compile-time-inline distinction and no `Float`/`Double`
        //           split, so the `f` suffix and `const` keyword both vanish.
        // Gotcha:   `const val` here is NOT a JS `const` local; it is a class-level (static),
        //           compile-time-inlined constant. And `4.0f` is 32-bit, narrower than JS `number`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly SANE_PEAK_UPPER_BOUND: number = 4.0;
        // ```
        private const val SANE_PEAK_UPPER_BOUND: Float = 4.0f
    }
}
