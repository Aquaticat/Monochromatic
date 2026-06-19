// ============================================================================
// File summary (folds in the old KDoc's domain content):
//
// This file is the *engine-agnostic body of the loudness sweep* for the Android
// music player. "True peak" is the highest instantaneous sample value a track
// reaches once you account for what happens between samples on playback; the
// player measures it once per track so it can later normalize playback volume
// (quiet and loud tracks end up at a comparable level) instead of guessing.
//
// `measureAndCache` does the work for ONE track: it fingerprints the track,
// short-circuits if the peak is already in the on-disk cache, otherwise hands
// the actual audio decode to the per-flavor `measureTrackPeak` seam (the Media3
// build decodes with `Media3TruePeakDecoder`; the native-Rust builds use their
// own decoder), and memoizes the result.
//
// It deliberately does NOT persist (flush) the cache: the foreground play path
// flushes once per measurement, but the background sweep worker measures many
// tracks and flushes them in batches, so deciding *when* to write to disk is the
// caller's job, not this function's. This file is the logic-twin of only the
// INNER per-track body of the desktop sweep loop (fingerprint -> cache-check ->
// measure -> store); the loop, batching, sleeping, and thread-priority logic
// live elsewhere (in `PeakSweepWorker`), so none of that is commented here.
//
// Failure handling mirrors the foreground resolve: a coroutine cancellation
// propagates (the worker is being stopped mid-track), while any decode failure
// is logged and swallowed so a single corrupt or unsupported file cannot abort
// a sweep of thousands of tracks.
// ============================================================================

// What:     `package dev.monochromatic.musicplayer` declares which namespace
//           every name in this file belongs to. A "package" in Kotlin/Java is
//           a dotted folder-like grouping; other files using the same line can
//           call `measureAndCache` without an import, and files elsewhere
//           import it as `dev.monochromatic.musicplayer.measureAndCache`.
// Why:      Without this, the compiler would put these declarations in the
//           anonymous default package and the worker class could not find them.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword for this in TS — the directory + module system play this role.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` pulls in the `Context` type, the
//           Android object that represents "the app's handle to the system"
//           (resources, content providers, the file system). The import names
//           one type from the `android.content` package.
// Why:      `measureAndCache` needs a `Context` to resolve the track's content
//           URI through its provider for both fingerprinting and decoding.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Context } from "android/content";
// ```
import android.content.Context

// What:     `import android.net.Uri` pulls in `Uri`, Android's parsed
//           "uniform resource identifier" type (for example a
//           `content://media/...` or a SAF `content://.../document/...`
//           string, already split into scheme/authority/path).
// Why:      The function is asked to measure the track AT a given `Uri`; it is
//           the address of the audio bytes.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Uri } from "android/net"; // think: a parsed URL
// ```
import android.net.Uri

// What:     `import android.util.Log` pulls in `Log`, Android's static logging
//           facility that writes to logcat (the device's system log buffer you
//           read with `adb logcat`). The import names the `Log` object itself,
//           and we call `Log.w(...)` (warning level) on it below.
// Why:      When a decode fails we want a breadcrumb in logcat naming the
//           offending track, without crashing the sweep.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Log } from "android/util"; // Log.w ~ console.warn
// ```
import android.util.Log

// What:     `import kotlinx.coroutines.CancellationException` pulls in the
//           special exception type Kotlin coroutines THROW to unwind a
//           coroutine that has been cancelled. A "coroutine" is a suspendable
//           function (see `suspend` below); cancelling one works by throwing
//           this exception at the next suspension point.
// Why:      We catch all exceptions around the decode, but a
//           `CancellationException` means "the worker is being stopped on
//           purpose", which must be re-thrown rather than swallowed (see the
//           catch block below). Importing the type lets us name it in a
//           `catch (cancellation: CancellationException)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { CancellationException } from "kotlinx/coroutines"; // ~ AbortError
// ```
import kotlinx.coroutines.CancellationException

