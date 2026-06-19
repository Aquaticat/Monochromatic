// File summary (folds in the old KDoc's domain content):
//
// Pure in-memory memoization of measured true peaks: the `fingerprint -> peak` map, a faithful port
// of the PURE part of the desktop's `peakcache.rs`.
//
// Measuring a track's true peak means decoding the whole audio file, which is slow, so the desktop
// persists a `fingerprint -> peak` map to disk and measures each track at most once. Privacy: the
// fingerprint is a one-way hash of (path, size, mtime), so no filename, path, or tag ever lands on
// disk; the saved cache reveals nothing about which tracks the user has.
//
// This file used to ALSO carry the fingerprint hash (a 64-bit FNV-1a in pure Kotlin). That hash is
// now `gxhash`, which has NO JVM/Kotlin port, so the fingerprint computation moved into the native
// crate (`rust/src/fingerprint.rs`) and is reached through `NativeBridge.nativeFingerprint`. What
// remains here is ONLY the in-memory `PeakCache` map (`get` / `insert` / `snapshot`). The desktop's
// on-disk JSON load/save, the config-directory resolution, the unsaved-insert counter, and the
// atomic-write/idle-sweep machinery are platform I/O and are deferred to the integration layer; do
// NOT expect this file to mention hashing, paths, locks, or saving (those live in the Rust twins).
//
// What:     `package dev.monochromatic.musicplayer.core` names the package (namespace) every
//           declaration in this file belongs to. It mirrors the directory path
//           `dev/monochromatic/musicplayer/core/`. Unlike a TS module, there is no `import` line
//           that pulls this file in; other files in the SAME package see these declarations with no
//           import at all, and other packages reference them as
//           `dev.monochromatic.musicplayer.core.PeakCache`.
// Why:      Kotlin requires a package declaration so the JVM knows the fully-qualified names of the
//           classes and top-level functions compiled from this file.
//
// In TS you'd write (pseudocode):
// ```ts
// // No 1:1 equivalent. Closest: this file lives in the `core/` module folder and its exports are
// // visible to sibling files in the same folder without an import statement.
// ```
package dev.monochromatic.musicplayer.core

// What:     `class PeakCache { ... }` declares a class named `PeakCache`. There is no `private`, so
//           it is public to other packages. With no `()` after the name it has the default empty
//           constructor (no fields set from outside). The `{ ... }` holds its single field and its
//           methods.
// Why:      The in-memory peak cache: a `fingerprint -> measured-true-peak` map, a faithful port of
//           the PURE part of the desktop's `PeakCache`. The desktop additionally tracks a
//           persistence path and an unsaved-insert counter for batched disk writes; those belong to
//           the deferred on-disk layer and are intentionally OMITTED here, so this type owns only the
//           query/insert/snapshot behaviour the pure tests exercise. Do not expect `path`,
//           `unsaved`, `save`, or locking in this port.
//
// In TS you'd write (pseudocode):
// ```ts
// class PeakCache {
//   private map: Record<string, number> = {};
//   get(fingerprint: string): number | undefined { ... }
//   insert(fingerprint: string, peak: number): void { ... }
//   snapshot(): Record<string, number> { ... }
// }
// ```
/**
 * Defines peak cache type for this music-player component; the TypeScript-oriented notes above explain its role.
 */
class PeakCache {
    // What:     `private val map: MutableMap<String, Float> = mutableMapOf()` declares a
    //           file/class-private, non-reassignable (`val`) field bound to a NEWLY-CREATED empty
    //           mutable hash map. `MutableMap<String, Float>` maps `String` keys (the fingerprint
    //           hex) to `Float` values (the measured peak). `mutableMapOf()` is the factory that
    //           allocates an empty `LinkedHashMap` (sibling factory: `mapOf()` builds a read-only
    //           `Map` with no `.put`). `val` fixes the binding (the map object never swaps) while the
    //           map's CONTENTS stay mutable.
    // Why:      The actual memoized data: the fingerprint -> peak entries. `private` so callers cannot
    //           bypass `insert` and mutate the map directly.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private map: Record<string, number> = {}; // TS `number` blurs the f32/f64 distinction
    // ```
    /**
     * Defines map value for this music-player component; the TypeScript-oriented notes above explain its source
     * and use.
     */
    private val map: MutableMap<String, Float> = mutableMapOf()

    // What:     `fun get(fingerprint: String): Float? = map[fingerprint]` declares a public method
    //           `get` taking one `String` parameter and returning `Float?`. The trailing `?` on the
    //           type makes it a NULLABLE `Float`: the value may be a `Float` OR `null`, and Kotlin's
    //           type system forces callers to handle the `null` case. The `=` is an expression body,
    //           so the single expression is the return value. `map[fingerprint]` is the indexed-read
    //           operator on a `Map`, which compiles to `map.get(fingerprint)` and returns `null` when
    //           the key is absent (hence the `?` on the return type).
    // Why:      Look up a cached peak, returning `null` when the key has never been inserted so the
    //           caller knows to measure the track instead.
    // Gotcha:   `map[key]` on a Kotlin `Map` is NOT a guaranteed-present value like a TS object index
    //           you have asserted; the `?` return type is mandatory because the key may be missing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // get(fingerprint: string): number | undefined {
    //   return this.map[fingerprint];
    // }
    // ```
    /**
     * Defines get behavior for this music-player component; the TypeScript-oriented notes above explain its call
     * shape and effects.
     */
    fun get(fingerprint: String): Float? = map[fingerprint]

    // What:     `fun insert(fingerprint: String, peak: Float) { ... }` declares a public method
    //           `insert` taking a `String` key and a `Float` value, with a `{ ... }` block body that
    //           returns nothing (`Unit`/void). `Float` (sibling `Double`) is the 32-bit peak.
    // Why:      Add or replace a cached peak, memoizing a freshly measured value.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // insert(fingerprint: string, peak: number): void {
    //   this.map[fingerprint] = peak;
    // }
    // ```
    /**
     * Defines insert behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    fun insert(fingerprint: String, peak: Float) {
        // What:     `map[fingerprint] = peak` is the indexed-WRITE operator on a `MutableMap`, which
        //           compiles to `map.put(fingerprint, peak)`. It stores or overwrites the entry.
        // Why:      Record the measurement under its fingerprint key.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.map[fingerprint] = peak;
        // ```
        map[fingerprint] = peak
    }

    // What:     `fun snapshot(): Map<String, Float> = map.toMap()` declares a public method
    //           `snapshot` that returns a `Map<String, Float>`. Note the return type is the READ-ONLY
    //           `Map` interface (sibling: the `MutableMap` the field uses), so the caller cannot
    //           mutate what it gets back. The `=` is an expression body. `map.toMap()` builds a fresh
    //           IMMUTABLE copy of the current entries (a defensive copy, not a live view).
    // Why:      Hand the platform persistence layer a snapshot of every cached entry to serialize.
    //           The desktop's `PeakCache` enumerates its entries internally when saving; this pure
    //           port keeps the map private and returns a COPY rather than the live map, so `insert`
    //           stays the only mutation path. A usage from the deferred persistence layer would look
    //           like, in Kotlin:
    //           `JSONObject(cache.snapshot().mapValues { it.value.toDouble() }).toString()`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // snapshot(): Readonly<Record<string, number>> {
    //   return { ...this.map };
    // }
    // ```
    /**
     * Defines snapshot behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    fun snapshot(): Map<String, Float> = map.toMap()
}
