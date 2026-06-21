// File summary (folds in the original KDoc's domain content):
//
// This file defines ONE thing: PeakSweepScheduler, a singleton that hands Android's
// WorkManager a recurring background job. The job, PeakSweepWorker (a sibling file), walks
// the music library and pre-computes the "true peak" loudness of every track so that during
// playback the app almost never has to decode a track just to learn how loud it is.
//
// Why scheduled this way, in plain terms:
//   - Charging-only: a full first pass is hours of audio decoding, so it must never run on
//     battery. Charging is the single constraint we attach.
//   - We deliberately do NOT add a "device must be idle" constraint: on some phones "idle"
//     and "charging" are never both true at once, and idle would also block the sweep while
//     you are simply using the phone. Instead the decode itself runs at the lowest thread
//     priority (over in measureTrackPeak), so it quietly yields to playback and the UI. This
//     is the Android analog of the desktop player's idle-priority worker.
//   - Periodic (repeating), not one-time-with-retry: one worker run is capped by the platform
//     at about ten minutes, so a long first sweep is naturally broken across many short runs.
//     A one-time job would have to ask WorkManager to "retry" on each forced stop, and
//     WorkManager's retry backoff (capped at five hours, reset only on a final result) would
//     then throttle the sweep to one attempt every five hours no matter how long it stays
//     plugged in. A periodic request sidesteps that, and re-running each period also picks up
//     tracks added since the last sweep.
//
// TS framing for the whole file: think of this as a tiny module that exports a single object
// literal with two private constants and one method, like
//   `export const PeakSweepScheduler = { enqueue(context) { ... } };`
// There is no WorkManager in the browser/Node world; the nearest mental model is "register a
// repeating background task with the OS scheduler, but only let it run while the device is
// charging."

// What:     `package dev.monochromatic.musicplayer` declares which namespace every
//           top-level name in this file belongs to. In Kotlin (like Java) the package name
//           usually mirrors the folder path under `src/main/kotlin`. There is no
//           `export`/`import` of THIS file's own symbols here; the package line just stamps
//           the address other files use to refer to `PeakSweepScheduler`.
// Why:      So sibling files (e.g. `PeakSweepWorker`, `LibrarySource`) in the same package
//           can see `PeakSweepScheduler` without importing it, and so other packages can
//           reach it by its fully-qualified name.
//
// In TS you'd write (pseudocode):
// ```ts
// // No 1:1 equivalent — the directory + exports play the role of a Kotlin package.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` pulls in the `Context` type. `Context` is
//           Android's "handle to the running app/system" object; you ask it for system
//           services, resources, files, etc. The dotted path `android.content.Context` is
//           the fully-qualified name (package path + type name).
// Why:      `enqueue` below takes a `Context` and passes it to `WorkManager.getInstance`,
//           so we must name the type to use it.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Context } from "android/content";
// ```
import android.content.Context

// What:     `import androidx.work.Constraints` brings in the `Constraints` type from the
//           AndroidX WorkManager library. `Constraints` describes the conditions under which
//           a background job is allowed to run (charging, network, idle, etc.).
// Why:      We build a `Constraints` value below that says "only run while charging" and
//           attach it to the work request.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Constraints } from "androidx/work";
// ```
import androidx.work.Constraints

// What:     `import androidx.work.ExistingPeriodicWorkPolicy` brings in an enum-like type
//           whose values (e.g. `KEEP`, `REPLACE`, `UPDATE`) tell WorkManager what to do when
//           you enqueue periodic work under a name that already has work scheduled.
// Why:      We pass `ExistingPeriodicWorkPolicy.KEEP` so a second `enqueue` call from another
//           entry point becomes a no-op instead of stacking a duplicate sweep.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ExistingPeriodicWorkPolicy } from "androidx/work";
// ```
import androidx.work.ExistingPeriodicWorkPolicy

// What:     `import androidx.work.PeriodicWorkRequestBuilder` brings in a builder helper used
//           to construct a description of a REPEATING background job. Note this is the
//           generic builder function; below it is called with a type argument
//           `PeriodicWorkRequestBuilder<PeakSweepWorker>(...)`.
// Why:      We use it to build the periodic request object that names which Worker class to
//           run and how often.
//
// In TS you'd write (pseudocode):
// ```ts
// import { PeriodicWorkRequestBuilder } from "androidx/work";
// ```
import androidx.work.PeriodicWorkRequestBuilder

// What:     `import androidx.work.WorkManager` brings in the `WorkManager` type — the central
//           Android service you hand background jobs to. You never `new` it; you fetch the
//           singleton via `WorkManager.getInstance(context)`.
// Why:      We call `WorkManager.getInstance(context).enqueueUniquePeriodicWork(...)` to
//           actually register the sweep.
//
// In TS you'd write (pseudocode):
// ```ts
// import { WorkManager } from "androidx/work";
// ```
import androidx.work.WorkManager

