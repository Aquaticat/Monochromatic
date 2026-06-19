// File summary (folded in from the old KDoc on the object below):
//
// This file is the Android home for the desktop music-player's persistent peak cache.
// "True peak" is the loudest sample value in a track; measuring it means decoding the
// WHOLE audio file, which is slow, so each measured value is memoized (cached) keyed by
// an opaque fingerprint hex string. This file is the ONE shared, on-disk-backed cache
// that every part of the app reads and writes.
//
// On the Rust desktop side this role is `Arc<Mutex<PeakCache>>` plus its `from_path` /
// `save` disk I/O. The pure Kotlin core port (`core/PeakCache.kt`) deliberately left the
// disk I/O out, so THIS file adds it: lazy load from a JSON file, atomic save, and a
// coroutine lock so the foreground "measure on cache miss" path and the background sweep
// worker (androidx.work) cannot corrupt the shared map or the file by racing.
//
// Privacy, identical to the desktop: the JSON only ever maps the opaque fingerprint hex
// key (a one-way hash of path+size+mtime, produced by the native crate via
// `NativeBridge.nativeFingerprint`) to a measured peak number. No filename, path, or tag is
// ever written to disk, so the cache file reveals nothing about which tracks the user owns.
//
// The atomic-write trick: write to a sibling temp file first, then rename it onto the
// real file. A rename on one filesystem is atomic, so a crash mid-write can never leave a
// half-written cache file. And following the desktop's `flush_pending`, the snapshot is
// serialized while holding the lock (fast, in memory) but the disk write happens with the
// lock RELEASED, so a slow write never blocks a track load that needs the cache.

// What:     `package dev.monochromatic.musicplayer` declares which namespace every name in
//           this file belongs to. A "package" is Kotlin/Java's folder-shaped grouping of
//           code; the dotted path mirrors the directory layout under `src/main/kotlin`.
// Why:      Other files refer to this code as `dev.monochromatic.musicplayer.PeakCacheStore`,
//           and Kotlin requires the package line to match the folder, or the build fails.
//
// In TS you'd write (pseudocode):
// ```ts
// // no package line in TS — the folder path + exports play this role
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` pulls in Android's `Context` type. A `Context`
//           is the Android handle to "the running app / its environment"; here it is only
//           used to find the app-private file directory (`context.filesDir`).
// Why:      Every public function needs a `Context` to locate where the `peaks.json` file
//           lives, because Android decides the per-app storage path at runtime.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Context } from "android/content";
// ```
import android.content.Context

// What:     `import android.util.Log` pulls in Android's logging utility. `Log` is a class
//           with static-style methods (`Log.w`, `Log.e`, ...) that write to "logcat", the
//           Android system log a developer reads with `adb logcat`.
// Why:      When the cache file is corrupt or a save fails, we log a warning instead of
//           crashing; this import gives us `Log.w`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Log } from "android/util"; // Log.w(tag, msg) ~ console.warn
// ```
import android.util.Log

// What:     `import dev.monochromatic.musicplayer.core.PeakCache` pulls in the pure
//           in-memory cache type from the sibling `core` package (defined in
//           `core/PeakCache.kt`). That `PeakCache` owns the actual `fingerprint -> peak`
//           map plus `get` / `insert` / `snapshot`.
// Why:      This store wraps ONE instance of that pure cache with a lock and disk I/O; we
//           need the type imported to construct and call it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { PeakCache } from "./core/PeakCache";
// ```
import dev.monochromatic.musicplayer.core.PeakCache

// What:     `import java.io.File` pulls in Java's `File` type, an object that represents a
//           path on disk (it does not open the file by itself; it is a handle you call
//           `.exists()`, `.readText()`, `.renameTo(...)` on).
// Why:      We read and write the JSON cache file through `File`, the standard JVM way to
//           touch the filesystem.
//
// In TS you'd write (pseudocode):
// ```ts
// import * as fs from "node:fs";
// import * as path from "node:path";
// ```
import java.io.File

// What:     `import kotlinx.coroutines.Dispatchers` pulls in the coroutine "dispatchers".
//           A dispatcher decides WHICH thread pool a coroutine runs on; `Dispatchers.IO` is
//           the pool meant for blocking disk/network work.
// Why:      File reads and writes block; we push them onto `Dispatchers.IO` so they never
//           stall the UI/audio thread.
//
// In TS you'd write (pseudocode):
// ```ts
// // no equivalent — picture "run this on the IO worker pool, not the main thread"
// ```
import kotlinx.coroutines.Dispatchers

