// ============================================================================
// File summary (folds in the old KDoc that sat on `class PeakSweepWorker`)
// ============================================================================
//
// This file is a BACKGROUND true-peak sweep. It walks the active library
// (`LibrarySource`) and measures-and-caches every uncached track, so playback
// rarely meets a track whose peak is not already known and the foreground
// decode-on-miss becomes the exception rather than the rule. A full first sweep
// is large (each opus track is seconds of decode and the library is thousands
// of tracks), so it runs only while charging (see `PeakSweepScheduler`) and
// decodes at the lowest thread priority, yielding to playback rather than
// contending with it.
//
// The sweep is SILENT by construction: `measureAndCache` decodes through
// `Media3TruePeakDecoder`, a decode-only pass with no `AudioTrack`, so it
// produces no sound while it runs. It is also RESUMABLE for free, with no
// separate cursor: the durable cursor is the cache file itself, because an
// already-measured track is a cheap `PeakCacheStore` hit that the next pass
// skips.
//
// A single worker execution is time-bounded by the platform (WorkManager's
// ~10-minute foreground-service-less limit), so `doWork` cooperates: it delegates
// to the shared `sweepTracksInParallel` coordinator with ONE worker (serial
// upkeep on the single low-priority decode thread). The coordinator stops
// promptly when this worker's coroutine is cancelled on stop, flushes in batches,
// and runs one final flush, so a stop loses at most a batch. On natural
// completion `doWork` returns `Result.success()` (never `Result.retry()`):
// WorkManager's exponential backoff (capped at five hours, reset only on a
// terminal result) would otherwise pin a long sweep to one attempt per five hours
// even while charging held continuously. As periodic work, returning success
// keeps the attempt count at zero and lets the next period continue the backlog,
// and newly added tracks are caught by future periods natively. Per-track
// failures never fail the run, so one unsupported file cannot stall the sweep.
//
// `SweepOutcome`, `sweepTracksInParallel`, `measureAndCache`, `sweepDecodeDispatcher`,
// `PeakCacheStore`, `LibrarySource`, and `Track` are all siblings in this same
// package (so no imports are needed for them).
// ============================================================================

// What:     `package dev.monochromatic.musicplayer` names the namespace this
//           worker lives in, reachable elsewhere as
//           `dev.monochromatic.musicplayer.PeakSweepWorker`.
// Why:      So WorkManager and `PeakSweepScheduler` can refer to the worker class.
//
// In TS you'd write (pseudocode):
// ```ts
// // No `package` line in TS; the file path is the module identity.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` pulls in `Context`, Android's app
//           environment handle. WorkManager passes one to the worker's constructor.
// Why:      The primary constructor takes a `Context` to forward to the base class.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Context } from "android/content";
// ```
import android.content.Context

// What:     `import android.util.Log` pulls in `Log`, Android's logger.
//           `Log.i(tag, message)` writes an info line to logcat.
// Why:      We log the empty-library case and the final per-run summary counts.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Log } from "android/util";
// ```
import android.util.Log

// What:     `import androidx.core.net.toUri` imports an EXTENSION FUNCTION named
//           `toUri`. An extension function is a function declared OUTSIDE a class
//           that you nonetheless call with dot-syntax ON a value of that class, as
//           if it were a method: here `someString.toUri()` parses a `String` into a
//           `Uri`. You must import the function itself (not a type) to make the
//           `.toUri()` call resolve.
// Why:      Each `track.uri` is a `String`; `measureAndCache` wants a `Uri`, so we
//           call `track.uri.toUri()` to parse it, which needs this import.
// Gotcha:   Importing a bare FUNCTION (not a class/type) is what enables the
//           `.toUri()` dot-call below; without the import the method appears not to
//           exist on `String`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { toUri } from "androidx/core/net"; // call as toUri(x), not x.toUri()
// ```
import androidx.core.net.toUri

// What:     `import androidx.work.CoroutineWorker` pulls in `CoroutineWorker`, the
//           WorkManager base class for background work whose body is a `suspend`
//           function (so it can do coroutine-style async work).
// Why:      `PeakSweepWorker` EXTENDS `CoroutineWorker` and overrides its
//           `doWork()`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { CoroutineWorker } from "androidx/work";
// ```
import androidx.work.CoroutineWorker

