// File summary (folds in the old KDoc on the class below):
//   On-device verification of the Media3TruePeakDecoder against known-peak fixtures. The decoder
//   drives a real android.media.MediaExtractor plus android.media.MediaCodec, which only exist on a
//   physical device or emulator, so this whole file runs as a CONNECTED (instrumented) test, not on
//   the host JVM. Think of it as an end-to-end test that has to talk to real OS audio hardware APIs.
//
//   The oracle (the thing we compare against) is deliberately INDEPENDENT of the core true-peak DSP:
//   each fixture is a hand-built signal whose peak is known purely from how it was constructed (a
//   constant level, or one isolated loud spike), so a wrong decoder cannot accidentally pass by
//   sharing the meter's own arithmetic. The core DSP is also `internal` (Kotlin's package-private-ish
//   visibility) and therefore invisible to this separate test module, which reinforces the same
//   separation.
//
//   Every fixture is uncompressed 16-bit PCM (raw audio samples, no compression) wrapped in a WAV
//   container, so the bytes the decoder reads back equal the bytes we wrote. That makes these tests
//   pin the decode plumbing exactly: the extractor/codec dequeue loop, end-of-stream handling (a
//   spike near the END would be lost to an early stop), the signed-16-bit-to-float scaling, and the
//   interleaved channel routing. The decode produces no audio output (decode-only, no playback), so
//   it is silent and safe to run while others are nearby.
//
//   Domain numbers a TS reader will see below: signed 16-bit PCM ranges -32768..+32767, and a sample
//   is scaled to a float by dividing by 32768, so 16384/32768 == 0.5 and 29491/32768 ~= 0.9. The
//   meter does ~4x Catmull-Rom (cubic) oversampling to catch peaks that fall BETWEEN stored samples,
//   which is why upper bounds leave a little headroom above the exact level. A fully silent stream is
//   mapped to unity gain by the meter's silence guard, so silence measures exactly 0.0.

// What:     `package dev.monochromatic.musicplayer` declares which package (namespace) every
//           declaration in this file belongs to. In Kotlin the package is decided by this line, NOT
//           by the folder path, though convention keeps them in sync.
// Why:      Lets other files in the same package see this test's symbols without an import, and lets
//           the test runner address the class by its fully-qualified name.
// TS map:   No direct equivalent. TS has no file-level `package` keyword; modules are identified by
//           file path. Mentally, picture it as the directory a module lives in.
//
// In TS you'd write (pseudocode):
// ```ts
// // (nothing — the file's location IS its module identity)
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.ContentUris` pulls one class, `ContentUris`, into scope so we can
//           write `ContentUris` instead of its full dotted path. `ContentUris` builds content:// URIs
//           with a numeric id appended (used to address one row in MediaStore).
// Why:      Needed so the timing test can turn a MediaStore row id into a playable Uri.
// TS map:   A named import. `import { ContentUris } from "android/content";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { ContentUris } from "android/content";
// ```
import android.content.ContentUris

// What:     `import android.content.Context` brings in `Context`, Android's handle to the running app
//           environment (its cache dir, content resolver, resources, etc.).
// Why:      The test reads `context.cacheDir` and `context.contentResolver`, so it must name the type.
// TS map:   `import { Context } from "android/content";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { Context } from "android/content";
// ```
import android.content.Context

// What:     `import android.net.Uri` brings in `Uri`, Android's parsed-URI value type (`file://...`,
//           `content://...`).
// Why:      Fixtures are passed to the decoder as `Uri.fromFile(file)`, and library tracks are URIs.
// TS map:   `import { Uri } from "android/net";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { Uri } from "android/net";
// ```
import android.net.Uri

// What:     `import android.provider.MediaStore` brings in `MediaStore`, the system database of media
//           files on the device (the user's indexed music library).
// Why:      The timing test queries `MediaStore` for real on-device tracks to decode.
// TS map:   `import { MediaStore } from "android/provider";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { MediaStore } from "android/provider";
// ```
import android.provider.MediaStore

// What:     `import android.util.Log` brings in `Log`, Android's logcat logger (`Log.i(tag, msg)`
//           writes an info-level line to the device log).
// Why:      The timing test logs per-track and total elapsed times under a shared tag.
// TS map:   `import { Log } from "android/util";` — closest runtime analogue is `console`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Log } from "android/util";
// ```
import android.util.Log

// What:     `import androidx.test.core.app.ApplicationProvider` brings in `ApplicationProvider`, a
//           test helper that hands back the app's `Context` while running under the instrumentation.
// Why:      The `context` property uses it to obtain a real `Context` on-device.
// TS map:   `import { ApplicationProvider } from "androidx/test/core/app";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { ApplicationProvider } from "androidx/test/core/app";
// ```
import androidx.test.core.app.ApplicationProvider

// What:     `import androidx.test.ext.junit.runners.AndroidJUnit4` brings in `AndroidJUnit4`, the
//           JUnit "runner" (the engine that finds and executes `@Test` methods) for Android
//           instrumented tests.
// Why:      The class is annotated `@RunWith(AndroidJUnit4::class)` so this runner drives it.
// TS map:   No 1:1 — picture importing a test-framework runner like a custom Jest environment.
//
// In TS you'd write (pseudocode):
// ```ts
// import { AndroidJUnit4 } from "androidx/test/ext/junit/runners";
// ```
import androidx.test.ext.junit.runners.AndroidJUnit4

// What:     `import java.io.File` brings in `File`, Java's path/handle type for files on disk (it
//           does not open the file by itself; it is a reference to a path).
// Why:      Fixtures are written to and read from a real cache file before decoding.
// TS map:   No exact match; mentally it's like a `fs.PathLike` plus a few helper methods.
//
// In TS you'd write (pseudocode):
// ```ts
// import { File } from "java/io"; // ~ a path handle, not Web `File`
// ```
import java.io.File

// What:     `import java.nio.ByteBuffer` brings in `ByteBuffer`, a fixed-capacity binary buffer with
//           a moving write/read cursor (`put`, `putInt`, `putShort`, `array`).
// Why:      The WAV encoder assembles the header and sample bytes into one `ByteBuffer`.
// TS map:   Closest is a `DataView` over an `ArrayBuffer`, which also writes typed integers.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ByteBuffer } from "java/nio"; // ~ DataView + ArrayBuffer
// ```
import java.nio.ByteBuffer

// What:     `import java.nio.ByteOrder` brings in `ByteOrder`, an enum-like type with the values
//           `LITTLE_ENDIAN` and `BIG_ENDIAN` controlling the byte order multi-byte numbers are
//           written in.
// Why:      WAV is little-endian, so the buffer is set to `LITTLE_ENDIAN` before writing ints/shorts.
// TS map:   `DataView` methods take a `littleEndian` boolean argument instead of an order object.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ByteOrder } from "java/nio"; // in TS: a boolean flag on DataView setters
// ```
import java.nio.ByteOrder

// What:     `import kotlinx.coroutines.runBlocking` brings in `runBlocking`, a coroutine bridge that
//           runs a `suspend` (async) block and BLOCKS the current thread until it completes, handing
//           back the block's result.
// Why:      `Media3TruePeakDecoder.measure(...)` is a `suspend` function; the synchronous JUnit test
//           bodies use `runBlocking` to await it without an async test framework.
// TS map:   There is no blocking `await` in TS. Mentally it's `await someAsyncFn()` but where the
//           whole thread parks until the promise settles.
// Gotcha:   Unlike `await`, this genuinely freezes the OS thread; it is a test-only convenience, not
//           something you would do in production UI code.
//
// In TS you'd write (pseudocode):
// ```ts
// import { runBlocking } from "kotlinx/coroutines"; // ~ a synchronous `await`
// ```
import kotlinx.coroutines.runBlocking

// What:     `import org.junit.Assert.assertEquals` imports the static function `assertEquals` so it
//           can be called bare. The float overload used here is `assertEquals(expected, actual, delta)`
//           and fails the test unless `|expected - actual| <= delta`.
// Why:      The exact fixtures (constant 0.5, silence 0.0) assert equality within a tiny tolerance.
// TS map:   `import { assertEquals } from "junit";` — like `expect(actual).toBeCloseTo(expected)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertEquals } from "junit";
// ```
import org.junit.Assert.assertEquals