// What:     `import kotlinx.coroutines.sync.Mutex` pulls in the coroutine `Mutex`, a lock.
//           A "mutex" (mutual exclusion) lets only one coroutine into a guarded section at a
//           time. This is the SUSPENDING kind: a waiter parks the coroutine instead of
//           blocking the OS thread.
// Why:      Two callers (foreground measure-on-miss and the background sweep) touch the same
//           map and file; the mutex serializes them so they cannot corrupt shared state.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Mutex } from "async-mutex"; // JS needs a lib; the runtime has no built-in lock
// ```
import kotlinx.coroutines.sync.Mutex

// What:     `import kotlinx.coroutines.sync.withLock` pulls in the `withLock { ... }`
//           extension function on `Mutex`. It locks the mutex, runs the block, and ALWAYS
//           unlocks afterward (even if the block throws), then returns the block's value.
// Why:      It is the safe way to use the mutex: lock + run + guaranteed unlock in one call,
//           so we never leak a held lock on an early return or exception.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Mutex } from "async-mutex"; // withLock ~ mutex.runExclusive(fn)
// ```
import kotlinx.coroutines.sync.withLock

// What:     `import kotlinx.coroutines.withContext` pulls in `withContext(dispatcher) { ... }`.
//           It runs the block on the given dispatcher's thread, suspends the caller until the
//           block finishes, then returns the block's value back on the original thread.
// Why:      We wrap blocking file I/O in `withContext(Dispatchers.IO) { ... }` so the read /
//           write happens on the IO pool while the calling coroutine simply awaits the result.
//
// In TS you'd write (pseudocode):
// ```ts
// // const result = await runOnIoPool(() => { ...blocking work... });
// ```
import kotlinx.coroutines.withContext

// What:     `import org.json.JSONObject` pulls in Android's bundled JSON object type. A
//           `JSONObject` is a mutable string-keyed map you build with `.put(key, value)` and
//           read with `.getDouble(key)` / `.keys()`, and `.toString()` renders it as JSON text.
// Why:      The cache file is a flat JSON object `{ "fingerprint": peak, ... }`; we parse it
//           into / serialize it from a `JSONObject`.
//
// In TS you'd write (pseudocode):
// ```ts
// // const obj = JSON.parse(text); ... ; const text = JSON.stringify(obj);
// ```
import org.json.JSONObject

// What:     `object PeakCacheStore { ... }` declares a SINGLETON. Kotlin's `object` keyword
//           (not to be confused with a JS object literal) defines a class AND its one-and-only
//           instance at the same time. Every member is reached as `PeakCacheStore.get(...)`,
//           never `new`ed. Siblings the reader might expect: a plain `class` (you would have to
//           instantiate it) or a `companion object` (a singleton nested INSIDE a class).
// Why:      The whole app must share exactly ONE cache and ONE lock, otherwise the foreground
//           path and the sweep would each have their own map and the file would race. A
//           singleton enforces "there is only one".
// Gotcha:   `object` here is a Kotlin SINGLETON declaration, NOT a JS object literal. There is
//           no constructor and no `new`; the instance exists for the whole process lifetime.
//
// In TS you'd write (pseudocode):
// ```ts
// export const PeakCacheStore = {
//   // ...all the consts and methods below become properties of this one object...
// };
// ```
/**
 * Defines peak cache store object for this music-player component; the TypeScript-oriented notes above explain
 * its shared role.
 */
object PeakCacheStore {
    // What:     `private const val STORE_TAG: String = "PeakCache"` declares a compile-time
    //           constant string. `private` = visible only inside this object; `const` = the
    //           value is baked in at compile time (must be a literal); `val` = immutable;
    //           `: String` is the explicit type. Sibling type the reader might expect: `var`
    //           (a reassignable variable) instead of `val`.
    // Why:      All logcat lines from the peak-cache code share this tag so they can be filtered
    //           together with `adb logcat -s PeakCache`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const STORE_TAG: string = "PeakCache";
    // ```
    /**
     * Defines store tag value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private const val STORE_TAG: String = "PeakCache"

    // What:     `private const val FILE_NAME: String = "peaks.json"` is the name of the
    //           app-private cache file. Same modifiers as above: private, compile-time constant,
    //           immutable, explicitly typed `String`.
    // Why:      One place names the on-disk file so the read path and write path cannot drift.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const FILE_NAME: string = "peaks.json";
    // ```
    /**
     * Defines file name value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private const val FILE_NAME: String = "peaks.json"

    // What:     `private const val TEMP_FILE_NAME: String = "peaks.json.tmp"` is the name of the
    //           staging file the atomic write writes into BEFORE renaming it onto `FILE_NAME`.
    // Why:      The atomic-save trick needs a sibling temp file; naming it once keeps it stable.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const TEMP_FILE_NAME: string = "peaks.json.tmp";
    // ```
    /**
     * Defines temp file name value for this music-player component; the TypeScript-oriented notes above explain
     * its source and use.
     */
    private const val TEMP_FILE_NAME: String = "peaks.json.tmp"

