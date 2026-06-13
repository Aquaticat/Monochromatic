// What:     `package dev.monochromatic.musicplayer.core` names the namespace this test file
//           lives under. It is the SAME package as the code under test (`PeakCache.kt`), so
//           this file calls `fingerprint` and uses `PeakCache` by their short names with no
//           import. The package must mirror the directory path.
// Why:      Sharing the package lets the tests reach the package-level `fingerprint` function
//           and the `PeakCache` class without importing them; test and main source sets merge
//           into one package at compile time.
// TS map:   No `package` keyword; a file's path IS its module. Equivalent would be
//           `import { fingerprint, PeakCache } from ".../core/PeakCache"`, made implicit by the
//           same-package rule.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path IS the module; here it shares a namespace with the SUT.
// ```
package dev.monochromatic.musicplayer.core

// What:     `import org.junit.Assert.assertEquals` imports the static `assertEquals` function
//           from JUnit 4's `org.junit.Assert` class, callable unqualified.
// Why:      The value-equality assertions below need it.
// TS map:   `import { assertEquals } from "...";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertEquals } from "@junit/assert";
// ```
import org.junit.Assert.assertEquals

// What:     `import org.junit.Assert.assertFalse` imports the static `assertFalse` function
//           (asserts a `Boolean` is `false`).
// Why:      The opacity assertion below (`assertFalse(first.contains("a.flac"))`) needs it.
// TS map:   `import { assertFalse } from "...";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertFalse } from "@junit/assert";
// ```
import org.junit.Assert.assertFalse

// What:     `import org.junit.Assert.assertNotEquals` imports the static `assertNotEquals`
//           function, which FAILS the test unless its two arguments are NOT equal. This import
//           is unique to this file among the test files; it is here because the
//           change-sensitivity assertions need a "must differ" check.
// Why:      The change-sensitivity assertions below (`assertNotEquals(first, fingerprint(...))`)
//           need it.
// TS map:   `import { assertNotEquals } from "...";` — equivalently `expect(a).not.toEqual(b)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertNotEquals } from "@junit/assert";
// ```
import org.junit.Assert.assertNotEquals

// What:     `import org.junit.Assert.assertNull` imports the static `assertNull` function, which
//           FAILS unless its argument is `null`.
// Why:      The cache-miss assertions below (`assertNull(cache.get(...))`) need it, because
//           `get`/`snapshot[...]` return a nullable `Float?`.
// TS map:   `import { assertNull } from "...";` — equivalently `expect(x).toBeNull()`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertNull } from "@junit/assert";
// ```
import org.junit.Assert.assertNull

// What:     `import org.junit.Assert.assertTrue` imports the static `assertTrue` function
//           (asserts a `Boolean` is `true`).
// Why:      Imported for symmetry with the assertion family; used where a positive boolean
//           condition must hold.
// TS map:   `import { assertTrue } from "...";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertTrue } from "@junit/assert";
// ```
import org.junit.Assert.assertTrue

// What:     `import org.junit.Test` imports the `Test` ANNOTATION class (a type) used as the
//           `@Test` marker on each test method; the runner runs every method tagged with it.
// Why:      Without it we could not write `@Test`, and the runner would find no tests.
// TS map:   No JUnit-style annotation; mentally each `@Test fun foo()` is a
//           `test("foo", () => { ... })`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from "vitest"; // each @Test method becomes a test("...", () => {...})
// ```
import org.junit.Test

// =============================================================================
// File summary (folds in the old class KDoc's domain content)
// =============================================================================
//
// Host-JVM unit tests for `fingerprint` and `PeakCache`, ported from the desktop player's
// `peakcache_tests.rs` so the Kotlin port stays faithful to the Rust behaviour.
//
// Both Rust tests reach the disk: the first stats a real temp file for size and mtime; the
// second round-trips the cache through a temp JSON file. Filesystem and JSON are platform I/O
// and are deferred from this pure port, so each test is adapted to drive the pure surface
// directly: feeding fixed (path, size, mtime) vectors instead of stat'ing a file, and
// exercising the in-memory map instead of save/reload. The expected fingerprints are the exact
// 64-bit FNV-1a outputs of the Rust key material (path UTF-8 bytes, then size as 8
// little-endian bytes, then mtime as 16 little-endian bytes). The cases pin: fingerprint
// determinism, opacity (a 16-char hex key that does not leak the path), change-sensitivity to
// size/mtime/path, in-memory insert/get hit and miss, and snapshot being a defensive copy.