// What:     `import org.junit.Assert.assertTrue` imports the static `assertTrue(message, condition)`
//           which fails with `message` unless `condition` is `true`.
// Why:      The spike/range tests assert measured values fall inside bounds.
// TS map:   `import { assertTrue } from "junit";` — like `expect(condition).toBe(true)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertTrue } from "junit";
// ```
import org.junit.Assert.assertTrue

// What:     `import org.junit.Assume.assumeTrue` imports `assumeTrue(message, condition)`. Unlike an
//           assert, a FAILED assumption SKIPS the test (marks it ignored) rather than failing it.
// Why:      The timing test needs an indexed music library; if none exists it skips, not fails.
// TS map:   No direct Jest analogue; closest is calling `test.skip` conditionally at runtime.
// Gotcha:   `assume*` and `assert*` look alike but mean opposite things on failure (skip vs fail).
//
// In TS you'd write (pseudocode):
// ```ts
// import { assumeTrue } from "junit"; // false => skip the test, not fail it
// ```
import org.junit.Assume.assumeTrue

// What:     `import org.junit.Test` brings in the `@Test` annotation that marks a method as a test
//           case the runner should execute.
// Why:      Each test method below is annotated `@Test`.
// TS map:   No import needed in Jest; `test(...)`/`it(...)` are globals. Picture it as that marker.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Test } from "junit"; // ~ the `it(...)` wrapper
// ```
import org.junit.Test

// What:     `import org.junit.runner.RunWith` brings in the `@RunWith` annotation that tells JUnit
//           which runner engine to use for the class.
// Why:      The class is annotated `@RunWith(AndroidJUnit4::class)` to run on-device.
// TS map:   No analogue; mentally a per-suite "use this test environment" directive.
//
// In TS you'd write (pseudocode):
// ```ts
// import { RunWith } from "junit";
// ```
import org.junit.runner.RunWith

// What:     `@RunWith(AndroidJUnit4::class)` is an ANNOTATION on the class. `AndroidJUnit4::class` is
//           a CLASS REFERENCE (Kotlin's `::class` yields a `KClass` token, the runtime stand-in for
//           the type itself, similar to passing the class object rather than an instance). It tells
//           JUnit to drive this suite with the Android instrumented-test runner.
// Why:      Without it, JUnit would run on the host JVM where MediaExtractor/MediaCodec do not exist.
// TS map:   No native equivalent. `::class` is like passing the class value `AndroidJUnit4` itself
//           (a constructor reference), not `new AndroidJUnit4()`.
//
// In TS you'd write (pseudocode):
// ```ts
// // @RunWith(AndroidJUnit4)  // pass the class itself, not an instance
// ```
@RunWith(AndroidJUnit4::class)
// What:     `class Media3TruePeakDecoderTest { ... }` declares the test class that groups the test
//           methods. It takes no constructor parameters.
// Why:      JUnit instantiates this class and invokes each `@Test` method on it.
// TS map:   `class Media3TruePeakDecoderTest { ... }` — same keyword, same idea.
//
// In TS you'd write (pseudocode):
// ```ts
// class Media3TruePeakDecoderTest { /* ... */ }
// ```
class Media3TruePeakDecoderTest {
    // What:     `private val context: Context get() = ApplicationProvider.getApplicationContext()`
    //           declares a read-only property `context` of type `Context`, computed each time it is
    //           read via the custom `get()`. `private` limits it to this class. `val` means
    //           read-only (no reassignment), the Kotlin sibling of `var` (reassignable). The `get()`
    //           form makes it a computed getter, not a stored field.
    //           `ApplicationProvider.getApplicationContext()` is generic; Kotlin infers its return
    //           type from the property's declared `Context`, so no explicit type argument is written.
    // Why:      Gives every test a fresh handle to the app `Context` without storing it.
    // TS map:   A getter on the class. `private get context(): Context { return getApplicationContext(); }`
    // Gotcha:   `val` here still RE-RUNS the getter on every access; it is not a cached constant.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private get context(): Context {
    //   return ApplicationProvider.getApplicationContext();
    // }
    // ```
    private val context: Context get() = ApplicationProvider.getApplicationContext()

    // What:     `private fun measureFixture(samples: ShortArray, channels: Int, name: String): Float`
    //           declares a private helper method. Parameters:
    //           - `samples: ShortArray`. A primitive array of `Short` (16-bit signed integers),
    //             interleaved PCM. Siblings the reader might expect: `IntArray` (32-bit), `Array<Short>`
    //             (a boxed object array). `ShortArray` is chosen because PCM samples are exactly 16-bit
    //             and a primitive array avoids per-element boxing.
    //           - `channels: Int`. A 32-bit signed integer channel count. Sibling: `Long` (64-bit).
    //             `Int` is chosen because a channel count is tiny and the WAV/byte APIs expect `Int`.
    //           - `name: String`. The cache file name.
    //           Return `Float`. A 32-bit IEEE float. Sibling: `Double` (64-bit). `Float` is chosen to
    //           match the decoder/meter, which work in single precision audio samples.
    // Why:      Centralises the write-WAV-then-decode flow so each test is one call.
    // TS map:   `private measureFixture(samples: Int16Array, channels: number, name: string): number`
    //           — note TS has only one `number`, so the Float-vs-Double and Short-vs-Int choices vanish.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private measureFixture(samples: Int16Array, channels: number, name: string): number { /* ... */ }
    // ```
    private fun measureFixture(samples: ShortArray, channels: Int, name: String): Float {
        // What:     `val file: File = File(context.cacheDir, name)` constructs a `File` handle (a path
        //           reference, no I/O yet) under the app's cache directory with the given file name.
        //           `val` is the read-only binding; `File(parent, child)` is the two-arg constructor.
        // Why:      Gives a concrete on-disk path to write the WAV fixture to and decode from.
        // TS map:   `const file = new File(context.cacheDir, name);` — `val` is `const`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const file = new File(context.cacheDir, name);
        // ```
        val file: File = File(context.cacheDir, name)

        // What:     `file.writeBytes(encodeWav16(samples, channels, SAMPLE_RATE))` calls our encoder to
        //           build the WAV byte array, then `writeBytes` truncates/creates the file and writes
        //           all of those bytes to disk in one shot.
        // Why:      Materialise the fixture as a real file the decoder can open via a `file://` URI.
        // TS map:   `fs.writeFileSync(file.path, encodeWav16(samples, channels, SAMPLE_RATE));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // fs.writeFileSync(file.path, encodeWav16(samples, channels, SAMPLE_RATE));
        // ```
        file.writeBytes(encodeWav16(samples, channels, SAMPLE_RATE))

        // What:     `return runBlocking { Media3TruePeakDecoder.measure(context, Uri.fromFile(file)) }`.
        //           `runBlocking { ... }` is a function call whose single argument is a TRAILING LAMBDA
        //           (Kotlin lets the last lambda argument sit outside the parentheses, in braces). It
        //           runs the `suspend` body and blocks until it returns. Inside, `Uri.fromFile(file)`
        //           converts the `File` into a `file://` `Uri`, and `Media3TruePeakDecoder.measure(...)`
        //           decodes and measures, returning a `Float`. `runBlocking` returns that `Float`, which
        //           `return` hands back.
        // Why:      Bridge the async measure into the synchronous test method and return its result.
        // TS map:   `return await Media3TruePeakDecoder.measure(context, Uri.fromFile(file));` — the
        //           `runBlocking { }` wrapper is the (blocking) stand-in for `await`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return await Media3TruePeakDecoder.measure(context, Uri.fromFile(file));
        // ```
        return runBlocking { Media3TruePeakDecoder.measure(context, Uri.fromFile(file)) }
    }