    // What:     `private val mutex: Mutex = Mutex()` creates the single lock instance. `Mutex()`
    //           is a CONSTRUCTOR CALL (Kotlin has no `new` keyword; calling the type name builds
    //           an instance). `val` = the reference never changes; the lock's internal state
    //           still mutates as coroutines lock/unlock it.
    // Why:      Guards both `cache` and the `loaded` flag against the concurrent foreground and
    //           sweep callers; without it they would race on the map and the file.
    // Gotcha:   `Mutex()` with no `new` IS a constructor; in TS you would write `new Mutex()`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const mutex: Mutex = new Mutex();
    // ```
    /**
     * Defines mutex value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private val mutex: Mutex = Mutex()

    // What:     `private val cache: PeakCache = PeakCache()` constructs the one shared in-memory
    //           cache (the pure `core.PeakCache`). `PeakCache()` is again a no-`new` constructor
    //           call. `val` because we never swap the cache object, only mutate its contents via
    //           `insert`.
    // Why:      This is the actual `fingerprint -> peak` map this store persists; one instance
    //           shared by every caller.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const cache: PeakCache = new PeakCache();
    // ```
    /**
     * Defines cache value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private val cache: PeakCache = PeakCache()

    // What:     `private var loaded: Boolean = false` declares a MUTABLE flag. `var` (not `val`)
    //           means it can be reassigned; `: Boolean` is the type; starts `false`.
    // Why:      The file is read lazily exactly once; this flag records "have we already loaded?"
    //           so repeat calls to `ensureLoaded` become no-ops.
    // Gotcha:   `var` vs `val` is Kotlin's `let` vs `const`. Only fields that get reassigned use
    //           `var`; everything else above is `val`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let loaded: boolean = false;
    // ```
    /**
     * Defines loaded value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private var loaded: Boolean = false

    // What:     `suspend fun get(context: Context, key: String): Float? = ...` declares a
    //           function. `suspend` marks it a COROUTINE function: it can pause and resume (e.g.
    //           while awaiting the lock or IO) without blocking a thread, and may only be called
    //           from another `suspend` function or a coroutine. Params: `context: Context` (to
    //           find the file dir), `key: String` (the fingerprint). Return type `Float?` — the
    //           trailing `?` makes it NULLABLE, so `null` is a legal value meaning "cache miss".
    //           Sibling types the reader might expect: `Float` (non-null, cannot be `null`),
    //           `Double` (64-bit float), or `Int` (integer). The `=` form means this is an
    //           EXPRESSION-BODY function: its value IS the expression on the right.
    // Why:      The app's read entry point; returns a memoized peak or `null` so the caller knows
    //           to measure-then-`put`.
    // Gotcha:   `Float?` ~ TS `number | null`. `Float` is a 32-bit float (sibling `Double` is
    //           64-bit); peaks are stored as 32-bit to match the desktop `f32`. A plain `Float`
    //           (no `?`) could NOT hold `null`; Kotlin enforces null-safety in the type.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // async get(context: Context, key: string): Promise<number | null> {
    //   return await mutex.runExclusive(async () => {
    //     await ensureLoaded(context);
    //     return cache.get(key); // number | null
    //   });
    // }
    // ```
    /**
     * Defines get behavior for this music-player component; the TypeScript-oriented notes above explain its call
     * shape and effects.
     */
    suspend fun get(context: Context, key: String): Float? = mutex.withLock {
        // What:     `ensureLoaded(context)` calls the lazy-load helper. It is a plain call, but
        //           it runs INSIDE the `withLock { ... }` block, so the load is serialized under
        //           the mutex and races nothing.
        // Why:      Guarantee the file has been read into `cache` before we look the key up.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // await ensureLoaded(context);
        // ```
        ensureLoaded(context)
        // What:     `cache.get(key)` is the LAST expression in the `withLock` lambda, so its
        //           value becomes the lambda's value, which `withLock` returns, which the
        //           expression-body `=` returns from `get`. It is a chain of implicit returns.
        //           `cache.get` itself returns `Float?` (the core map lookup, `null` on a miss).
        // Why:      Hand the memoized peak (or `null`) straight back to the caller.
        // Gotcha:   no `return` keyword here on purpose: the trailing expression of a lambda IS
        //           its return value, and an expression-body function returns that in turn.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return cache.get(key);
        // ```
        cache.get(key)
    }

