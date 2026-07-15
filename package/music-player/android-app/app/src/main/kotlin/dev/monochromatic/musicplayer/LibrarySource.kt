// File summary (folds in the old KDoc's domain content):
//
// This file decides WHERE the music app reads its library of tracks from, and
// hands back the list of tracks. It is the single shared "seam" (one chokepoint
// both readers go through) used by two callers:
//   - the foreground player (`PlaybackService`), which plays audio for the user, and
//   - the background sweep (`PeakSweepWorker`), which precomputes loudness peaks
//     while the app is idle.
//
// Why one shared seam matters (this is NOT cosmetic): the loudness-peak cache is
// keyed by `TrackFingerprint`, which is computed from a track's URI plus its byte
// size plus its last-modified time. The same physical audio file can be reached
// through two DIFFERENT URI styles on Android:
//   - a MediaStore URI (the device-wide media database), and
//   - a SAF document URI (a folder the user explicitly granted via the Storage
//     Access Framework, "SAF").
// Those two URI styles fingerprint DIFFERENTLY for the same file (MediaStore has no
// last-modified column, so it falls back to zero). If the background sweep listed
// the library from one source while playback listed it from the other, every cache
// entry the sweep wrote would fail to match on playback: the cache would be
// "write-only" (filled but never read back). Because both callers go through the
// single `load` function below, their URIs (and therefore fingerprints) line up.
//
// Which source wins, in order:
//   1. the user's chosen folder, when `LibraryRoot.heldRoot` confirms a still-live
//      permission grant (honored even when the folder is empty, so a deliberately
//      small folder is respected and not silently widened to the whole device);
//   2. otherwise the device-wide MediaStore collection, when the audio permission
//      is held;
//   3. otherwise nothing (an empty list).
//
// What:     `package dev.monochromatic.musicplayer` declares which namespace
//           (logical grouping / folder-like path of names) every type in this
//           file belongs to. Other Kotlin files in the same package can refer to
//           these names without importing them.
// Why:      We need every file in this app to share one namespace so `Track`,
//           `LibraryRoot`, `PlaybackService`, etc. can see each other without
//           fully-qualified names.
//
// In TS you'd write (pseudocode):
// ```ts
// // No 1:1 equivalent — in TS the file path + `import`/`export` define grouping.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` pulls the name `Context` into this
//           file from the Android framework. `Context` is Android's "handle to the
//           running app environment" object: you ask it for system services, the
//           content resolver, permissions state, etc.
// Why:      The functions below take a `Context` so they can resolve the held
//           folder, check the audio permission, and reach the content resolver.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Context } from "android/content";
// ```
import android.content.Context

// What:     `import android.net.Uri` brings in `Uri`, Android's parsed
//           "Uniform Resource Identifier" type (a string like
//           `content://...` that points at a resource). It is NOT a plain string;
//           it is a structured object with scheme/authority/path parts.
// Why:      The library source is identified by a `Uri` (the granted folder's tree
//           URI, or a MediaStore URI), so we need this type to talk about it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Uri } from "android/net";
// ```
import android.net.Uri

// What:     `import android.util.Log` brings in `Log`, Android's logging facility
//           that writes lines to "logcat" (the device log stream developers read).
// Why:      The folder-scan fallback below logs a warning when an entire scan fails
//           so the failure is visible in logcat instead of silently swallowed.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Log } from "android/util";
// ```
import android.util.Log

// What:     `import kotlinx.coroutines.CancellationException` brings in the special
//           exception type a Kotlin coroutine (a suspendable, async unit of work)
//           throws when it is cancelled. It is an `Exception` subtype, but it is
//           "special": catching it and swallowing it would break cancellation.
// Why:      The scan runs inside a coroutine; we must catch real failures but
//           RE-THROW `CancellationException` so structured cancellation (parent
//           cancels child) keeps working. See the catch clauses below.
// Gotcha:   In TS a thrown async error is just an `Error`; here cancellation is a
//           distinct exception class you are REQUIRED to re-throw, not absorb.
//
// In TS you'd write (pseudocode):
// ```ts
// import { CancellationException } from "kotlinx/coroutines";
// ```
import kotlinx.coroutines.CancellationException