    // What:     `@Test` marks the next method as a JUnit test case.
    // Why:      So the runner executes `decodesConstantHalfScaleToExactlyHalf`.
    // TS map:   The `it("...", () => { ... })` wrapper around the function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // it("decodes constant half-scale to exactly half", () => { /* ... */ });
    // ```
    @Test
    // What:     `fun decodesConstantHalfScaleToExactlyHalf() { ... }` declares a no-arg test method
    //           returning `Unit` (Kotlin's `void`, written implicitly here).
    // Why:      Verifies a constant +0.5-full-scale signal measures exactly 0.5.
    // TS map:   `function decodesConstantHalfScaleToExactlyHalf(): void { /* ... */ }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function decodesConstantHalfScaleToExactlyHalf(): void { /* ... */ }
    // ```
    fun decodesConstantHalfScaleToExactlyHalf() {
        // Every sample is +0.5 full scale exactly (16384 / 32768 == 0.5), so the true peak is 0.5
        // with no inter-sample overshoot; a wrong byte-to-float scale (e.g. a factor-of-2 error)
        // would land at 0.25 or 1.0 and fail this tight bound.
        // What:     `val samples = ShortArray(MONO_FRAMES) { HALF_SCALE_SHORT }` builds a `ShortArray`
        //           of length `MONO_FRAMES`. The `{ ... }` is an INIT LAMBDA called once per index; it
        //           ignores the index and returns `HALF_SCALE_SHORT` for every slot, so the array is
        //           filled with that constant. Type `ShortArray` is inferred (no annotation here).
        // Why:      Produce a flat DC signal at exactly +0.5 full scale for the constant-level test.
        // TS map:   `const samples = new Int16Array(MONO_FRAMES).fill(HALF_SCALE_SHORT);` — the trailing
        //           lambda is the per-index initialiser, here ignoring the index like `.fill`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const samples = new Int16Array(MONO_FRAMES).fill(HALF_SCALE_SHORT);
        // ```
        val samples = ShortArray(MONO_FRAMES) { HALF_SCALE_SHORT }

        // What:     `val measured: Float = measureFixture(samples, channels = 1, name = "...")` calls
        //           the helper with NAMED ARGUMENTS (`channels = 1`, `name = "..."`); Kotlin lets you
        //           label arguments at the call site for clarity. Result type is `Float` (annotated).
        // Why:      Run the full encode/decode/measure pipeline on the constant fixture.
        // TS map:   TS has no named args; you pass positionally or via an options object:
        //           `const measured = this.measureFixture(samples, 1, "truepeak-dc-half.wav");`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const measured: number = this.measureFixture(samples, /* channels */ 1, "truepeak-dc-half.wav");
        // ```
        val measured: Float = measureFixture(samples, channels = 1, name = "truepeak-dc-half.wav")

        // What:     `assertEquals(0.5f, measured, EXACT_TOLERANCE)`. `0.5f` is a `Float` literal (the
        //           `f` suffix makes it 32-bit, not a 64-bit `Double`; without it Kotlin would infer
        //           `Double`). Asserts `|0.5 - measured| <= EXACT_TOLERANCE`.
        // Why:      Pin the constant signal's peak to exactly 0.5 within a tiny tolerance.
        // TS map:   `expect(measured).toBeCloseTo(0.5)` — TS has no `f` suffix; all numbers are doubles.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertEquals(0.5, measured, EXACT_TOLERANCE);
        // ```
        assertEquals(0.5f, measured, EXACT_TOLERANCE)
    }

    // What:     `@Test` marks the next method as a JUnit test case.
    // Why:      So the runner executes `measuresLoudSpikeNearStreamEnd`.
    // TS map:   The `it("...", () => { ... })` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // it("measures a loud spike near the stream end", () => { /* ... */ });
    // ```
    @Test
    // What:     `fun measuresLoudSpikeNearStreamEnd() { ... }` declares a no-arg test returning `Unit`.
    // Why:      Verifies the decoder reads the WHOLE stream, including a spike placed near the end.
    // TS map:   `function measuresLoudSpikeNearStreamEnd(): void { /* ... */ }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function measuresLoudSpikeNearStreamEnd(): void { /* ... */ }
    // ```
    fun measuresLoudSpikeNearStreamEnd() {
        // A quiet body with one loud sample placed near the END: if the decode loop stops early or
        // drops the tail, it never sees the spike and reports roughly the quiet level (~0.1), so this
        // proves the whole stream is decoded. The band's lower edge sits just below the spike's exact
        // 0.9 level; the upper edge allows the small Catmull-Rom inter-sample overshoot.
        // What:     `val samples = ShortArray(MONO_FRAMES) { QUIET_SHORT }` builds a `ShortArray` of
        //           length `MONO_FRAMES` whose init lambda fills every slot with `QUIET_SHORT`.
        // Why:      Start from an all-quiet body that the single spike will stand out against.
        // TS map:   `const samples = new Int16Array(MONO_FRAMES).fill(QUIET_SHORT);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const samples = new Int16Array(MONO_FRAMES).fill(QUIET_SHORT);
        // ```
        val samples = ShortArray(MONO_FRAMES) { QUIET_SHORT }

        // What:     `samples[MONO_FRAMES - SPIKE_FROM_END] = LOUD_SHORT` overwrites one element near the
        //           end of the array (index = last frame minus the offset) with the loud value. Plain
        //           subscript assignment, same as TS.
        // Why:      Plant the lone loud spike close to the stream's end so an early stop would miss it.
        // TS map:   `samples[MONO_FRAMES - SPIKE_FROM_END] = LOUD_SHORT;` — identical.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // samples[MONO_FRAMES - SPIKE_FROM_END] = LOUD_SHORT;
        // ```
        samples[MONO_FRAMES - SPIKE_FROM_END] = LOUD_SHORT

        // What:     `val measured: Float = measureFixture(samples, channels = 1, name = "...")` runs the
        //           pipeline on the spiked mono fixture, using named arguments; returns a `Float`.
        // Why:      Measure the peak of the spiked signal to check the tail was decoded.
        // TS map:   `const measured = this.measureFixture(samples, 1, "truepeak-spike.wav");`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const measured: number = this.measureFixture(samples, /* channels */ 1, "truepeak-spike.wav");
        // ```
        val measured: Float = measureFixture(samples, channels = 1, name = "truepeak-spike.wav")

        // What:     `assertTrue("...$measured...", measured >= SPIKE_LOWER_BOUND)`. The message is a
        //           STRING TEMPLATE: `$measured` interpolates the variable's value into the string
        //           (Kotlin's `$name` / `${expr}` syntax). The condition asserts the measured peak is
        //           at least the lower bound.
        // Why:      Fail (with a helpful message) if the decoder missed the spike near the end.
        // TS map:   `assertTrue(\`measured ${measured} should reach the loud spike near the end\`,
        //           measured >= SPIKE_LOWER_BOUND)` — `$x` maps to template-literal `${x}`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertTrue(`measured ${measured} should reach the loud spike near the end`,
        //   measured >= SPIKE_LOWER_BOUND);
        // ```
        assertTrue(
            "measured $measured should reach the loud spike near the end",
            measured >= SPIKE_LOWER_BOUND,
        )

        // What:     `assertTrue("measured $measured should stay a sane level", measured <= SANE_UPPER_BOUND)`
        //           interpolates `$measured` into the message and asserts the peak is not absurdly high.
        // Why:      Catch an over-scale bug that would push the measured peak past a sane ceiling.
        // TS map:   `assertTrue(\`measured ${measured} should stay a sane level\`, measured <= SANE_UPPER_BOUND);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertTrue(`measured ${measured} should stay a sane level`, measured <= SANE_UPPER_BOUND);
        // ```
        assertTrue("measured $measured should stay a sane level", measured <= SANE_UPPER_BOUND)
    }