// What:     `import java.util.concurrent.TimeUnit` brings in `TimeUnit`, a Java enum whose
//           members are time units: `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, etc. It exists so
//           a number like `15` can be tagged with the unit it is measured in.
// Why:      The periodic request below says `(SWEEP_INTERVAL_MINUTES, TimeUnit.MINUTES)`, so
//           WorkManager knows the `15` means fifteen minutes, not seconds or hours.
//
// In TS you'd write (pseudocode):
// ```ts
// import { TimeUnit } from "java/util/concurrent";
// // (in real TS you'd usually skip this and pass milliseconds directly)
// ```
import java.util.concurrent.TimeUnit

// What:     `object PeakSweepScheduler { ... }` declares a SINGLETON. In Kotlin, `object`
//           (not `class`) means: "there is exactly one instance of this, created lazily the
//           first time it's touched, and its name IS that instance." You never write
//           `PeakSweepScheduler()` — you call members directly on the name, e.g.
//           `PeakSweepScheduler.enqueue(context)`. Siblings the reader might expect: a
//           `class` (which you'd instantiate with `Class()`), or a `companion object` (a
//           singleton nested inside a class). This is the standalone, top-level singleton
//           form.
// Why:      The scheduler holds no per-call state and is called from several entry points;
//           a single shared instance with namespaced helpers is exactly what we want, and it
//           also gives the two private constants below a home.
// Gotcha:   Despite the keyword `object`, this is NOT a JS object literal — its members are
//           resolved at compile time and the constants below are truly constant. Do not read
//           `object` as TS's `object` type.
//
// In TS you'd write (pseudocode):
// ```ts
// export const PeakSweepScheduler = {
//   // ...private consts conceptually live here as closed-over constants...
//   enqueue(context: Context): void { /* ... */ },
// };
// ```
/**
 * Defines peak sweep scheduler object for this music-player component; the TypeScript-oriented notes above
 * explain its shared role.
 */
object PeakSweepScheduler {
    // What:     `private const val UNIQUE_WORK_NAME: String = "peak-sweep"`. Breaking it
    //           down: `private` hides it from other files; `const` means a true
    //           compile-time constant (inlined, no runtime field); `val` means immutable
    //           (cannot be reassigned, like TS `const`); `: String` is an explicit type
    //           annotation. `String` is Kotlin's ordinary text type. Sibling the reader
    //           might expect: `CharSequence` (a read-only super-type of `String`); we want
    //           the concrete `String` here.
    // Why:      WorkManager keys "unique periodic work" by a name string. Using one fixed
    //           name means repeated `enqueue` calls all refer to the SAME scheduled job, so
    //           the `KEEP` policy can collapse them into a single sweep.
    // Gotcha:   Kotlin `const val` must be a compile-time constant (a literal); it is
    //           stronger than `val`, which only forbids reassignment. There is no TS
    //           distinction — both map to `const`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const UNIQUE_WORK_NAME: string = "peak-sweep";
    // ```
    /**
     * Defines unique work name value for this music-player component; the TypeScript-oriented notes above
     * explain its source and use.
     */
    private const val UNIQUE_WORK_NAME: String = "peak-sweep"

    // What:     `private const val SWEEP_INTERVAL_MINUTES: Long = 15L`. Same modifiers as
    //           above (`private const val`), but the type is `Long`. `Long` is a 64-bit
    //           signed integer. The literal `15L` — note the trailing `L` — is how Kotlin
    //           writes a `Long` literal (a bare `15` would be the 32-bit `Int`). Siblings the
    //           reader might expect: `Int` (32-bit signed), `Short`, `Byte`, or the unsigned
    //           `UInt`/`ULong`. We pick `Long`, not `Int`.
    // Why:      `Int` (not `Long`) because the WorkManager `PeriodicWorkRequestBuilder`
    //           constructor used below takes the repeat interval as a `Long`; declaring the
    //           constant as `Long` (and writing `15L`) means it slots in with no conversion.
    //           Time/interval APIs on the platform conventionally use `Long` to avoid
    //           overflow on large millisecond counts. The interval is the MINIMUM gap between
    //           runs, not a guarantee; the charging constraint decides when a run actually
    //           fires, so "15" really means "as often as charging allows, but no tighter
    //           than the platform's 15-minute floor".
    // Gotcha:   In Kotlin `15` and `15L` are DIFFERENT types (`Int` vs `Long`) and passing an
    //           `Int` where a `Long` is required is a compile error — there is no silent
    //           widening like JS number coercion. The `L` suffix is mandatory here.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const SWEEP_INTERVAL_MINUTES = 15; // TS `number` — no Int/Long distinction
    // ```
    /**
     * Defines sweep interval minutes value for this music-player component; the TypeScript-oriented notes above
     * explain its source and use.
     */
    private const val SWEEP_INTERVAL_MINUTES: Long = 15L