    // What:     `suspend fun put(context: Context, key: String, peak: Float) { ... }` declares
    //           the write entry point. `suspend` = coroutine function (can await the lock).
    //           Params: `context`, `key` (fingerprint), `peak: Float` (the measured value, 32-bit
    //           float, sibling `Double` is 64-bit). No `: ReturnType` after the `)` and a `{ }`
    //           body means it returns `Unit` (Kotlin's "nothing useful", like TS `void`).
    // Why:      Records a freshly measured peak in memory. It deliberately does NOT write to disk;
    //           the caller decides when to `flush` (immediately for one foreground measurement,
    //           batched for a sweep).
    // Gotcha:   a `{ }`-body function with no declared return type returns `Unit` (~ `void`); the
    //           expression-body `= ...` form (like `get` above) returns the expression instead.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // async put(context: Context, key: string, peak: number): Promise<void> {
    //   await mutex.runExclusive(async () => {
    //     await ensureLoaded(context);
    //     cache.insert(key, peak);
    //   });
    // }
    // ```
    /**
     * Defines put behavior for this music-player component; the TypeScript-oriented notes above explain its call
     * shape and effects.
     */
    suspend fun put(context: Context, key: String, peak: Float) {
        // What:     `mutex.withLock { ... }` locks the mutex, runs the block, and unlocks even on
        //           throw. Here the block returns nothing, so `withLock` is used purely for its
        //           lock-run-unlock effect, not its value. The `{ ... }` after the call is a
        //           TRAILING LAMBDA: when a function's last argument is a lambda, Kotlin lets you
        //           move it outside the parentheses.
        // Why:      Serialize the in-memory insert with every other cache accessor.
        // Gotcha:   `withLock { ... }` is a function CALL whose last argument is the `{ ... }`
        //           lambda; the braces are NOT a block-statement, they are the lambda body.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // await mutex.runExclusive(async () => { ... });
        // ```
        mutex.withLock {
            // What:     `ensureLoaded(context)` lazy-loads the file once, under the lock.
            // Why:      We must not insert into a cache that has not yet absorbed the on-disk
            //           entries, or a later flush would drop them.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // await ensureLoaded(context);
            // ```
            ensureLoaded(context)
            // What:     `cache.insert(key, peak)` stores the pair in the in-memory map (the core
            //           cache's only mutation method). No return value is used.
            // Why:      Memoize the measured peak so the next `get(key)` is a hit.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // cache.insert(key, peak);
            // ```
            cache.insert(key, peak)
        }
    }

