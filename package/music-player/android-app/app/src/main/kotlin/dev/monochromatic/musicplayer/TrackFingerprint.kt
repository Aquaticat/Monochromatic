// ============================================================================
// File summary (folds in the old KDoc that sat on `object TrackFingerprint`)
// ============================================================================
//
// This file computes the opaque peak-cache KEY for a track from its content
// URI: the Android source for the desktop player's filesystem
// `path + size + mtime` fingerprint. The native crate (reached via
// `NativeBridge.nativeFingerprint`) gxhashes the pieces; the platform-specific
// pieces (the file's size and modified-time) are read from the Android content
// provider HERE.
// Because the result is hashed, no path, name, or tag is ever stored.
//
// How the Android pieces stand in for the desktop's:
//   - The URI string stands in for the desktop's path: it is stable per track
//     (a SAF document URI is derived from the tree and document id; a MediaStore
//     URI ends in the stable row id).
//   - Size comes from `OpenableColumns.SIZE`, which both SAF and MediaStore
//     expose, so a re-encode (a size change) invalidates a stale entry.
//   - Last-modified comes from `DocumentsContract.Document.COLUMN_LAST_MODIFIED`;
//     SAF document providers report it (so an in-place edit invalidates the
//     entry), while MediaStore does NOT carry that column and falls back to zero
//     (size still guards it).
//
// Cross-source or cross-device portability is not a goal: the cache is
// per-install and rebuilt on a miss. The provider queries run on the IO thread
// pool because they are cursor I/O.
// ============================================================================

// What:     `package dev.monochromatic.musicplayer` names the namespace (Kotlin's
//           named bucket that fully qualifies the names in this file) this object
//           lives in, reachable elsewhere as
//           `dev.monochromatic.musicplayer.TrackFingerprint`.
// Why:      So the peak cache and sweep code can call `TrackFingerprint.of(...)`.
//
// In TS you'd write (pseudocode):
// ```ts
// // No `package` line in TS; the file path is the module identity.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` pulls in `Context`, Android's handle
//           to the app environment; its `contentResolver` is how we query the
//           document/MediaStore provider.
// Why:      Both query helpers take a `Context` to reach `context.contentResolver`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Context } from "android/content";
// ```
import android.content.Context

// What:     `import android.net.Uri` pulls in `Uri`, Android's parsed
//           uniform-resource-identifier type (e.g. a `content://...` URI).
// Why:      `of` and the helpers take the track's `Uri` to query and to stringify
//           into the fingerprint.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Uri } from "android/net";
// ```
import android.net.Uri

// What:     `import android.provider.DocumentsContract` pulls in
//           `DocumentsContract`, the Storage Access Framework's contract class.
//           We read its `Document.COLUMN_LAST_MODIFIED` column-name constant.
// Why:      `queryLastModifiedMs` asks the provider for that column.
//
// In TS you'd write (pseudocode):
// ```ts
// import { DocumentsContract } from "android/provider";
// ```
import android.provider.DocumentsContract

// What:     `import android.provider.OpenableColumns` pulls in `OpenableColumns`,
//           whose `SIZE` constant is the column name for a file's byte size,
//           exposed by both SAF and MediaStore providers.
// Why:      `querySize` requests the `OpenableColumns.SIZE` column.
//
// In TS you'd write (pseudocode):
// ```ts
// import { OpenableColumns } from "android/provider";
// ```
import android.provider.OpenableColumns

// What:     No import is needed for the fingerprint helper anymore. `of` now calls
//           `NativeBridge.nativeFingerprint(...)`, and `NativeBridge` is in THIS file's
//           package (`dev.monochromatic.musicplayer`), so it is visible with no import.
//           The old pure-Kotlin `core.fingerprint` was removed: gxhash (the new hash)
//           has no JVM port, so the computation moved into the native crate.
// Why:      Document why the formerly-imported `core.fingerprint` is gone, so a reader
//           does not look for it.
//
// In TS you'd write (pseudocode):
// ```ts
// // (no import) NativeBridge is a sibling in the same module folder
// ```

