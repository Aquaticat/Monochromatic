// What:     `package dev.monochromatic.musicplayer.core` names the namespace this test file
//           lives under. It is the SAME package as the code under test (`PeakCache.kt`), so
//           this file calls `fingerprint` and uses `PeakCache` by their short names with no
//           import. The package must mirror the directory path.
// Why:      Sharing the package lets the tests reach the package-level `fingerprint` function
//           and the `PeakCache` class without importing them; test and main source sets merge
//           into one package at compile time.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path IS the module; here it shares a namespace with the SUT.
// ```
package dev.monochromatic.musicplayer.core

// What:     `import org.junit.Assert.assertEquals` imports the static `assertEquals` function
//           from JUnit 4's `org.junit.Assert` class, callable unqualified.
// Why:      The value-equality assertions below need it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertEquals } from "@junit/assert";
// ```
import org.junit.Assert.assertEquals

// What:     `import org.junit.Assert.assertNull` imports the static `assertNull` function, which
//           FAILS unless its argument is `null`.
// Why:      The cache-miss assertions below (`assertNull(cache.get(...))`) need it, because
//           `get`/`snapshot[...]` return a nullable `Float?`.
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
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertTrue } from "@junit/assert";
// ```
import org.junit.Assert.assertTrue

// What:     `import org.junit.Test` imports the `Test` ANNOTATION class (a type) used as the
//           `@Test` marker on each test method; the runner runs every method tagged with it.
// Why:      Without it we could not write `@Test`, and the runner would find no tests.
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
//
// In TS you'd write (pseudocode):
// ```ts
// describe("PeakCache", () => {
//   // ...shared trackPath + each @Test fun become a const / test(...) calls inside here...
// });
// ```
class PeakCacheTest {
    // What:     The host-side fingerprint test moved to an on-device instrumented test. The
    //           fingerprint hash is now `gxhash` (hardware AES, no JVM port), computed in the
    //           native crate and reached through `NativeBridge.nativeFingerprint`, so it can only
    //           run on the device. Its determinism / opacity / change-sensitivity assertions now
    //           live in `androidTest`'s `NativeBridgeTest.fingerprintIsDeterministicOpaqueAndChangeSensitiveOnDevice`.
    // Why:      Keep this host suite to the PURE in-memory `PeakCache` map; nothing here calls the
    //           native fingerprint, so no native library is loaded in the host JVM.

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `insertAndGetPreservesEntries` with the runner.
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
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(cache.get("0000000000000000")).toBeNull();
        // ```
        assertNull(cache.get("0000000000000000"))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `snapshotCopiesEntries` with the runner.
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
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun snapshotCopiesEntries() {
        // What:     `val cache = PeakCache()` constructs a fresh empty cache (constructor call, no
        //           `new`; see the `insertAndGetPreservesEntries` block for the detail).
        // Why:      A fresh cache to populate and snapshot.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const cache = new PeakCache();
        // ```
        val cache = PeakCache()
        // What:     `cache.insert("aaaaaaaaaaaaaaaa", 0.5f)` inserts a peak. `0.5f` is a `Float`
        //           literal (the `f` suffix; sibling `0.5` is a `Double`).
        // Why:      Seed the first entry to appear in the snapshot.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // cache.insert("aaaaaaaaaaaaaaaa", 0.5);
        // ```
        cache.insert("aaaaaaaaaaaaaaaa", 0.5f)
        // What:     `cache.insert("bbbbbbbbbbbbbbbb", 0.9f)` inserts a second peak; `0.9f` is again
        //           a `Float` literal.
        // Why:      Seed the second entry so the snapshot should hold two.
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
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(snapshot["cccccccccccccccc"]).toBeUndefined();
        // ```
        assertNull(snapshot["cccccccccccccccc"])
    }
}