    // What:     `suspend fun flush(context: Context) { ... }` declares the "persist to disk now"
    //           entry point. `suspend` coroutine function; `context` locates the file dir; returns
    //           `Unit` (no useful value).
    // Why:      Makes the in-memory cache durable. The snapshot is serialized while holding the
    //           lock (fast, in memory) but written to disk with the lock RELEASED (slow), so a
    //           track load that needs `get` is never blocked behind the write.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // async flush(context: Context): Promise<void> {
    //   const json = await mutex.runExclusive(async () => {
    //     await ensureLoaded(context);
    //     return serialize(cache.snapshot());
    //   });
    //   await writeAtomic(context, json);
    // }
    // ```
    /**
     * Defines flush behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    suspend fun flush(context: Context) {
        // What:     `val json: String = mutex.withLock { ... }` captures the lambda's value into
        //           an immutable local. `val` = immutable; `: String` explicit type. `withLock`
        //           returns whatever its trailing lambda's last expression evaluates to.
        // Why:      Build the JSON text WHILE the lock is held (so the snapshot is consistent),
        //           then release the lock before the slow disk write below.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const json: string = await mutex.runExclusive(async () => { ... });
        // ```
        /**
         * Defines json value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val json: String = mutex.withLock {
            // What:     `ensureLoaded(context)` lazy-loads under the lock.
            // Why:      A flush must include any entries already on disk, not overwrite them with
            //           a half-populated map.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // await ensureLoaded(context);
            // ```
            ensureLoaded(context)
            // What:     `serialize(cache.snapshot())` is the lambda's LAST expression, so its
            //           value flows out of `withLock` into `json`. `cache.snapshot()` returns an
            //           immutable `Map<String, Float>` copy of every entry; `serialize(...)` turns
            //           that into JSON text. This is a nested call (inner result feeds the outer).
            // Why:      Capture an immutable snapshot under the lock and serialize it, so the later
            //           out-of-lock write works from a frozen copy and the live map is free to
            //           keep accepting inserts.
            // Gotcha:   no `return` keyword: trailing-expression-is-the-value again.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return serialize(cache.snapshot());
            // ```
            serialize(cache.snapshot())
        }
        // What:     `writeAtomic(context, json)` performs the actual disk write, called AFTER the
        //           `withLock` block has ended, i.e. with the mutex already released.
        // Why:      The slow file I/O happens off the lock, so a concurrent `get` (which needs the
        //           lock) is never blocked behind it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // await writeAtomic(context, json);
        // ```
        writeAtomic(context, json)
    }

    // What:     `private suspend fun ensureLoaded(context: Context) { ... }` declares the
    //           lazy-load helper. `private` = only this object calls it; `suspend` = coroutine
    //           (it awaits IO). Returns `Unit`. Every public method calls it FIRST while holding
    //           the mutex, so the load races nothing.
    // Why:      Read the file into `cache` exactly once; later calls short-circuit. A corrupt or
    //           unreadable file is logged and treated as an empty cache instead of failing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private async ensureLoaded(context: Context): Promise<void> { ... }
    // ```
    /**
     * Defines ensure loaded behavior for this music-player component; the TypeScript-oriented notes above
     * explain its call shape and effects.
     */
    private suspend fun ensureLoaded(context: Context) {
        // What:     `if (loaded) { return }` early-exits when the file was already read. `return`
        //           with no value leaves the function (returns `Unit`).
        // Why:      The load must happen exactly once; this makes every repeat call a no-op.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (loaded) return;
        // ```
        if (loaded) {
            return
        }
        // What:     `val text: String? = withContext(Dispatchers.IO) { ... }` runs the block on
        //           the IO thread pool, suspends until it finishes, and stores its value. The type
        //           `String?` is NULLABLE (trailing `?`): the block returns either the file's text
        //           or `null` when the file does not exist. Sibling type: plain `String` could not
        //           hold `null`.
        // Why:      File reads block; `withContext(Dispatchers.IO)` moves the read off the
        //           UI/audio thread while this coroutine simply awaits the result.
        // Gotcha:   `String?` ~ TS `string | null`; the `?` is Kotlin's compile-time null marker,
        //           not optional-chaining.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const text: string | null = await runOnIoPool(() => {
        //   const file = new File(context.filesDir, FILE_NAME);
        //   return file.exists() ? file.readText() : null;
        // });
        // ```
        /**
         * Defines text value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val text: String? = withContext(Dispatchers.IO) {
            // What:     `val file = File(context.filesDir, FILE_NAME)` builds a `File` handle for
            //           `<app private dir>/peaks.json`. `File(dir, name)` is a CONSTRUCTOR call
            //           (no `new`); `context.filesDir` is Android's app-private directory. The
            //           type is inferred (`File`) since no `: Type` is written.
            // Why:      A handle to read the cache file from the only directory the app may write.
            // Gotcha:   `File(...)` with no `new` is a constructor; in TS this is `new File(...)`
            //           or a `path.join` plus `fs` calls.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const file = path.join(context.filesDir, FILE_NAME);
            // ```
            /**
             * Defines file value for this music-player component; the TypeScript-oriented notes above explain
             * its source and use.
             */
            val file = File(context.filesDir, FILE_NAME)
            // What:     `if (file.exists()) file.readText() else null` is an IF USED AS AN
            //           EXPRESSION: the whole `if/else` evaluates to a value (the read text, or
            //           `null`). It is the block's last line, so this value becomes the block's
            //           result, which `withContext` returns into `text`. `file.readText()` reads
            //           the whole file into a `String`.
            // Why:      Return the file contents when present, or `null` to signal "no file yet,
            //           start empty".
            // Gotcha:   Kotlin's `if` is an EXPRESSION, so `val x = if (c) a else b` works without
            //           a ternary; here there is no `return` because the trailing value is the
            //           lambda's result.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return file.exists() ? file.readText() : null;
            // ```
            if (file.exists()) file.readText() else null
        }
        // What:     `if (text != null) { ... }` guards the parse. After this check Kotlin SMART-
        //           CASTS `text` from `String?` to non-null `String` inside the block, so it can be
        //           passed where a non-null `String` is required without any cast.
        // Why:      Only parse when there was actually a file to read; a missing file leaves the
        //           cache empty.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (text !== null) { ... }
        // ```
        if (text != null) {
            // What:     `runCatching { parseInto(text, cache) }` runs the block and CAPTURES the
            //           outcome as a `Result` instead of letting an exception escape. `runCatching`
            //           returns `Result.success(...)` if the block completes or
            //           `Result.failure(throwable)` if it throws. `.onFailure { failure -> ... }`
            //           runs its lambda ONLY on the failure case, handing it the captured
            //           `Throwable` (named `failure` here). The `{ failure -> ... }` is a lambda
            //           whose `failure ->` part names its parameter (Kotlin lambda syntax; without
            //           it the single param is the implicit `it`).
            // Why:      A corrupt or malformed cache file must NOT crash the app; we catch the
            //           parse failure, log it, and continue with whatever the cache already holds
            //           (an empty map on first run).
            // Gotcha:   `runCatching { }.onFailure { }` IS try/catch turned into a value-returning
            //           call chain; the `failure ->` is the caught error, like `catch (failure)`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // try {
            //   parseInto(text, cache);
            // } catch (failure) {
            //   Log.w(STORE_TAG, `could not parse ${FILE_NAME}; starting from an empty cache`, failure);
            // }
            // ```
            runCatching { parseInto(text, cache) }
                .onFailure { failure ->
                    // What:     `Log.w(STORE_TAG, "could not parse $FILE_NAME; ...", failure)`
                    //           writes a WARNING to logcat. `Log.w(tag, message, throwable)` is the
                    //           Android logger; the `$FILE_NAME` inside the string is a STRING
                    //           TEMPLATE — Kotlin substitutes the variable's value into the literal
                    //           (like a TS `${...}` placeholder). `failure` is the captured error,
                    //           logged so its stack trace appears.
                    // Why:      Make the corruption visible to a developer without crashing the app.
                    // Gotcha:   `"$FILE_NAME"` is string interpolation; the `$` is NOT a literal
                    //           dollar sign. It is Kotlin's `${...}` shorthand for a simple name.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // console.warn(`could not parse ${FILE_NAME}; starting from an empty cache`, failure);
                    // ```
                    Log.w(STORE_TAG, "could not parse $FILE_NAME; starting from an empty cache", failure)
                }
        }
        // What:     `loaded = true` flips the once-only flag (reassigning the `var`).
        // Why:      Mark the load done so every later `ensureLoaded` returns immediately.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // loaded = true;
        // ```
        loaded = true
    }

    // What:     `private fun parseInto(text: String, target: PeakCache) { ... }` declares a plain
    //           (NON-suspend) helper. `private` = internal; no `suspend` because it only does CPU
    //           work, no IO/await. Params: `text: String` (JSON previously written by `serialize`)
    //           and `target: PeakCache` (the cache to fill). Returns `Unit`.
    // Why:      Decode every `fingerprint -> peak` entry from the persisted JSON into the cache.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private parseInto(text: string, target: PeakCache): void { ... }
    // ```
    /**
     * Defines parse into behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    private fun parseInto(text: String, target: PeakCache) {
        // What:     `val obj = JSONObject(text)` parses the JSON text into a `JSONObject`.
        //           `JSONObject(text)` is a CONSTRUCTOR call (no `new`) that THROWS if `text` is
        //           not valid JSON — which is exactly why the caller wrapped this in `runCatching`.
        //           Type inferred as `JSONObject`.
        // Why:      Turn the on-disk text into a key/value structure we can iterate.
        // Gotcha:   `JSONObject(text)` is a constructor that THROWS on malformed input; in TS the
        //           throwing equivalent is `JSON.parse(text)`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const obj = JSON.parse(text);
        // ```
        /**
         * Defines obj value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val obj = JSONObject(text)
        // What:     `obj.keys().forEach { key -> target.insert(key, obj.getDouble(key).toFloat()) }`
        //           iterates every key. `obj.keys()` returns an iterator of the JSON keys;
        //           `.forEach { key -> ... }` runs the lambda once per key (the `key ->` names the
        //           lambda parameter). `obj.getDouble(key)` reads the value as a 64-bit `Double`;
        //           `.toDouble`'s inverse `.toFloat()` is a TYPE CONVERSION narrowing that
        //           `Double` to a 32-bit `Float`. `target.insert(...)` stores the pair.
        // Why:      JSON numbers come back as `Double`, but the cache stores 32-bit `Float` to
        //           match the desktop `f32`, so each value is narrowed on the way in. Looping fills
        //           the cache with every persisted entry.
        // Gotcha:   `.toFloat()` is a real value conversion (64-bit -> 32-bit, may lose precision),
        //           not a cast that TS would need; TS `number` is always 64-bit double.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const key of Object.keys(obj)) {
        //   target.insert(key, obj[key]); // TS number is already a float; no .toFloat()
        // }
        // ```
        obj.keys().forEach { key -> target.insert(key, obj.getDouble(key).toFloat()) }
    }

    // What:     `private fun serialize(entries: Map<String, Float>): String { ... }` declares a
    //           plain helper. Param `entries: Map<String, Float>` is an IMMUTABLE read-only map
    //           (the `<String, Float>` are the key and value TYPE ARGUMENTS, the angle-bracket
    //           generics). Sibling type the reader might expect: `MutableMap<String, Float>` (a map
    //           you can add to). Return type `: String` (the JSON text).
    // Why:      Turn a cache snapshot into the flat JSON object `{ fingerprint: peak, ... }` that
    //           `writeAtomic` persists.
    // Gotcha:   `Map<String, Float>` is Kotlin's READ-ONLY map interface; the mutable one is
    //           `MutableMap`. TS `Map` is always mutable, so the read-only distinction is invisible.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private serialize(entries: ReadonlyMap<string, number>): string { ... }
    // ```
    /**
     * Defines serialize behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    private fun serialize(entries: Map<String, Float>): String {
        // What:     `val obj = JSONObject()` constructs an EMPTY JSON object (no-arg constructor,
        //           no `new`). Type inferred `JSONObject`.
        // Why:      We build up the JSON entry by entry, then render it to text.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const obj: Record<string, number> = {};
        // ```
        /**
         * Defines obj value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val obj = JSONObject()
        // What:     `entries.forEach { (key, peak) -> obj.put(key, peak.toDouble()) }` iterates the
        //           map. `.forEach { (key, peak) -> ... }` uses DESTRUCTURING in the lambda
        //           parameter: each `Map.Entry` is unpacked into `key` and `peak`. `peak.toDouble()`
        //           is a TYPE CONVERSION widening the 32-bit `Float` back to a 64-bit `Double`,
        //           because `JSONObject.put` stores doubles. `obj.put(key, value)` adds the pair.
        // Why:      Write each `fingerprint -> peak` into the JSON object; the value is widened to
        //           `Double` so JSON stores a plain number.
        // Gotcha:   `(key, peak) ->` is lambda DESTRUCTURING of a map entry, like TS
        //           `([key, peak]) => ...`. `.toDouble()` is a real Float->Double widen, not a cast.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const [key, peak] of entries) {
        //   obj[key] = peak; // already a 64-bit number in TS
        // }
        // ```
        entries.forEach { (key, peak) -> obj.put(key, peak.toDouble()) }
        // What:     `return obj.toString()` returns the JSON object rendered as text.
        //           `obj.toString()` is a CONVERSION call producing the serialized JSON string.
        //           Explicit `return` here (this is a `{ }`-body function, not an expression body).
        // Why:      Hand the JSON text back to `flush`, which passes it to `writeAtomic`.
        // Gotcha:   `obj.toString()` on a `JSONObject` produces JSON text (not `"[object Object]"`);
        //           it is the JVM analogue of `JSON.stringify`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return JSON.stringify(obj);
        // ```
        return obj.toString()
    }

    // What:     `private suspend fun writeAtomic(context: Context, json: String) { ... }` declares
    //           the disk-write helper. `suspend` because it awaits IO; `context` locates the dir;
    //           `json: String` is the serialized cache. Returns `Unit`. Called by `flush` with NO
    //           lock held.
    // Why:      Persist `json` to `FILE_NAME` atomically: stage into `TEMP_FILE_NAME`, then rename
    //           it onto the target, so a crash mid-write never leaves a half-written cache.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private async writeAtomic(context: Context, json: string): Promise<void> { ... }
    // ```
    /**
     * Defines write atomic behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    private suspend fun writeAtomic(context: Context, json: String) {
        // What:     `withContext(Dispatchers.IO) { ... }` runs the whole write on the IO thread
        //           pool and suspends the caller until it completes. Same shape as in
        //           `ensureLoaded`, but here it returns nothing useful.
        // Why:      File writes block; do them on the IO pool, off the UI/audio thread.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // await runOnIoPool(() => { ... });
        // ```
        withContext(Dispatchers.IO) {
            // What:     `val temp = File(context.filesDir, TEMP_FILE_NAME)` builds the staging-file
            //           handle (`<dir>/peaks.json.tmp`). Constructor call, type inferred `File`.
            // Why:      We write the new contents here first, then atomically rename onto the real
            //           file.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const temp = path.join(context.filesDir, TEMP_FILE_NAME);
            // ```
            /**
             * Defines temp value for this music-player component; the TypeScript-oriented notes above explain
             * its source and use.
             */
            val temp = File(context.filesDir, TEMP_FILE_NAME)
            // What:     `val target = File(context.filesDir, FILE_NAME)` builds the handle for the
            //           REAL cache file (`<dir>/peaks.json`). Constructor call, inferred `File`.
            // Why:      The final destination the temp file is renamed onto.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const target = path.join(context.filesDir, FILE_NAME);
            // ```
            /**
             * Defines target value for this music-player component; the TypeScript-oriented notes above explain
             * its source and use.
             */
            val target = File(context.filesDir, FILE_NAME)
            // What:     `temp.writeText(json)` writes the JSON text to the temp file, creating or
            //           truncating it. This is the blocking I/O the surrounding `withContext` moved
            //           off the main thread.
            // Why:      Stage the new contents safely before touching the real file.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // fs.writeFileSync(temp, json);
            // ```
            temp.writeText(json)
            // renameTo does not overwrite on every filesystem, so drop the old target first on a
            // second attempt; a final failure is logged, leaving the previous file intact.
            // What:     `if (!temp.renameTo(target)) { ... }`. `temp.renameTo(target)` returns a
            //           `Boolean`: `true` if the rename succeeded, `false` if it failed (e.g. the
            //           target already exists on a filesystem that will not overwrite). `!` is
            //           boolean NOT, so this branch runs when the rename FAILED. `renameTo` returns
            //           a flag instead of throwing — it never throws on a normal failure.
            // Why:      On a filesystem that refuses to overwrite, the first rename fails and we
            //           must retry; this guards that retry path.
            // Gotcha:   `renameTo` reports failure by RETURNING `false`, not by throwing; easy to
            //           miss. `!` here is plain boolean negation, same as TS `!`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // let renamed = false;
            // try { fs.renameSync(temp, target); renamed = true; } catch {}
            // if (!renamed) { ... }
            // ```
            if (!temp.renameTo(target)) {
                // What:     `target.delete()` removes the existing real file. Returns a `Boolean`
                //           success flag (ignored here). Deleting first clears the way for a rename
                //           on a filesystem that will not overwrite an existing target.
                // Why:      The first rename failed because `target` existed; remove it, then retry.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // try { fs.unlinkSync(target); } catch {}
                // ```
                target.delete()
                // What:     `if (!temp.renameTo(target)) { ... }` retries the rename now that the
                //           target is gone. `!` again means "the rename still failed". This is the
                //           same boolean-flag-not-exception pattern as the outer `if`.
                // Why:      Second attempt after clearing the target; if it STILL fails, the disk is
                //           in some unexpected state and we give up without crashing.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // try { fs.renameSync(temp, target); } catch {
                //   console.warn(`could not persist ${FILE_NAME}; cache stays in memory only`);
                // }
                // ```
                if (!temp.renameTo(target)) {
                    // What:     `Log.w(STORE_TAG, "could not persist $FILE_NAME; cache stays in
                    //           memory only")` writes a logcat warning. Two-argument `Log.w(tag,
                    //           message)` (no throwable this time). `$FILE_NAME` is again a STRING
                    //           TEMPLATE substituting the constant's value.
                    // Why:      Make the persistence failure visible while letting the app keep
                    //           running with the cache held in memory only.
                    // Gotcha:   `$FILE_NAME` is interpolation, not a literal dollar; same as TS `${...}`.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // console.warn(`could not persist ${FILE_NAME}; cache stays in memory only`);
                    // ```
                    Log.w(STORE_TAG, "could not persist $FILE_NAME; cache stays in memory only")
                }
            }
        }
    }
}