    // What:     `@Test` marks the next method as a JUnit test case.
    // Why:      So the runner executes `routesInterleavedStereoSpikeInTheSecondChannel`.
    // TS map:   The `it("...", () => { ... })` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // it("routes an interleaved stereo spike in the second channel", () => { /* ... */ });
    // ```
    @Test
    // What:     `fun routesInterleavedStereoSpikeInTheSecondChannel() { ... }` declares a no-arg test
    //           returning `Unit`.
    // Why:      Verifies channel-count and interleaving handling by hiding the spike in the right lane.
    // TS map:   `function routesInterleavedStereoSpikeInTheSecondChannel(): void { /* ... */ }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function routesInterleavedStereoSpikeInTheSecondChannel(): void { /* ... */ }
    // ```
    fun routesInterleavedStereoSpikeInTheSecondChannel() {
        // Left channel quiet, right channel carries the spike. Interleaved as L,R,L,R,...; a decoder
        // that mis-handles channel count or interleaving would miss the right-channel spike. Frame
        // count is the same; the spike sits in the right (odd) lane near the end.
        // What:     `val samples = ShortArray(STEREO_FRAMES * 2) { QUIET_SHORT }` builds a `ShortArray`
        //           of length `STEREO_FRAMES * 2` (two samples per frame for stereo), filling every
        //           slot with `QUIET_SHORT` via the init lambda.
        // Why:      Lay down an all-quiet interleaved L,R,L,R buffer before planting one spike.
        // TS map:   `const samples = new Int16Array(STEREO_FRAMES * 2).fill(QUIET_SHORT);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const samples = new Int16Array(STEREO_FRAMES * 2).fill(QUIET_SHORT);
        // ```
        val samples = ShortArray(STEREO_FRAMES * 2) { QUIET_SHORT }

        // What:     `val spikeFrame: Int = STEREO_FRAMES - SPIKE_FROM_END` computes the FRAME index
        //           (not the sample index) where the spike goes, near the end. `Int` annotated; sibling
        //           `Long` not needed since the value is small. Plain subtraction.
        // Why:      Choose a frame close to the end, then derive the right-channel sample slot from it.
        // TS map:   `const spikeFrame = STEREO_FRAMES - SPIKE_FROM_END;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const spikeFrame: number = STEREO_FRAMES - SPIKE_FROM_END;
        // ```
        val spikeFrame: Int = STEREO_FRAMES - SPIKE_FROM_END

        // What:     `samples[spikeFrame * 2 + 1] = LOUD_SHORT` writes the loud value into the RIGHT
        //           channel of that frame. In interleaved L,R layout, frame `f`'s left sample is at
        //           `f*2` and its right sample at `f*2 + 1`; the `+1` selects the right (odd) lane.
        // Why:      Hide the spike in the second channel so only correct interleaving will find it.
        // TS map:   `samples[spikeFrame * 2 + 1] = LOUD_SHORT;` — identical indexing.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // samples[spikeFrame * 2 + 1] = LOUD_SHORT;
        // ```
        samples[spikeFrame * 2 + 1] = LOUD_SHORT

        // What:     `val measured: Float = measureFixture(samples, channels = 2, name = "...")` runs the
        //           pipeline declaring 2 channels (named argument) so the WAV header and decode treat
        //           the buffer as stereo; returns a `Float`.
        // Why:      Measure the stereo fixture's peak to confirm the right-channel spike was routed.
        // TS map:   `const measured = this.measureFixture(samples, 2, "truepeak-stereo.wav");`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const measured: number = this.measureFixture(samples, /* channels */ 2, "truepeak-stereo.wav");
        // ```
        val measured: Float = measureFixture(samples, channels = 2, name = "truepeak-stereo.wav")

        // What:     `assertTrue("measured $measured should reach the right-channel spike", measured >= SPIKE_LOWER_BOUND)`
        //           interpolates `$measured` and asserts the peak reached the spike level.
        // Why:      Fail if interleaving/channel handling dropped the right-channel spike.
        // TS map:   `assertTrue(\`measured ${measured} should reach the right-channel spike\`, measured >= SPIKE_LOWER_BOUND);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertTrue(`measured ${measured} should reach the right-channel spike`,
        //   measured >= SPIKE_LOWER_BOUND);
        // ```
        assertTrue(
            "measured $measured should reach the right-channel spike",
            measured >= SPIKE_LOWER_BOUND,
        )

        // What:     `assertTrue("measured $measured should stay a sane level", measured <= SANE_UPPER_BOUND)`
        //           interpolates `$measured` and asserts the peak is within a sane ceiling.
        // Why:      Catch an over-scale bug for the stereo path too.
        // TS map:   `assertTrue(\`measured ${measured} should stay a sane level\`, measured <= SANE_UPPER_BOUND);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertTrue(`measured ${measured} should stay a sane level`, measured <= SANE_UPPER_BOUND);
        // ```
        assertTrue("measured $measured should stay a sane level", measured <= SANE_UPPER_BOUND)
    }

    // Times the Media3 (MediaExtractor + MediaCodec) decode + true-peak measure over the first real
    // library tracks, for the like-for-like head-to-head against the full-Rust flavor's
    // nativeMeasureTruePeak (NativeBridgeTest.measureTruePeakOnDevice) on the same MediaStore tracks.
    // Same operation (full decode + 4x Catmull-Rom true peak), so the times are directly comparable.
    // Decode-only, silent; needs READ_MEDIA_AUDIO; skips when no library is indexed. Logged under the
    // shared NativeBench tag.
    // What:     `@Test` marks the next method as a JUnit test case.
    // Why:      So the runner executes `measureLibraryTimingForComparison`.
    // TS map:   The `it("...", () => { ... })` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // it("measures library timing for comparison", () => { /* ... */ });
    // ```
    @Test
    // What:     `fun measureLibraryTimingForComparison() { ... }` declares a no-arg test returning `Unit`.
    // Why:      Benchmarks the Media3 decode+measure path over real library tracks for comparison.
    // TS map:   `function measureLibraryTimingForComparison(): void { /* ... */ }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function measureLibraryTimingForComparison(): void { /* ... */ }
    // ```
    fun measureLibraryTimingForComparison() {
        // What:     `val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)`
        //           fetches the content `Uri` for the external-volume audio table (the user's music).
        //           Type `Uri` is inferred. `getContentUri(...)` is a plain static call.
        // Why:      The table URI is the target the query below runs against.
        // TS map:   `const collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
        // ```
        val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)

        // What:     `val uris = mutableListOf<Uri>()` creates an empty growable list. `mutableListOf<Uri>()`
        //           is a factory with an explicit type argument `<Uri>` (Kotlin generics). Siblings the
        //           reader might expect: `listOf<Uri>()` (read-only) or `arrayListOf<Uri>()`. The
        //           mutable variant is chosen because we `add` to it in the loop below.
        // Why:      Accumulate the track URIs we will time the decode over.
        // TS map:   `const uris: Uri[] = [];` — `mutableListOf<Uri>()` is just `[]` with element type `Uri`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const uris: Uri[] = [];
        // ```
        val uris = mutableListOf<Uri>()

        // What:     A chained statement. `context.contentResolver.query(...)` runs a DB-style query and
        //           returns a NULLABLE `Cursor?` (it can be `null` if the query fails). `?.use { cursor -> ... }`
        //           is a SAFE CALL (`?.`): the `use { }` runs only if the cursor is non-null, and `use`
        //           guarantees the cursor is CLOSED afterward (Kotlin's try-with-resources). `cursor` is
        //           the lambda parameter. The query args: the table URI, `arrayOf(...)` of one column to
        //           select, a WHERE clause `"${...} != 0"` (string template) selecting music rows, then
        //           two `null`s for selection-args and sort-order.
        // Why:      Open a cursor over the music rows and read ids out of it, closing it automatically.
        // TS map:   no `?.use`; mentally: `const cursor = ...query(...); if (cursor) { try { ... } finally { cursor.close(); } }`.
        // Gotcha:   `?.` short-circuits to `null` (skips the block) when the receiver is null; it does
        //           NOT throw. `use` is the resource-closing helper, not a generic block.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const cursor = context.contentResolver.query(
        //   collection, [MediaStore.Audio.Media._ID], `${MediaStore.Audio.Media.IS_MUSIC} != 0`, null, null);
        // if (cursor) {
        //   try {
        //     // ...body using cursor...
        //   } finally { cursor.close(); }
        // }
        // ```
        context.contentResolver.query(collection, arrayOf(MediaStore.Audio.Media._ID), "${MediaStore.Audio.Media.IS_MUSIC} != 0", null, null)?.use { cursor ->
            // What:     `val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)` looks
            //           up the integer column index for the `_ID` column; the `OrThrow` variant THROWS
            //           if the column is missing instead of returning -1. Type `Int` inferred.
            // Why:      We need the column index to read each row's id with `cursor.getLong(...)`.
            // TS map:   `const idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
            // ```
            val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)