// What:     `import kotlinx.coroutines.Dispatchers` pulls in `Dispatchers`, the
//           coroutines object naming the thread pools. We use `Dispatchers.IO`,
//           the pool for blocking input/output (file/provider reads).
// Why:      `of` runs its provider queries on `Dispatchers.IO`, off the UI thread.
//
// In TS you'd write (pseudocode):
// ```ts
// // no equivalent — JS is single-threaded; picture a Worker pool named "IO"
// ```
import kotlinx.coroutines.Dispatchers

// What:     `import kotlinx.coroutines.withContext` pulls in `withContext`, the
//           coroutine function that runs a block on a given dispatcher (thread
//           pool), SUSPENDS the caller until it finishes, and returns the block's
//           value.
// Why:      `of` uses `withContext(Dispatchers.IO) { ... }` to do its reads on the
//           IO pool while still returning a value to the caller.
//
// In TS you'd write (pseudocode):
// ```ts
// import { withContext } from "kotlinx/coroutines"; // ~ await runOnWorker(fn)
// ```
import kotlinx.coroutines.withContext

// What:     `object TrackFingerprint { ... }` declares a SINGLETON named
//           `TrackFingerprint`. In Kotlin `object` (not `class`) means "exactly
//           one instance, created lazily on first use, whose members you call
//           through the name directly" (`TrackFingerprint.of(...)`), never with
//           `new`.
// Why:      This holds no per-instance state; it is a namespaced bag of one public
//           function plus two private helpers and two constants, so a single
//           shared instance is exactly right.
// Gotcha:   `object` here is NOT TS's structural `object` type; it is Kotlin's
//           keyword for a compiler-managed singleton.
//
// In TS you'd write (pseudocode):
// ```ts
// export const TrackFingerprint = {
//   // ...members below...
// };
// ```
/**
 * Defines track fingerprint object for this music-player component; the TypeScript-oriented notes above explain
 * its shared role.
 */
object TrackFingerprint {
    // What:     `private const val NANOS_PER_MILLI: Long = 1_000_000L` declares a
    //           compile-time constant. `private` hides it outside this object;
    //           `const` means "known at compile time and inlined"; `val` means it
    //           can never be reassigned; `: Long` is the explicit type, a 64-bit
    //           signed integer (siblings the reader might expect: `Int` = 32-bit).
    //           The literal `1_000_000L` uses `_` purely as a digit GROUPING
    //           separator (ignored by the compiler, like `1,000,000`) and the
    //           trailing `L` forces it to be a `Long` (a bare `1000000` would be
    //           an `Int`).
    // Why:      The provider reports the modified time in milliseconds, but the
    //           core key wants nanoseconds; this is the multiplier between them.
    // Gotcha:   `Long` is fixed-width 64-bit; the `L` suffix is load-bearing here
    //           because `modifiedMs * NANOS_PER_MILLI` must stay 64-bit to avoid
    //           overflow.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const NANOS_PER_MILLI = 1_000_000;
    // ```
    /**
     * Defines nanos per milli value for this music-player component; the TypeScript-oriented notes above explain
     * its source and use.
     */
    private const val NANOS_PER_MILLI: Long = 1_000_000L

    // What:     `private const val UNKNOWN_MODIFIED_MS: Long = 0L` declares another
    //           private compile-time `Long` constant (see `NANOS_PER_MILLI` for the
    //           `const`/`val`/`Long`/`L`-suffix explanation). `0L` is the `Long`
    //           literal zero.
    // Why:      The fallback last-modified value when the provider does not expose
    //           the column (for example MediaStore), so a missing mtime becomes a
    //           stable zero rather than an error.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const UNKNOWN_MODIFIED_MS = 0;
    // ```
    /**
     * Defines unknown modified ms value for this music-player component; the TypeScript-oriented notes above
     * explain its source and use.
     */
    private const val UNKNOWN_MODIFIED_MS: Long = 0L

