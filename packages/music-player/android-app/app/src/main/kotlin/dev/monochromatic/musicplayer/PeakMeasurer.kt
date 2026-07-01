// What:     `package dev.monochromatic.musicplayer` declares the namespace this file's
//           declarations belong to. This file is compiled with the app's main source set and
//           provides the native true-peak measurement entry point.
// Why:      Keeps `measureTrackPeak` in the same package as the shared sweep code that calls it
//           and the `NativeBridge` it decodes through.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — file path is the module.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` brings in Android's `Context` (app-environment
//           handle) by short name.
// Why:      Both functions take a `Context` to resolve the URI's provider.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Context } from "android-framework";
// ```
import android.content.Context

// What:     `import android.net.Uri` brings in Android's parsed `Uri` type.
// Why:      Both functions take a track `Uri`.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Uri } from "android-framework";
// ```
import android.net.Uri

// What:     `import android.os.ParcelFileDescriptor` brings in `ParcelFileDescriptor`, Android's
//           wrapper around an open OS file descriptor. It is `Closeable` (so it works with
//           `use {}`) and exposes the raw integer fd via `.fd`.
// Why:      The decoder needs an open descriptor to hand the native side; this is how a
//           `content://` URI becomes a readable fd.
//
// In TS you'd write (pseudocode):
// ```ts
// // Mentally a file handle with a numeric `.fd` and a `.close()`.
// ```
import android.os.ParcelFileDescriptor

// What:     `import android.os.Process` brings in Android's `Process` class, whose
//           `setThreadPriority` / `THREAD_PRIORITY_LOWEST` set the calling thread's niceness.
// Why:      The sweep thread sets itself to the lowest priority so it yields to playback.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent — JS has no per-thread scheduling priority.
// ```
import android.os.Process

// What:     `import java.io.FileNotFoundException` brings in the JDK exception thrown when a file
//           or provider stream cannot be opened.
// Why:      `measureTruePeakBlocking` throws it when the content resolver returns no descriptor.
//
// In TS you'd write (pseudocode):
// ```ts
// // Mentally an Error subclass for "could not open file".
// ```
import java.io.FileNotFoundException

// What:     `import java.util.concurrent.Executors` brings in the JDK `Executors` factory;
//           `newSingleThreadExecutor(threadFactory)` builds a one-worker-thread executor.
// Why:      The sweep needs a single dedicated low-priority worker thread.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent — mentally a single dedicated worker.
// ```
import java.util.concurrent.Executors

// What:     `import kotlinx.coroutines.CoroutineDispatcher` brings in the type naming which
//           thread(s) a coroutine runs on.
// Why:      `sweepDecodeDispatcher`'s declared type is `CoroutineDispatcher`.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent — JS is single-threaded.
// ```
import kotlinx.coroutines.CoroutineDispatcher

// What:     `import kotlinx.coroutines.asCoroutineDispatcher` brings in the EXTENSION that adapts
//           a JDK `Executor` into a coroutine `CoroutineDispatcher`.
// Why:      We build a single-thread executor, then `.asCoroutineDispatcher()` it for coroutines.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent — wrap a worker for the async scheduler.
// ```
import kotlinx.coroutines.asCoroutineDispatcher

// What:     `import kotlinx.coroutines.withContext` brings in `withContext(dispatcher) { ... }`,
//           which runs the block ON that dispatcher's thread and SUSPENDS until it finishes,
//           returning the block's value (await-style, unlike fire-and-forget `launch`).
// Why:      `measureTrackPeak` wraps the blocking native measure in
//           `withContext(sweepDecodeDispatcher) { ... }` so it runs on the low-priority thread.
//
// In TS you'd write (pseudocode):
// ```ts
// // const x = await runOn(dispatcher, () => { ... }); (no real TS threads)
// ```
import kotlinx.coroutines.withContext

// =============================================================================
// File summary (folds in the old KDoc's domain content)
// =============================================================================
//
// This file is the app's offline true-peak MEASURER for the background sweep. It decodes the
// track NATIVELY with symphonia/libopus via `NativeBridge.nativeMeasureTruePeak`, matching the
// production playback engine's decoder stack.
//
// It owns `sweepDecodeDispatcher`: ONE low-priority (nice 19) daemon thread the sweep decodes
// on, so its CPU-heavy native true-peak pass yields to playback and the UI under contention.
// `THREAD_PRIORITY_LOWEST` runs full speed when idle (the overnight charging window the sweep
// targets) and almost fully yields whenever a foreground thread wants the CPU. One thread
// suffices because the sweep measures one track at a time; a daemon never holds the process
// open.
//
// `measureTrackPeak` (the sweep entry point) routes onto that low-priority dispatcher;
// `measureTruePeakBlocking` does the actual open-and-measure on whatever thread calls it, so
// the dispatcher choice lives with each caller (the foreground engine calls it on its own
// default background thread).