            // What:     `while (cursor.moveToNext() && uris.size < TIMING_TRACK_COUNT) { ... }` loops as
            //           long as there is another row AND we have not yet collected enough tracks.
            //           `moveToNext()` advances the cursor and returns `false` when exhausted; `&&` is
            //           short-circuit AND (same as TS).
            // Why:      Walk rows until we have `TIMING_TRACK_COUNT` track URIs or run out of rows.
            // TS map:   `while (cursor.moveToNext() && uris.length < TIMING_TRACK_COUNT) { ... }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // while (cursor.moveToNext() && uris.length < TIMING_TRACK_COUNT) { /* ... */ }
            // ```
            while (cursor.moveToNext() && uris.size < TIMING_TRACK_COUNT) {
                // What:     `uris.add(ContentUris.withAppendedId(collection, cursor.getLong(idColumn)))`.
                //           `cursor.getLong(idColumn)` reads the row's id as a `Long` (64-bit integer;
                //           sibling `Int` is 32-bit, but MediaStore ids are `Long`). `withAppendedId`
                //           builds a per-row content `Uri` from the table URI plus that id, and `add`
                //           appends it to the list.
                // Why:      Turn each matching row into a concrete track URI we can decode later.
                // TS map:   `uris.push(ContentUris.withAppendedId(collection, cursor.getLong(idColumn)));`
                //           — TS has one `number`, so the Long-vs-Int distinction disappears.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // uris.push(ContentUris.withAppendedId(collection, cursor.getLong(idColumn)));
                // ```
                uris.add(ContentUris.withAppendedId(collection, cursor.getLong(idColumn)))
            }
        }

        // What:     `assumeTrue("...", uris.isNotEmpty())`. `uris.isNotEmpty()` returns `true` when the
        //           list has at least one element. `assumeTrue` SKIPS (not fails) the test when the
        //           condition is `false`.
        // Why:      If no music is indexed (or the permission was not granted), skip the benchmark.
        // TS map:   no native skip-on-assumption; mentally `if (uris.length === 0) return; /* skipped */`.
        // Gotcha:   This SKIPS rather than fails; do not read it as an assertion.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (uris.length === 0) return; // skip: no indexed MediaStore audio
        // ```
        assumeTrue("no indexed MediaStore audio (grant READ_MEDIA_AUDIO)", uris.isNotEmpty())

        // What:     `var totalMs = 0.0` declares a REASSIGNABLE accumulator. `var` is the mutable
        //           sibling of `val` (read-only). `0.0` is a `Double` literal (64-bit; sibling `0.0f`
        //           would be a 32-bit `Float`). `Double` is chosen for time accumulation precision.
        // Why:      Sum the per-track elapsed milliseconds for a grand total at the end.
        // TS map:   `let totalMs = 0;` — `var` is `let`; TS has a single `number`, so 0.0-vs-0.0f vanishes.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let totalMs = 0;
        // ```
        var totalMs = 0.0

        // What:     `for (uri in uris) { ... }` iterates each element of the list, binding it to `uri`.
        //           This is Kotlin's for-each (NOT a C-style counter loop); it is the equivalent of
        //           `for...of`, not `for (let i = ...)`.
        // Why:      Decode and time every collected track.
        // TS map:   `for (const uri of uris) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const uri of uris) { /* ... */ }
        // ```
        for (uri in uris) {
            // What:     `val start = System.nanoTime()` reads a monotonic high-resolution timer in
            //           nanoseconds as a `Long`. Its absolute value is meaningless; only DIFFERENCES
            //           are valid. Type `Long` inferred.
            // Why:      Mark the start instant so we can measure how long the decode+measure takes.
            // TS map:   `const start = performance.now() * 1e6;` (nanos) — closest is `performance.now()`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const start = System.nanoTime(); // ~ performance.now(), in nanoseconds
            // ```
            val start = System.nanoTime()

            // What:     `val peak: Float = runBlocking { Media3TruePeakDecoder.measure(context, uri) }`.
            //           `runBlocking { ... }` runs the `suspend` measure and blocks until it returns a
            //           `Float` (annotated). The braces are the trailing-lambda body.
            // Why:      Perform the actual decode+true-peak work that we are timing.
            // TS map:   `const peak = await Media3TruePeakDecoder.measure(context, uri);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const peak: number = await Media3TruePeakDecoder.measure(context, uri);
            // ```
            val peak: Float = runBlocking { Media3TruePeakDecoder.measure(context, uri) }

            // What:     `val elapsedMs = (System.nanoTime() - start) / 1_000_000.0` computes the elapsed
            //           time. The subtraction of two `Long` nanosecond stamps yields a `Long`, then
            //           dividing by the `Double` literal `1_000_000.0` (underscores are digit grouping,
            //           ignored by the compiler) PROMOTES the result to `Double` milliseconds. Had the
            //           divisor been the `Int` `1_000_000`, this would be integer division.
            // Why:      Convert the nanosecond delta into fractional milliseconds for logging/summing.
            // TS map:   `const elapsedMs = (System.nanoTime() - start) / 1_000_000;` — TS divides as
            //           floating point by default; numeric underscores work the same.
            // Gotcha:   The `.0` matters: `/ 1_000_000` (no `.0`) would truncate to whole milliseconds.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const elapsedMs = (System.nanoTime() - start) / 1_000_000;
            // ```
            val elapsedMs = (System.nanoTime() - start) / 1_000_000.0

            // What:     `totalMs += elapsedMs` adds this track's time to the running total. Plain
            //           compound assignment on the `var`.
            // Why:      Build up the grand total across all tracks.
            // TS map:   `totalMs += elapsedMs;` — identical.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // totalMs += elapsedMs;
            // ```
            totalMs += elapsedMs

            // What:     `Log.i(BENCH_TAG, "media3-measure (${uri.lastPathSegment}) -> peak=$peak elapsedMs=${"%.1f".format(elapsedMs)}")`
            //           logs an info line. The message is a STRING TEMPLATE: `${uri.lastPathSegment}`
            //           and `$peak` interpolate values, and `${"%.1f".format(elapsedMs)}` calls the
            //           `format` EXTENSION FUNCTION on the format string `"%.1f"` (Kotlin's
            //           printf-style formatting) to render `elapsedMs` with one decimal place, then
            //           interpolates that.
            // Why:      Record each track's filename, measured peak, and decode time to logcat.
            // TS map:   `Log.i(BENCH_TAG, \`media3-measure (${uri.lastPathSegment}) -> peak=${peak} elapsedMs=${elapsedMs.toFixed(1)}\`);`
            //           — `"%.1f".format(x)` maps to `x.toFixed(1)`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // Log.i(BENCH_TAG,
            //   `media3-measure (${uri.lastPathSegment}) -> peak=${peak} elapsedMs=${elapsedMs.toFixed(1)}`);
            // ```
            Log.i(BENCH_TAG, "media3-measure (${uri.lastPathSegment}) -> peak=$peak elapsedMs=${"%.1f".format(elapsedMs)}")

            // What:     `assertTrue("media3 measure failed for $uri (peak=$peak)", peak >= 0.0f)`. The
            //           message interpolates `$uri` and `$peak`. `0.0f` is a `Float` literal (matches
            //           `peak`'s type). Asserts the measure returned a non-negative peak (a sentinel
            //           below zero would mean failure).
            // Why:      Treat a negative peak as a decode failure for this track and fail the test.
            // TS map:   `assertTrue(\`media3 measure failed for ${uri} (peak=${peak})\`, peak >= 0);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // assertTrue(`media3 measure failed for ${uri} (peak=${peak})`, peak >= 0);
            // ```
            assertTrue("media3 measure failed for $uri (peak=$peak)", peak >= 0.0f)
        }

        // What:     `Log.i(BENCH_TAG, "media3-measure TOTAL ${uris.size} tracks = ${"%.1f".format(totalMs)} ms (MediaCodec decode + true-peak)")`
        //           logs a summary line. `${uris.size}` interpolates the track count; `${"%.1f".format(totalMs)}`
        //           formats the accumulated total to one decimal place.
        // Why:      Emit the grand-total decode time so it can be compared against the Rust flavor.
        // TS map:   `Log.i(BENCH_TAG, \`media3-measure TOTAL ${uris.length} tracks = ${totalMs.toFixed(1)} ms (MediaCodec decode + true-peak)\`);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // Log.i(BENCH_TAG,
        //   `media3-measure TOTAL ${uris.length} tracks = ${totalMs.toFixed(1)} ms (MediaCodec decode + true-peak)`);
        // ```
        Log.i(BENCH_TAG, "media3-measure TOTAL ${uris.size} tracks = ${"%.1f".format(totalMs)} ms (MediaCodec decode + true-peak)")
    }

    // What:     `@Test` marks the next method as a JUnit test case.
    // Why:      So the runner executes `silenceMeasuresZero`.
    // TS map:   The `it("...", () => { ... })` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // it("silence measures zero", () => { /* ... */ });
    // ```
    @Test
    // What:     `fun silenceMeasuresZero() { ... }` declares a no-arg test returning `Unit`.
    // Why:      Verifies an all-zero stream measures exactly 0.0 via the meter's silence guard.
    // TS map:   `function silenceMeasuresZero(): void { /* ... */ }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function silenceMeasuresZero(): void { /* ... */ }
    // ```
    fun silenceMeasuresZero() {
        // An all-zero stream must measure exactly 0.0 (the silence guard maps it to unity gain).
        // What:     `val samples = ShortArray(MONO_FRAMES) { 0 }` builds a `ShortArray` of length
        //           `MONO_FRAMES` whose init lambda returns `0` for every slot. The literal `0` is
        //           coerced to `Short` because the array element type is `Short`.
        // Why:      Produce a fully silent (all-zero) signal for the silence-guard test.
        // TS map:   `const samples = new Int16Array(MONO_FRAMES); // zero-filled by default`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const samples = new Int16Array(MONO_FRAMES); // already all zeros
        // ```
        val samples = ShortArray(MONO_FRAMES) { 0 }

        // What:     `val measured: Float = measureFixture(samples, channels = 1, name = "...")` runs the
        //           pipeline on the silent mono fixture (named arguments); returns a `Float`.
        // Why:      Measure the silent signal's peak to confirm it is exactly zero.
        // TS map:   `const measured = this.measureFixture(samples, 1, "truepeak-silence.wav");`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const measured: number = this.measureFixture(samples, /* channels */ 1, "truepeak-silence.wav");
        // ```
        val measured: Float = measureFixture(samples, channels = 1, name = "truepeak-silence.wav")

        // What:     `assertEquals(0.0f, measured, EXACT_TOLERANCE)`. `0.0f` is a 32-bit `Float` literal
        //           (the `f` suffix; without it `0.0` would be a 64-bit `Double`). Asserts the measured
        //           peak equals 0.0 within the tiny tolerance.
        // Why:      Pin silence to exactly zero.
        // TS map:   `expect(measured).toBeCloseTo(0.0)` — no `f` suffix in TS.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assertEquals(0.0, measured, EXACT_TOLERANCE);
        // ```
        assertEquals(0.0f, measured, EXACT_TOLERANCE)
    }

    // What:     `private fun encodeWav16(samples: ShortArray, channels: Int, sampleRate: Int): ByteArray`
    //           declares a private helper. Parameters:
    //           - `samples: ShortArray`. Interleaved signed 16-bit PCM (sibling `IntArray`/`Array<Short>`;
    //             `ShortArray` matches the 16-bit sample width without boxing).
    //           - `channels: Int` and `sampleRate: Int`. 32-bit ints to declare in the WAV header
    //             (sibling `Long`; `Int` matches the buffer-write APIs and header field widths).
    //           Return `ByteArray`. A primitive array of bytes (sibling `Array<Byte>` boxes each byte;
    //           `ByteArray` is the raw, unboxed buffer the file expects).
    // Why:      Turn raw PCM samples into a complete little-endian WAV file image we can write to disk.
    // TS map:   `private encodeWav16(samples: Int16Array, channels: number, sampleRate: number): Uint8Array`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private encodeWav16(samples: Int16Array, channels: number, sampleRate: number): Uint8Array { /* ... */ }
    // ```
    private fun encodeWav16(samples: ShortArray, channels: Int, sampleRate: Int): ByteArray {
        // What:     `val dataSize: Int = samples.size * BYTES_PER_SAMPLE` computes the byte length of the
        //           sample data: element count times bytes per sample. `Int` annotated; plain
        //           multiplication.
        // Why:      Needed to size the buffer and to fill in the WAV `data` chunk length field.
        // TS map:   `const dataSize = samples.length * BYTES_PER_SAMPLE;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const dataSize: number = samples.length * BYTES_PER_SAMPLE;
        // ```
        val dataSize: Int = samples.size * BYTES_PER_SAMPLE

        // What:     `val buffer: ByteBuffer = ByteBuffer.allocate(WAV_HEADER_BYTES + dataSize).order(ByteOrder.LITTLE_ENDIAN)`
        //           allocates a fixed-capacity byte buffer big enough for the 44-byte header plus the
        //           data, then `.order(LITTLE_ENDIAN)` sets its byte order so multi-byte `putInt`/
        //           `putShort` writes use little-endian (WAV's required order). The call is split over
        //           lines (Kotlin allows the `.` chain to continue on the next line).
        // Why:      One buffer to assemble the whole WAV image in the correct byte order.
        // TS map:   `const buffer = new DataView(new ArrayBuffer(WAV_HEADER_BYTES + dataSize));` then pass
        //           `littleEndian=true` to each setter (DataView has no stored order object).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const ab = new ArrayBuffer(WAV_HEADER_BYTES + dataSize);
        // const buffer = new DataView(ab); // pass littleEndian=true on each set* call
        // ```
        val buffer: ByteBuffer = ByteBuffer
            .allocate(WAV_HEADER_BYTES + dataSize)
            .order(ByteOrder.LITTLE_ENDIAN)

        // What:     `buffer.put("RIFF".toByteArray(Charsets.US_ASCII))`. `"RIFF".toByteArray(Charsets.US_ASCII)`
        //           CONVERTS the string into a `ByteArray` using ASCII (so each char is one byte);
        //           `Charsets.US_ASCII` names the encoding. `buffer.put(bytes)` appends those bytes at
        //           the cursor and advances it.
        // Why:      Write the literal "RIFF" magic that every WAV/RIFF file starts with.
        // TS map:   `buffer.writeBytes(new TextEncoder().encode("RIFF"));` — ASCII text to bytes.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // putBytes(buffer, new TextEncoder().encode("RIFF"));
        // ```
        buffer.put("RIFF".toByteArray(Charsets.US_ASCII))

        // What:     `buffer.putInt(WAV_HEADER_BYTES - RIFF_CHUNK_OVERHEAD + dataSize)` writes a 4-byte
        //           little-endian integer: the RIFF "chunk size" = total file size minus the 8 bytes of
        //           the `RIFF` tag and this size field itself, i.e. header(44) - 8 + data.
        // Why:      RIFF requires this length so readers know how many bytes follow.
        // TS map:   `buffer.setUint32(offset, WAV_HEADER_BYTES - RIFF_CHUNK_OVERHEAD + dataSize, true);`
        //           — `putInt` auto-advances the cursor; DataView needs an explicit offset and `true`
        //           for little-endian.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // putInt(buffer, WAV_HEADER_BYTES - RIFF_CHUNK_OVERHEAD + dataSize); // LE
        // ```
        buffer.putInt(WAV_HEADER_BYTES - RIFF_CHUNK_OVERHEAD + dataSize)

        // What:     `buffer.put("WAVE".toByteArray(Charsets.US_ASCII))` converts "WAVE" to ASCII bytes
        //           and appends them.
        // Why:      RIFF form-type tag declaring this RIFF file is specifically a WAVE.
        // TS map:   `putBytes(buffer, new TextEncoder().encode("WAVE"));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // putBytes(buffer, new TextEncoder().encode("WAVE"));
        // ```
        buffer.put("WAVE".toByteArray(Charsets.US_ASCII))

        // What:     `buffer.put("fmt ".toByteArray(Charsets.US_ASCII))` converts the 4-char string
        //           `"fmt "` (note the trailing space, which makes it exactly 4 bytes) to ASCII bytes
        //           and appends them.
        // Why:      Marks the start of the format chunk that describes the audio layout.
        // TS map:   `putBytes(buffer, new TextEncoder().encode("fmt "));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // putBytes(buffer, new TextEncoder().encode("fmt "));
        // ```
        buffer.put("fmt ".toByteArray(Charsets.US_ASCII))

        // What:     `buffer.putInt(PCM_FMT_CHUNK_SIZE)` writes the 4-byte length (16) of the PCM format
        //           chunk body that follows.
        // Why:      Tells readers the format chunk is 16 bytes long (the canonical PCM size).
        // TS map:   `buffer.setUint32(offset, PCM_FMT_CHUNK_SIZE, true);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // putInt(buffer, PCM_FMT_CHUNK_SIZE); // LE
        // ```
        buffer.putInt(PCM_FMT_CHUNK_SIZE)

        // What:     `buffer.putShort(PCM_FORMAT_TAG)` writes a 2-byte little-endian short, the format
        //           tag `1` meaning uncompressed PCM.
        // Why:      Declares the samples are raw PCM (not a compressed codec).
        // TS map:   `buffer.setUint16(offset, PCM_FORMAT_TAG, true);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // putShort(buffer, PCM_FORMAT_TAG); // LE, 2 bytes
        // ```
        buffer.putShort(PCM_FORMAT_TAG)

        // What:     `buffer.putShort(channels.toShort())`. `channels` is an `Int` (32-bit); `.toShort()`
        //           NARROWS it to a 16-bit `Short` (the WAV channel-count field is 2 bytes). `putShort`
        //           then writes those 2 little-endian bytes.
        // Why:      Records how many channels the data interleaves (1 = mono, 2 = stereo).
        // TS map:   `buffer.setUint16(offset, channels & 0xffff, true);` — TS has no Short; you mask to
        //           16 bits manually.
        // Gotcha:   `.toShort()` TRUNCATES to 16 bits; a value above 32767 would wrap. Fine here (1 or 2).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // putShort(buffer, channels & 0xffff); // LE
        // ```
        buffer.putShort(channels.toShort())

        // What:     `buffer.putInt(sampleRate)` writes the 4-byte little-endian sample rate (e.g. 48000).
        // Why:      Declares how many frames per second the data plays at.
        // TS map:   `buffer.setUint32(offset, sampleRate, true);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // putInt(buffer, sampleRate); // LE
        // ```
        buffer.putInt(sampleRate)

        // What:     `buffer.putInt(sampleRate * channels * BYTES_PER_SAMPLE)` writes the 4-byte "byte
        //           rate" = bytes consumed per second = sampleRate * channels * bytesPerSample.
        // Why:      WAV stores this so players can size buffers; we compute it from the declared fields.
        // TS map:   `buffer.setUint32(offset, sampleRate * channels * BYTES_PER_SAMPLE, true);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // putInt(buffer, sampleRate * channels * BYTES_PER_SAMPLE); // LE
        // ```
        buffer.putInt(sampleRate * channels * BYTES_PER_SAMPLE)

        // What:     `buffer.putShort((channels * BYTES_PER_SAMPLE).toShort())`. The parenthesised
        //           `channels * BYTES_PER_SAMPLE` is the "block align" (bytes per frame across all
        //           channels), an `Int`; `.toShort()` narrows it to the 16-bit field; `putShort` writes
        //           those 2 little-endian bytes.
        // Why:      WAV's block-align field: bytes that make up one interleaved frame.
        // TS map:   `buffer.setUint16(offset, (channels * BYTES_PER_SAMPLE) & 0xffff, true);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // putShort(buffer, (channels * BYTES_PER_SAMPLE) & 0xffff); // LE
        // ```
        buffer.putShort((channels * BYTES_PER_SAMPLE).toShort())

        // What:     `buffer.putShort(BITS_PER_SAMPLE)` writes the 2-byte little-endian bits-per-sample
        //           field (16). `BITS_PER_SAMPLE` is already a `Short`, so no conversion is needed.
        // Why:      Declares each sample is 16 bits wide.
        // TS map:   `buffer.setUint16(offset, BITS_PER_SAMPLE, true);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // putShort(buffer, BITS_PER_SAMPLE); // LE
        // ```
        buffer.putShort(BITS_PER_SAMPLE)

        // What:     `buffer.put("data".toByteArray(Charsets.US_ASCII))` converts "data" to ASCII bytes
        //           and appends them.
        // Why:      Marks the start of the data chunk that holds the raw samples.
        // TS map:   `putBytes(buffer, new TextEncoder().encode("data"));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // putBytes(buffer, new TextEncoder().encode("data"));
        // ```
        buffer.put("data".toByteArray(Charsets.US_ASCII))

        // What:     `buffer.putInt(dataSize)` writes the 4-byte little-endian length of the sample data
        //           that follows.
        // Why:      Tells readers exactly how many bytes of PCM come next.
        // TS map:   `buffer.setUint32(offset, dataSize, true);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // putInt(buffer, dataSize); // LE
        // ```
        buffer.putInt(dataSize)

        // What:     `samples.forEach { buffer.putShort(it) }`. `forEach { ... }` runs the trailing lambda
        //           once per element; `it` is Kotlin's implicit single-parameter name (the current
        //           `Short`). `buffer.putShort(it)` writes each sample as 2 little-endian bytes.
        // Why:      Append every PCM sample, in order, as the data-chunk payload.
        // TS map:   `for (const s of samples) buffer.setInt16(offset, s, true);` — `it` is the loop var
        //           the lambda receives implicitly.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const s of samples) putShort(buffer, s); // LE, signed 16-bit
        // ```
        samples.forEach { buffer.putShort(it) }

        // What:     `return buffer.array()` returns the buffer's backing `ByteArray` (the raw bytes we
        //           filled). Explicit `return`; the tail value is the byte array.
        // Why:      Hand the completed WAV image back so the caller can write it to disk.
        // TS map:   `return new Uint8Array(ab);` — expose the backing bytes of the buffer.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return new Uint8Array(ab);
        // ```
        return buffer.array()
    }

    // What:     `private companion object { ... }` declares the class's COMPANION OBJECT: a single
    //           per-class singleton that holds members shared by all instances, addressed as
    //           `Media3TruePeakDecoderTest.NAME`. It is the Kotlin stand-in for `static` members
    //           (Kotlin has no `static` keyword). `private` keeps it visible only inside this class.
    // Why:      A home for the test's shared constants without making them instance fields.
    // TS map:   `static` members on the class. Picture each `const` below as a `static readonly` field.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // (the constants below become `private static readonly` fields on the class)
    // ```
    private companion object {
        // What:     `private const val BENCH_TAG: String = "NativeBench"` declares a compile-time
        //           constant string. `const val` (stronger than plain `val`) means the value is inlined
        //           at compile time and must be a primitive or `String` literal.
        // Why:      Shared logcat tag so this test and the Rust native bench group together when grepped.
        // TS map:   `private static readonly BENCH_TAG = "NativeBench";`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly BENCH_TAG = "NativeBench";
        // ```
        private const val BENCH_TAG: String = "NativeBench"

        // What:     `private const val TIMING_TRACK_COUNT: Int = 8` declares a compile-time `Int`
        //           constant (32-bit; sibling `Long` is 64-bit but overkill for a small count).
        // Why:      How many real tracks to time, matching the Rust flavor's sample size for fairness.
        // TS map:   `private static readonly TIMING_TRACK_COUNT = 8;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly TIMING_TRACK_COUNT = 8;
        // ```
        private const val TIMING_TRACK_COUNT: Int = 8

        // What:     `private const val SAMPLE_RATE: Int = 48_000` declares a compile-time `Int` constant.
        //           The underscore is digit grouping (48_000 == 48000), ignored by the compiler.
        // Why:      Fixture sample rate to declare in the WAV header; any standard rate works since the
        //           oracle is amplitude-based, not frequency-based.
        // TS map:   `private static readonly SAMPLE_RATE = 48_000;` — numeric underscores work in TS too.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly SAMPLE_RATE = 48_000;
        // ```
        private const val SAMPLE_RATE: Int = 48_000

        // What:     `private const val MONO_FRAMES: Int = 4_800` declares a compile-time `Int` constant
        //           (4800). At 48000 Hz that is 0.1 seconds of audio.
        // Why:      Mono fixture length in frames; long enough to exercise the decoder's chunking loop.
        // TS map:   `private static readonly MONO_FRAMES = 4_800;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly MONO_FRAMES = 4_800;
        // ```
        private const val MONO_FRAMES: Int = 4_800

        // What:     `private const val STEREO_FRAMES: Int = 4_800` declares a compile-time `Int`
        //           constant (4800) for the stereo fixture's frame count.
        // Why:      Stereo fixture length in frames (same duration as the mono fixture).
        // TS map:   `private static readonly STEREO_FRAMES = 4_800;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly STEREO_FRAMES = 4_800;
        // ```
        private const val STEREO_FRAMES: Int = 4_800

        // What:     `private const val HALF_SCALE_SHORT: Short = 16_384` declares a compile-time `Short`
        //           constant (16-bit signed; sibling `Int` is 32-bit). Because PCM scales by /32768,
        //           16384/32768 == 0.5, so a constant fixture of this value peaks at exactly 0.5.
        // Why:      The exact +0.5-full-scale sample value for the constant-level test.
        // TS map:   `private static readonly HALF_SCALE_SHORT = 16_384;` — TS has no `Short`, just number.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly HALF_SCALE_SHORT = 16_384; // /32768 == 0.5
        // ```
        private const val HALF_SCALE_SHORT: Short = 16_384

        // What:     `private const val QUIET_SHORT: Short = 3_277` declares a compile-time `Short`
        //           constant. 3277/32768 ~= 0.1 full scale.
        // Why:      The quiet body level the spike stands out against (~0.1 full scale).
        // TS map:   `private static readonly QUIET_SHORT = 3_277;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly QUIET_SHORT = 3_277; // ~0.1 full scale
        // ```
        private const val QUIET_SHORT: Short = 3_277

        // What:     `private const val LOUD_SHORT: Short = 29_491` declares a compile-time `Short`
        //           constant. 29491/32768 ~= 0.9 full scale.
        // Why:      The loud spike level (~0.9 full scale) the decoder must reach.
        // TS map:   `private static readonly LOUD_SHORT = 29_491;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly LOUD_SHORT = 29_491; // ~0.9 full scale
        // ```
        private const val LOUD_SHORT: Short = 29_491

        // What:     `private const val SPIKE_FROM_END: Int = 64` declares a compile-time `Int` constant:
        //           how many frames before the very last frame the spike sits.
        // Why:      Places the spike near the end so an early-stopping decode would miss it.
        // TS map:   `private static readonly SPIKE_FROM_END = 64;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly SPIKE_FROM_END = 64;
        // ```
        private const val SPIKE_FROM_END: Int = 64

        // What:     `private const val SPIKE_LOWER_BOUND: Float = 0.89f` declares a compile-time `Float`
        //           constant (32-bit; the `f` suffix; sibling `Double` would be 64-bit). Just under the
        //           spike's exact 0.9 level.
        // Why:      Assertion lower bound that an early-stop decode (which would read ~0.1) fails.
        // TS map:   `private static readonly SPIKE_LOWER_BOUND = 0.89;` — no `f` suffix in TS.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly SPIKE_LOWER_BOUND = 0.89;
        // ```
        private const val SPIKE_LOWER_BOUND: Float = 0.89f

        // What:     `private const val SANE_UPPER_BOUND: Float = 1.1f` declares a compile-time 32-bit
        //           `Float` constant (the `f` suffix; sibling `Double`). Leaves headroom above 1.0.
        // Why:      Upper bound that allows the small Catmull-Rom inter-sample overshoot while still
        //           catching an over-scale bug.
        // TS map:   `private static readonly SANE_UPPER_BOUND = 1.1;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly SANE_UPPER_BOUND = 1.1;
        // ```
        private const val SANE_UPPER_BOUND: Float = 1.1f

        // What:     `private const val EXACT_TOLERANCE: Float = 1e-3f` declares a compile-time 32-bit
        //           `Float` constant. `1e-3f` is scientific notation (0.001) with the `f` Float suffix.
        // Why:      Equality tolerance for the exact fixtures (constant and silence); WAV is lossless so
        //           only tiny float rounding is expected.
        // TS map:   `private static readonly EXACT_TOLERANCE = 1e-3;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly EXACT_TOLERANCE = 1e-3;
        // ```
        private const val EXACT_TOLERANCE: Float = 1e-3f

        // What:     `private const val BYTES_PER_SAMPLE: Int = 2` declares a compile-time `Int` constant.
        // Why:      Bytes per 16-bit sample (used to size buffers and header rate fields).
        // TS map:   `private static readonly BYTES_PER_SAMPLE = 2;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly BYTES_PER_SAMPLE = 2;
        // ```
        private const val BYTES_PER_SAMPLE: Int = 2

        // What:     `private const val BITS_PER_SAMPLE: Short = 16` declares a compile-time `Short`
        //           constant (16-bit; sibling `Int`). Chosen `Short` because the WAV bits-per-sample
        //           field is 2 bytes and `putShort` takes a `Short` directly (no conversion needed).
        // Why:      The bits-per-sample value written into the WAV format chunk.
        // TS map:   `private static readonly BITS_PER_SAMPLE = 16;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly BITS_PER_SAMPLE = 16;
        // ```
        private const val BITS_PER_SAMPLE: Short = 16

        // What:     `private const val WAV_HEADER_BYTES: Int = 44` declares a compile-time `Int` constant.
        // Why:      Size of the canonical PCM WAV header in bytes (used to size the buffer and RIFF len).
        // TS map:   `private static readonly WAV_HEADER_BYTES = 44;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly WAV_HEADER_BYTES = 44;
        // ```
        private const val WAV_HEADER_BYTES: Int = 44

        // What:     `private const val RIFF_CHUNK_OVERHEAD: Int = 8` declares a compile-time `Int`
        //           constant: the 8 bytes (`RIFF` tag + 4-byte size field) NOT counted by the RIFF
        //           chunk-size value.
        // Why:      Subtracted when computing the RIFF chunk-size field.
        // TS map:   `private static readonly RIFF_CHUNK_OVERHEAD = 8;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly RIFF_CHUNK_OVERHEAD = 8;
        // ```
        private const val RIFF_CHUNK_OVERHEAD: Int = 8

        // What:     `private const val PCM_FMT_CHUNK_SIZE: Int = 16` declares a compile-time `Int`
        //           constant: the body length of the PCM `fmt ` chunk.
        // Why:      Written as the format-chunk length in the WAV header.
        // TS map:   `private static readonly PCM_FMT_CHUNK_SIZE = 16;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly PCM_FMT_CHUNK_SIZE = 16;
        // ```
        private const val PCM_FMT_CHUNK_SIZE: Int = 16

        // What:     `private const val PCM_FORMAT_TAG: Short = 1` declares a compile-time `Short`
        //           constant (16-bit; sibling `Int`). Chosen `Short` because the WAV format-tag field
        //           is 2 bytes and is written with `putShort`.
        // Why:      The WAV format tag value `1`, meaning uncompressed PCM.
        // TS map:   `private static readonly PCM_FORMAT_TAG = 1;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly PCM_FORMAT_TAG = 1;
        // ```
        private const val PCM_FORMAT_TAG: Short = 1
    }
}