    // What:     `suspend fun of(context: Context, uri: Uri): Long? = withContext(Dispatchers.IO) { ... }`
    //           declares a function `of` with two named params (`context`, `uri`).
    //           `suspend` marks it a COROUTINE function that may pause/resume (so it
    //           can await background work) and must be called from another
    //           coroutine. `: Long?` is the return type, a NULLABLE `Long` (the
    //           trailing `?` means "a `Long` OR null"): the raw `u64` fingerprint the
    //           native cache keys on, bit-cast to `Long`. The `= <expr>` form is an
    //           expression body: the function returns the value of the single
    //           `withContext(Dispatchers.IO) { ... }` expression, which runs the
    //           trailing lambda on the IO pool and returns its value.
    // Why:      It is the one public entry point: hand it a context and a track URI,
    //           get back the opaque cache key, or `null` when the size can't be read
    //           (so the caller skips caching and plays at unity gain). `suspend`
    //           lets it do the provider I/O without blocking the UI thread.
    // Gotcha:   A `suspend` function looks synchronous but can only be called from a
    //           coroutine. `Long?` forces the caller to handle the null case; the `Long`
    //           is an opaque key, not a number to interpret.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // async function of(context: Context, uri: Uri): Promise<bigint | null> {
    //   return await runOnWorker(() => { // runs on the IO pool
    //     // ...body below...
    //   });
    // }
    // ```
    /**
     * Defines of behavior for this music-player component; the TypeScript-oriented notes above explain its call
     * shape and effects.
     */
    suspend fun of(context: Context, uri: Uri): Long? = withContext(Dispatchers.IO) {
        // What:     `val size: Long = querySize(context, uri) ?: return@withContext null`
        //           declares a read-only `Long` local `size`. The right side uses the
        //           ELVIS operator `?:`: "use the left value if it is non-null,
        //           otherwise evaluate the right side." `querySize(...)` returns a
        //           `Long?` (size or null); if non-null, `size` gets that value; if
        //           null, the right side `return@withContext null` runs.
        //           `return@withContext` is a LABELED return: it returns from the
        //           `withContext` lambda (NOT just out of this line), making the whole
        //           `withContext` (and thus `of`) evaluate to `null`.
        // Why:      With no readable size there is nothing to fingerprint, so we bail
        //           out early and report `null` to the caller.
        // Gotcha:   The `@withContext` label is REQUIRED: a bare `return` inside this
        //           lambda would be a compile error (this is an expression-bodied
        //           function with no statement-block to return from); the label says
        //           "return from the withContext lambda." It is the close analogue of
        //           Rust's `?` on an `Option`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const maybeSize = querySize(context, uri); // number | null
        // if (maybeSize === null) return null;
        // const size = maybeSize;
        // ```
        /**
         * Defines size value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val size: Long = querySize(context, uri) ?: return@withContext null
        // What:     `val modifiedMs: Long = queryLastModifiedMs(context, uri)` declares
        //           a read-only `Long` local `modifiedMs` from the helper, which always
        //           returns a `Long` (never null: it substitutes `UNKNOWN_MODIFIED_MS`
        //           when the provider lacks the column).
        // Why:      The last-modified time in milliseconds, the second platform input
        //           to the fingerprint.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const modifiedMs: number = queryLastModifiedMs(context, uri);
        // ```
        /**
         * Defines modified ms value for this music-player component; the TypeScript-oriented notes above explain
         * its source and use.
         */
        val modifiedMs: Long = queryLastModifiedMs(context, uri)
        // What:     `NativeBridge.nativeFingerprint(uri.toString(), size, modifiedMs * NANOS_PER_MILLI)`
        //           is the TAIL EXPRESSION of the `withContext` lambda (no trailing
        //           `;`), so its value is what `withContext` returns, hence `of`'s
        //           result. Pieces:
        //           - `uri.toString()` is a TYPE-CONVERSION call turning the `Uri`
        //             object into its `String` form (the path stand-in).
        //           - `size` is passed as the plain `Long` (no `.toULong()`): the
        //             native function takes a signed `Long` and reinterprets it as
        //             unsigned, since sizes are never negative.
        //           - `(modifiedMs * NANOS_PER_MILLI)` multiplies ms by 1,000,000 (both
        //             `Long`, so 64-bit integer multiply) to get nanoseconds, passed as
        //             a plain `Long`.
        //           - `NativeBridge.nativeFingerprint(...)` calls into the native crate
        //             (src/fingerprint.rs) over JNI, which gxhashes the three into the
        //             cache key `String`.
        // Why:      Produce the opaque, hashed cache key from the URI plus the two read
        //           file attributes, matching the desktop's `path + size + mtime` key
        //           and its gxhash, so Android and desktop agree on identical inputs.
        // Gotcha:   `Long * Long` is 64-bit integer multiply that WRAPS silently on
        //           overflow (no auto-widening like JS numbers); using `Long` for the
        //           constant is what keeps it 64-bit. The conversion to unsigned now
        //           happens native-side, so no `.toULong()` is needed here.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return NativeBridge.nativeFingerprint(
        //   uri.toString(),
        //   size,                          // native side treats it as unsigned 64-bit
        //   modifiedMs * NANOS_PER_MILLI,  // ms -> ns
        // );
        // ```
        NativeBridge.nativeFingerprint(uri.toString(), size, modifiedMs * NANOS_PER_MILLI)
    }