// What:     `class PeakCacheTest { ... }` declares a JUnit 4 test class the runner instantiates
//           to invoke each `@Test`-marked method. It also holds one private FIELD (`trackPath`)
//           shared across the fingerprint vectors.
// Why:      Groups every peak-cache test plus the shared path fixture.
// TS map:   `describe("PeakCache", () => { ... })`; the shared `trackPath` would be a `const`
//           declared inside that block.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("PeakCache", () => {
//   // ...shared trackPath + each @Test fun become a const / test(...) calls inside here...
// });
// ```
class PeakCacheTest {
    // What:     `private val trackPath: String = "/music/Artist/Album/a.flac"` declares a
    //           class-private, read-only (`val`, not `var`) FIELD `trackPath` of explicit type
    //           `String`, initialised to a fixed path literal.
    // Why:      One path reused across the fingerprint vectors; its basename `a.flac` stands in
    //           for the Rust temp file's suffix, so the opacity assertion checks the same leak
    //           the Rust test guards (the path must not appear in the hex key).
    // TS map:   `private trackPath: string = "/music/Artist/Album/a.flac";` (a class field), or
    //           a `const trackPath = "..."` inside the describe block.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const trackPath = "/music/Artist/Album/a.flac";
    // ```
    private val trackPath: String = "/music/Artist/Album/a.flac"

    // What:     `@Test` is an ANNOTATION (metadata, no code) marking the method below as a test
    //           the JUnit runner executes and reports.
    // Why:      Registers `fingerprintIsStableOpaqueAndChangeSensitive` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("fingerprint is stable, opaque, and change-sensitive", () => {
    // ```
    @Test
    // What:     `fun fingerprintIsStableOpaqueAndChangeSensitive() { ... }` declares a
    //           no-parameter test method returning `Unit` (Kotlin's "void"), block body. The
    //           name is the report label.
    // Why:      Adapted from the Rust `fingerprint_is_stable_opaque_and_change_sensitive`: pins
    //           DETERMINISM (same inputs -> same key), OPACITY (a 16-char hex key that does not
    //           leak the path), and CHANGE-SENSITIVITY to size and mtime (and path). The Rust
    //           file-stat and its missing-file `None` branch are deferred with the I/O layer.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun fingerprintIsStableOpaqueAndChangeSensitive() {
        // What:     `val size = 5uL` declares a read-only local `size`. The literal `5uL` has the
        //           `uL` suffix: `u` makes it UNSIGNED, `L` makes it 64-bit-wide, so the type is
        //           `ULong` (unsigned 64-bit integer), inferred from the literal. Siblings the
        //           reader might expect: `5L` (signed `Long`), `5u` (`UInt`, 32-bit unsigned), `5`
        //           (plain `Int`).
        // Why:      A fixed file size (5 bytes) feeding `fingerprint`, whose `size` parameter is
        //           `ULong`. `ULong` (not `Long`/`UInt`) is required because the function's
        //           signature is `ULong` and the byte serialisation depends on the unsigned 64-bit
        //           width.
        // TS map:   `const size = 5n;` — TS has no unsigned integer type; `bigint` (the `n`
        //           suffix) is the closest 64-bit-capable analogue, though it is signed and
        //           arbitrary-precision.
        // Gotcha:   `5uL` is `ULong`, NOT `Int` and NOT TS `number`. A plain `5` would be `Int` and
        //           would not match the `ULong` parameter without conversion.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const size = 5n; // bigint stands in for Kotlin's ULong
        // ```
        val size = 5uL
        // What:     `val mtimeNanos = 1_000_000_000uL` declares a read-only `ULong` local. The
        //           `uL` suffix again makes it `ULong`. The UNDERSCORES `_` are DIGIT SEPARATORS:
        //           they are ignored by the compiler and only group digits for human readability
        //           (one billion nanoseconds = 1 second).
        // Why:      A fixed modified-time (1 second past the epoch, in nanoseconds) feeding
        //           `fingerprint`, whose `mtimeNanos` parameter is `ULong`.
        // TS map:   `const mtimeNanos = 1_000_000_000n;` — TS bigint also allows `_` separators.
        // Gotcha:   `_` are cosmetic; `1_000_000_000uL` is the single value 1000000000 as a
        //           `ULong`, not multiple tokens.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const mtimeNanos = 1_000_000_000n;
        // ```
        val mtimeNanos = 1_000_000_000uL