    // What:     `fun enqueue(context: Context) { ... }` declares a function named `enqueue`.
    //           `fun` is Kotlin's keyword for a function/method. It has one parameter,
    //           `context`, whose type is `Context` (the Android app/system handle imported
    //           above). There is no return-type annotation, which in Kotlin means it returns
    //           `Unit` — Kotlin's equivalent of `void`. Because this is inside `object
    //           PeakSweepScheduler`, it's effectively a "static" method on the singleton:
    //           callers write `PeakSweepScheduler.enqueue(context)`.
    //           Parameter `context: Context`: the caller hands in the live app context so we
    //           can resolve the `WorkManager` instance from it.
    // Why:      This is the one public entry point. It (idempotently) schedules the recurring
    //           peak sweep. It's safe to call from every place a library becomes available,
    //           because the `KEEP` policy makes the second-and-later calls no-ops.
    // Gotcha:   No explicit return type means `Unit` (void-like), NOT "infer some value". If
    //           you wanted it to return something you'd have to write `: SomeType`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function enqueue(context: Context): void {
    //   // ...body...
    // }
    // ```
    /**
     * Defines enqueue behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    fun enqueue(context: Context) {
        // What:     `val constraints: Constraints = Constraints.Builder().setRequiresCharging(true).build()`.
        //           `val` is an immutable local (like TS `const`). `: Constraints` is an
        //           explicit type annotation. The right side uses the BUILDER pattern:
        //           `Constraints.Builder()` creates a mutable builder, `.setRequiresCharging(true)`
        //           records "only run while charging" and returns the same builder (so the
        //           call can be chained), and `.build()` freezes the accumulated settings into
        //           an immutable `Constraints` value.
        // Why:      Charging is the single condition we attach to the job: a full first sweep
        //           is hours of decode, so it must not drain the battery. This object encodes
        //           exactly that one rule, ready to hand to the work request.
        // Gotcha:   `Constraints.Builder()` is a constructor call WITHOUT a `new` keyword;
        //           Kotlin omits `new`. Read `Constraints.Builder()` as `new
        //           Constraints.Builder()` in TS terms.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const constraints: Constraints = new Constraints.Builder()
        //   .setRequiresCharging(true)
        //   .build();
        // ```
        /**
         * Defines constraints value for this music-player component; the TypeScript-oriented notes above explain
         * its source and use.
         */
        val constraints: Constraints = Constraints.Builder()
            .setRequiresCharging(true)
            .build()
        // What:     `val request = PeriodicWorkRequestBuilder<PeakSweepWorker>(SWEEP_INTERVAL_MINUTES,
        //           TimeUnit.MINUTES).setConstraints(constraints).build()`.
        //           `val request` is an immutable local; here the type is INFERRED (no `:
        //           Type`), Kotlin reads it off the builder's `.build()` return. The
        //           `<PeakSweepWorker>` is a GENERIC TYPE ARGUMENT in angle brackets: it tells
        //           the builder "the job to run is the `PeakSweepWorker` class", the same way
        //           you'd write `Array<string>` in TS. The two constructor arguments
        //           `(SWEEP_INTERVAL_MINUTES, TimeUnit.MINUTES)` mean "repeat every 15
        //           minutes". `.setConstraints(constraints)` attaches the charging-only rule
        //           built above; `.build()` finalizes an immutable periodic work request.
        // Why:      This is the actual description of the recurring job: which Worker, how
        //           often, under what constraints. We need it to pass to WorkManager.
        // Gotcha:   `<PeakSweepWorker>` is a TYPE passed at compile time (a `reified` generic),
        //           not a runtime value/argument. Do not confuse it with a normal function
        //           argument; it sits in angle brackets exactly like a TS generic parameter.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const request = PeriodicWorkRequestBuilder<PeakSweepWorker>(
        //   SWEEP_INTERVAL_MINUTES,
        //   TimeUnit.MINUTES,
        // )
        //   .setConstraints(constraints)
        //   .build();
        // ```
        /**
         * Defines request value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val request = PeriodicWorkRequestBuilder<PeakSweepWorker>(SWEEP_INTERVAL_MINUTES, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()
        // What:     `WorkManager.getInstance(context).enqueueUniquePeriodicWork(UNIQUE_WORK_NAME,
        //           ExistingPeriodicWorkPolicy.KEEP, request)`.
        //           `WorkManager.getInstance(context)` fetches the process-wide WorkManager
        //           singleton (it is NOT constructed; you always go through `getInstance`).
        //           `.enqueueUniquePeriodicWork(...)` then registers the job with three
        //           arguments: the unique name string (so repeated calls address the same
        //           scheduled job), the policy `ExistingPeriodicWorkPolicy.KEEP` (an
        //           enum-member access — `KEEP` means "if work already exists under this name,
        //           leave it and ignore this enqueue"), and the `request` describing the work.
        //           This statement is the function's last line and produces no value we keep;
        //           it's a side-effecting call, not a returned tail expression.
        // Why:      This is the line that actually does the scheduling. `KEEP` is what makes
        //           `enqueue` idempotent: the first caller wins and every later caller from a
        //           different entry point becomes a harmless no-op, so we never stack duplicate
        //           sweeps.
        // Gotcha:   Picking `REPLACE` or `UPDATE` instead of `KEEP` here would tear down and
        //           reschedule the sweep on every call — the opposite of the idempotency we
        //           rely on. The dedup behavior lives entirely in this one argument.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        //   UNIQUE_WORK_NAME,
        //   ExistingPeriodicWorkPolicy.KEEP,
        //   request,
        // );
        // ```
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(UNIQUE_WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }
}
