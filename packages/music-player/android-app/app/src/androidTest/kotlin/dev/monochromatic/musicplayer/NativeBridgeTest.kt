// FILE SUMMARY (folds in the old class doc):
// This is an on-device JUnit instrumentation test. It is the proof that the
// native Rust/C engine (`libmusicplayer_native.so`, built by cargo-ndk and
// cross-compiled for arm64) actually loaded and works across the JNI boundary
// on a real GrapheneOS phone. "JNI" = Java Native Interface, the bridge that
// lets Kotlin/Java call into compiled native code; think of it as TS calling a
// native Node addon (.node file) via N-API. Each `@Test` method below pokes one
// `external` native function on `NativeBridge` and asserts it behaved.
// Run it via `am instrument` (NOT `connectedAndroidTest`): the gradle task
// uninstalls + reinstalls the app, which would wipe the SAF (Storage Access
// Framework) permission grant the device tests rely on to read real music.
//
// In TS terms there is no exact analogue: imagine a Jest/Vitest suite that can
// only run on the physical device, where each test calls a function from a
// native addon and checks the result.

// What:     `package dev.monochromatic.musicplayer` declares the namespace this
//           file's class lives in. Every Kotlin file starts with the package it
//           belongs to; the dotted path mirrors the directory layout.
// Why:      So other Kotlin files (and the JNI loader) can refer to this test's
//           class and to `NativeBridge` by a stable fully-qualified name.
//
// In TS you'd write (pseudocode):
// ```ts
// // (implicit) this file lives under src/dev/monochromatic/musicplayer/
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.ContentUris` pulls in the Android SDK helper
//           class `ContentUris`. Kotlin `import` names one symbol (a class here)
//           from another package so we can write `ContentUris` instead of the
//           full dotted path.
// Why:      We need it later to build a `content://` URI for one specific audio
//           row by appending its numeric id (see `withAppendedId`).
//
// In TS you'd write (pseudocode):
// ```ts
// import { ContentUris } from "android/content";
// ```
import android.content.ContentUris

// What:     `import android.net.Uri` pulls in Android's `Uri` type, the parsed
//           representation of a URI such as `content://media/external/...`.
// Why:      We collect and pass `Uri` values that point at indexed music tracks.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Uri } from "android/net";
// ```
import android.net.Uri

// What:     `import android.provider.MediaStore` brings in `MediaStore`, the
//           Android content provider that indexes all audio/video/images on the
//           device. We read its `Audio.Media` table to find real music files.
// Why:      The device tests decode actual library tracks, so we must query
//           MediaStore for their ids and column metadata.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MediaStore } from "android/provider";
// ```
import android.provider.MediaStore

// What:     `import android.util.Log` brings in Android's logcat logger. `Log.i`
//           etc. write tagged lines visible via `adb logcat`.
// Why:      The benchmarks emit their timing/peak numbers to logcat under the
//           tag `NativeBench` so a human can read them off the device.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Log } from "android/util";
// ```
import android.util.Log

// What:     `import androidx.test.platform.app.InstrumentationRegistry` brings in
//           the entry point that hands a running instrumentation test a handle to
//           the Android runtime (the app `Context`, the target package, etc.).
// Why:      We need the app `Context` to reach the content resolver and the
//           app's external files directory.
//
// In TS you'd write (pseudocode):
// ```ts
// import { InstrumentationRegistry } from "androidx/test/platform/app";
// ```
import androidx.test.platform.app.InstrumentationRegistry

// What:     `import org.junit.Assert.assertEquals` imports ONE static method
//           (`assertEquals`) from JUnit's `Assert` class, not the whole class.
//           Kotlin lets you import an individual member function this way.
// Why:      So we can call `assertEquals(expected, actual)` bare to assert two
//           values match, failing the test if they don't.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertEquals } from "junit/Assert";
// ```
import org.junit.Assert.assertEquals

// What:     `import org.junit.Assert.assertTrue` imports JUnit's `assertTrue`
//           static method. It fails the test unless the boolean argument is true;
//           an optional first `String` becomes the failure message.
// Why:      The benchmarks assert their numeric results are positive/sane.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertTrue } from "junit/Assert";
// ```
import org.junit.Assert.assertTrue

// What:     `import org.junit.Assume.assumeTrue` imports JUnit's `assumeTrue`.
//           Unlike `assertTrue`, a false assumption does NOT fail the test; it
//           SKIPS it (marks it as ignored). The optional first `String` is the
//           skip reason.
// Why:      Device tests that need a fixture file or an indexed library should
//           skip (not fail) when that precondition is absent on this phone.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assumeTrue } from "junit/Assume"; // assumeTrue(cond) => skip if false
// ```
import org.junit.Assume.assumeTrue

// What:     `import org.junit.Test` imports the `@Test` annotation marker. A
//           method tagged `@Test` is discovered and run by the JUnit runner.
// Why:      Every test method below carries `@Test`; without this import the
//           annotation would not resolve.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from "junit"; // used as the @Test decorator below
// ```
import org.junit.Test

// What:     `import java.io.File` brings in the JDK's `File` class, an abstract
//           pathname (it represents a path; it does not hold open file content).
// Why:      One benchmark builds a `File` for a pushed fixture and checks whether
//           it exists on disk before decoding it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { File } from "java/io";
// ```
import java.io.File