        // What:     `val first = fingerprint(trackPath, size, mtimeNanos)` declares a read-only
        //           `String` local `first` (type inferred from `fingerprint`'s `String` return),
        //           holding the fingerprint of the baseline (path, size, mtime) vector.
        // Why:      Compute the reference key once; later assertions compare other keys against it.
        // TS map:   `const first = fingerprint(trackPath, size, mtimeNanos);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const first = fingerprint(trackPath, size, mtimeNanos);
        // ```
        val first = fingerprint(trackPath, size, mtimeNanos)
        // What:     `assertEquals(first, fingerprint(trackPath, size, mtimeNanos))` is
        //           `assertEquals(expected, actual)`: EXPECTED is `first` (the reference key);
        //           ACTUAL is a SECOND call with the SAME inputs. (Folds in the original note:
        //           same inputs fingerprint identically; determinism for cache hits.)
        // Why:      Prove the fingerprint is deterministic: identical inputs yield an identical
        //           key, which is what makes a cache lookup hit.
        // TS map:   `expect(fingerprint(trackPath, size, mtimeNanos)).toEqual(first);` — JUnit
        //           puts EXPECTED first, opposite of `expect(actual)`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(fingerprint(trackPath, size, mtimeNanos)).toEqual(first);
        // ```
        assertEquals(first, fingerprint(trackPath, size, mtimeNanos))
        // What:     `assertEquals("75553bb5d36767ef", first)` is `assertEquals(expected, actual)`:
        //           EXPECTED is the literal hex string, ACTUAL is `first`. (Folds in the original
        //           note: the key is the exact Rust 64-bit FNV-1a output for this material.)
        // Why:      Pin the EXACT cross-language output, proving the Kotlin byte assembly + FNV-1a
        //           hash reproduce the desktop Rust result bit-for-bit.
        // TS map:   `expect(first).toEqual("75553bb5d36767ef");`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(first).toEqual("75553bb5d36767ef");
        // ```
        assertEquals("75553bb5d36767ef", first)
        // What:     `assertEquals(16, first.length)` is `assertEquals(expected, actual)`: EXPECTED
        //           is the `Int` literal `16`; ACTUAL is `first.length`, the `Int` character count
        //           of the string. (Folds in the original note: the key is a 16-char hex string,
        //           not the path; no metadata exposed.)
        // Why:      Confirm the key is exactly 16 hex digits wide (a zero-padded 64-bit hash), not
        //           a path-derived string of varying length.
        // TS map:   `expect(first.length).toEqual(16);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(first.length).toEqual(16);
        // ```
        assertEquals(16, first.length)
        // What:     `assertFalse(first.contains("a.flac"))` is the SINGLE-argument
        //           `assertFalse(condition)`. The condition `first.contains("a.flac")` uses the
        //           `String` overload of `.contains` (substring search) to ask whether the key
        //           leaks the track's basename.
        // Why:      Opacity: the hex key must NOT contain the path's `a.flac`, proving the
        //           fingerprint is a one-way hash that exposes no filesystem metadata.
        // TS map:   `expect(first.includes("a.flac")).toBe(false);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(first.includes("a.flac")).toBe(false);
        // ```
        assertFalse(first.contains("a.flac"))