// What:     `private val sweepDecodeDispatcher: CoroutineDispatcher = Executors.newSingleThreadExecutor { ...
//           }.asCoroutineDispatcher()`
//           declares a FILE-PRIVATE, top-level read-only property of type `CoroutineDispatcher`,
//           built by making a one-thread executor (with a custom thread factory) and adapting it
//           into a coroutine dispatcher. The pieces are commented line by line below.
// Why:      Provide the single low-priority worker thread the sweep decodes on.
//
// In TS you'd write (pseudocode):
// ```ts
// // const sweepDecodeDispatcher = asDispatcher(makeSingleLowPriorityWorker("peak-sweep-decode"));
// ```
/**
 * Defines sweep decode dispatcher value for this music-player component; the TypeScript-oriented notes above
 * explain its source and use.
 */
internal val sweepDecodeDispatcher: CoroutineDispatcher =
    // What:     `Executors.newSingleThreadExecutor { runnable -> ... }` calls the factory with a
    //           THREAD FACTORY passed as a TRAILING LAMBDA (SAM conversion: `ThreadFactory` is a
    //           single-method interface). The lambda's parameter `runnable` is the work to wrap;
    //           the lambda must build and return a `Thread` that runs it.
    // Why:      The one worker thread must be low-priority and a daemon, so we supply a custom
    //           factory instead of the default.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // makeSingleThreadExecutor((runnable) => { /* build & return a low-priority daemon thread */ });
    // ```
    Executors.newSingleThreadExecutor { runnable ->
        // What:     `Thread( { ... }, "peak-sweep-decode" ).apply { isDaemon = true }` constructs a
        //           `Thread` from a `Runnable` (the lambda first arg, SAM-converted) and a NAME, then
        //           `.apply { isDaemon = true }` marks it a daemon and returns it.
        // Why:      Build the worker: lower its priority, then run the task; the name aids debugging;
        //           daemon means it does not keep the process alive.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const t = new Thread(() => { /* setThreadPriority(LOWEST); runnable.run(); */ }, "peak-sweep-decode");
        // t.isDaemon = true;
        // return t;
        // ```
        Thread(
            // What:     `{ ... }` is the thread's RUNNABLE body (SAM lambda passed as the `Thread`
            //           constructor's first argument); it runs ON the new thread when started.
            // Why:      Define the worker's work: drop priority, then run the task.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // () => { /* setThreadPriority(LOWEST); runnable.run(); */ }
            // ```
            {
                // What:     `Process.setThreadPriority(Process.THREAD_PRIORITY_LOWEST)` lowers THIS
                //           thread's scheduling priority to the platform minimum (nice 19).
                // Why:      So the CPU-heavy native decode yields to playback and the UI.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // // No equivalent — JS has no per-thread priority.
                // ```
                Process.setThreadPriority(Process.THREAD_PRIORITY_LOWEST)
                // What:     `runnable.run()` runs the executor's task on this thread via its `run()`.
                // Why:      After lowering priority, actually perform the queued work.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // runnable.run();
                // ```
                runnable.run()
            },
            "peak-sweep-decode",
        ).apply { isDaemon = true }
    }.asCoroutineDispatcher()

/**
 * Worker count for the user-initiated foreground sweep: half the logical cores, at least two. On a
 * big.LITTLE phone that is the performance-core count; the Pixel 6 benchmark
 * (DECISION.peak-sweep-parallelism.md) showed sustained decode throughput saturates there
 * (~130 tracks/min) and extra threads only add heat and UI contention.
 */
internal val FOREGROUND_SWEEP_WORKERS: Int = maxOf(2, Runtime.getRuntime().availableProcessors() / 2)

/**
 * Multi-threaded decode dispatcher for the foreground initial sweep: [FOREGROUND_SWEEP_WORKERS]
 * daemon threads at [Process.THREAD_PRIORITY_DEFAULT], so the first full index claims the big cores
 * and finishes in one continuous session. Contrast [sweepDecodeDispatcher], the single nice-19
 * thread the background upkeep worker uses to yield to playback.
 */
internal val foregroundSweepDispatcher: CoroutineDispatcher =
    Executors.newFixedThreadPool(FOREGROUND_SWEEP_WORKERS) { runnable ->
        Thread(
            {
                Process.setThreadPriority(Process.THREAD_PRIORITY_DEFAULT)
                runnable.run()
            },
            "peak-sweep-fg",
        ).apply { isDaemon = true }
    }.asCoroutineDispatcher()