// What:     `class NativeBridgeTest { ... }` declares a class named
//           `NativeBridgeTest`. JUnit instantiates this class and runs each of
//           its `@Test` methods. No constructor parameters, no inheritance.
// Why:      JUnit groups tests by class; this class is the suite that proves the
//           native engine works on device.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("NativeBridgeTest", () => { /* @Test methods become it(...) */ });
// ```
class NativeBridgeTest {
    // What:     `@Test` is an annotation (metadata attached to the next
    //           declaration) telling the JUnit runner "this method is a test".
    //           It is NOT a function call; it decorates the method below it.
    // Why:      Marks `nativePingCrossesJniBoundary` as a runnable test case.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // it("nativePingCrossesJniBoundary", () => { /* body */ });
    // ```
    @Test
    // What:     `fun nativePingCrossesJniBoundary() { ... }` declares a method
    //           named `nativePingCrossesJniBoundary` that takes no parameters and
    //           returns nothing (`Unit`, Kotlin's implicit void). `fun` is
    //           Kotlin's keyword for "function".
    // Why:      Cheapest possible smoke test: call the native `nativePing` and
    //           confirm the JNI call round-trips a value back into Kotlin.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function nativePingCrossesJniBoundary(): void { /* body */ }
    // ```
    fun nativePingCrossesJniBoundary() {
        // What:     `assertEquals(42, NativeBridge.nativePing())` calls the native
        //           function `nativePing` (declared `external` on the
        //           `NativeBridge` object, implemented in Rust/C in the .so) and
        //           asserts its returned `Int` equals the literal `42`. The first
        //           argument to `assertEquals` is the EXPECTED value, the second
        //           is the ACTUAL.
        // Why:      `nativePing` is hard-coded native-side to return 42; getting
        //           42 back proves the .so loaded and the JNI call path works.
        // Gotcha:   `Int` is a fixed-width 32-bit signed integer here, not TS's
        //           floating `number`; the comparison is integer-exact.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(nativeAddon.nativePing()).toBe(42);
        // ```
        assertEquals(42, NativeBridge.nativePing())
    }

    // What:     `@Test` annotation marking the next method as a JUnit test case.
    // Why:      Registers `opusDecoderConstructsOnDevice` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // it("opusDecoderConstructsOnDevice", () => { /* body */ });
    // ```
    @Test
    // What:     `fun opusDecoderConstructsOnDevice() { ... }` declares a no-arg,
    //           void-returning test method. Domain note: it proves the bundled
    //           libopus C library cross-compiled for arm64 and actually runs on
    //           device. The native side (`nativeOpusSelfTest`) constructs an opus
    //           decoder via `opus_decoder_create` and returns 1 on success.
    // Why:      Linking a C library is one thing; constructing a decoder at
    //           runtime on this CPU is the real proof.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function opusDecoderConstructsOnDevice(): void { /* body */ }
    // ```
    fun opusDecoderConstructsOnDevice() {
        // What:     `assertEquals(1, NativeBridge.nativeOpusSelfTest())` calls the
        //           `external` native `nativeOpusSelfTest` and asserts its `Int`
        //           return equals `1` (the native success sentinel).
        // Why:      `1` means the opus decoder was created successfully on device.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(nativeAddon.nativeOpusSelfTest()).toBe(1);
        // ```
        assertEquals(1, NativeBridge.nativeOpusSelfTest())
    }

    // What:     `@Test` annotation marking the next method as a test case.
    // Why:      Registers `symphoniaRegistryInitializesOnDevice`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // it("symphoniaRegistryInitializesOnDevice", () => { /* body */ });
    // ```
    @Test
    // What:     `fun symphoniaRegistryInitializesOnDevice() { ... }`. Domain note:
    //           proves symphonia (a pure-Rust decoder covering all the codecs)
    //           cross-compiled and links into the .so. Native side
    //           (`nativeSymphoniaSelfTest`) initializes symphonia's format prober
    //           plus codec registry and returns 1.
    // Why:      Confirms the Rust audio stack is present and self-initializes.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function symphoniaRegistryInitializesOnDevice(): void { /* body */ }
    // ```
    fun symphoniaRegistryInitializesOnDevice() {
        // What:     `assertEquals(1, NativeBridge.nativeSymphoniaSelfTest())`
        //           calls the native self-test and asserts `Int` `1`.
        // Why:      `1` means symphonia's prober + codec registry initialized.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(nativeAddon.nativeSymphoniaSelfTest()).toBe(1);
        // ```
        assertEquals(1, NativeBridge.nativeSymphoniaSelfTest())
    }