        // What:     `assertNotEquals(first, fingerprint(trackPath, 6uL, mtimeNanos))` calls
        //           `assertNotEquals(unexpected, actual)`, which FAILS unless the two DIFFER. The
        //           ACTUAL fingerprints the SAME path and mtime but a DIFFERENT size: `6uL` (a
        //           `ULong` literal, vs the baseline `5uL`). (Folds in the original note: a size
        //           change, i.e. a re-encode, changes the key.)
        // Why:      Prove the key is sensitive to file size, so a re-encoded file (new size)
        //           invalidates the stale cache entry.
        // TS map:   `expect(fingerprint(trackPath, 6n, mtimeNanos)).not.toEqual(first);`
        // Gotcha:   `assertNotEquals(a, b)` is the "must differ" assertion; do not read it as
        //           `assertEquals`. `6uL` is a `ULong`, like `5uL`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(fingerprint(trackPath, 6n, mtimeNanos)).not.toEqual(first);
        // ```
        assertNotEquals(first, fingerprint(trackPath, 6uL, mtimeNanos))
        // What:     `assertNotEquals(first, fingerprint(trackPath, size, 2_000_000_000uL))` is the
        //           "must differ" assertion. The ACTUAL keeps the path and size but uses a
        //           DIFFERENT mtime: `2_000_000_000uL` (a `ULong`, 2 seconds, vs the baseline 1
        //           second). (Folds in the original note: an mtime change, i.e. an in-place edit,
        //           changes the key.)
        // Why:      Prove the key is sensitive to modified-time, so an in-place edit (same size,
        //           new mtime) still invalidates the stale entry.
        // TS map:   `expect(fingerprint(trackPath, size, 2_000_000_000n)).not.toEqual(first);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(fingerprint(trackPath, size, 2_000_000_000n)).not.toEqual(first);
        // ```
        assertNotEquals(first, fingerprint(trackPath, size, 2_000_000_000uL))
        // What:     `assertNotEquals(first, fingerprint("/music/Artist/Album/b.flac", size, mtimeNanos))`
        //           is the "must differ" assertion. The ACTUAL keeps size and mtime but uses a
        //           DIFFERENT path (`b.flac` instead of `a.flac`). (Folds in the original note: a
        //           path change changes the key.)
        // Why:      Prove the key is sensitive to the path, so two different tracks with identical
        //           size and mtime still get distinct cache keys.
        // TS map:   `expect(fingerprint("/music/Artist/Album/b.flac", size, mtimeNanos)).not.toEqual(first);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(fingerprint("/music/Artist/Album/b.flac", size, mtimeNanos)).not.toEqual(first);
        // ```
        assertNotEquals(first, fingerprint("/music/Artist/Album/b.flac", size, mtimeNanos))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `insertAndGetPreservesEntries` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("insert and get preserves entries", () => {
    // ```
    @Test
    // What:     `fun insertAndGetPreservesEntries() { ... }` declares a no-arg `Unit`-returning
    //           test method, block body.
    // Why:      Adapted from the Rust `save_and_reload_preserves_entries_without_metadata`: the
    //           pure in-memory map preserves an inserted entry and reports a MISS for an absent
    //           key. The disk save/reload and on-disk privacy assertions are deferred with the
    //           JSON layer; key opacity is covered by the fingerprint test above.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun insertAndGetPreservesEntries() {
        // What:     `val cache = PeakCache()` declares a read-only local `cache` and constructs a
        //           fresh `PeakCache`. `PeakCache()` is a CONSTRUCTOR CALL: in Kotlin you call a
        //           constructor like a function, with NO `new` keyword. The default empty
        //           constructor makes an empty cache.
        // Why:      A fresh, empty cache to insert into and query.
        // TS map:   `const cache = new PeakCache();` — TS requires `new`; Kotlin omits it.
        // Gotcha:   `PeakCache()` looks like a function call but is `new PeakCache()`; a TS reader
        //           expecting `new` must remember Kotlin drops it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const cache = new PeakCache();
        // ```
        val cache = PeakCache()

        // What:     `cache.insert("deadbeef00000000", 0.75f)` calls the `insert` method with a
        //           hex key and a peak value. `0.75f` has the `f` suffix, making it a `Float`
        //           (32-bit IEEE-754). Sibling: `0.75` with NO suffix is a `Double` (64-bit) in
        //           Kotlin. (Folds in the original note: inserting a peak makes it retrievable by
        //           its key.)
        // Why:      Store a measured peak under a key so the next line can read it back.
        // TS map:   `cache.insert("deadbeef00000000", 0.75);` — TS has only `number` (double), so
        //           the `Float`-vs-`Double` choice does not exist there.
        // Gotcha:   The `f` suffix is load-bearing: `0.75` (no `f`) is a `Double` and would NOT
        //           match `insert`'s `Float` parameter without conversion.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // cache.insert("deadbeef00000000", 0.75); // TS number blurs Float vs Double
        // ```
        cache.insert("deadbeef00000000", 0.75f)
        // What:     `assertEquals(0.75f, cache.get("deadbeef00000000"))` is
        //           `assertEquals(expected, actual)`: EXPECTED is the `Float` literal `0.75f`;
        //           ACTUAL is `cache.get(...)`, which returns `Float?` (a `Float` OR `null`) for
        //           the key just inserted.
        // Why:      Prove a just-inserted key reads back the exact value stored (a cache hit).
        // TS map:   `expect(cache.get("deadbeef00000000")).toEqual(0.75);` — Kotlin's `Float?` is
        //           TS's `number | undefined`.
        // Gotcha:   Comparing floats by EXACT equality (no tolerance) is safe HERE only because
        //           the value is stored and read back unchanged (no arithmetic alters the bits);
        //           for computed floats you would need a delta.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(cache.get("deadbeef00000000")).toEqual(0.75);
        // ```
        assertEquals(0.75f, cache.get("deadbeef00000000"))

        // What:     `assertNull(cache.get("0000000000000000"))` calls `assertNull(value)`, which
        //           FAILS unless its argument is `null`. The argument `cache.get(...)` looks up a
        //           key that was never inserted, so it returns the `null` variant of `Float?`.
        //           (Folds in the original note: a key that was never inserted is a miss.)
        // Why:      Prove a missing key is a clean MISS (`null`), so the caller knows to measure
        //           the track instead.
        // TS map:   `expect(cache.get("0000000000000000")).toBeNull();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(cache.get("0000000000000000")).toBeNull();
        // ```
        assertNull(cache.get("0000000000000000"))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `snapshotCopiesEntries` with the runner.
    // TS map:   The `test("...", () => {` wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("snapshot copies entries", () => {
    // ```
    @Test
    // What:     `fun snapshotCopiesEntries() { ... }` declares a no-arg `Unit`-returning test
    //           method, block body.
    // Why:      Pins that `PeakCache.snapshot` returns EVERY inserted entry (so the persistence
    //           layer can serialise the whole cache) AND is a DEFENSIVE COPY: a later insert does
    //           not change an earlier snapshot, keeping `insert` the only mutation path.
    // TS map:   `() => { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun snapshotCopiesEntries() {
        // What:     `val cache = PeakCache()` constructs a fresh empty cache (constructor call, no
        //           `new`; see the `insertAndGetPreservesEntries` block for the detail).
        // Why:      A fresh cache to populate and snapshot.
        // TS map:   `const cache = new PeakCache();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const cache = new PeakCache();
        // ```
        val cache = PeakCache()
        // What:     `cache.insert("aaaaaaaaaaaaaaaa", 0.5f)` inserts a peak. `0.5f` is a `Float`
        //           literal (the `f` suffix; sibling `0.5` is a `Double`).
        // Why:      Seed the first entry to appear in the snapshot.
        // TS map:   `cache.insert("aaaaaaaaaaaaaaaa", 0.5);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // cache.insert("aaaaaaaaaaaaaaaa", 0.5);
        // ```
        cache.insert("aaaaaaaaaaaaaaaa", 0.5f)
        // What:     `cache.insert("bbbbbbbbbbbbbbbb", 0.9f)` inserts a second peak; `0.9f` is again
        //           a `Float` literal.
        // Why:      Seed the second entry so the snapshot should hold two.
        // TS map:   `cache.insert("bbbbbbbbbbbbbbbb", 0.9);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // cache.insert("bbbbbbbbbbbbbbbb", 0.9);
        // ```
        cache.insert("bbbbbbbbbbbbbbbb", 0.9f)

        // What:     `val snapshot = cache.snapshot()` declares a read-only local `snapshot`
        //           holding the result of `snapshot()`, which returns a READ-ONLY `Map<String,
        //           Float>` (a defensive COPY of the cache's entries, not the live mutable map).
        // Why:      Capture a copy of the current entries to assert against, then prove a later
        //           insert does not disturb it.
        // TS map:   `const snapshot = cache.snapshot();` (a `Readonly<Record<string, number>>`).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const snapshot = cache.snapshot();
        // ```
        val snapshot = cache.snapshot()
        // What:     `assertEquals(2, snapshot.size)` is `assertEquals(expected, actual)`: EXPECTED
        //           is the `Int` literal `2`; ACTUAL is `snapshot.size`, the `Int` entry count of
        //           the map.
        // Why:      Confirm both inserted entries are present in the snapshot.
        // TS map:   `expect(Object.keys(snapshot).length).toEqual(2);` — a TS `Record` has no
        //           `.size`, so you count keys; Kotlin `Map.size` gives it directly.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(Object.keys(snapshot).length).toEqual(2);
        // ```
        assertEquals(2, snapshot.size)
        // What:     `assertEquals(0.5f, snapshot["aaaaaaaaaaaaaaaa"])` is
        //           `assertEquals(expected, actual)`: EXPECTED is the `Float` literal `0.5f`;
        //           ACTUAL is `snapshot["aaaaaaaaaaaaaaaa"]`, the indexed-READ operator on a `Map`
        //           (compiles to `snapshot.get(key)`), returning `Float?` (`null` if absent).
        // Why:      Confirm the first key maps to its inserted value in the snapshot.
        // TS map:   `expect(snapshot["aaaaaaaaaaaaaaaa"]).toEqual(0.5);`
        // Gotcha:   `map[key]` on a Kotlin `Map` yields a NULLABLE value (`Float?`), not a
        //           guaranteed-present one; here the key exists, so it is the `Float` `0.5`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(snapshot["aaaaaaaaaaaaaaaa"]).toEqual(0.5);
        // ```
        assertEquals(0.5f, snapshot["aaaaaaaaaaaaaaaa"])
        // What:     `assertEquals(0.9f, snapshot["bbbbbbbbbbbbbbbb"])` is the same shape: EXPECTED
        //           `Float` `0.9f`, ACTUAL the map index read (`Float?`) for the second key.
        // Why:      Confirm the second key maps to its inserted value.
        // TS map:   `expect(snapshot["bbbbbbbbbbbbbbbb"]).toEqual(0.9);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(snapshot["bbbbbbbbbbbbbbbb"]).toEqual(0.9);
        // ```
        assertEquals(0.9f, snapshot["bbbbbbbbbbbbbbbb"])

        // What:     `cache.insert("cccccccccccccccc", 0.7f)` inserts a THIRD peak AFTER the
        //           snapshot was taken; `0.7f` is a `Float` literal. (Folds in the original note: a
        //           later insert does not appear in the earlier snapshot, because it is a copy,
        //           not the live map.)
        // Why:      Mutate the live cache after snapshotting, to prove the snapshot does not see
        //           the change.
        // TS map:   `cache.insert("cccccccccccccccc", 0.7);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // cache.insert("cccccccccccccccc", 0.7);
        // ```
        cache.insert("cccccccccccccccc", 0.7f)
        // What:     `assertEquals(2, snapshot.size)` re-asserts the snapshot STILL has 2 entries
        //           (EXPECTED `Int` `2`, ACTUAL `snapshot.size`), even though the live cache now
        //           has 3.
        // Why:      Prove the snapshot is a frozen copy: the post-snapshot insert did not grow it.
        // TS map:   `expect(Object.keys(snapshot).length).toEqual(2);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(Object.keys(snapshot).length).toEqual(2);
        // ```
        assertEquals(2, snapshot.size)
        // What:     `assertNull(snapshot["cccccccccccccccc"])` calls `assertNull(value)`, which
        //           FAILS unless its argument is `null`. The argument `snapshot["ccc..."]` is the
        //           map index read for the key inserted AFTER the snapshot; it is absent from the
        //           copy, so the read returns `null`.
        // Why:      Confirm the post-snapshot key is NOT in the snapshot, proving `snapshot()`
        //           returns a defensive copy rather than a live view of the cache.
        // TS map:   `expect(snapshot["cccccccccccccccc"]).toBeUndefined();` — Kotlin yields `null`
        //           for an absent map key; TS yields `undefined`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(snapshot["cccccccccccccccc"]).toBeUndefined();
        // ```
        assertNull(snapshot["cccccccccccccccc"])
    }
}
