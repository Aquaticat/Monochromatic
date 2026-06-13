// What:     `package dev.monochromatic.musicplayer` declares the namespace this file's
//           declarations belong to. This file is in the `media3` FLAVOR source set, merged
//           with the shared `main` source set for the Media3 build variant.
// Why:      Keeps `measureTrackPeak` in the same package as the shared sweep code that calls
//           it and the `Media3TruePeakDecoder` it delegates to.
// TS map:   No `package` keyword in TS; the file path is the module identity.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — file path is the module; this one is media3-flavor only.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` brings in Android's `Context` (app-environment
//           handle) by short name.
// Why:      `measureTrackPeak` forwards a `Context` to the decoder.
// TS map:   `import type { Context } from "android-framework";`
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Context } from "android-framework";
// ```
import android.content.Context

// What:     `import android.net.Uri` brings in Android's parsed `Uri` type.
// Why:      `measureTrackPeak` takes a track `Uri`.
// TS map:   `import type { Uri } from "android-framework";` — mentally a `URL`.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Uri } from "android-framework";
// ```
import android.net.Uri

// What:     `import android.os.Process` brings in Android's `Process` class, whose
//           `setThreadPriority` / `THREAD_PRIORITY_LOWEST` control the calling thread's
//           scheduling "niceness".
// Why:      The sweep thread sets itself to the lowest priority so it yields to playback.
// TS map:   No equivalent. JS has no thread-priority control; mentally "run this worker at
//           the lowest scheduler priority".
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent — JS has no per-thread scheduling priority.
// ```
import android.os.Process

// What:     `import java.util.concurrent.Executors` brings in the JDK `Executors` factory,
//           whose `newSingleThreadExecutor(threadFactory)` builds an executor backed by ONE
//           worker thread, created via the supplied thread factory.
// Why:      The sweep needs a single dedicated low-priority worker thread; this builds it.
// TS map:   No direct equivalent. Closest is a single Web Worker you post tasks to; JS has no
//           built-in thread-pool executor.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent — mentally: a single dedicated Web Worker that runs queued tasks.
// ```
import java.util.concurrent.Executors

// What:     `import kotlinx.coroutines.CoroutineDispatcher` brings in `CoroutineDispatcher`,
//           the type naming which thread(s) a coroutine runs on.
// Why:      `sweepDecodeDispatcher`'s declared type is `CoroutineDispatcher`.
// TS map:   No equivalent; mentally "which worker to run on".
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent — JS is single-threaded.
// ```
import kotlinx.coroutines.CoroutineDispatcher

// What:     `import kotlinx.coroutines.asCoroutineDispatcher` brings in the EXTENSION
//           `asCoroutineDispatcher()` on a JDK `Executor`/`ExecutorService`. It ADAPTS a
//           plain executor into a coroutine `CoroutineDispatcher` so coroutines can run on it.
// Why:      We build a single-thread executor, then `.asCoroutineDispatcher()` it so
//           `withContext(...)` can target that thread.
// TS map:   No equivalent. Mentally "wrap this worker so the async runtime can schedule onto it".
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent — adapt a raw worker into something the async scheduler accepts.
// ```
import kotlinx.coroutines.asCoroutineDispatcher

// =============================================================================
// File summary (folds in the old KDoc's domain content)
// =============================================================================
//
// This file is the Media3 flavor's offline true-peak MEASURER for the background sweep.
// The same `measureTrackPeak(context, uri)` signature is provided by EACH flavor source set
// (exactly like `createAudioEngine`), so the engine-agnostic `measureAndCache` in `main`
// resolves the right decoder AT COMPILE TIME without a runtime switch. The Media3 flavor
// decodes through the platform `Media3TruePeakDecoder`; the Rust flavors feed their native
// decoder.
//
// It owns `sweepDecodeDispatcher`: ONE low-priority thread the sweep decodes on, so its
// CPU-heavy true-peak pass yields to playback and the UI under contention. This is the
// Android analog of the desktop's idle-priority worker: `THREAD_PRIORITY_LOWEST` is nice 19,
// the lowest the platform offers, so the decode runs at full speed when nothing competes
// (the overnight charging window the sweep targets) and almost fully yields whenever a
// foreground thread wants the CPU. A single thread suffices because the sweep measures one
// track at a time, and it is a daemon so it never holds the process open.
//
// This seam is the sweep's ONLY caller, so it always decodes on the low-priority
// `sweepDecodeDispatcher`. The foreground measure-on-miss keeps decoding on the shared
// `Dispatchers.IO` (the decoder's default) by calling `Media3TruePeakDecoder.measure`
// directly, so a mid-song gain correction is never slowed by this lower priority.