    // What:     `@Test` annotation marking the next method as a test case.
    // Why:      Registers `benchmarkNativeDecode`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // it("benchmarkNativeDecode", () => { /* body */ });
    // ```
    @Test
    // What:     `fun benchmarkNativeDecode() { ... }`. Domain note: benchmarks
    //           native decode-to-PCM throughput on device for a pushed opus and
    //           flac fixture, logging results under tag `NativeBench` for a
    //           head-to-head against the Media3/MediaCodec baseline. It SKIPS
    //           (does not fail) when a fixture is absent; you push fixtures to the
    //           app's external files dir as `bench.opus` / `bench.flac` first. A
    //           negative native result is an error code.
    // Why:      Measures whether the Rust decode path is fast enough on hardware.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function benchmarkNativeDecode(): void { /* body */ }
    // ```
    fun benchmarkNativeDecode() {
        // What:     `val context = InstrumentationRegistry.getInstrumentation()`
        //           `.targetContext`. `val` declares an immutable local (like TS
        //           `const`). `getInstrumentation()` returns the running test's
        //           instrumentation handle; `.targetContext` is the application
        //           `Context` under test (gives access to app dirs, resolvers).
        // Why:      We need the app `Context` to find the external files directory
        //           where fixtures were pushed.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const context = getInstrumentation().targetContext;
        // ```
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        // What:     `val dir = context.getExternalFilesDir(null)` asks the app for
        //           its app-private external files directory. `null` (the `type`
        //           argument) means "the root of that dir", not a typed subfolder.
        //           This returns a nullable `File?` (could be null if external
        //           storage is unavailable).
        // Why:      Fixtures (`bench.opus`, `bench.flac`) are pushed into this dir;
        //           we build paths under it.
        // Gotcha:   `null` is a real argument value here, not absence; the API
        //           overload uses it to mean "no type subdirectory".
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const dir = context.getExternalFilesDir(null); // File | null
        // ```
        val dir = context.getExternalFilesDir(null)
        // What:     `for (name in listOf("bench.opus", "bench.flac")) { ... }`.
        //           `listOf(...)` builds a read-only `List<String>` of two literal
        //           filenames. `for (name in <list>)` iterates each element,
        //           binding it to the immutable loop variable `name`.
        // Why:      We run the same benchmark routine once per fixture filename.
        // Gotcha:   Kotlin's `for (x in xs)` is value iteration (TS `for...of`),
        //           NOT index iteration like a JS `for (x in obj)` (which walks
        //           keys). Easy to misread.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const name of ["bench.opus", "bench.flac"]) { /* body */ }
        // ```
        for (name in listOf("bench.opus", "bench.flac")) {
            // What:     `val fixture = File(dir, name)` constructs a `File` from a
            //           parent directory (`dir`) and a child name (`name`). This
            //           is a constructor call (no `new` keyword in Kotlin); it
            //           just joins the path, it does not open or read anything.
            // Why:      Gives a concrete path we can existence-check and pass to
            //           the native decoder by absolute path.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const fixture = new File(dir, name);
            // ```
            val fixture = File(dir, name)
            // What:     `assumeTrue("missing fixture $name", fixture.exists())`.
            //           `$name` is a string-template interpolation: Kotlin splices
            //           the value of `name` into the string. `fixture.exists()`
            //           returns a `Boolean`. `assumeTrue(msg, cond)` SKIPS (does
            //           not fail) the test when `cond` is false, recording `msg`.
            // Why:      If the fixture was never pushed, skip this iteration's
            //           benchmark instead of failing the suite.
            // Gotcha:   `assumeTrue` is SKIP-on-false, unlike `assertTrue` which is
            //           FAIL-on-false. The distinction is the whole point here.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (!fixture.exists()) return; // assumeTrue => skip the test
            // ```
            assumeTrue("missing fixture $name", fixture.exists())
            // What:     `val usPerSample = NativeBridge.nativeDecodeBenchmark(`
            //           `fixture.absolutePath)`. `fixture.absolutePath` is a
            //           property getter returning the file's absolute path as a
            //           `String`. We pass it to the `external` native benchmark,
            //           which returns a `Double` (microseconds per decoded sample;
            //           negative encodes a native error code).
            // Why:      Captures the throughput number for logging and asserting.
            // Gotcha:   `Double` (64-bit float) is chosen over `Float` (32-bit)
            //           because microsecond timings want the extra precision; both
            //           collapse to TS `number`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const usPerSample = nativeAddon.nativeDecodeBenchmark(fixture.absolutePath);
            // ```
            val usPerSample = NativeBridge.nativeDecodeBenchmark(fixture.absolutePath)
            // What:     `Log.i("NativeBench", "$name -> $usPerSample us/sample`
            //           `(native symphonia/opus, decode-only)")`. `Log.i(tag, msg)`
            //           writes an info-level logcat line. `$name` and
            //           `$usPerSample` are string-template interpolations.
            // Why:      Emits the timing to logcat so a human can read off the
            //           benchmark result under the `NativeBench` tag.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.info("NativeBench", `${name} -> ${usPerSample} us/sample (native symphonia/opus, decode-only)`);
            // ```
            Log.i("NativeBench", "$name -> $usPerSample us/sample (native symphonia/opus, decode-only)")
            // What:     `assertTrue("decode failed for $name (native code`
            //           `$usPerSample)", usPerSample > 0.0)`. Fails the test
            //           UNLESS `usPerSample > 0.0`. The first arg is the failure
            //           message (with `$name`/`$usPerSample` interpolated); `0.0`
            //           is a `Double` literal.
            // Why:      A non-positive result means the native decoder failed (it
            //           returns negative error codes); assert it actually decoded.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // expect(usPerSample > 0).toBe(true); // else: "decode failed for ${name}"
            // ```
            assertTrue("decode failed for $name (native code $usPerSample)", usPerSample > 0.0)
        }
    }

    // What:     `@Test` annotation marking the next method as a test case.
    // Why:      Registers `aaudioOutputLatencyOnDevice`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // it("aaudioOutputLatencyOnDevice", () => { /* body */ });
    // ```
    @Test
    // What:     `fun aaudioOutputLatencyOnDevice() { ... }`. Domain note: opens a
    //           silent low-latency AAudio output stream (via raw `ndk::audio` in
    //           Rust) and reads its presentation latency, proving the pure-Rust
    //           AAudio output path opens and runs on this GrapheneOS device. It is
    //           inaudible (writes zeros), so the resident-noise rule isn't engaged.
    // Why:      Confirms the native audio OUTPUT path works, not just decode.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function aaudioOutputLatencyOnDevice(): void { /* body */ }
    // ```
    fun aaudioOutputLatencyOnDevice() {
        // What:     `val latencyMs = NativeBridge.nativeOutputLatencyProbe()`
        //           calls the `external` native probe, which opens the silent
        //           stream and returns its latency in milliseconds as a `Double`
        //           (negative encodes a native error code).
        // Why:      Captures the measured latency for logging and assertion.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const latencyMs = nativeAddon.nativeOutputLatencyProbe();
        // ```
        val latencyMs = NativeBridge.nativeOutputLatencyProbe()
        // What:     `Log.i("NativeBench", "AAudio output latency = $latencyMs ms`
        //           `(ndk::audio, silent)")`. Info-level logcat line; `$latencyMs`
        //           is interpolated.
        // Why:      Surfaces the latency number to a human reading logcat.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // console.info("NativeBench", `AAudio output latency = ${latencyMs} ms (ndk::audio, silent)`);
        // ```
        Log.i("NativeBench", "AAudio output latency = $latencyMs ms (ndk::audio, silent)")
        // What:     `assertTrue("AAudio output probe failed (native code`
        //           `$latencyMs)", latencyMs > 0.0)`. Fails unless the latency is
        //           positive; `0.0` is a `Double` literal.
        // Why:      A non-positive value is the native error sentinel; assert the
        //           probe actually opened the stream.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(latencyMs > 0).toBe(true); // else: "AAudio output probe failed"
        // ```
        assertTrue("AAudio output probe failed (native code $latencyMs)", latencyMs > 0.0)
    }