    // What:     `private fun querySize(context: Context, uri: Uri): Long? { ... }`
    //           declares a PRIVATE (this-object-only) function taking `context` and
    //           `uri` and returning a NULLABLE `Long?` (the `?` = "a `Long` OR null"),
    //           with a BLOCK body `{ ... }` (not an expression body).
    // Why:      Read the file's byte size from `OpenableColumns.SIZE`, or `null` when
    //           the provider does not report it (the signal that lets `of` skip
    //           caching).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function querySize(context: Context, uri: Uri): number | null {
    //   const cursor = context.contentResolver.query(uri, [OpenableColumns.SIZE], null, null, null);
    //   if (cursor) {
    //     try {
    //       if (cursor.moveToFirst() && !cursor.isNull(0)) return cursor.getLong(0);
    //     } finally { cursor.close(); }
    //   }
    //   return null;
    // }
    // ```
    /**
     * Defines query size behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    private fun querySize(context: Context, uri: Uri): Long? {
        // What:     `context.contentResolver` reads the `ContentResolver` off the
        //           context: the object you hand a query to in order to read a content
        //           provider. This begins a multi-line CALL CHAIN (the next two lines
        //           continue it with `.query(...)` and `?.use { ... }`).
        // Why:      It is the entry point for querying the document/MediaStore provider
        //           for this URI's size.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // context.contentResolver
        // ```
        context.contentResolver
            // What:     `.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)`
            //           runs the provider query and returns a `Cursor?` (nullable; null
            //           if the query failed). `arrayOf(OpenableColumns.SIZE)` builds an
            //           `Array<String>` of the one column we want (`arrayOf(x)` is the
            //           stdlib factory for a fixed-size typed array). The three `null`s
            //           are the unused `selection`, `selectionArgs`, and `sortOrder`
            //           query arguments.
            // Why:      Ask the provider for just the size column of this one URI.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // .query(uri, [OpenableColumns.SIZE], null, null, null)
            // ```
            .query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)
            // What:     `?.use { cursor -> ... }`. The `?.` is a SAFE-CALL: if the
            //           `Cursor?` from `.query` is null, the whole `?.use { ... }` is
            //           skipped (evaluates to null) instead of crashing; otherwise
            //           `.use { ... }` runs the trailing lambda and GUARANTEES the
            //           cursor is closed afterward (even on exception). `{ cursor -> ... }`
            //           is a TRAILING LAMBDA whose single parameter `cursor` is the
            //           non-null cursor.
            // Why:      Read the row safely while making sure the native cursor handle is
            //           always released; a null cursor becomes a harmless no-op.
            // Gotcha:   `?.` short-circuits the ENTIRE chained call on null (like TS
            //           optional chaining); `use {}` is Kotlin's resource-closing helper
            //           (a `using`/`try-with-resources` block), not a plain method.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // ?.use((cursor) => { ... })
            // ```
            ?.use { cursor ->
                // What:     `if (cursor.moveToFirst() && !cursor.isNull(0)) { ... }` is a
                //           control-flow `if`. `cursor.moveToFirst()` advances to the
                //           first row and returns `true` if one exists; `&&` is logical
                //           AND; `!cursor.isNull(0)` is the NEGATION (`!`) of
                //           "column 0 is null", i.e. "column 0 has a value." `0` is the
                //           column index (we requested only the size column).
                // Why:      Only read the size when there is a first row AND its size
                //           column actually holds a value.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (cursor.moveToFirst() && !cursor.isNull(0)) { ... }
                // ```
                if (cursor.moveToFirst() && !cursor.isNull(0)) {
                    // What:     `return cursor.getLong(0)` reads column 0 as a `Long` and
                    //           RETURNS it. Crucially this is a NON-LOCAL return: because
                    //           `use` is an inline function, `return` here returns from the
                    //           enclosing `querySize` function (escaping the lambda AND
                    //           closing the cursor on the way out), NOT merely from the
                    //           lambda.
                    // Why:      We have the size; hand it straight back as the function's
                    //           result.
                    // Gotcha:   This `return` exits `querySize`, not just the `use` lambda.
                    //           That is only legal because `use` is `inline`; a non-inline
                    //           lambda would forbid a non-local `return`.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // return cursor.getLong(0); // non-local: leaves querySize entirely
                    // ```
                    return cursor.getLong(0)
                }
            }
        // What:     `return null` is the fall-through return: reached when the cursor was
        //           null, had no first row, or its size column was null. It hands back
        //           the `null` variant of the `Long?` return type.
        // Why:      Signal "size unavailable" so `of` skips caching this track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return null;
        // ```
        return null
    }

    // What:     `private fun queryLastModifiedMs(context: Context, uri: Uri): Long = <expr>`
    //           declares a PRIVATE helper taking `context` and `uri` and returning a
    //           non-null `Long` (always a value, never null), as an EXPRESSION body
    //           (`= <expr>` is the return). Its single expression is the
    //           `runCatching { ... }.getOrDefault(...)` below.
    // Why:      Read the last-modified time in milliseconds, or substitute
    //           `UNKNOWN_MODIFIED_MS` when the provider lacks that column (MediaStore
    //           uses a different one and the query throws, which is treated as
    //           "unknown" rather than an error).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function queryLastModifiedMs(context: Context, uri: Uri): number {
    //   try {
    //     const cursor = context.contentResolver.query(
    //       uri, [DocumentsContract.Document.COLUMN_LAST_MODIFIED], null, null, null,
    //     );
    //     if (cursor) {
    //       try {
    //         return (cursor.moveToFirst() && !cursor.isNull(0))
    //           ? cursor.getLong(0) : UNKNOWN_MODIFIED_MS;
    //       } finally { cursor.close(); }
    //     }
    //     return UNKNOWN_MODIFIED_MS;
    //   } catch { return UNKNOWN_MODIFIED_MS; }
    // }
    // ```
    /**
     * Defines query last modified ms behavior for this music-player component; the TypeScript-oriented notes
     * above explain its call shape and effects.
     */
    private fun queryLastModifiedMs(context: Context, uri: Uri): Long =
        // What:     `runCatching { ... }` runs the trailing lambda and CATCHES any
        //           exception it throws, returning a `Result<T>` (a wrapper that is
        //           either "success holding the value" or "failure holding the
        //           exception"). It never re-throws; the failure is captured.
        // Why:      Some providers (MediaStore) lack the `COLUMN_LAST_MODIFIED` column,
        //           so the query THROWS; wrapping it in `runCatching` lets us turn that
        //           throw into a quiet fallback instead of crashing.
        // Gotcha:   `runCatching` swallows the exception into a `Result`; you MUST then
        //           unwrap it (here with `.getOrDefault` below), or the failure is lost.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const result = runCatching(() => { ... }); // Result<number>
        // ```
        runCatching {
            // What:     `context.contentResolver` reads the `ContentResolver` off the
            //           context, beginning the same kind of multi-line query chain as in
            //           `querySize` (continued by `.query(...)` and `?.use { ... }`).
            // Why:      Entry point for querying the provider for this URI's mtime.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // context.contentResolver
            // ```
            context.contentResolver
                // What:     `.query(uri, arrayOf(DocumentsContract.Document.COLUMN_LAST_MODIFIED), null, null, null)`
                //           runs the provider query for just the last-modified column and
                //           returns a `Cursor?`. `arrayOf(...)` builds the one-element
                //           `Array<String>` of column names; the three `null`s are the
                //           unused selection/args/sort arguments.
                // Why:      Ask for this URI's last-modified column specifically. On a
                //           provider lacking it, this is the call that THROWS (caught by
                //           the surrounding `runCatching`).
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // .query(uri, [DocumentsContract.Document.COLUMN_LAST_MODIFIED], null, null, null)
                // ```
                .query(uri, arrayOf(DocumentsContract.Document.COLUMN_LAST_MODIFIED), null, null, null)
                // What:     `?.use { cursor -> ... }`. `?.` SAFE-CALLs only when the
                //           `Cursor?` is non-null; `.use { ... }` runs the trailing lambda
                //           and guarantees the cursor is closed afterward; `cursor` is the
                //           non-null cursor parameter. Unlike `querySize`, here the lambda
                //           is used as an EXPRESSION (its value flows out, see below).
                // Why:      Read the row safely and always release the cursor handle.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // ?.use((cursor) => { ... })
                // ```
                ?.use { cursor ->
                    // What:     `if (cursor.moveToFirst() && !cursor.isNull(0)) { A } else { B }`
                    //           is an `if/else` used AS AN EXPRESSION (each branch's last
                    //           value becomes the `if`'s value, which becomes the `use`
                    //           lambda's value). The condition is "there is a first row AND
                    //           column 0 is not null" (`!` negates `isNull`).
                    // Why:      Yield the real mtime when present, otherwise the fallback.
                    // Gotcha:   This `if` PRODUCES a value (Kotlin), unlike TS where `if`
                    //           is a statement; that value is what the lambda returns.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // (cursor.moveToFirst() && !cursor.isNull(0)) ? cursor.getLong(0) : UNKNOWN_MODIFIED_MS
                    // ```
                    if (cursor.moveToFirst() && !cursor.isNull(0)) {
                        // What:     `cursor.getLong(0)` reads column 0 as a `Long`. As the
                        //           `then`-branch's last expression it becomes the branch's
                        //           value (and so the lambda's value). NOTE: no `return`
                        //           here, unlike `querySize` (this whole helper is an
                        //           expression body, so values flow out, they are not
                        //           `return`ed mid-lambda).
                        // Why:      The actual last-modified time in milliseconds.
                        //
                        // In TS you'd write (pseudocode):
                        // ```ts
                        // cursor.getLong(0)
                        // ```
                        cursor.getLong(0)
                    } else {
                        // What:     `UNKNOWN_MODIFIED_MS` (the `0L` constant) is the
                        //           `else`-branch's value: used when there is no row or the
                        //           column is null.
                        // Why:      Fall back to a stable zero mtime rather than failing.
                        //
                        // In TS you'd write (pseudocode):
                        // ```ts
                        // UNKNOWN_MODIFIED_MS
                        // ```
                        UNKNOWN_MODIFIED_MS
                    }
                // What:     `} ?: UNKNOWN_MODIFIED_MS` closes the `?.use { ... }` lambda and
                //           then applies the ELVIS operator `?:` to its result. `?.use { ... }`
                //           is `Long?` (null when the `Cursor?` was null, so `.use` never
                //           ran); `?: UNKNOWN_MODIFIED_MS` substitutes the fallback in that
                //           null case. The resulting `Long` is the value `runCatching`'s
                //           lambda produces on success.
                // Why:      A null cursor (provider returned nothing) must still yield a
                //           `Long`, so we coalesce it to the unknown-mtime fallback.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // (cursorResult) ?? UNKNOWN_MODIFIED_MS
                // ```
                } ?: UNKNOWN_MODIFIED_MS
        // What:     `}.getOrDefault(UNKNOWN_MODIFIED_MS)` closes the `runCatching { ... }`
        //           lambda and calls `.getOrDefault(default)` on the resulting
        //           `Result<Long>`: it returns the success value if the lambda completed,
        //           or `UNKNOWN_MODIFIED_MS` if the lambda THREW (the failure case). This
        //           whole `runCatching { ... }.getOrDefault(...)` is the expression body's
        //           value, hence `queryLastModifiedMs`'s return.
        // Why:      Turn a thrown "no such column" (MediaStore) into the quiet fallback,
        //           so a missing mtime never propagates as an error.
        // Gotcha:   `.getOrDefault(x)` SILENTLY discards the captured exception; use it
        //           only when "no info, fall back" is genuinely correct (it is here:
        //           size still guards the cache entry).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return result.getOrDefault(UNKNOWN_MODIFIED_MS);
        // ```
        }.getOrDefault(UNKNOWN_MODIFIED_MS)
}
