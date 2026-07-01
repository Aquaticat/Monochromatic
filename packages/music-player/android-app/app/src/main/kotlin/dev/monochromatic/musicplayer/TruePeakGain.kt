// What:     `package dev.monochromatic.musicplayer` places this file in the app's root package,
//           beside `RustEngine`, `NativeBridge`, and the peak-sweep classes that use it.
// Why:      Same package as its callers, so they reach `TruePeakGain` with no import.
//
// In TS you'd write (pseudocode):
// ```ts
// // module dev/monochromatic/musicplayer
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` brings in the Android context, the handle to
//           app-global services and the app-private files directory.
// Why:      The one place the decision database path is derived (`filesDir/decisions.db`).
//
// In TS you'd write (pseudocode):
// ```ts
// // Context ~ the app runtime handle
// ```
import android.content.Context

// What:     `import java.io.File` brings in the JDK `File` type.
// Why:      Build the absolute `decisions.db` path under `filesDir`.
//
// In TS you'd write (pseudocode):
// ```ts
// // File ~ a filesystem path
// ```
import java.io.File

// What:     `object TruePeakGain { ... }` declares a process-wide SINGLETON (Kotlin `object`:
//           one lazily-constructed instance) owning the ONE native true-peak decision service
//           handle. Both the foreground gain resolution (`RustEngine.resolveNormalizationGain`)
//           and the background warming sweep reach the shared cache through this single handle.
// Why:      The shared `DecisionCache` is backed by a single Turso connection on the service's
//           actor thread; opening a second connection to the same `decisions.db` from a separate
//           sweep handle would risk write contention. One process-wide handle keeps exactly one
//           connection, matching the desktop's single-actor design.
// Gotcha:   The handle is created lazily on first use and never released: it lives for the
//           process lifetime (the OS reclaims it on process death, and the native actor thread
//           is detached). There is no owner to release it, unlike the per-engine handle it
//           replaced.
//
// In TS you'd write (pseudocode):
// ```ts
// const TruePeakGain = { handle(context): bigint { /* lazily create once */ } };
// ```
/**
 * Owns the one process-wide native true-peak decision service handle, shared by foreground gain
 * resolution and background warming.
 */
object TruePeakGain {
    // What:     `private const val DB_NAME = "decisions.db"` names the decision database file.
    // Why:      One place decides the filename; it replaces the old Kotlin `peaks.json`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const DB_NAME = "decisions.db";
    // ```
    /** Filename of the shared decision database under the app-private files directory. */
    private const val DB_NAME = "decisions.db"

    // What:     `@Volatile private var handle: Long = 0L` holds the opaque native service handle.
    //           `@Volatile` publishes writes across threads (foreground and sweep threads both
    //           read it); `0L` means "not yet created" (or creation failed).
    // Why:      Cache the created handle so it is opened once, not per call.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let handle: bigint = 0n;
    // ```
    /** The cached native service handle, `0` until created. */
    @Volatile
    private var handle: Long = 0L

    // What:     `@Synchronized fun handle(context: Context): Long` returns the shared service
    //           handle, creating it on first use. `@Synchronized` serializes creation so two
    //           threads never open two services.
    // Why:      The single entry point both callers use; a `0` return means creation failed, and
    //           `nativeResolveGain`/`nativeWarmTrack` then degrade to the safe ceiling gain.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // handle(context) {
    //   if (this.handle === 0n) this.handle = nativeTruePeakServiceCreate(dbPath(context));
    //   return this.handle;
    // }
    // ```
    /**
     * Returns the shared native true-peak service handle, opening it on first use.
     */
    @Synchronized
    fun handle(context: Context): Long {
        // What:     `if (handle == 0L) { ... }`. Create only when not yet open.
        // Why:      Reuse the one handle across every call.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.handle === 0n) { ... }
        // ```
        if (handle == 0L) {
            // What:     `val dbPath = File(context.applicationContext.filesDir, DB_NAME).absolutePath`.
            //           The app-private database path. `applicationContext` avoids leaking a
            //           short-lived activity.
            // Why:      The service opens `DecisionCache` at this path.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const dbPath = join(context.applicationContext.filesDir, DB_NAME);
            // ```
            /** Absolute path of the app-private decision database. */
            val dbPath = File(context.applicationContext.filesDir, DB_NAME).absolutePath
            // What:     `handle = NativeBridge.nativeTruePeakServiceCreate(dbPath)`. Open the
            //           service and cache its handle.
            // Why:      One-time creation; later calls reuse it.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.handle = NativeBridge.nativeTruePeakServiceCreate(dbPath);
            // ```
            handle = NativeBridge.nativeTruePeakServiceCreate(dbPath)
        }
        // What:     `return handle`. The shared handle (possibly `0` if creation failed).
        // Why:      Callers pass it to the native resolve/warm functions.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.handle;
        // ```
        return handle
    }
}