// What:     `private val sweepDecodeDispatcher: CoroutineDispatcher = Executors.newSingleThreadExecutor { ... }.asCoroutineDispatcher()`
//           declares a FILE-PRIVATE, top-level (not inside any class), read-only property of
//           type `CoroutineDispatcher`. Its value is built by:
//           - `Executors.newSingleThreadExecutor { runnable -> ... }` building a one-thread
//             executor whose worker is created by the supplied thread factory (the lambda);
//           - `.asCoroutineDispatcher()` adapting that executor into a coroutine dispatcher.
//           The pieces are commented line by line below.
// Why:      Provide the single low-priority worker thread the sweep decodes on.
// TS map:   No clean equivalent (JS has no threads). Mentally: build one dedicated low-priority
//           worker and expose it as something the async runtime can schedule onto.
//
// In TS you'd write (pseudocode):
// ```ts
// // const sweepDecodeDispatcher = asDispatcher(makeSingleLowPriorityWorker("peak-sweep-decode"));
// ```
private val sweepDecodeDispatcher: CoroutineDispatcher =
    // What:     `Executors.newSingleThreadExecutor { runnable -> ... }` calls the factory with a
    //           THREAD FACTORY passed as a TRAILING LAMBDA. The lambda's single parameter
    //           `runnable` is the work the executor wants run; the lambda must build and return a
    //           `Thread` that will run it. (This is SAM CONVERSION: a `ThreadFactory` is a
    //           single-method interface, so Kotlin lets you pass a lambda where one is expected.)
    // Why:      We need the executor's one thread to be created with low priority and as a daemon,
    //           so we supply a custom factory rather than the default.
    // TS map:   `Executors.newSingleThreadExecutor((runnable) => { ... return thread; })` — the
    //           lambda is the thread factory; `runnable` is the task to wrap.
    // Gotcha:   The lambda is a `ThreadFactory` (SAM-converted), not the work itself; it CONSTRUCTS
    //           a thread around `runnable` and returns it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // makeSingleThreadExecutor((runnable) => { /* build & return a low-priority daemon thread */ });
    // ```
    Executors.newSingleThreadExecutor { runnable ->
        // What:     `Thread( { ... }, "peak-sweep-decode" ).apply { isDaemon = true }` constructs a
        //           `Thread`. Its FIRST argument is a `Runnable` passed as a lambda `{ ... }` (SAM
        //           conversion again); its SECOND argument is the thread NAME `"peak-sweep-decode"`.
        //           `.apply { isDaemon = true }` then configures the thread (sets it as a daemon)
        //           and returns it.
        // Why:      Build the worker thread: it first lowers its own priority, then runs the
        //           executor's `runnable`; naming it aids logcat/debugging; daemon means it does not
        //           keep the process alive.
        // TS map:   `const t = new Thread(() => { ... }, "peak-sweep-decode"); t.isDaemon = true; return t;`
        // Gotcha:   The first `{ ... }` arg is the thread's BODY (a `Runnable` SAM lambda); the
        //           `"peak-sweep-decode"` is just its name. `.apply { }` returns the thread itself.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const t = new Thread(
        //   () => { /* set priority; runnable.run(); */ },
        //   "peak-sweep-decode",
        // );
        // t.isDaemon = true;
        // return t;
        // ```
        Thread(
            // What:     `{ ... }` here is the thread's RUNNABLE body (a SAM lambda passed as the
            //           `Thread` constructor's first argument). It runs ON the new thread when started.
            // Why:      Define what the worker thread does: drop its priority, then run the task.
            // TS map:   `() => { Process.setThreadPriority(...); runnable.run(); }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // () => { /* setThreadPriority(LOWEST); runnable.run(); */ }
            // ```
            {
                // What:     `Process.setThreadPriority(Process.THREAD_PRIORITY_LOWEST)` lowers THIS
                //           thread's scheduling priority to the platform minimum (nice 19).
                // Why:      So the CPU-heavy decode yields to playback and the UI under contention.
                // TS map:   No equivalent — JS cannot set a thread's scheduler priority.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // // No equivalent — JS has no per-thread priority.
                // ```
                Process.setThreadPriority(Process.THREAD_PRIORITY_LOWEST)
                // What:     `runnable.run()` runs the executor's task (the `runnable` the factory was
                //           given) ON this thread by calling its `run()` method.
                // Why:      After lowering priority, actually perform the queued work.
                // TS map:   `runnable.run();` — invoke the task on this worker.
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

// What:     `suspend fun measureTrackPeak(context: Context, uri: Uri): Float = Media3TruePeakDecoder.measure(context, uri, sweepDecodeDispatcher)`
//           declares a top-level SUSPEND function (can await without blocking a thread) with an
//           EXPRESSION BODY: it calls the decoder's suspend `measure`, passing the sweep's
//           low-priority dispatcher, and returns that result.
// Why:      The sweep's entry point for measuring a track's true peak; it always routes the
//           decode onto `sweepDecodeDispatcher` (the foreground player instead calls
//           `Media3TruePeakDecoder.measure` directly with the default dispatcher, so it is
//           unaffected). Returns the measured true peak (linear, typically near `1.0` for
//           full-scale material; `0.0` for a zero-channel stream).
// TS map:   `async function measureTrackPeak(context: Context, uri: Uri): Promise<number> { return await Media3TruePeakDecoder.measure(context, uri, sweepDecodeDispatcher); }`
//           — `suspend` is `async`; the expression body is a single `return await ...`.
//
// In TS you'd write (pseudocode):
// ```ts
// async function measureTrackPeak(context: Context, uri: Uri): Promise<number> {
//   return await Media3TruePeakDecoder.measure(context, uri, sweepDecodeDispatcher);
// }
// ```
suspend fun measureTrackPeak(context: Context, uri: Uri): Float =
    Media3TruePeakDecoder.measure(context, uri, sweepDecodeDispatcher)
