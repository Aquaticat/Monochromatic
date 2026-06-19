// What:     `package dev.monochromatic.musicplayer` declares the namespace this file's
//           declarations belong to. This file is in the `rust` FLAVOR source set, merged with
//           the shared `main` source set for the full-Rust build variant.
// Why:      Keeps `measureTrackPeak` in the same package as the shared sweep code that calls it
//           and the `NativeBridge` it decodes through.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — file path is the module; this one is rust-flavor only.
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
// This file is the full-Rust flavor's offline true-peak MEASURER for the background sweep,
// mirroring the Media3 flavor's `measureTrackPeak` so the engine-agnostic `measureAndCache`
// (in shared `main`) resolves the right decoder AT COMPILE TIME. It decodes the track
// NATIVELY (symphonia/libopus via `NativeBridge.nativeMeasureTruePeak`), the in-process
// replacement for the Media3 flavor's MediaCodec decoder.
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

// What:     `private val sweepDecodeDispatcher: CoroutineDispatcher = Executors.newSingleThreadExecutor { ... }.asCoroutineDispatcher()`
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
private val sweepDecodeDispatcher: CoroutineDispatcher =
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

// What:     `suspend fun measureTrackPeak(context: Context, uri: Uri): Float = withContext(sweepDecodeDispatcher) { measureTruePeakBlocking(context, uri) }`
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
 * Defines measure track peak behavior for this music-player component; the TypeScript-oriented notes above
 * explain its call shape and effects.
 */
suspend fun measureTrackPeak(context: Context, uri: Uri): Float =
    withContext(sweepDecodeDispatcher) { measureTruePeakBlocking(context, uri) }

// What:     `internal fun measureTruePeakBlocking(context: Context, uri: Uri): Float { ... }`
//           declares a function with `internal` VISIBILITY: visible everywhere in THIS module
//           (this Gradle compilation), but not to other modules. It is a plain (NON-suspend),
//           BLOCKING function (it runs synchronously on whatever thread calls it). Block body.
// Why:      Open `uri` read-only and run the native true-peak measure on the CALLING thread,
//           returning the true peak. The background sweep calls this on its low-priority
//           dispatcher; the foreground engine calls it on a default background thread, so the
//           dispatcher choice lives with each caller. THROWS `FileNotFoundException` when the
//           provider cannot open the URI; `IllegalStateException` when the native measure returns
//           an error code.
// Gotcha:   `internal` is MODULE-scoped visibility, between `private` (file) and `public`
//           (everywhere); TS has no direct equivalent.
//
// In TS you'd write (pseudocode):
// ```ts
// // module-internal, synchronous:
// function measureTruePeakBlocking(context: Context, uri: Uri): number { ... }
// ```
/**
 * Defines measure true peak blocking behavior for this music-player component; the TypeScript-oriented notes
 * above explain its call shape and effects.
 */
internal fun measureTruePeakBlocking(context: Context, uri: Uri): Float {
    // What:     `val descriptor: ParcelFileDescriptor = context.contentResolver.openFileDescriptor(uri, "r") ?: throw FileNotFoundException("could not open $uri for true-peak measure")`
    //           declares a read-only `ParcelFileDescriptor`. `openFileDescriptor(uri, "r")` opens
    //           the URI in READ mode (`"r"`) and returns a nullable `ParcelFileDescriptor?`; `?:`
    //           is the ELVIS operator that THROWS a `FileNotFoundException` when it is `null`.
    // Why:      Get an open, readable descriptor for the track; a `null` means the provider could
    //           not open it, which is a hard error.
    // Gotcha:   `"r"` is the open-mode string (read-only); `?: throw ...` both null-checks and
    //           throws in one line.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const d = context.contentResolver.openFileDescriptor(uri, "r");
    // if (d === null) throw new FileNotFoundException(`could not open ${uri} for true-peak measure`);
    // const descriptor: ParcelFileDescriptor = d;
    // ```
    /**
     * Defines descriptor value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val descriptor: ParcelFileDescriptor = context.contentResolver.openFileDescriptor(uri, "r")
        ?: throw FileNotFoundException("could not open $uri for true-peak measure")
    // What:     `val peak: Float = descriptor.use { NativeBridge.nativeMeasureTruePeak(it.fd) }`
    //           declares a read-only `Float` `peak`. `descriptor.use { ... }` is the RESOURCE
    //           SCOPE function: it runs the trailing lambda and then GUARANTEES `descriptor.close()`
    //           runs afterward (success or exception), like try-with-resources. `it` is the
    //           implicit lambda parameter (the descriptor); `it.fd` reads its raw integer file
    //           descriptor, which is passed to the native measure. The lambda's value (the native
    //           result) becomes `peak`.
    // Why:      Pass the BORROWED fd to the native side INSIDE `use {}`, so the native code dups it
    //           synchronously while the descriptor is still open, then the descriptor is closed
    //           exactly once (the dup-ownership protocol that avoids an fdsan double-close).
    // Gotcha:   `use {}` CLOSES the descriptor when the block ends; do not keep using `it`/the fd
    //           afterward. The native side must finish (dup) before the block returns.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let peak: number;
    // {
    //   using d = descriptor; // auto-closes at block end
    //   peak = NativeBridge.nativeMeasureTruePeak(d.fd);
    // }
    // ```
    /**
     * Defines peak value for this music-player component; the TypeScript-oriented notes above explain its source
     * and use.
     */
    val peak: Float = descriptor.use { NativeBridge.nativeMeasureTruePeak(it.fd) }
    // What:     `if (peak < 0.0f) { ... }` checks for a negative native result. `0.0f` is a `Float`
    //           literal (the `f` suffix; a negative `peak` is the native error-code convention).
    // Why:      The native measure returns a negative value to signal failure; surface it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (peak < 0.0) { ... }
    // ```
    if (peak < 0.0f) {
        // What:     `throw IllegalStateException("native true-peak measure failed (code $peak) for $uri")`
        //           constructs (no `new`) and throws an `IllegalStateException` naming the error
        //           code and URI (string-template interpolation).
        // Why:      A native failure must propagate as an error, not be mistaken for a real peak.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // throw new IllegalStateException(`native true-peak measure failed (code ${peak}) for ${uri}`);
        // ```
        throw IllegalStateException("native true-peak measure failed (code $peak) for $uri")
    }
    // What:     `return peak` returns the measured (non-negative) true peak.
    // Why:      Hand the peak back to the caller.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return peak;
    // ```
    return peak
}