// What:     `suspend fun measureTrackPeak(context: Context, uri: Uri): Float = withContext(sweepDecodeDispatcher) {
//           measureTruePeakBlocking(context, uri) }`
//           declares a top-level SUSPEND function with an EXPRESSION BODY whose value is the
//           `withContext(...)` call: it runs `measureTruePeakBlocking(context, uri)` on the
//           low-priority sweep thread and awaits the result.
// Why:      The sweep's entry point; it always routes the (blocking) native measure onto
//           `sweepDecodeDispatcher`. Returns the measured true peak (linear), `0.0` for a
//           zero-channel stream.
//
// In TS you'd write (pseudocode):
// ```ts
// async function measureTrackPeak(context: Context, uri: Uri): Promise<number> {
//   return await runOn(sweepDecodeDispatcher, () => measureTruePeakBlocking(context, uri));
// }
// ```
/**
 * Routes the blocking native warming call onto [dispatcher] (default [sweepDecodeDispatcher], the
 * single low-priority thread the background upkeep worker uses). The foreground initial sweep passes
 * [foregroundSweepDispatcher] for parallel default-priority decode. Returns the resolved gain (the
 * native side full-scans to an exact decision and caches it, skipping already-exact tracks).
 */
suspend fun warmTrack(
    context: Context,
    uri: Uri,
    fingerprint: Long,
    dispatcher: CoroutineDispatcher = sweepDecodeDispatcher,
): Float =
    withContext(dispatcher) { warmTrackBlocking(context, uri, fingerprint) }

// What:     `internal fun warmTrackBlocking(context: Context, uri: Uri, fingerprint: Long): Float`
//           declares a function with `internal` VISIBILITY (visible within this module). It is a
//           plain (NON-suspend), BLOCKING function that runs synchronously on the calling thread.
// Why:      Open `uri` read-only and run the native WARMING resolve on the CALLING thread: the
//           native service full-scans the track to an EXACT decision and caches it (skipping tracks
//           already cached exactly), returning its gain. The gain math and the cache live in Rust;
//           Kotlin no longer stores peaks. THROWS `FileNotFoundException` when the provider cannot
//           open the URI. `nativeWarmTrack` never returns a negative code (it falls back to the safe
//           ceiling gain), so there is no error-code check here.
// Gotcha:   `internal` is MODULE-scoped visibility, between `private` (file) and `public`.
//
// In TS you'd write (pseudocode):
// ```ts
// function warmTrackBlocking(context: Context, uri: Uri, fingerprint: bigint): number { ... }
// ```
/**
 * Warms one track natively (full-scan exact + cache) and returns its gain.
 */
internal fun warmTrackBlocking(context: Context, uri: Uri, fingerprint: Long): Float {
    // What:     `val descriptor: ParcelFileDescriptor = context.contentResolver.openFileDescriptor(uri, "r") ?: throw
    //           FileNotFoundException("could not open $uri for true-peak warm")`
    //           opens the URI read-only (`"r"`), throwing via the ELVIS operator when the provider
    //           returns `null`.
    // Why:      Get an open, readable descriptor for the track; a `null` means the provider could
    //           not open it, a hard error.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const d = context.contentResolver.openFileDescriptor(uri, "r");
    // if (d === null) throw new FileNotFoundException(`could not open ${uri} for true-peak warm`);
    // ```
    /**
     * Defines descriptor value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val descriptor: ParcelFileDescriptor = context.contentResolver.openFileDescriptor(uri, "r")
        ?: throw FileNotFoundException("could not open $uri for true-peak warm")
    // What:     `return descriptor.use { NativeBridge.nativeWarmTrack(TruePeakGain.handle(context),
    //           it.fd, fingerprint) }` warms the track natively and closes the fd after. `use {}`
    //           runs the lambda then GUARANTEES `descriptor.close()` (the dup-ownership protocol
    //           that avoids an fdsan double-close); `it.fd` is the borrowed raw fd.
    //           `TruePeakGain.handle(context)` is the one process-wide service handle (shared with
    //           the foreground). The returned gain is unused by the sweep but returned for logging.
    // Why:      One native call full-scans, caches an exact decision, and skips already-exact tracks.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return descriptor.use((d) => NativeBridge.nativeWarmTrack(TruePeakGain.handle(context), d.fd, fingerprint));
    // ```
    return descriptor.use { NativeBridge.nativeWarmTrack(TruePeakGain.handle(context), it.fd, fingerprint) }
}