// What:     `private const val SWEEP_TAG: String = "PeakSweep"` declares a
//           file-private compile-time constant string.
//           - `private` limits visibility to THIS file.
//           - `const` means the value is known at compile time and inlined at
//             every use site (only allowed for primitives and `String`).
//           - `val` is an immutable binding (cannot be reassigned), the
//             opposite of `var`.
//           - `: String` is the explicit type. Sibling the reader might
//             expect: `CharSequence` (a read-only character-sequence
//             interface that `String` implements); `String` is the concrete,
//             immutable, owned text type and the right choice for a literal tag.
// Why:      `Log.w` takes a "tag" first argument to group log lines; sharing
//           one named constant keeps every line from this sweep grep-able under
//           the same tag, and `const` means no per-call allocation.
//
// In TS you'd write (pseudocode):
// ```ts
// const SWEEP_TAG: string = "PeakSweep";
// ```
/**
 * Defines sweep tag value for this music-player component; the TypeScript-oriented notes above explain its
 * source and use.
 */
private const val SWEEP_TAG: String = "PeakSweep"

// What:     `enum class SweepOutcome { CACHED, MEASURED, UNFINGERPRINTABLE, FAILED }`
//           declares an enumeration: a closed type with exactly four named
//           constant values, used to report which branch of `measureAndCache`
//           ran. The four members (folding in the old per-value docs):
//           - `CACHED`: the cache already held a peak, so nothing was decoded.
//           - `MEASURED`: the track was decoded and a fresh peak was memoized
//             (the caller still owns flushing it to disk).
//           - `UNFINGERPRINTABLE`: no cache key could be derived (the provider
//             did not report a size), so the track is skipped; at playback it
//             falls back to unity (unchanged) gain.
//           - `FAILED`: the decode threw (unsupported or corrupt file); the
//             track is left uncached so a later pass or a foreground play can
//             retry it.
// Why:      The worker counts these outcomes to decide when to flush and to log
//           a useful summary; returning a typed value (not a bare boolean or
//           int) makes every caller handle each case explicitly.
// Gotcha:   A Kotlin `enum class` value is a real object (it has a `.name`,
//           `.ordinal`, can carry methods), not just a string the way the TS
//           union below is. Here we only ever compare identities, so the union
//           is a faithful stand-in.
//
// In TS you'd write (pseudocode):
// ```ts
// type SweepOutcome = "CACHED" | "MEASURED" | "UNFINGERPRINTABLE" | "FAILED";
// ```
/**
 * Defines sweep outcome type for this music-player component; the TypeScript-oriented notes above explain
 * its role.
 */
enum class SweepOutcome {
    /**
     * Defines cached case for this music-player state; the TypeScript-oriented notes above explain when it is
     * selected.
     */
    CACHED,

    /**
     * Defines measured case for this music-player state; the TypeScript-oriented notes above explain when it is
     * selected.
     */
    MEASURED,

    /**
     * Defines unfingerprintable case for this music-player state; the TypeScript-oriented notes above explain
     * when it is selected.
     */
    UNFINGERPRINTABLE,

    /**
     * Defines failed case for this music-player state; the TypeScript-oriented notes above explain when it is
     * selected.
     */
    FAILED,
}

// What:     `suspend fun measureAndCache(context: Context, uri: Uri): SweepOutcome`
//           declares a function. Piece by piece:
//           - `suspend` marks it a COROUTINE: a function that may pause itself
//             (at an `await`-like point) and resume later without blocking the
//             thread. Only other `suspend` functions (or a coroutine builder)
//             may call it. Both helpers it calls (`TrackFingerprint.of`,
//             `PeakCacheStore.get/put`, `measureTrackPeak`) are themselves
//             `suspend`, which is why this one must be too.
//           - `fun measureAndCache` is the name.
//           - `context: Context` is the first parameter: the app's system
//             handle, used to resolve the URI's provider.
//           - `uri: Uri` is the second parameter: the address of the track to
//             measure.
//           - `: SweepOutcome` is the return type: one of the four enum values
//             above, telling the caller which branch ran.
// Why:      This is the one entry point a worker (or the foreground path) calls
//           per track; returning the outcome lets the caller drive its
//           accounting and flush cadence.
// Gotcha:   Unlike TS `async`, calling a `suspend` function does NOT eagerly
//           return a promise you can ignore; it can only run inside a coroutine
//           scope, and cancelling that scope unwinds it via the
//           `CancellationException` imported above.
//
// In TS you'd write (pseudocode):
// ```ts
// async function measureAndCache(
//   context: Context,
//   uri: Uri,
// ): Promise<SweepOutcome> { ... }
// ```
/**
 * Defines measure and cache behavior for this music-player component; the TypeScript-oriented notes above
 * explain its call shape and effects.
 */