    // What:     `@Test` annotation marking the next method as a test case.
    // Why:      Registers `measureTruePeakOnDevice`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // it("measureTruePeakOnDevice", () => { /* body */ });
    // ```
    @Test
    // What:     `fun measureTruePeakOnDevice() { ... }`. Domain note: measures a
    //           real library track's TRUE PEAK natively (4x-oversampled), the
    //           loudness-normalization input the Rust flavor needs (its peak cache
    //           starts empty, and the Media3 true-peak decoder is MediaCodec-bound).
    //           It reads the first MediaStore tracks via `content://` file
    //           descriptors, logs the peak and the gain the core would derive
    //           (`min(0.8912509 / peak, 1)`, the -1 dBTP ceiling), and asserts a
    //           sane positive peak. Skips when no library is indexed; silent
    //           (decode-only).
    // Why:      Proves the Rust true-peak measurement works on real device files.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function measureTruePeakOnDevice(): void { /* body */ }
    // ```
    fun measureTruePeakOnDevice() {
        // What:     `val context = ...targetContext` — the app `Context` under
        //           test (same as earlier).
        // Why:      Needed to reach the content resolver that queries MediaStore.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const context = getInstrumentation().targetContext;
        // ```
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        // What:     `val resolver = context.contentResolver` reads the `Context`'s
        //           `ContentResolver`, the object you use to query/open content
        //           providers like MediaStore.
        // Why:      We query it for audio rows and open `content://` fds through it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const resolver = context.contentResolver;
        // ```
        val resolver = context.contentResolver
        // What:     `val collection = MediaStore.Audio.Media.getContentUri(`
        //           `MediaStore.VOLUME_EXTERNAL)`. Builds the `content://` URI for
        //           the audio table on the external storage volume.
        // Why:      This URI is the table we query for music rows.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
        // ```
        val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        // What:     `val uris = mutableListOf<Uri>()`. `mutableListOf<Uri>()`
        //           constructs an empty, GROWABLE list whose elements are `Uri`.
        //           The `<Uri>` is an explicit generic type argument. Sibling:
        //           `listOf<Uri>()` would be READ-ONLY (no `.add`); we need the
        //           mutable one to append inside the loop.
        // Why:      We collect up to 8 track URIs to measure.
        // Gotcha:   Kotlin distinguishes read-only `List` from `MutableList`;
        //           picking `mutableListOf` is what makes `.add(...)` legal.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const uris: Uri[] = [];
        // ```
        val uris = mutableListOf<Uri>()
        // What:     `resolver.query(collection, arrayOf(MediaStore.Audio.Media._ID),`
        //           `"${MediaStore.Audio.Media.IS_MUSIC} != 0", null, null)?.use {`
        //           `cursor -> ... }`. Several concepts on one line:
        //           - `query(...)` runs a SQL-like query and returns a nullable
        //             `Cursor?` (a forward iterator over result rows), or null on
        //             failure.
        //           - `arrayOf(...)` builds the projection: the array of columns to
        //             select (here just the `_ID` column).
        //           - `"${...IS_MUSIC} != 0"` is the WHERE clause; `${...}` splices
        //             the actual column-name constant into the SQL string. The two
        //             trailing `null`s are selection-args and sort-order (none).
        //           - `?.` is the SAFE-CALL operator: call `.use { }` only if the
        //             cursor is non-null, otherwise the whole expression is null.
        //           - `.use { cursor -> ... }` runs the trailing lambda with the
        //             cursor bound to `cursor`, then AUTO-CLOSES the cursor when the
        //             lambda exits (even on exception). `{ cursor -> ... }` is a
        //             lambda whose single parameter is named `cursor`.
        // Why:      Open a cursor over music rows, do the work, and guarantee the
        //           cursor is closed afterward without a manual finally.
        // Gotcha:   `.use { }` is Kotlin's deterministic resource cleanup (like
        //           `using`/`with`); it ALWAYS closes the resource. TS has no
        //           built-in equivalent beyond a manual `try/finally`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const cursor = resolver.query(collection, [MediaStore.Audio.Media._ID], `${IS_MUSIC} != 0`, null, null);
        // if (cursor) { try { /* lambda body */ } finally { cursor.close(); } }
        // ```
        resolver.query(collection, arrayOf(MediaStore.Audio.Media._ID), "${MediaStore.Audio.Media.IS_MUSIC} != 0", null, null)?.use { cursor ->
            // What:     `val idColumn = cursor.getColumnIndexOrThrow(`
            //           `MediaStore.Audio.Media._ID)`. Looks up the integer column
            //           index for the `_ID` column in this cursor; the `OrThrow`
            //           variant throws if the column is missing rather than
            //           returning -1.
            // Why:      We read each row's id by index; we need that index first.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
            // ```
            val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            // What:     `while (cursor.moveToNext() && uris.size < 8) { ... }`.
            //           `cursor.moveToNext()` advances to the next row and returns
            //           a `Boolean` (false when exhausted). `uris.size` is the list
            //           length. The loop runs while there's a next row AND we have
            //           fewer than 8 URIs.
            // Why:      Walk rows, capping the sample at 8 tracks.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // while (cursor.moveToNext() && uris.length < 8) { /* body */ }
            // ```
            while (cursor.moveToNext() && uris.size < 8) {
                // What:     `uris.add(ContentUris.withAppendedId(collection,`
                //           `cursor.getLong(idColumn)))`. Two nested calls:
                //           - `cursor.getLong(idColumn)` reads the current row's id
                //             column as a `Long` (64-bit signed integer). Sibling
                //             `getInt` returns 32-bit `Int`; MediaStore ids can
                //             exceed 32 bits, so `Long` is the safe choice and is
                //             what `withAppendedId` wants.
                //           - `ContentUris.withAppendedId(collection, id)` returns a
                //             new `Uri` pointing at that one row.
                //           - `uris.add(...)` appends that `Uri` to our list.
                // Why:      Build a per-track URI we can later open as a file
                //           descriptor and decode.
                // Gotcha:   `getLong` (64-bit) not `getInt` (32-bit) on purpose;
                //           both are plain TS `number`, but the width matters
                //           native-side.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // uris.push(ContentUris.withAppendedId(collection, cursor.getLong(idColumn)));
                // ```
                uris.add(ContentUris.withAppendedId(collection, cursor.getLong(idColumn)))
            }
        }
        // What:     `assumeTrue("no indexed MediaStore audio (grant`
        //           `READ_MEDIA_AUDIO)", uris.isNotEmpty())`. `uris.isNotEmpty()`
        //           returns a `Boolean`. `assumeTrue` SKIPS the test (does not
        //           fail) when the list is empty.
        // Why:      Without an indexed library there's nothing to measure, so skip.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (uris.length === 0) return; // assumeTrue => skip
        // ```
        assumeTrue("no indexed MediaStore audio (grant READ_MEDIA_AUDIO)", uris.isNotEmpty())
        // What:     `val ceiling = 0.8912509f`. The trailing `f` makes this a
        //           `Float` literal (32-bit float). Sibling: without `f` it would
        //           be a `Double` (64-bit). Domain: `0.8912509` is the linear
        //           amplitude of the -1 dBTP loudness ceiling (10^(-1/20)).
        // Why:      `Float` matches the 32-bit PCM sample/peak type the native
        //           true-peak path returns, avoiding a precision mismatch.
        // Gotcha:   The `f` suffix is significant: `0.8912509` (Double) vs
        //           `0.8912509f` (Float) are different types in Kotlin, even
        //           though both are `number` in TS.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const ceiling = 0.8912509; // -1 dBTP ceiling
        // ```
        val ceiling = 0.8912509f
        // What:     `var maxPeak = 0.0f`. `var` (NOT `val`) declares a MUTABLE
        //           local, reassignable later. `0.0f` is a `Float` zero.
        // Why:      Running maximum of every measured peak, updated in the loop.
        // Gotcha:   `var` = TS `let` (reassignable); `val` = TS `const`. Picking
        //           `var` here is deliberate because we mutate it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let maxPeak = 0;
        // ```
        var maxPeak = 0.0f
        // What:     `var totalMs = 0.0`. Mutable `Double` (64-bit float, no `f`
        //           suffix) accumulator starting at zero. Sibling `Float` would
        //           lose precision summing many elapsed-time readings.
        // Why:      Sums per-track elapsed milliseconds for a total at the end.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let totalMs = 0;
        // ```
        var totalMs = 0.0
        // What:     `for (uri in uris) { ... }`. Value iteration over the `uris`
        //           list, binding each `Uri` to the immutable loop variable `uri`.
        // Why:      Measure the true peak of each collected track in turn.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const uri of uris) { /* body */ }
        // ```
        for (uri in uris) {
            // What:     `val start = System.nanoTime()` reads a monotonic
            //           nanosecond timestamp as a `Long`. Not wall-clock time; only
            //           valid for measuring elapsed intervals.
            // Why:      Marks the start so we can compute decode elapsed time.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const start = process.hrtime.bigint(); // monotonic nanoseconds
            // ```
            val start = System.nanoTime()
            // What:     `val peak: Float = resolver.openFileDescriptor(uri, "r")`
            //           `?.use { pfd -> NativeBridge.nativeMeasureTruePeak(pfd.fd) }`
            //           `?: -100.0f`. Several concepts:
            //           - `: Float` is an EXPLICIT type annotation on the local.
            //           - `openFileDescriptor(uri, "r")` opens the content URI for
            //             reading and returns a nullable `ParcelFileDescriptor?`.
            //           - `?.use { pfd -> ... }` safe-calls `.use`: only if the pfd
            //             is non-null, run the lambda (param `pfd`) and AUTO-CLOSE
            //             the pfd afterward. `pfd.fd` is the raw integer fd we pass
            //             to the native true-peak measurer, which returns a `Float`.
            //           - `?:` is the ELVIS operator: if the left side is null
            //             (open failed), use the right side `-100.0f` instead.
            // Why:      Measure the track's true peak over a borrowed fd, falling
            //           back to a clearly-bad sentinel (-100) if the open failed.
            // Gotcha:   `?:` is Kotlin's null-coalescing (TS `??`), NOT a ternary;
            //           there is no condition, only "left, or else right if null".
            //           The fd is BORROWED: the native side dups it before this
            //           `.use` closes the original (the fd-ownership protocol).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const pfd = resolver.openFileDescriptor(uri, "r");
            // let peak: number;
            // if (pfd) { try { peak = nativeMeasureTruePeak(pfd.fd); } finally { pfd.close(); } }
            // else { peak = -100; }
            // ```
            val peak: Float = resolver.openFileDescriptor(uri, "r")?.use { pfd ->
                NativeBridge.nativeMeasureTruePeak(pfd.fd)
            } ?: -100.0f
            // What:     `val elapsedMs = (System.nanoTime() - start) / 1_000_000.0`.
            //           `System.nanoTime() - start` is the elapsed nanoseconds as a
            //           `Long`. The `_` in `1_000_000.0` is a DIGIT SEPARATOR (one
            //           million), purely cosmetic. Dividing a `Long` by a `Double`
            //           promotes the result to `Double` milliseconds.
            // Why:      Convert the elapsed nanoseconds to milliseconds for logging.
            // Gotcha:   The `_` separators (`1_000_000.0`) are ignored by the
            //           compiler; they don't change the value, just readability.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
            // ```
            val elapsedMs = (System.nanoTime() - start) / 1_000_000.0
            // What:     `totalMs += elapsedMs`. Plain compound assignment adding
            //           this track's elapsed ms into the running total.
            // Why:      Accumulate total measurement time across all tracks.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // totalMs += elapsedMs;
            // ```
            totalMs += elapsedMs
            // What:     `val gain: Float = if (peak > 0.0f) minOf(ceiling / peak,`
            //           `1.0f) else 1.0f`. Concepts:
            //           - `if (...) a else b` is an EXPRESSION in Kotlin (it yields
            //             a value), not just a statement.
            //           - `minOf(ceiling / peak, 1.0f)` returns the smaller of the
            //             two `Float`s: the gain that scales this peak down to the
            //             ceiling, clamped to at most `1.0` so we never boost.
            //           - When `peak <= 0` (a bad/sentinel reading) the gain is
            //             `1.0f` (no change).
            //           - `: Float` is an explicit type annotation on `gain`.
            // Why:      Compute the exact normalization gain the core would apply,
            //           purely for logging here so a human can sanity-check it.
            // Gotcha:   Kotlin's `if/else` returns a value (used like a ternary
            //           here); `minOf` is the two-arg `Math.min`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const gain = peak > 0 ? Math.min(ceiling / peak, 1) : 1;
            // ```
            val gain: Float = if (peak > 0.0f) minOf(ceiling / peak, 1.0f) else 1.0f
            // What:     `Log.i("NativeBench", "rust-measure`
            //           `(${uri.lastPathSegment}) -> peak=$peak gain=$gain`
            //           `elapsedMs=${"%.1f".format(elapsedMs)}")`. Info-level
            //           logcat line. `${uri.lastPathSegment}` interpolates the last
            //           path segment of the URI (the id). `${"%.1f".format(`
            //           `elapsedMs)}` formats `elapsedMs` to one decimal place by
            //           calling `.format(...)` on the format-string `"%.1f"`.
            // Why:      Log this track's peak, derived gain, and timing for a human.
            // Gotcha:   `"%.1f".format(x)` is Kotlin's printf-style formatting
            //           (method ON the string), equivalent to `x.toFixed(1)`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.info("NativeBench", `rust-measure (${uri.lastPathSegment}) -> peak=${peak} gain=${gain} elapsedMs=${elapsedMs.toFixed(1)}`);
            // ```
            Log.i("NativeBench", "rust-measure (${uri.lastPathSegment}) -> peak=$peak gain=$gain elapsedMs=${"%.1f".format(elapsedMs)}")
            // What:     `assertTrue("true-peak measure failed for $uri`
            //           `(peak=$peak)", peak > 0.0f && peak < 8.0f)`. Fails unless
            //           the peak is positive AND below 8.0 (a sane linear range).
            //           `&&` is short-circuit boolean AND. `0.0f`/`8.0f` are
            //           `Float` literals.
            // Why:      A valid true peak is positive and not absurdly large; both
            //           bounds catch a broken measurement or sentinel value.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // expect(peak > 0 && peak < 8).toBe(true); // else: "true-peak measure failed for ${uri}"
            // ```
            assertTrue("true-peak measure failed for $uri (peak=$peak)", peak > 0.0f && peak < 8.0f)
            // What:     `maxPeak = maxOf(maxPeak, peak)`. `maxOf(a, b)` returns the
            //           larger of two `Float`s. Reassigns the mutable `maxPeak`.
            // Why:      Track the loudest peak seen across the sampled tracks.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // maxPeak = Math.max(maxPeak, peak);
            // ```
            maxPeak = maxOf(maxPeak, peak)
        }
        // What:     `Log.i("NativeBench", "rust-measure TOTAL ${uris.size} tracks`
        //           `= ${"%.1f".format(totalMs)} ms (native symphonia/opus decode`
        //           `+ true-peak)")`. Info-level summary line. `${uris.size}` is
        //           the count; `${"%.1f".format(totalMs)}` formats the total ms to
        //           one decimal.
        // Why:      Logs the aggregate measurement time across all sampled tracks.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // console.info("NativeBench", `rust-measure TOTAL ${uris.length} tracks = ${totalMs.toFixed(1)} ms (native symphonia/opus decode + true-peak)`);
        // ```
        Log.i("NativeBench", "rust-measure TOTAL ${uris.size} tracks = ${"%.1f".format(totalMs)} ms (native symphonia/opus decode + true-peak)")
        // A real library has at least one reasonably loud track; a uniformly tiny max
        // across the sample would mean a systematic scaling bug, not genuinely quiet music.
        // What:     `assertTrue("all sampled tracks improbably quiet`
        //           `(maxPeak=$maxPeak) - possible scaling bug", maxPeak > 0.1f)`.
        //           Fails unless the loudest measured peak exceeds `0.1f`.
        // Why:      If even the loudest track is near-silent, the measurement is
        //           systematically wrong (a scaling bug), not real quiet music.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(maxPeak > 0.1).toBe(true); // else: "all sampled tracks improbably quiet"
        // ```
        assertTrue("all sampled tracks improbably quiet (maxPeak=$maxPeak) - possible scaling bug", maxPeak > 0.1f)
    }