// What:     `import androidx.work.WorkerParameters` pulls in `WorkerParameters`, the
//           bag of inputs WorkManager constructs each worker with (including the
//           input-data key/value pairs).
// Why:      The constructor takes one to forward to the base class; `inputData`
//           (read in `doWork`) comes from it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { WorkerParameters } from "androidx/work";
// ```
import androidx.work.WorkerParameters

// What:     `class PeakSweepWorker( context: Context, parameters: WorkerParameters, ) : CoroutineWorker(context,
//           parameters) { ... }`
//           declares a class named `PeakSweepWorker`. The parentheses after the
//           name are the PRIMARY CONSTRUCTOR. Note `context` and `parameters` have
//           NO `val`/`var`, so they are plain constructor parameters (NOT stored as
//           fields) visible only during construction. The
//           `: CoroutineWorker(context, parameters)` means "this class EXTENDS
//           `CoroutineWorker` and immediately calls that base constructor passing
//           `context` and `parameters`."
// Why:      Subclassing `CoroutineWorker` is what makes this a WorkManager job;
//           forwarding `context`/`parameters` hands the base class what it needs
//           (and exposes `applicationContext`, `inputData`, `isStopped` to us).
// Gotcha:   Because the params lack `val`/`var` they are NOT fields; we never refer
//           to `context`/`parameters` again, only to the base class's
//           `applicationContext`/`inputData`/`isStopped`.
//
// In TS you'd write (pseudocode):
// ```ts
// class PeakSweepWorker extends CoroutineWorker {
//   constructor(context: Context, parameters: WorkerParameters) {
//     super(context, parameters);
//   }
//   // ...body...
// }
// ```
/**
 * Defines peak sweep worker type for this music-player component; the TypeScript-oriented notes above explain
 * its role.
 */