// What:     `object LibrarySource { ... }` declares a SINGLETON. The `object`
//           keyword (not `class`) means Kotlin creates exactly one instance,
//           lazily, the first time it is used, and `LibrarySource` is both the
//           type name AND that single instance. There is no `new LibrarySource()`.
//           Siblings the reader might expect: `class` (you instantiate many),
//           `companion object` (a singleton nested INSIDE a class), `interface`
//           (no instances at all).
// Why:      The library source is global, stateless app behavior shared by every
//           caller; a singleton namespace of functions is the right shape, and it
//           keeps `LibrarySource.load(...)` callable from anywhere with no setup.
// Gotcha:   Unlike a TS `class`, you never construct this; `LibrarySource` already
//           IS the instance. Treat it as a namespace, not a constructable type.
//
// In TS you'd write (pseudocode):
// ```ts
// export const LibrarySource = {
//   // load, scanRoot defined below
// };
// ```
/**
 * Defines library source object for this music-player component; the TypeScript-oriented notes above explain its
 * shared role.
 */
object LibrarySource {
    // What:     `private const val SOURCE_TAG: String = "LibrarySource"` declares a
    //           compile-time constant string.
    //           - `private` limits visibility to this `object`.
    //           - `const` means the value is known at compile time and inlined at
    //             every use site (only allowed for primitives and `String`).
    //           - `val` means read-only (cannot be reassigned), the opposite of
    //             `var`.
    //           - `: String` is the explicit type. Kotlin's `String` is an
    //             immutable UTF-16 text value; there is no separate borrowed-vs-
    //             owned distinction (unlike Rust's `String` vs `&str`).
    // Why:      A single named tag is passed to `Log.w(...)` so every log line from
    //           this file is filterable in logcat under one label.
    // Gotcha:   `const` here is a Kotlin compile-time constant, NOT TS's
    //           block-scoped `const`; `val` alone is the runtime read-only binding.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const SOURCE_TAG: string = "LibrarySource";
    // ```
    /**
     * Defines source tag value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private const val SOURCE_TAG: String = "LibrarySource"

    // What:     `suspend fun load(context: Context): List<Track>` declares a
    //           function named `load`.
    //           - `suspend` marks it as a coroutine function: it may PAUSE
    //             (suspend) at await-like points and resume later without blocking
    //             a thread. A `suspend` function can only be called from another
    //             `suspend` function or a coroutine builder.
    //           - `context: Context` is its one parameter (the app-environment
    //             handle).
    //           - `: List<Track>` is the return type: a read-only list of `Track`.
    //             `List<T>` is the immutable-view list interface; siblings the
    //             reader might expect are `MutableList<T>` (you can add/remove) and
    //             `Array<T>` (fixed-size). `Track` is this app's track record type.
    // Why:      This is the single public entry point both callers use to fetch the
    //           current library, so their URIs and fingerprints stay in sync.
    // Gotcha:   `suspend` is NOT `async` at the type level: the return type is
    //           `List<Track>`, not `Promise<List<Track>>`. The "promise" is hidden
    //           by the compiler. You `await` implicitly just by calling it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // async function load(
    //   context: Context,
    //   onBatch: ((batch: readonly Track[]) => Promise<void>) | null = null,
    // ): Promise<readonly Track[]> {
    //   // ...body...
    // }
    // ```
    /**
     * Defines load behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    suspend fun load(
        // What:     `context: Context` is the app-environment handle.
        // Why:      Used to resolve the held folder, check the audio permission, and reach the
        //           content resolver.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // context: Context,
        // ```
        context: Context,
        // What:     `onBatch: (suspend (List<Track>) -> Unit)? = null` is the OPTIONAL streaming
        //           callback, FORWARDED unchanged to whichever source runs. Its type reads as "a
        //           SUSPENDING function taking a read-only `List<Track>`, OR null"; `= null` is the
        //           default.
        // Why:      The cold-start loader passes a callback so the active source can stream its
        //           partial library; the foreground rescan passes nothing so it stays atomic.
        //           Forwarding here keeps the single shared seam (so SAF and MediaStore stream the
        //           same way) without each caller knowing which source is live.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // onBatch: ((batch: readonly Track[]) => Promise<void>) | null = null,
        // ```
        onBatch: (suspend (List<Track>) -> Unit)? = null,
    ): List<Track> {
        // What:     `val root: Uri? = LibraryRoot.heldRoot(context)`.
        //           - `val` is a read-only binding (cannot be reassigned).
        //           - `: Uri?` is the type, and the trailing `?` makes it NULLABLE:
        //             the value is either a `Uri` or `null`. Without the `?`,
        //             Kotlin forbids `null` entirely. This is the type-level
        //             encoding of "maybe there is a chosen folder, maybe not".
        //           - `LibraryRoot.heldRoot(context)` calls the singleton
        //             `LibraryRoot`'s `heldRoot` method, which returns `Uri?`: the
        //             granted folder URI when a live grant exists, else `null`.
        // Why:      We look up the user's chosen folder first; its presence decides
        //           whether we scan that folder or fall through to MediaStore.
        // Gotcha:   The `?` on the TYPE means nullable. It is unrelated to Rust's
        //           `?` propagation operator and unrelated to Kotlin's `?.`/`?:`
        //           operators; here it is purely "this slot may hold null".
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const root: Uri | null = LibraryRoot.heldRoot(context);
        // ```
        /**
         * Defines root value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val root: Uri? = LibraryRoot.heldRoot(context)
        // What:     `if (root != null) { ... }` tests whether the chosen-folder URI
        //           exists. Inside this block Kotlin SMART-CASTS `root` from `Uri?`
        //           to non-null `Uri`, so it can be passed where a plain `Uri` is
        //           required without any unwrap call.
        // Why:      A held folder grant always wins over the device-wide collection,
        //           so when one exists we scan it and return immediately.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (root !== null) {
        //   return scanRoot(context, root);
        // }
        // ```
        return when {
            root != null -> {
            // What:     `return scanRoot(context, root, onBatch)` calls the sibling function
            //           `scanRoot` with the context, the now-non-null `root`, and the
            //           forwarded `onBatch`, and returns its `List<Track>` to the caller.
            //           `scanRoot` is itself `suspend`, so this call is an implicit await
            //           point.
            // Why:      Delegate folder enumeration (and its failure handling) to `scanRoot`,
            //           threading the streaming callback through so a SAF scan can emit
            //           partial batches.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return await scanRoot(context, root, onBatch);
            // ```
            scanRoot(context, root, onBatch)
            }
        // What:     `if (hasAudioPermission(context)) { ... }` calls the top-level
        //           function `hasAudioPermission` (defined in `Permissions.kt`,
        //           visible here because it shares this package), which returns a
        //           plain `Boolean`, and branches on it.
        // Why:      With no chosen folder, we may still read the device-wide
        //           MediaStore collection, but only if the user granted the audio
        //           read permission; this gate enforces that.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (hasAudioPermission(context)) {
        //   return MediaStoreSource.query(context.contentResolver);
        // }
        // ```
            hasAudioPermission(context) -> {
            // What:     `return MediaStoreSource.query(context.contentResolver)`.
            //           - `context.contentResolver` reads the `contentResolver`
            //             property off the `Context`: Android's gateway object for
            //             querying content providers (databases like MediaStore).
            //           - `MediaStoreSource.query(...)` calls the singleton
            //             `MediaStoreSource`'s `suspend` `query`, which returns
            //             `List<Track>` from the device-wide media database.
            // Why:      No folder was chosen but audio permission is held, so the
            //           whole-device collection is the active library; return it.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return await MediaStoreSource.query(context.contentResolver, onBatch);
            // ```
            MediaStoreSource.query(context.contentResolver, onBatch)
            }
        // What:     `return emptyList()` calls Kotlin's standard-library helper
        //           `emptyList()`, which returns a shared, immutable, zero-element
        //           `List<T>`. The element type `Track` is inferred from `load`'s
        //           declared return type `List<Track>`.
        // Why:      Neither a folder grant nor the audio permission is held, so
        //           there is no source yet; an empty library is the correct,
        //           non-crashing answer.
        // Gotcha:   `emptyList()` returns a SHARED immutable instance (cheap, no
        //           allocation), not a fresh array each call as `[]` would in TS.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return [];
        // ```
            else -> emptyList()
        }
    }

    // What:     `suspend fun scanRoot(context: Context, treeUri: Uri): List<Track>`
    //           declares a coroutine function named `scanRoot` with TWO parameters,
    //           `context: Context` and `treeUri: Uri` (the granted folder's tree
    //           URI), returning a read-only `List<Track>`. The body uses the
    //           `=` expression-body form (see the next block), not a `{ }` block.
    // Why:      Folder scanning needs its own failure handling: an unexpected
    //           whole-walk crash must degrade to an empty library rather than take
    //           down the cold-start service or the background worker. Isolating
    //           that in `scanRoot` keeps `load` simple.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // async function scanRoot(
    //   context: Context,
    //   treeUri: Uri,
    //   onBatch: ((batch: readonly Track[]) => Promise<void>) | null = null,
    // ): Promise<readonly Track[]> {
    //   // ...body...
    // }
    // ```
    /**
     * Defines scan root behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    suspend fun scanRoot(
        // What:     `context: Context` is the app-environment handle.
        // Why:      Used to reach the content resolver for the SAF walk.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // context: Context,
        // ```
        context: Context,
        // What:     `treeUri: Uri` is the granted folder's tree URI to scan.
        // Why:      `SafTreeSource.query` walks this tree and every descendant.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // treeUri: Uri,
        // ```
        treeUri: Uri,
        // What:     `onBatch: (suspend (List<Track>) -> Unit)? = null` is the OPTIONAL streaming
        //           callback, forwarded to `SafTreeSource.query`. `= null` is the default.
        // Why:      The cold-start loader streams a chosen folder's scan; the folder-pick reload
        //           passes nothing here, so it stays atomic.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // onBatch: ((batch: readonly Track[]) => Promise<void>) | null = null,
        // ```
        onBatch: (suspend (List<Track>) -> Unit)? = null,
    ): List<Track> =
        // What:     `try { ... } catch (...) { ... }` runs the folder scan and, if
        //           it throws, routes the error to a matching `catch` clause. Here
        //           the WHOLE `try`/`catch` is an EXPRESSION whose value becomes the
        //           function's result, because `scanRoot` uses the `= <expr>` body
        //           form (the `try` block's value is its last expression). This is
        //           the implicit-return tail of `scanRoot`.
        // Why:      We want a single value (the track list, or empty on failure) to
        //           fall out of the scan and be returned, with cancellation handled
        //           separately from real failures.
        // Gotcha:   Unlike TS, Kotlin's `try`/`catch` evaluates to a value. Read
        //           this as "the function returns whichever branch ran".
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // try/catch is a statement in TS, so each branch returns:
        // try {
        //   return await SafTreeSource.query(context.contentResolver, treeUri);
        // } catch (e) {
        //   if (e instanceof CancellationException) throw e;
        //   Log.w(SOURCE_TAG, `scan of folder ${treeUri} failed; treating as empty`, e);
        //   return [];
        // }
        // ```
        try {
            // What:     `SafTreeSource.query(context.contentResolver, treeUri, onBatch)`
            //           calls the singleton `SafTreeSource`'s `suspend` `query`, passing
            //           the content resolver, the granted tree URI, and the forwarded
            //           streaming callback; it returns `List<Track>` for every audio file
            //           under the folder. No trailing `return` and no `;`: as the last
            //           expression in the `try` block, its value becomes the `try`
            //           expression's value, which (via the `=` body) becomes `scanRoot`'s
            //           return.
            // Why:      Delegate the actual folder walk to `SafTreeSource`, which already
            //           skips individual unreadable directories and (when `onBatch` is set)
            //           emits partial batches; this layer only guards a failure of the
            //           ENTIRE walk.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return await SafTreeSource.query(context.contentResolver, treeUri, onBatch);
            // ```
            SafTreeSource.query(context.contentResolver, treeUri, onBatch)
        } catch (cancellation: CancellationException) {
            // What:     `throw cancellation` re-throws the caught
            //           `CancellationException` unchanged, propagating it to the
            //           coroutine machinery instead of treating it as a scan
            //           failure. `cancellation` is the bound name of the caught
            //           exception from the `catch (cancellation: CancellationException)`
            //           clause directly above.
            // Why:      Coroutine cancellation must NOT be swallowed; re-throwing it
            //           lets structured cancellation (a parent cancelling its
            //           children) work correctly. Catching it first, before the
            //           generic `Exception` clause below, is what separates "we were
            //           cancelled" from "the scan genuinely failed".
            // Gotcha:   Order matters: `CancellationException` is itself an
            //           `Exception`, so this MORE SPECIFIC clause must come before
            //           the broad `catch (expectedFailure: Exception)` clause, or every
            //           cancellation would be wrongly absorbed as a failure.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (e instanceof CancellationException) throw e;
            // ```
            throw cancellation
        } catch (expectedFailure: Exception) {
            // What:     `Log.w(SOURCE_TAG, "scan of folder $treeUri failed; treating as empty", expectedFailure)`
            //           writes a WARNING-level line to logcat.
            //           - `SOURCE_TAG` is the filter label.
            //           - The middle argument is a Kotlin STRING TEMPLATE: `$treeUri`
            //             inside the double-quoted literal is interpolation that
            //             splices the `treeUri` value into the text (Kotlin calls
            //             `toString()` on it).
            //           - `failure` is the caught `Exception` from the
            //             `catch (expectedFailure: Exception)` clause; passing it as the
            //             third argument makes `Log` print its stack trace.
            // Why:      The whole folder walk failed for some unexpected reason; we
            //           record it visibly (rather than silently swallowing) before
            //           degrading to an empty library.
            // Gotcha:   `$treeUri` works ONLY inside a double-quoted Kotlin string;
            //           it is interpolation, not a shell/regex variable. For an
            //           expression you would write `${treeUri.something}`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // Log.w(SOURCE_TAG, `scan of folder ${treeUri} failed; treating as empty`, expectedFailure);
            // ```
            Log.w(SOURCE_TAG, "scan of folder $treeUri failed; treating as empty", expectedFailure)
            // What:     `emptyList()` returns the shared immutable zero-element
            //           `List<Track>` (element type inferred from `scanRoot`'s
            //           return type). It is the last expression in this `catch`
            //           block, so it is the block's value, which becomes the value
            //           of the whole `try`/`catch` expression and thus the
            //           implicit return of `scanRoot` when a real failure occurred.
            // Why:      A whole-walk failure should look like "the folder has no
            //           tracks" to callers, never a crash; an empty library is the
            //           safe degraded result.
            // Gotcha:   No `return` keyword and no `;` here: this bare
            //           `emptyList()` IS the tail value of the `catch` branch, which
            //           is the tail value of the function. Easy to miss for a TS
            //           reader used to seeing an explicit `return`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return [];
            // ```
            emptyList()
        }
}