    // What:     `@Test` annotation marking the next method as a test case.
    // Why:      Registers `decodeFromContentFd`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // it("decodeFromContentFd", () => { /* body */ });
    // ```
    @Test
    // What:     `fun decodeFromContentFd() { ... }`. Domain note: decodes a real
    //           library track straight from a `content://` file descriptor, the
    //           exact path the full-Rust engine will use. Proves on this
    //           GrapheneOS device that (1) MediaProvider hands back a seekable
    //           regular-file fd, (2) symphonia probes and decodes over a BORROWED
    //           `ParcelFileDescriptor`, and (3) the dup-based fd-ownership protocol
    //           does not double-close (which would be a deterministic fdsan
    //           SIGABRT). The fd is the borrowed `pfd.fd` (`getFd`) and decode
    //           happens synchronously inside `use {}`, so Rust dups before Kotlin
    //           closes the original. Needs `READ_MEDIA_AUDIO` (granted via
    //           `adb shell pm grant` before the run); skips (not fails) when the
    //           permission or indexed library is absent. Silent (decode-only).
    // Why:      Final proof the engine's real input path (content fd) works.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function decodeFromContentFd(): void { /* body */ }
    // ```
    fun decodeFromContentFd() {
        // What:     `val context = ...targetContext` — the app `Context` (same as
        //           earlier methods).
        // Why:      Needed to reach the content resolver.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const context = getInstrumentation().targetContext;
        // ```
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        // What:     `val resolver = context.contentResolver` — the content
        //           resolver (same as earlier).
        // Why:      We query MediaStore and open content fds through it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const resolver = context.contentResolver;
        // ```
        val resolver = context.contentResolver
        // What:     `val collection = MediaStore.Audio.Media.getContentUri(`
        //           `MediaStore.VOLUME_EXTERNAL)` — the external audio table URI
        //           (same as earlier).
        // Why:      The table we query for music rows.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
        // ```
        val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        // What:     `val projection = arrayOf(MediaStore.Audio.Media._ID,`
        //           `MediaStore.Audio.Media.DISPLAY_NAME)`. `arrayOf(...)` builds a
        //           typed array of the two column names we want to read: the row id
        //           and the display filename.
        // Why:      We need both the id (to build a URI) and the name (to pick the
        //           file extension) for each row.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const projection = [MediaStore.Audio.Media._ID, MediaStore.Audio.Media.DISPLAY_NAME];
        // ```
        val projection = arrayOf(MediaStore.Audio.Media._ID, MediaStore.Audio.Media.DISPLAY_NAME)
        // What:     `val wantedExtensions = listOf(".flac", ".opus", ".mp3")`.
        //           `listOf(...)` builds a READ-ONLY `List<String>` of the three
        //           file extensions we want one sample of each. Sibling
        //           `mutableListOf` would allow `.add`; we don't need that here.
        // Why:      We pick the first track matching each of these extensions.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const wantedExtensions = [".flac", ".opus", ".mp3"] as const;
        // ```
        val wantedExtensions = listOf(".flac", ".opus", ".mp3")
        // What:     `val firstByExtension = mutableMapOf<String, Uri>()`.
        //           `mutableMapOf<String, Uri>()` constructs an empty, GROWABLE map
        //           from `String` keys (the extension) to `Uri` values. The
        //           `<String, Uri>` are explicit generic type arguments. Sibling
        //           `mapOf` would be read-only; we need mutable to insert.
        // Why:      Records the first track URI found per extension, deduplicating.
        // Gotcha:   Like lists, Kotlin separates read-only `Map` from
        //           `MutableMap`; `mutableMapOf` is what makes index-set legal.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const firstByExtension = new Map<string, Uri>();
        // ```
        val firstByExtension = mutableMapOf<String, Uri>()
        // What:     `resolver.query(collection, projection,`
        //           `"${MediaStore.Audio.Media.IS_MUSIC} != 0", null, null)?.use {`
        //           `cursor -> ... }`. Same shape as the earlier query: run the
        //           query (nullable `Cursor?`), and `?.use { cursor -> ... }`
        //           safe-calls `.use` to run the lambda and auto-close the cursor.
        //           The WHERE clause `${...IS_MUSIC} != 0` filters to music rows.
        // Why:      Open a cursor over music rows and guarantee it closes after.
        // Gotcha:   `?.` safe-call + `.use {}` auto-close, same as before; no TS
        //           one-liner equivalent.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const cursor = resolver.query(collection, projection, `${IS_MUSIC} != 0`, null, null);
        // if (cursor) { try { /* lambda body */ } finally { cursor.close(); } }
        // ```
        resolver.query(collection, projection, "${MediaStore.Audio.Media.IS_MUSIC} != 0", null, null)?.use { cursor ->
            // What:     `val idColumn = cursor.getColumnIndexOrThrow(`
            //           `MediaStore.Audio.Media._ID)` — index of the `_ID` column,
            //           throwing if absent.
            // Why:      Needed to read each row's id.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
            // ```
            val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            // What:     `val nameColumn = cursor.getColumnIndexOrThrow(`
            //           `MediaStore.Audio.Media.DISPLAY_NAME)` — index of the
            //           display-name column, throwing if absent.
            // Why:      Needed to read each row's filename to pick its extension.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
            // ```
            val nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
            // What:     `while (cursor.moveToNext() && firstByExtension.size <`
            //           `wantedExtensions.size) { ... }`. Advance row by row
            //           (`moveToNext()` returns `Boolean`) while we still have fewer
            //           collected extensions than we want.
            // Why:      Stop scanning once we've found one track per wanted ext.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // while (cursor.moveToNext() && firstByExtension.size < wantedExtensions.length) { /* body */ }
            // ```
            while (cursor.moveToNext() && firstByExtension.size < wantedExtensions.size) {
                // What:     `val name = cursor.getString(nameColumn)?.lowercase()`
                //           `?: continue`. Concepts:
                //           - `cursor.getString(nameColumn)` reads the name column
                //             as a nullable `String?`.
                //           - `?.lowercase()` safe-calls `.lowercase()` only if the
                //             string is non-null, producing a lowercased copy (or
                //             null).
                //           - `?: continue` is the ELVIS operator with a control-flow
                //             right side: if the left is null, run `continue` to skip
                //             to the next loop iteration. `continue` here is the
                //             whole expression's value-position fallback.
                // Why:      Get a normalized lowercase filename, or skip this row if
                //           it has no name.
                // Gotcha:   `?:` Elvis with `continue` on the right is idiomatic
                //           Kotlin for "default-or-bail"; there's no single TS
                //           operator that branches control flow this way.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const raw = cursor.getString(nameColumn);
                // if (raw == null) continue;
                // const name = raw.toLowerCase();
                // ```
                val name = cursor.getString(nameColumn)?.lowercase() ?: continue
                // What:     `val extension = wantedExtensions.firstOrNull {`
                //           `name.endsWith(it) } ?: continue`. Concepts:
                //           - `wantedExtensions.firstOrNull { ... }` returns the
                //             first element matching the predicate, or null if none.
                //             `{ name.endsWith(it) }` is a trailing-lambda predicate;
                //             `it` is the implicit single parameter (the current
                //             extension).
                //           - `?: continue` Elvis: if no extension matched (null),
                //             skip to the next row.
                // Why:      Find which wanted extension this filename ends with, or
                //           skip the row if it's none of them.
                // Gotcha:   `it` is Kotlin's auto-named single lambda parameter
                //           (no `(it) =>` needed); `firstOrNull` is `Array.find`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const extension = wantedExtensions.find((ext) => name.endsWith(ext));
                // if (extension == null) continue;
                // ```
                val extension = wantedExtensions.firstOrNull { name.endsWith(it) } ?: continue
                // What:     `if (extension !in firstByExtension) { ... }`. `!in` is
                //           the negated membership operator: true when `extension` is
                //           NOT a key of the map `firstByExtension`. (For a map,
                //           `in`/`!in` test the KEYS.)
                // Why:      Only record the FIRST track per extension; ignore later
                //           duplicates of an extension we already have.
                // Gotcha:   `in`/`!in` on a map check keys (like `Map.has`), not
                //           values; on a list/range they check membership.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (!firstByExtension.has(extension)) { /* body */ }
                // ```
                if (extension !in firstByExtension) {
                    // What:     `firstByExtension[extension] =`
                    //           `ContentUris.withAppendedId(collection,`
                    //           `cursor.getLong(idColumn))`. Concepts:
                    //           - `firstByExtension[extension] = ...` is index-set
                    //             syntax that inserts/updates the map entry.
                    //           - `cursor.getLong(idColumn)` reads the row id as a
                    //             `Long` (64-bit; ids can exceed 32-bit `Int`).
                    //           - `ContentUris.withAppendedId(collection, id)` builds
                    //             the per-row `Uri`.
                    // Why:      Remember this track's URI under its extension key.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // firstByExtension.set(extension, ContentUris.withAppendedId(collection, cursor.getLong(idColumn)));
                    // ```
                    firstByExtension[extension] = ContentUris.withAppendedId(collection, cursor.getLong(idColumn))
                }
            }
        }
        // What:     `assumeTrue("no indexed MediaStore audio (grant`
        //           `READ_MEDIA_AUDIO)", firstByExtension.isNotEmpty())`. SKIPS the
        //           test (does not fail) when the map is empty.
        // Why:      Nothing to decode without an indexed library, so skip.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (firstByExtension.size === 0) return; // assumeTrue => skip
        // ```
        assumeTrue("no indexed MediaStore audio (grant READ_MEDIA_AUDIO)", firstByExtension.isNotEmpty())
        // What:     `for ((extension, uri) in firstByExtension) { ... }`. Iterates
        //           the map's entries, DESTRUCTURING each entry into two locals:
        //           `extension` (the key) and `uri` (the value). `(a, b)` on the
        //           left of `in` is Kotlin component-destructuring.
        // Why:      Decode each collected track, labeled by its extension.
        // Gotcha:   `(extension, uri)` is destructuring of a Map.Entry, equivalent
        //           to TS's `[key, value]` array destructuring in `for...of`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const [extension, uri] of firstByExtension) { /* body */ }
        // ```
        for ((extension, uri) in firstByExtension) {
            // What:     `val usPerSample = resolver.openFileDescriptor(uri, "r")`
            //           `?.use { pfd -> NativeBridge.nativeDecodeFdBenchmark(pfd.fd)`
            //           `} ?: -100.0`. Concepts:
            //           - `openFileDescriptor(uri, "r")` opens the content URI for
            //             reading, nullable `ParcelFileDescriptor?`.
            //           - `?.use { pfd -> ... }` safe-call: only if non-null, run the
            //             lambda (param `pfd`) and AUTO-CLOSE the pfd after. `pfd.fd`
            //             is the borrowed raw fd passed to the native fd-benchmark,
            //             which returns a `Double` (us/sample; negative is an error).
            //           - `?: -100.0` Elvis: if the open failed (null), use `-100.0`
            //             (a `Double` sentinel; no `f` suffix).
            // Why:      Decode straight from the borrowed content fd and capture the
            //           throughput, falling back to a clearly-bad sentinel on open
            //           failure.
            // Gotcha:   Borrowed fd: native side dups it before this `.use` closes
            //           the original (the dup-based fd-ownership protocol that
            //           avoids a double-close fdsan SIGABRT).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const pfd = resolver.openFileDescriptor(uri, "r");
            // let usPerSample: number;
            // if (pfd) { try { usPerSample = nativeDecodeFdBenchmark(pfd.fd); } finally { pfd.close(); } }
            // else { usPerSample = -100; }
            // ```
            val usPerSample = resolver.openFileDescriptor(uri, "r")?.use { pfd ->
                NativeBridge.nativeDecodeFdBenchmark(pfd.fd)
            } ?: -100.0
            // What:     `Log.i("NativeBench", "content-fd $extension ($uri) ->`
            //           `$usPerSample us/sample (native symphonia/opus,`
            //           `decode-only)")`. Info logcat line; `$extension`, `$uri`,
            //           `$usPerSample` interpolated.
            // Why:      Logs which extension/track decoded and how fast.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.info("NativeBench", `content-fd ${extension} (${uri}) -> ${usPerSample} us/sample (native symphonia/opus, decode-only)`);
            // ```
            Log.i("NativeBench", "content-fd $extension ($uri) -> $usPerSample us/sample (native symphonia/opus, decode-only)")
            // What:     `assertTrue("content-fd decode failed for $extension`
            //           `(native code $usPerSample)", usPerSample > 0.0)`. Fails
            //           unless the throughput is positive; `0.0` is a `Double`
            //           literal.
            // Why:      A non-positive value is the native error sentinel; assert
            //           the content-fd decode actually succeeded.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // expect(usPerSample > 0).toBe(true); // else: "content-fd decode failed for ${extension}"
            // ```
            assertTrue("content-fd decode failed for $extension (native code $usPerSample)", usPerSample > 0.0)
        }
    }
}