class PeakSweepWorker(
    // What:     `context: Context` is a plain constructor parameter (no `val`/`var`,
    //           so not a stored field). It is the application context WorkManager
    //           constructs the worker with.
    // Why:      It is forwarded straight to `CoroutineWorker(context, parameters)`;
    //           we never need it again afterward (we use `applicationContext` from
    //           the base class instead).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // context: Context // not stored; just passed to super(...)
    // ```
    context: Context,
    // What:     `parameters: WorkerParameters` is a second plain (non-field)
    //           constructor parameter: the worker parameters, including the
    //           `KEY_MAX_TRACKS` bound used by tests.
    // Why:      Forwarded to the base constructor; `inputData` (read later) is
    //           derived from it by the base class.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // parameters: WorkerParameters // not stored; passed to super(...)
    // ```
    parameters: WorkerParameters,
) : CoroutineWorker(context, parameters) {
    // What:     `override suspend fun doWork(): Result { ... }` declares the method
    //           that runs the job. `override` is MANDATORY because it replaces
    //           `CoroutineWorker.doWork()`. `suspend` marks it a coroutine function
    //           (it can await background work). `: Result` is the return type,
    //           WorkManager's outcome value (`Result.success()` / `Result.retry()` /
    //           `Result.failure()`).
    // Why:      This is the worker's body: sweep the library once, bounded by the
    //           idle window, and report success so periodic scheduling continues
    //           without backoff.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override async doWork(): Promise<Result> { ... }
    // ```
    /**
     * Defines do work behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    override suspend fun doWork(): Result {
        // What:     `val tracks: List<Track> = LibrarySource.load(applicationContext)`
        //           declares a read-only `List<Track>` local `tracks` (an immutable
        //           list; sibling `MutableList<Track>` is the editable one).
        //           `LibrarySource.load(...)` is a `suspend` call (awaited implicitly)
        //           that returns the active library; `applicationContext` is the base
        //           class's app-wide context property.
        // Why:      We need the full track list to sweep over.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const tracks: readonly Track[] = await LibrarySource.load(this.applicationContext);
        // ```
        /**
         * Defines tracks value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val tracks: List<Track> = LibrarySource.load(applicationContext)
        // What:     `if (tracks.isEmpty()) { ... }` is a control-flow check using the
        //           `List.isEmpty()` predicate (true when there are zero tracks).
        // Why:      A missing/empty library has nothing to sweep; bail out early.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (tracks.length === 0) { ... }
        // ```
        if (tracks.isEmpty()) {
            // What:     `Log.i(WORKER_TAG, "PeakSweepWorker found no library to sweep")`
            //           writes an info log line under the worker's tag.
            // Why:      Record that the run found nothing, for on-device verification.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.info(`[${WORKER_TAG}] PeakSweepWorker found no library to sweep`);
            // ```
            Log.i(WORKER_TAG, "PeakSweepWorker found no library to sweep")
            // What:     `return Result.success()` returns WorkManager's "succeeded"
            //           outcome. `Result.success()` is a FACTORY constructing that
            //           outcome value (no `new` keyword in Kotlin).
            // Why:      An empty library is a successful no-op run; returning success
            //           (not retry) avoids backoff so the next period just retries.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return Result.success();
            // ```
            return Result.success()
        }
        // What:     `val limit: Int = inputData.getInt(KEY_MAX_TRACKS, DEFAULT_MAX_TRACKS)`
        //           declares a read-only `Int` local `limit` (32-bit signed; siblings
        //           `Long`/`Short`). `inputData.getInt(key, default)` reads the integer
        //           stored under `key`, or returns `default` when the key is absent
        //           (the default-on-miss pattern, like TS's `map.get(k) ?? default`).
        // Why:      A test sets `KEY_MAX_TRACKS` small so one instrumented run stays
        //           short; production leaves it unset, so `limit` defaults to
        //           `Int.MAX_VALUE` (effectively no cap).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const limit: number = inputData.getInt(KEY_MAX_TRACKS, DEFAULT_MAX_TRACKS);
        // ```
        /**
         * Defines limit value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val limit: Int = inputData.getInt(KEY_MAX_TRACKS, DEFAULT_MAX_TRACKS)
        // What:     `val tally = sweepTracksInParallel(...)` delegates the whole sweep
        //           to the shared coordinator. `workers = 1` makes it SERIAL (the upkeep
        //           runs one decode at a time on the single low-priority thread
        //           `sweepDecodeDispatcher`); `maxTracks = limit` applies the (test) cap;
        //           the three trailing lambdas inject the per-track measure, the disk
        //           flush, and a no-op progress sink. It returns a `SweepTally` of the
        //           per-outcome counts.
        // Why:      One tested loop shared with the foreground service instead of a
        //           second hand-written copy. Stop is cooperative: when WorkManager
        //           cancels this worker's coroutine, the coordinator's `isActive` workers
        //           break and its final flush still runs under `NonCancellable`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const tally = await sweepTracksInParallel({
        //   items: tracks, workers: 1, dispatcher: sweepDecodeDispatcher,
        //   flushBatch: FLUSH_BATCH, notifyEvery: Number.MAX_SAFE_INTEGER, maxTracks: limit,
        //   process: (track) => measureAndCache(this.applicationContext, toUri(track.uri)),
        //   onFlush: () => PeakCacheStore.flush(this.applicationContext),
        //   onProgress: () => {},
        // });
        // ```
        /**
         * Defines tally value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val tally = sweepTracksInParallel(
            items = tracks,
            workers = 1,
            dispatcher = sweepDecodeDispatcher,
            flushBatch = FLUSH_BATCH,
            notifyEvery = Int.MAX_VALUE,
            maxTracks = limit,
            process = { track -> measureAndCache(applicationContext, track.uri.toUri()) },
            // The native decision cache commits each write itself (Turso autocommit), so there is
            // nothing for Kotlin to flush; the hook stays a no-op.
            onFlush = { },
            onProgress = { _, _ -> },
        )
        // What:     `Log.i( WORKER_TAG, "... ${tally.processed}/${tally.total} ..." )`
        //           writes the run summary from the returned tally. Each `${tally.x}` is
        //           a string-template placeholder; `skipped` reports the unfingerprintable
        //           count.
        // Why:      Emit one line with the per-outcome tallies and whether we were
        //           stopped, for on-device verification.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // console.info(
        //   `[${WORKER_TAG}] PeakSweepWorker swept ${tally.processed}/${tally.total} tracks ` +
        //     `(measured=${tally.measured} cached=${tally.cached} skipped=${tally.unfingerprintable} ` +
        //     `failed=${tally.failed} stopped=${this.isStopped})`,
        // );
        // ```
        Log.i(
            WORKER_TAG,
            "PeakSweepWorker swept ${tally.processed}/${tally.total} tracks " +
                "(measured=${tally.measured} cached=${tally.cached} skipped=${tally.unfingerprintable} " +
                "failed=${tally.failed} stopped=$isStopped)",
        )
        // What:     `return Result.success()` returns WorkManager's "succeeded" outcome
        //           from the normal end of the sweep.
        // Why:      Returning success (never retry) keeps the attempt count at zero so the
        //           next period continues the backlog without exponential backoff.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return Result.success();
        // ```
        return Result.success()
    }

    /**
     * Defines companion object for this music-player component; the TypeScript-oriented notes above explain its
     * shared role.
     */
    // What:     `companion object { ... }` declares a single file-private OBJECT
    //           attached to the `PeakSweepWorker` class. A "companion object" hangs
    //           STATIC-LIKE members (values that belong to the class itself, not to
    //           an instance) off the class; you read them as
    //           `PeakSweepWorker.KEY_MAX_TRACKS`.
    // Why:      It holds the constants (log tag, flush batch size, the test cap key,
    //           and its default) that belong to the worker type as a whole.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // static members of the PeakSweepWorker class:
    // //   static readonly KEY_MAX_TRACKS = "max_tracks";
    // //   static readonly DEFAULT_MAX_TRACKS = Number.MAX_SAFE_INTEGER;
    // ```
    companion object {
        // What:     `private const val WORKER_TAG: String = "PeakSweep"` declares a
        //           private compile-time `String` constant (`const` = known at compile
        //           time and inlined; `val` = never reassigned).
        // Why:      The logcat tag shared with `measureAndCache`, so verification can
        //           grep just this work's output.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly WORKER_TAG = "PeakSweep";
        // ```
        /**
         * Defines worker tag value for this music-player component; the TypeScript-oriented notes above explain
         * its source and use.
         */
        private const val WORKER_TAG: String = "PeakSweep"

        // What:     `private const val FLUSH_BATCH: Int = 16` declares a private
        //           compile-time `Int` constant (32-bit; siblings `Long`/`Short`).
        // Why:      Fresh measurements between disk flushes: small enough to bound the
        //           at-most-this-many measurements an abrupt stop can lose (re-measured
        //           next pass, idempotently), large enough to keep writes infrequent
        //           (each flush rewrites the whole `peaks.json`).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly FLUSH_BATCH = 16;
        // ```
        /**
         * Defines flush batch value for this music-player component; the TypeScript-oriented notes above explain
         * its source and use.
         */
        private const val FLUSH_BATCH: Int = 16

        // What:     `internal const val KEY_MAX_TRACKS: String = "max_tracks"` declares a
        //           module-internal (visible across this Gradle module, not outside)
        //           compile-time `String` constant. `internal` is the visibility;
        //           siblings: `private`/`public`/`protected`.
        // Why:      Input-data key capping how many tracks one run processes. Unset in
        //           production; a test sets it small so a single instrumented run stays
        //           short instead of decoding the whole device library. `internal` so the
        //           test (same module) can reference the key.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // static readonly KEY_MAX_TRACKS = "max_tracks";
        // ```
        /**
         * Defines key max tracks value for this music-player component; the TypeScript-oriented notes above
         * explain its source and use.
         */
        internal const val KEY_MAX_TRACKS: String = "max_tracks"

        // What:     `internal const val DEFAULT_MAX_TRACKS: Int = Int.MAX_VALUE` declares a
        //           module-internal compile-time `Int` constant whose value is
        //           `Int.MAX_VALUE`, the largest 32-bit signed integer (2,147,483,647).
        // Why:      No cap: a production run processes the whole backlog until the
        //           platform stops it, so the default limit is effectively unbounded.
        // Gotcha:   `Int.MAX_VALUE` is the 32-bit ceiling specifically; one past it WRAPS
        //           to the negative minimum (no auto-widening like a JS number).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // static readonly DEFAULT_MAX_TRACKS = 2147483647; // Int.MAX_VALUE
        // ```
        /**
         * Defines default max tracks value for this music-player component; the TypeScript-oriented notes above
         * explain its source and use.
         */
        internal const val DEFAULT_MAX_TRACKS: Int = Int.MAX_VALUE
    }
}