suspend fun measureAndCache(context: Context, uri: Uri): SweepOutcome {
    // What:     `val key: String = TrackFingerprint.of(context, uri) ?: return SweepOutcome.UNFINGERPRINTABLE`
    //           does four things on one line:
    //           - `TrackFingerprint.of(context, uri)` calls the fingerprint
    //             helper, which returns a NULLABLE `String?` (the cache key, or
    //             `null` when the provider reports no size so no stable key can
    //             be built).
    //           - `?:` is Kotlin's ELVIS operator: "if the left side is
    //             non-null, use it; otherwise evaluate the right side". It is
    //             the null-fallback idiom that exists because Kotlin
    //             distinguishes `String` (never null) from `String?` (maybe
    //             null).
    //           - the right side is itself `return SweepOutcome.UNFINGERPRINTABLE`,
    //             so a null key early-returns the whole function with that
    //             outcome.
    //           - `val key: String` (note: non-nullable `String`, NOT
    //             `String?`) therefore always holds a real key past this line;
    //             the compiler knows it cannot be null because the null branch
    //             already returned. Sibling type the reader might expect:
    //             `String?`; we annotate the non-nullable `String` precisely to
    //             prove "from here on, key is present".
    // Why:      No fingerprint means we cannot key the cache for this track, so
    //           we stop immediately and report `UNFINGERPRINTABLE` instead of
    //           pointlessly decoding something we could never cache.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const maybeKey = await TrackFingerprint.of(context, uri); // string | null
    // if (maybeKey == null) return "UNFINGERPRINTABLE";
    // const key: string = maybeKey;
    // ```
    /**
     * Defines key value for this music-player component; the TypeScript-oriented notes above explain its source
     * and use.
     */
    val key: String = TrackFingerprint.of(context, uri) ?: return SweepOutcome.UNFINGERPRINTABLE
    // What:     `if (PeakCacheStore.get(context, key) != null) {` checks the
    //           on-disk peak cache. `PeakCacheStore.get` returns a nullable
    //           `Float?` (the cached peak, or `null` on a miss); `!= null` is a
    //           plain not-null test. The `{` opens the cache-hit branch.
    // Why:      If the peak is already cached we must not decode again; the
    //           whole point of the cache is to make a re-sweep of a known
    //           library cheap.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if ((await PeakCacheStore.get(context, key)) != null) {
    // ```
    if (PeakCacheStore.get(context, key) != null) {
        // What:     `return SweepOutcome.CACHED` exits the function with the
        //           "already cached" outcome. `SweepOutcome.CACHED` selects one
        //           member of the enum declared above.
        // Why:      Tell the caller nothing was decoded; it will not flush for
        //           this track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return "CACHED";
        // ```
        return SweepOutcome.CACHED
    }
    // What:     `val peak: Float = try {` begins assigning the measured peak.
    //           Two concepts:
    //           - `: Float` is the explicit type. `Float` is a 32-bit IEEE-754
    //             single-precision floating-point number. Sibling the reader
    //             might expect: `Double`, the 64-bit double-precision type
    //             (which is what a bare TS `number` actually is). We use
    //             `Float`, not `Double`, because the audio sample pipeline and
    //             the on-disk cache store peaks as 32-bit floats; widening to
    //             `Double` here would just force a narrowing conversion back
    //             when caching and waste precision the source never had.
    //           - in Kotlin `try { ... } catch ... ` is an EXPRESSION: the
    //             whole try/catch evaluates to a value (the last expression of
    //             whichever branch runs) and we assign it to `peak`.
    // Why:      We want the decoded peak if the decode succeeds, but we also
    //           need to turn certain failures into a control-flow outcome; an
    //           expression-shaped try lets us produce `peak` OR return early,
    //           all in one binding.
    // Gotcha:   This is the big difference from TS. In TS `try/catch` is a
    //           STATEMENT, not an expression, so you cannot write
    //           `const peak = try {...}`. You must declare `let peak` first and
    //           assign inside the branches.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let peak: number; // TS number is 64-bit; Kotlin Float is 32-bit
    // try {
    // ```
    /**
     * Defines peak value for this music-player component; the TypeScript-oriented notes above explain its source
     * and use.
     */
    val peak: Float = try {
        // What:     `measureTrackPeak(context, uri)` calls the per-flavor decode
        //           seam that actually reads the audio and computes its true
        //           peak, returning a `Float`. It has no trailing assignment or
        //           `return`, so as the last expression of the `try` block it
        //           IS the value the `try` expression produces (an
        //           implicit-return tail expression), which becomes `peak`.
        // Why:      This is the expensive work we only reach on a cache miss:
        //           decode the track and get its peak.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        //   peak = await measureTrackPeak(context, uri);
        // ```
        measureTrackPeak(context, uri)
    } catch (cancellation: CancellationException) {
        // What:     `throw cancellation` re-throws the caught cancellation
        //           exception unchanged. `cancellation` is the value bound by
        //           the `catch (cancellation: CancellationException)` clause
        //           just above.
        // Why:      A cancellation is NOT a decode failure; it means the worker
        //           is being stopped on purpose. Swallowing it would break
        //           structured concurrency (the coroutine machinery relies on
        //           the exception propagating to actually stop), so we must let
        //           it keep unwinding.
        // Gotcha:   Catch-all `catch (e: Exception)` in Kotlin would also catch
        //           cancellations; this dedicated earlier clause exists solely
        //           to rescue and rethrow them before the broad catch below
        //           swallows everything.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // } catch (cancellation) {
        //   if (cancellation instanceof CancellationException) throw cancellation;
        // ```
        throw cancellation
    } catch (failure: Exception) {
        // What:     `Log.w(SWEEP_TAG, "true-peak measure failed for $uri; leaving it uncached", failure)`
        //           writes a WARNING-level logcat line. Arguments:
        //           - `SWEEP_TAG` is the shared tag constant.
        //           - the second argument is the message, where `$uri` is
        //             Kotlin STRING INTERPOLATION: `$uri` is replaced by the
        //             URI's text inline (the `$name` form splices a simple
        //             variable; `${expr}` would splice an expression).
        //           - `failure` is the caught exception, passed as the optional
        //             throwable argument so logcat prints its stack trace.
        // Why:      Leave a breadcrumb naming the bad track without crashing the
        //           sweep, so one unsupported or corrupt file is visible but
        //           non-fatal.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        //   console.warn(`true-peak measure failed for ${uri}; leaving it uncached`, failure);
        // ```
        Log.w(SWEEP_TAG, "true-peak measure failed for $uri; leaving it uncached", failure)
        // What:     `return SweepOutcome.FAILED` exits the function (out of the
        //           catch block, out of the whole `try` expression) with the
        //           "decode threw" outcome. `SweepOutcome.FAILED` selects that
        //           enum member.
        // Why:      Report the failure to the caller and, by returning instead
        //           of producing a `peak`, deliberately leave this track
        //           uncached so a later pass or a foreground play can retry it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        //   return "FAILED";
        // ```
        return SweepOutcome.FAILED
    }
    // What:     `PeakCacheStore.put(context, key, peak)` stores the freshly
    //           measured peak in the cache under our fingerprint key. It
    //           returns `Unit` (Kotlin's "no meaningful value", the equivalent
    //           of TS `void`), so we call it for its side effect and ignore the
    //           result.
    // Why:      Memoize the measurement so future sweeps and playbacks hit the
    //           cache instead of re-decoding. Note this only updates the
    //           in-memory cache and its persistence policy; flushing to disk is
    //           explicitly the CALLER's responsibility (the worker batches many
    //           of these), which is why this function does not flush here.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // await PeakCacheStore.put(context, key, peak);
    // ```
    PeakCacheStore.put(context, key, peak)
    // What:     `return SweepOutcome.MEASURED` exits with the "decoded a fresh
    //           peak" outcome. `SweepOutcome.MEASURED` selects that enum member.
    // Why:      Tell the caller this track produced a new measurement (pending
    //           its flush), so it can increment its batch counter and decide
    //           when to persist.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return "MEASURED";
    // ```
    return SweepOutcome.MEASURED
}
