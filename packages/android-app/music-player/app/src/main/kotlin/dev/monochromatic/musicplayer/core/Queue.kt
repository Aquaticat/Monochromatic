// What:     `package dev.monochromatic.musicplayer.core` declares which namespace
//           (logical folder of names) every declaration in this file belongs to.
//           In Kotlin/Java the package name must mirror the directory path under
//           `src/main/kotlin`, so this file physically lives at
//           `.../dev/monochromatic/musicplayer/core/Queue.kt`. Other files refer
//           to `Queue` either by importing `dev.monochromatic.musicplayer.core.Queue`
//           or by sitting in this same package (as the sibling `ShuffleMode`,
//           `Page`, and `paginate` do).
// Why:      Without a package line everything would land in the unnamed "root"
//           package, which Kotlin discourages and which collides as the app grows.
// TS map:   No direct equivalent. TS has no `package` keyword; a module's identity
//           IS its file path, and you `import { Queue } from "./core/Queue"`.
//           Mentally, this line is the compiler-enforced version of "this file is
//           the `core/Queue` module".
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path ./core/Queue.ts IS the module name.
// ```
package dev.monochromatic.musicplayer.core

// What:     `import kotlin.random.Random` pulls the standard-library pseudo-random
//           number generator type `Random` into this file by its short name, so we
//           can write `Random` instead of the fully-qualified `kotlin.random.Random`.
//           `kotlin.random` is the package (namespace) the type lives in; `Random`
//           is the specific class.
// Why:      The queue's shuffle needs a SEEDED random source. `kotlin.random.Random`
//           can be constructed from a fixed `Long` seed, which is exactly what makes
//           the shuffle deterministic (same seed -> same order) for the tests and
//           for session restore.
// TS map:   `import { Random } from "...";` — except JS/TS has no built-in seedable
//           RNG; `Math.random()` cannot be seeded, so the TS analogue would be a
//           small seedable-PRNG class you import.
// Gotcha:   This is NOT the desktop port's xorshift64 PRNG. The desktop (`queue.rs`)
//           hand-rolls a 64-bit xorshift with `^=`/`<<`; this Kotlin port instead
//           leans on the platform's seeded `Random`. The two produce DIFFERENT
//           shuffle sequences; only the "same seed -> same order on THIS platform"
//           guarantee is shared (see the class summary below).
//
// In TS you'd write (pseudocode):
// ```ts
// import { Random } from "./seeded-random"; // a seedable PRNG, since Math.random isn't
// ```
import kotlin.random.Random

// =============================================================================
// File summary (folds in the old class KDoc's domain content)
// =============================================================================
//
// This file defines `Queue`: the play queue, an ordered list of tracks plus a
// cursor, with shuffle and "repeat track" behaviour. It is PURE LOGIC: no audio,
// no I/O, so it is fully unit-tested. It is a faithful port of the desktop's
// `queue.rs`.
//
// Playback has a SCOPE that it loops over, chosen by the shuffle mode (the
// sibling `ShuffleMode` enum):
//
//   - `ShuffleMode.OFF` and `ShuffleMode.WITHIN_PAGE` confine playback to the
//     current track's PAGE: its top-level folder under the loaded root, or its
//     A-Z/`#` letter bucket for a root-level track. This is the same grouping the
//     UI tabs use, computed by the sibling `paginate` function. `OFF` plays the
//     page in load order; `WITHIN_PAGE` shuffles the page. Either way, reaching
//     the end of the page loops back to its start.
//   - `ShuffleMode.ALL` scopes playback to the whole queue, shuffled, and loops
//     the whole queue.
//
// "Repeat track" is independent of the shuffle scope: when on, a track that ends
// NATURALLY replays itself; a manual Next/Prev still moves within the scope.
// Because `OFF`/`WITHIN_PAGE` are page-confined and always loop the page, there is
// deliberately NO way to play the whole queue in load order and loop the whole
// queue; when not shuffling, the user stays inside the current page.
//
// Portability note (a real Gotcha): the desktop's deterministic shuffle uses a
// seeded xorshift64 PRNG. That exact cross-language sequence is not portable, so
// this port shuffles with a seeded `kotlin.random.Random` instead. The same seed
// still yields the same order ON THIS PLATFORM, which is what the tests (and the
// session restore) rely on. Do not assume a given seed reproduces the desktop's
// order; only the within-Kotlin determinism is guaranteed.

// What:     `class Queue private constructor(private val rng: Random) { ... }`
//           declares a class named `Queue`. Several pieces:
//           - `class Queue` is the type itself (a bundle of state + methods).
//           - `private constructor(...)` makes the PRIMARY constructor private:
//             outside code cannot call `Queue(...)` directly; it must go through
//             the `new`/`withRngSeed` factories in the companion object below.
//           - `private val rng: Random` is a constructor parameter that ALSO
//             becomes a private, read-only PROPERTY of the class in one stroke
//             (the `val` keyword on a constructor param is Kotlin shorthand for
//             "store this argument as a field"). `val` = read-only (immutable
//             binding); the sibling `var` would be reassignable. Its type is
//             `Random` (the seeded PRNG imported above).
// Why:      Bundles the queue's state behind methods that keep it consistent, and
//           forces construction through the factories so every queue gets a
//           properly seeded `Random`. Storing `rng` as a field lets `shuffleSlice`
//           draw repeatable random numbers across many calls.
// TS map:   A class with a private constructor and a private readonly field:
//           `class Queue { private constructor(private readonly rng: Random) {} }`.
//           Kotlin's "param with `val` becomes a field" is TS's
//           `constructor(private readonly rng: Random)` parameter-property sugar.
// Gotcha:   The constructor being `private` means `new Queue(rng)` is unreachable
//           from outside; the only doors in are `Queue.new()` and
//           `Queue.withRngSeed(seed)`. (Replaces the old `@constructor`/`@param rng`
//           KDoc: the constructor builds an empty queue driven by the given seeded
//           `Random`; callers use `withRngSeed`/`new` instead of calling it.)
//
// In TS you'd write (pseudocode):
// ```ts
// class Queue {
//   private constructor(private readonly rng: Random) {}
//   // ...state fields and methods below...
// }
// ```
class Queue private constructor(private val rng: Random) {
    //region State
    // What:     `private var tracks: List<String> = emptyList()` declares a private,
    //           REASSIGNABLE field named `tracks`.
    //           - `var` (not `val`) means the field can be pointed at a new list
    //             later (e.g. when the user opens new files).
    //           - `: List<String>` is the type: a READ-ONLY list (interface) of
    //             strings. Siblings the reader might expect: `MutableList<String>`
    //             (a list you can `.add`/`.removeAt`), or `Array<String>` (a
    //             fixed-size array). `List` is chosen because the field is replaced
    //             wholesale, never mutated element-by-element, so the read-only
    //             interface is enough and prevents accidental in-place edits.
    //           - `= emptyList()` is the initial value: a shared, zero-length
    //             read-only list (see the `emptyList()` note below).
    // Why:      Holds the tracks in the order the user loaded them; the displayed
    //           queue list uses this order.
    // TS map:   `private tracks: readonly string[] = [];` — TS's `readonly string[]`
    //           is the `List<String>` analogue; a plain `string[]` would be the
    //           `MutableList` analogue.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private tracks: readonly string[] = [];
    // ```
    private var tracks: List<String> = emptyList()

    // What:     `private var order: List<Int> = emptyList()` declares a private,
    //           reassignable read-only list of integers.
    //           - `List<Int>` holds LOAD-ORDER INDICES (positions into `tracks`),
    //             not the strings themselves. `Int` is a 32-bit signed integer;
    //             siblings: `Long` (64-bit), `Short`, `Byte`. `Int` is right here
    //             because a queue never holds billions of tracks, so 32 bits is
    //             ample and matches every list-index API.
    //           - `emptyList()` again seeds it empty.
    // Why:      This is the CURRENT SCOPE's playback order: the load-order indices of
    //           the tracks playback walks right now (the current page for
    //           `OFF`/`WITHIN_PAGE`, or the whole queue for `ALL`), sequential or
    //           shuffled. Storing indices (not paths) lets the same scope reference
    //           tracks cheaply and keep the `tracks` list as the single source of
    //           truth for the strings.
    // TS map:   `private order: readonly number[] = [];` — TS has only `number`, so
    //           the `Int` vs `Long` distinction collapses.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private order: readonly number[] = [];
    // ```
    private var order: List<Int> = emptyList()

    // What:     `private var pos: Int? = null` declares a private, reassignable field
    //           whose type is `Int?` — a NULLABLE `Int`. The trailing `?` makes the
    //           type "either an `Int` or `null`". The initial value is `null`.
    //           Sibling the reader might expect: a plain non-null `Int` (which could
    //           never represent "nothing selected").
    // Why:      The cursor's POSITION WITHIN `order` (not within `tracks`). `null`
    //           means the queue is empty / nothing is selected. The nullability is
    //           how "no current track" is modelled without a sentinel like `-1`.
    // TS map:   `private pos: number | null = null;`. Kotlin's `Int?` is exactly TS's
    //           `number | null`; the `?` suffix replaces the `| null` union.
    // Gotcha:   `Int?` forces every read to handle the `null` case (via `?.`, `?:`,
    //           or a null check) — the compiler will not let you index `order[pos]`
    //           until you have proven `pos` is non-null. This is Kotlin's
    //           null-safety, stricter than TS unless `strictNullChecks` is on.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private pos: number | null = null;
    // ```
    private var pos: Int? = null

    // What:     `private var shuffle: ShuffleMode = ShuffleMode.OFF` declares a
    //           private, reassignable field of the sibling enum type `ShuffleMode`,
    //           initialised to the enum constant `ShuffleMode.OFF`. `ShuffleMode` is
    //           a three-state enum (`OFF`, `WITHIN_PAGE`, `ALL`); `ShuffleMode.OFF`
    //           names one specific constant of it.
    // Why:      The three-state shuffle/scope setting; it decides BOTH the scope
    //           (page vs whole queue) and the ordering (sequential vs shuffled).
    //           Defaulting to `OFF` means a fresh queue plays the current page in
    //           load order.
    // TS map:   `private shuffle: ShuffleMode = "off";` if `ShuffleMode` were a string
    //           union, or `ShuffleMode.OFF` if it were a TS enum. A Kotlin `enum`
    //           constant is closest to a TS string-literal-union member.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private shuffle: ShuffleMode = ShuffleMode.OFF;
    // ```
    private var shuffle: ShuffleMode = ShuffleMode.OFF

    // What:     `private var repeatTrackFlag: Boolean = false` declares a private,
    //           reassignable boolean field, initialised `false`. `Boolean` is
    //           Kotlin's true/false type (capital `B`); there are no integer
    //           siblings to confuse it with here.
    // Why:      When true, a track that ends naturally replays itself; this is the
    //           "repeat track" checkbox state. It is independent of the shuffle
    //           scope, which is why it lives in its own field.
    // TS map:   `private repeatTrackFlag = false;` — `Boolean` is TS's `boolean`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private repeatTrackFlag: boolean = false;
    // ```
    private var repeatTrackFlag: Boolean = false
    //endregion

    //region Factories
    // What:     `companion object { ... }` declares a single, file-private OBJECT
    //           attached to the `Queue` class. A "companion object" is Kotlin's way
    //           to hang STATIC-LIKE members (functions/values that belong to the
    //           class itself, not to an instance) off a class. Members declared
    //           inside it are called as `Queue.new()` / `Queue.withRngSeed(...)`,
    //           exactly like static methods.
    // Why:      It hosts the public factory functions that mirror the desktop Rust
    //           `new` / `with_rng_seed` constructors. Because the primary
    //           constructor is private, these factories are the only way to build a
    //           `Queue`; they live here so they can reach the private constructor.
    // TS map:   TS has no `companion object`; you would use `static` methods on the
    //           class: `class Queue { static new() {...} static withRngSeed(s) {...} }`.
    //           Mentally, "everything inside `companion object` is a `static` member
    //           of `Queue`".
    // Gotcha:   The companion is itself an object instance (you could name it), but
    //           here it is anonymous and used purely as a static-method bag. Calling
    //           `Queue.new()` does NOT create the companion each time; there is
    //           exactly one companion per class.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // static factory methods on the Queue class:
    // //   static new(): Queue { ... }
    // //   static withRngSeed(seed: bigint): Queue { ... }
    // ```
    companion object {
        // What:     `fun new(): Queue = withRngSeed(System.nanoTime())` declares a
        //           companion (static-like) function named `new` taking no
        //           parameters and returning a `Queue`. The `= expr` form is an
        //           EXPRESSION BODY: the single expression after `=` IS the return
        //           value (no `return` keyword, no braces).
        //           - `System.nanoTime()` is a Java-interop call: `System` is the
        //             java.lang class, `nanoTime()` returns a `Long` (64-bit signed
        //             integer) high-resolution timestamp.
        //           - `withRngSeed(...)` is the sibling factory, called with that
        //             timestamp as the seed; its result is `new`'s result.
        // Why:      Creates an empty queue seeded from the wall clock so first-run
        //           shuffles differ between launches (each launch's `nanoTime` is
        //           different). Mirrors the Rust `Queue::new`.
        // TS map:   `static new(): Queue { return Queue.withRngSeed(BigInt(performance.now())); }`
        //           — `System.nanoTime()` is roughly `performance.now()` but returns
        //           a `Long`, not a float; the expression-body `=` is TS's
        //           single-`return` arrow.
        // Gotcha:   `System.nanoTime()` returns a `Long`, NOT an `Int`; it is a
        //           nanosecond counter that easily exceeds 32 bits. Feeding it
        //           straight into `withRngSeed(seed: Long)` is why that parameter is
        //           `Long`, not `Int`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // static new(): Queue {
        //   return Queue.withRngSeed(BigInt(performance.now())); // nondeterministic seed
        // }
        // ```
        fun new(): Queue = withRngSeed(System.nanoTime())

        // What:     `fun withRngSeed(seed: Long): Queue = Queue(Random(seed))` declares
        //           a companion factory taking one parameter and returning a `Queue`,
        //           again as an expression body (`= expr` is the return).
        //           - `seed: Long` is the parameter: a 64-bit signed integer seed.
        //             Sibling `Int` (32-bit) is declined because `System.nanoTime()`
        //             above overflows 32 bits, and a wider seed gives more shuffle
        //             entropy.
        //           - `Random(seed)` is a CONSTRUCTOR CALL on the imported `Random`
        //             type: it builds a seeded PRNG. (In Kotlin you call a constructor
        //             just like a function, no `new` keyword.)
        //           - `Queue(...)` then calls the PRIVATE primary constructor with
        //             that `Random`, producing the empty queue. The companion can
        //             reach the private constructor because it is nested inside the
        //             class.
        // Why:      Creates an empty queue with a CALLER-CHOSEN PRNG seed, mirroring
        //           the Rust `Queue::with_rng_seed`; tests pass a fixed seed to get a
        //           deterministic shuffle (same seed -> same order).
        // TS map:   `static withRngSeed(seed: bigint): Queue { return new Queue(new Random(seed)); }`
        //           — but TS would need `new` for both constructions; Kotlin omits it.
        // Gotcha:   No `new` keyword anywhere: `Random(seed)` constructs a `Random`,
        //           and `Queue(...)` constructs a `Queue`. A TS reader expects `new`;
        //           Kotlin constructor calls look identical to function calls.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // static withRngSeed(seed: bigint): Queue {
        //   return new Queue(new Random(seed)); // same seed -> same shuffle order
        // }
        // ```
        fun withRngSeed(seed: Long): Queue = Queue(Random(seed))
    }
    //endregion

    //region Read-only accessors
    // What:     `fun len(): Int = tracks.size` declares an INSTANCE method `len`
    //           (no `companion`, so it runs on a `Queue` instance) returning `Int`,
    //           as an expression body. `tracks.size` reads the `.size` property of
    //           the `List<String>` field (its element count, an `Int`); that value
    //           IS the return.
    // Why:      Callers ask how many tracks are in the queue.
    // TS map:   `len(): number { return this.tracks.length; }` — Kotlin's `.size`
    //           on a `List` is TS's `.length` on an array.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // len(): number { return this.tracks.length; }
    // ```
    fun len(): Int = tracks.size

    // What:     `fun tracks(): List<String> = tracks` declares an instance method
    //           `tracks()` returning the read-only `List<String>`, as an expression
    //           body. The body `tracks` (the field) is the return value. Note the
    //           method and the field share the name; `tracks` here resolves to the
    //           field because there is no `tracks(...)` call.
    // Why:      Exposes the tracks in load order (as opened), regardless of shuffle;
    //           the session save persists these. Returning the read-only `List`
    //           interface hands out a view callers cannot mutate.
    // TS map:   `tracks(): readonly string[] { return this.tracks; }` — the
    //           read-only `List<String>` maps to `readonly string[]`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // tracks(): readonly string[] { return this.tracks; }
    // ```
    fun tracks(): List<String> = tracks

    // What:     `fun isEmpty(): Boolean = tracks.isEmpty()` declares an instance
    //           method returning `Boolean`, expression body. `tracks.isEmpty()` is a
    //           stdlib `List` method returning `true` when the list has zero
    //           elements; that boolean is the return.
    // Why:      Convenience predicate for "the queue has no tracks".
    // TS map:   `isEmpty(): boolean { return this.tracks.length === 0; }` — TS arrays
    //           have no `.isEmpty()`, so you compare `.length` to 0.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // isEmpty(): boolean { return this.tracks.length === 0; }
    // ```
    fun isEmpty(): Boolean = tracks.isEmpty()

    // What:     `fun repeatTrack(): Boolean = repeatTrackFlag` declares an instance
    //           method returning `Boolean`, expression body. It simply reads the
    //           `repeatTrackFlag` field and returns it.
    // Why:      Whether "repeat track" is on; the engine mirrors this flag to the UI
    //           checkbox.
    // TS map:   `repeatTrack(): boolean { return this.repeatTrackFlag; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // repeatTrack(): boolean { return this.repeatTrackFlag; }
    // ```
    fun repeatTrack(): Boolean = repeatTrackFlag

    // What:     `fun shuffleMode(): ShuffleMode = shuffle` declares an instance
    //           method returning the sibling enum `ShuffleMode`, expression body.
    //           It reads and returns the `shuffle` field.
    // Why:      The current shuffle mode; the engine mirrors it to the UI radio
    //           group.
    // TS map:   `shuffleMode(): ShuffleMode { return this.shuffle; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // shuffleMode(): ShuffleMode { return this.shuffle; }
    // ```
    fun shuffleMode(): ShuffleMode = shuffle

    // What:     `fun displayPaths(): List<String> = relativeDisplayPaths(tracks)`
    //           declares an instance method returning a read-only `List<String>`,
    //           expression body. `relativeDisplayPaths(tracks)` calls the sibling
    //           package-level function (defined in `RelPath.kt`) with the `tracks`
    //           field; its result IS the return.
    // Why:      Produces the display strings in load order: each track's path
    //           RELATIVE to the queue's common root, so the UI shows the folder a
    //           track lives in and pagination can group by folder. Delegating to the
    //           shared helper keeps one source of truth for the common-prefix
    //           stripping (unit-tested in `RelPath.kt`).
    // TS map:   `displayPaths(): string[] { return relativeDisplayPaths(this.tracks); }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // displayPaths(): string[] { return relativeDisplayPaths(this.tracks); }
    // ```
    fun displayPaths(): List<String> = relativeDisplayPaths(tracks)

    // What:     `fun currentIndex(): Int? = pos?.let { order[it] }` declares an
    //           instance method returning a NULLABLE `Int?`, expression body. The
    //           body is symbol-dense:
    //           - `pos` is the `Int?` cursor (position within `order`, or `null`).
    //           - `?.` is the SAFE-CALL operator: `pos?.let { ... }` runs the `.let`
    //             ONLY when `pos` is non-null; when `pos` is `null` the whole
    //             expression short-circuits to `null` (so `null` is the return).
    //           - `.let { ... }` is a scope function: it invokes the trailing lambda
    //             with the (now non-null) receiver as its single implicit argument.
    //           - `{ order[it] }` is that TRAILING LAMBDA. `it` is Kotlin's implicit
    //             name for the lambda's single parameter (here the non-null `pos`
    //             value). `order[it]` indexes the `order` list at that position,
    //             yielding the LOAD-ORDER index stored there.
    // Why:      Translates the cursor's position-within-`order` into the load-order
    //           index of the current track (into `tracks`), or `null` when nothing
    //           is selected; the UI highlights this row.
    // TS map:   `currentIndex(): number | null { return this.pos === null ? null : this.order[this.pos]; }`
    //           — `pos?.let { order[it] }` is exactly "if pos is null return null,
    //           else compute `order[pos]`".
    // Gotcha:   `?.let { order[it] }` is the idiomatic Kotlin way to "map over a
    //           nullable". The `it` is auto-named; it is the non-null `pos`. This is
    //           NOT a loop — `.let` runs the block at most once.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // currentIndex(): number | null {
    //   return this.pos === null ? null : this.order[this.pos];
    // }
    // ```
    fun currentIndex(): Int? = pos?.let { order[it] }

    // What:     `fun currentPath(): String? = currentIndex()?.let { tracks[it] }`
    //           declares an instance method returning a NULLABLE `String?`,
    //           expression body. Same shape as `currentIndex`:
    //           - `currentIndex()` returns `Int?` (the current track's load-order
    //             index, or `null`).
    //           - `?.let { tracks[it] }` runs only when that index is non-null;
    //             `it` is the non-null index, and `tracks[it]` reads the path string
    //             at that position. When `currentIndex()` is `null`, the whole thing
    //             is `null`.
    // Why:      The path of the current track, or `null`; the engine needs it to open
    //           the file. Chaining off `currentIndex()` reuses the cursor->index
    //           translation rather than duplicating it.
    // TS map:   `currentPath(): string | null { const i = this.currentIndex(); return i === null ? null : this.tracks[i]; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // currentPath(): string | null {
    //   const i = this.currentIndex();
    //   return i === null ? null : this.tracks[i];
    // }
    // ```
    fun currentPath(): String? = currentIndex()?.let { tracks[it] }

    // What:     `fun playbackOrder(): List<Int> = order` declares an instance method
    //           returning the read-only `List<Int>` of load-order indices, expression
    //           body. It returns the `order` field directly.
    // Why:      The current scope's playback order as load-order indices: the sequence
    //           playback walks right now. This is the same order a MediaSession
    //           timeline must report so its (framework-computed) next/previous
    //           navigation matches this queue; position `i` in the result is timeline
    //           window index `i`. (No `queue.rs` twin: this method is
    //           MediaSession-oriented, specific to the Android port.)
    // TS map:   `playbackOrder(): readonly number[] { return this.order; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // playbackOrder(): readonly number[] { return this.order; }
    // ```
    fun playbackOrder(): List<Int> = order

    // What:     `fun cursorPosition(): Int? = pos` declares an instance method
    //           returning the nullable `Int?` cursor, expression body. It returns the
    //           `pos` field as-is (no translation, unlike `currentIndex` which maps
    //           through `order`).
    // Why:      The cursor's POSITION WITHIN `playbackOrder` (the current timeline
    //           window index), or `null` when the queue is empty; the MediaSession
    //           reports this as the current media-item index. (Also no `queue.rs`
    //           twin: MediaSession-specific.)
    // TS map:   `cursorPosition(): number | null { return this.pos; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // cursorPosition(): number | null { return this.pos; }
    // ```
    fun cursorPosition(): Int? = pos
    //endregion

    //region Mutators
    // What:     `fun setRepeatTrack(on: Boolean) { ... }` declares an instance method
    //           taking one `Boolean` parameter `on` and returning nothing (no return
    //           type annotation means the return type is `Unit`, Kotlin's "void").
    //           This uses a BLOCK body `{ ... }`, not an expression body.
    // Why:      Toggle "repeat track"; `advance` reads the flag on a natural end.
    // TS map:   `setRepeatTrack(on: boolean): void { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setRepeatTrack(on: boolean): void { this.repeatTrackFlag = on; }
    // ```
    fun setRepeatTrack(on: Boolean) {
        // What:     `repeatTrackFlag = on` is a plain field assignment: store the
        //           parameter into the `var` field. No Kotlin-specific punctuation.
        // Why:      Record the new flag so `advance` can honour it.
        // TS map:   `this.repeatTrackFlag = on;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.repeatTrackFlag = on;
        // ```
        repeatTrackFlag = on
    }

    // What:     `fun setTracks(newTracks: List<String>) { ... }` declares an instance
    //           method taking one read-only `List<String>` parameter `newTracks` and
    //           returning `Unit` (void), block body. The parameter is the replacement
    //           track list in load order.
    // Why:      Replace the queue when the user opens new files, anchoring playback on
    //           the first track (or leaving it empty when there are no tracks).
    // TS map:   `setTracks(newTracks: readonly string[]): void { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setTracks(newTracks: readonly string[]): void {
    //   this.tracks = newTracks;
    //   this.rebuildScopeOrder(0);
    // }
    // ```
    fun setTracks(newTracks: List<String>) {
        // What:     `tracks = newTracks` reassigns the `var` field to the new list.
        //           Plain assignment; no special punctuation.
        // Why:      Adopt the new track list.
        // TS map:   `this.tracks = newTracks;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.tracks = newTracks;
        // ```
        tracks = newTracks
        // What:     `rebuildScopeOrder(0)` calls the private helper with the literal
        //           anchor `0`. Note `0` is a plain non-null `Int` here, which the
        //           helper accepts as its `Int?` parameter (a non-null value is a
        //           valid `Int?`). The helper itself handles the empty-queue case.
        // Why:      Build the scope order around the first track so playback starts
        //           at the first track's page (or whole queue).
        // TS map:   `this.rebuildScopeOrder(0);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.rebuildScopeOrder(0);
        // ```
        rebuildScopeOrder(0)
    }

    // What:     `fun setShuffle(mode: ShuffleMode) { ... }` declares an instance
    //           method taking one `ShuffleMode` enum parameter `mode`, returning
    //           `Unit` (void), block body.
    // Why:      Change the shuffle/scope mode while keeping the currently-playing
    //           track current, so switching shuffle does not interrupt the current
    //           song. A no-op change is ignored so the cursor never jumps needlessly.
    // TS map:   `setShuffle(mode: ShuffleMode): void { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setShuffle(mode: ShuffleMode): void {
    //   if (mode === this.shuffle) return;
    //   const current = this.currentIndex();
    //   this.shuffle = mode;
    //   this.rebuildScopeOrder(current);
    // }
    // ```
    fun setShuffle(mode: ShuffleMode) {
        // What:     `if (mode == shuffle) return` is an EARLY RETURN guard. `==` on
        //           two enum values is a value/identity comparison (enum constants are
        //           singletons, so `==` checks "same constant"). When the requested
        //           mode equals the current `shuffle`, `return` exits immediately
        //           (returning `Unit`).
        // Why:      Avoid reshuffling and moving the cursor on a no-op mode change.
        // TS map:   `if (mode === this.shuffle) return;`
        // Gotcha:   Kotlin's `==` calls structural equality (`.equals`), but for an
        //           `enum` it behaves exactly like reference equality / TS `===`,
        //           because each enum constant is a unique singleton.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (mode === this.shuffle) return;
        // ```
        if (mode == shuffle) return
        // What:     `val current: Int? = currentIndex()` declares a read-only local
        //           binding `current` (`val` = immutable) with an EXPLICIT type
        //           annotation `Int?` (nullable Int), assigned the result of
        //           `currentIndex()` (the current track's load-order index, or null).
        // Why:      Remember the playing track BEFORE we change the mode and rebuild,
        //           so the rebuild can keep the cursor on the same track.
        // TS map:   `const current: number | null = this.currentIndex();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const current: number | null = this.currentIndex();
        // ```
        val current: Int? = currentIndex()
        // What:     `shuffle = mode` reassigns the `var` field to the new mode.
        // Why:      Record the new mode so `rebuildScopeOrder`/`scopeIndices` read it.
        // TS map:   `this.shuffle = mode;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.shuffle = mode;
        // ```
        shuffle = mode
        // What:     `rebuildScopeOrder(current)` calls the private helper, passing the
        //           remembered `Int?` anchor (which may be `null` for an empty queue;
        //           the helper handles `null` by defaulting to the first track).
        // Why:      Apply the new mode by recomputing the scope order, anchored on the
        //           previously playing track so it stays current.
        // TS map:   `this.rebuildScopeOrder(current);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.rebuildScopeOrder(current);
        // ```
        rebuildScopeOrder(current)
    }

    // What:     `fun playIndex(track: Int): Int? { ... }` declares an instance method
    //           taking one non-null `Int` parameter `track` (a load-order index) and
    //           returning a nullable `Int?`, block body.
    // Why:      Select a specific track as current, switching the playback scope when
    //           the track is on another page; the user clicked a row in the queue
    //           list. Returns the now-current track index, or `null` for an
    //           out-of-range click (which moves nothing).
    // TS map:   `playIndex(track: number): number | null { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // playIndex(track: number): number | null {
    //   if (track >= this.tracks.length) return null;
    //   const position = this.order.indexOf(track);
    //   if (position >= 0) this.pos = position;
    //   else this.rebuildScopeOrder(track);
    //   return track;
    // }
    // ```
    fun playIndex(track: Int): Int? {
        // What:     `if (track >= tracks.size) return null` is an early-return bounds
        //           check. `tracks.size` is the element count; `>=` compares the
        //           clicked index against it. `return null` exits with the `null`
        //           variant of the `Int?` return type.
        // Why:      Ignore an out-of-range click (clicking past the last track moves
        //           nothing).
        // TS map:   `if (track >= this.tracks.length) return null;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (track >= this.tracks.length) return null;
        // ```
        if (track >= tracks.size) return null
        // What:     `val position: Int = order.indexOf(track)` declares a read-only
        //           local `position` with explicit type `Int`. `order.indexOf(track)`
        //           is a stdlib `List` method returning the FIRST index at which
        //           `track` appears in `order`, or `-1` if it is absent.
        // Why:      Find where (if anywhere) the clicked track sits in the CURRENT
        //           scope order, so we can stay in the same scope when possible.
        // TS map:   `const position: number = this.order.indexOf(track);`
        // Gotcha:   `.indexOf` returns `-1` for "not found" (not `null`); the code
        //           below tests `position >= 0` rather than a null check.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const position: number = this.order.indexOf(track);
        // ```
        val position: Int = order.indexOf(track)
        // What:     `if (position >= 0) { ... } else { ... }` is a plain if/else
        //           STATEMENT (used for control flow, not as an expression). The
        //           condition `position >= 0` means "the track is already in the
        //           current scope order".
        // Why:      Branch: if the track is already in this scope, just move the
        //           cursor; otherwise the track is on a different page and the scope
        //           must be rebuilt around it.
        // TS map:   `if (position >= 0) { ... } else { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (position >= 0) { this.pos = position; } else { this.rebuildScopeOrder(track); }
        // ```
        if (position >= 0) {
            // What:     `pos = position` assigns the found scope position into the
            //           `Int?` cursor field. A non-null `Int` is a valid `Int?`.
            // Why:      Clicking a track already on the current page keeps the page's
            //           (possibly shuffled) order intact; we only move the cursor.
            // TS map:   `this.pos = position;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.pos = position;
            // ```
            pos = position
        } else {
            // What:     `rebuildScopeOrder(track)` calls the private helper with the
            //           clicked load-order index as the anchor (a non-null `Int`
            //           passed to the `Int?` parameter).
            // Why:      The track is on another page (under `OFF`/`WITHIN_PAGE`), so
            //           rebuild the scope around it, switching playback to its page.
            // TS map:   `this.rebuildScopeOrder(track);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.rebuildScopeOrder(track);
            // ```
            rebuildScopeOrder(track)
        }
        // What:     `return track` returns the clicked load-order index. This is an
        //           explicit `return` (block body), returning the non-null `Int`
        //           wrapped as the `Int?` result.
        // Why:      Tell the caller which track is now current so it can load that
        //           index.
        // TS map:   `return track;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return track;
        // ```
        return track
    }

    // What:     `fun advance(natural: Boolean): Int? { ... }` declares an instance
    //           method taking one `Boolean` parameter `natural` and returning a
    //           nullable `Int?`, block body. `natural` is `true` when a track ended
    //           on its own, `false` when the user pressed Next.
    // Why:      Move to the next track within the scope, looping to the scope's start
    //           at the end; a track that ends naturally under "repeat track" replays
    //           itself instead. Only a natural end honours "repeat track". Returns the
    //           load-order index of the track to play next, or `null` when the queue
    //           is empty.
    // TS map:   `advance(natural: boolean): number | null { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // advance(natural: boolean): number | null {
    //   if (this.pos === null) return null;
    //   const current = this.pos;
    //   if (natural && this.repeatTrackFlag) return this.order[current];
    //   const next = current + 1;
    //   if (next < this.order.length) { this.pos = next; return this.order[next]; }
    //   this.pos = 0; return this.order[0];
    // }
    // ```
    fun advance(natural: Boolean): Int? {
        // What:     `val current: Int = pos ?: return null` declares a read-only local
        //           `current` of type `Int`, using the ELVIS operator `?:`.
        //           - `pos` is the `Int?` cursor.
        //           - `?:` (Elvis) means "use the left value if it is non-null,
        //             otherwise evaluate the right side". Here the right side is
        //             `return null`, which exits the whole function. So if `pos` is
        //             non-null, `current` gets its (now `Int`, non-null) value; if
        //             `pos` is `null`, the method returns `null` immediately.
        // Why:      No cursor means the queue is empty / nothing to advance; bail out
        //           early. This also smart-casts away the nullability so `current`
        //           can be used as a plain `Int` below.
        // TS map:   `if (this.pos === null) return null; const current = this.pos;`
        // Gotcha:   `?: return null` is Kotlin's idiomatic "unwrap-or-bail". The right
        //           side of Elvis can be ANY expression, including `return` (which has
        //           type `Nothing`), which is why this compiles as a single line. It
        //           is the close analogue of Rust's `?` operator on an `Option`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.pos === null) return null;
        // const current = this.pos;
        // ```
        val current: Int = pos ?: return null
        // What:     `if (natural && repeatTrackFlag) { ... }` is a control-flow if.
        //           `&&` is logical AND of two booleans; the body runs only when the
        //           track ended naturally AND repeat-track is on.
        // Why:      A track that ends on its own under "repeat track" replays itself
        //           (a manual Next must NOT, which is why `natural` gates it).
        // TS map:   `if (natural && this.repeatTrackFlag) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (natural && this.repeatTrackFlag) return this.order[current];
        // ```
        if (natural && repeatTrackFlag) {
            // What:     `return order[current]` indexes the `order` list at the current
            //           cursor position and returns that load-order index (the cursor
            //           is left unchanged). Wrapped as the `Int?` result.
            // Why:      Signal "play this same track again" without moving the cursor.
            // TS map:   `return this.order[current];`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return this.order[current];
            // ```
            return order[current]
        }
        // What:     `val next: Int = current + 1` declares a read-only `Int` local
        //           `next` as the position after the current one. `+ 1` is plain
        //           integer arithmetic, identical to TS.
        // Why:      Try to step forward within the scope.
        // TS map:   `const next: number = current + 1;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const next: number = current + 1;
        // ```
        val next: Int = current + 1
        // What:     `if (next < order.size) { ... }` is a control-flow bounds check.
        //           `order.size` is the scope length; `next < order.size` means
        //           "there is a track after the current one in this scope".
        // Why:      A normal forward step is possible without looping.
        // TS map:   `if (next < this.order.length) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (next < this.order.length) { this.pos = next; return this.order[next]; }
        // ```
        if (next < order.size) {
            // What:     `pos = next` updates the `Int?` cursor field to the new
            //           position (a non-null `Int` assigned to the nullable field).
            // Why:      Record the forward move.
            // TS map:   `this.pos = next;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.pos = next;
            // ```
            pos = next
            // What:     `return order[next]` indexes `order` at the new position and
            //           returns that load-order index (as the `Int?` result).
            // Why:      Hand back what to play next.
            // TS map:   `return this.order[next];`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return this.order[next];
            // ```
            return order[next]
        }
        // What:     `pos = 0` sets the cursor back to the scope's start. Reached only
        //           when we were past the end of the scope.
        // Why:      `OFF`/`WITHIN_PAGE` loop the page; `ALL` loops the whole queue.
        //           There is no "stop at end" mode (only repeat-track changes a
        //           natural end), so the end of the scope wraps to its start.
        // TS map:   `this.pos = 0;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.pos = 0;
        // ```
        pos = 0
        // What:     `return order[0]` indexes the first element of `order` and returns
        //           it (the `Int?` result). This is the final statement of the block.
        // Why:      Begin the next loop of the scope from its first track.
        // TS map:   `return this.order[0];`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.order[0];
        // ```
        return order[0]
    }

    // What:     `fun moveCursorTo(scopeIndex: Int): Int? { ... }` declares an instance
    //           method taking one non-null `Int` parameter `scopeIndex` (a timeline
    //           window index) and returning a nullable `Int?`, block body.
    // Why:      Move the cursor straight to scope position `scopeIndex` WITHOUT
    //           changing the scope; used when a MediaSession seek (Next/Previous from
    //           the notification, or a jump to a queue item) resolves to an index the
    //           framework already computed against the reported order. Out-of-range
    //           indices move nothing, matching the framework's `C.INDEX_UNSET` no-op.
    //           (No `queue.rs` twin: this is MediaSession-specific to the Android
    //           port.)
    // TS map:   `moveCursorTo(scopeIndex: number): number | null { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // moveCursorTo(scopeIndex: number): number | null {
    //   if (scopeIndex < 0 || scopeIndex >= this.order.length) return null;
    //   this.pos = scopeIndex;
    //   return this.order[scopeIndex];
    // }
    // ```
    fun moveCursorTo(scopeIndex: Int): Int? {
        // What:     `if (scopeIndex < 0 || scopeIndex >= order.size) { return null }`
        //           is a bounds-check guard. `||` is logical OR; the condition is true
        //           when `scopeIndex` is negative OR past the last scope slot.
        //           `return null` exits with the `null` variant.
        // Why:      An out-of-range target moves nothing (the `C.INDEX_UNSET` no-op
        //           the framework uses).
        // TS map:   `if (scopeIndex < 0 || scopeIndex >= this.order.length) return null;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (scopeIndex < 0 || scopeIndex >= this.order.length) return null;
        // ```
        if (scopeIndex < 0 || scopeIndex >= order.size) {
            return null
        }
        // What:     `pos = scopeIndex` assigns the (now validated, in-range) index
        //           into the `Int?` cursor field.
        // Why:      Move the cursor directly to the framework-chosen position without
        //           recomputing the scope.
        // TS map:   `this.pos = scopeIndex;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.pos = scopeIndex;
        // ```
        pos = scopeIndex
        // What:     `return order[scopeIndex]` indexes `order` at the new position and
        //           returns that load-order index (the `Int?` result).
        // Why:      Tell the caller which track is now current.
        // TS map:   `return this.order[scopeIndex];`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.order[scopeIndex];
        // ```
        return order[scopeIndex]
    }

    // What:     `fun prev(): Int? { ... }` declares an instance method taking no
    //           parameters and returning a nullable `Int?`, block body.
    // Why:      Move to the previous track within the scope, wrapping to the scope's
    //           end at the start; the user pressed Previous. Returns the load-order
    //           index of the previous track, or `null` when the queue is empty.
    // TS map:   `prev(): number | null { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // prev(): number | null {
    //   if (this.pos === null) return null;
    //   const current = this.pos;
    //   if (current > 0) { this.pos = current - 1; return this.order[current - 1]; }
    //   const last = this.order.length - 1;
    //   this.pos = last; return this.order[last];
    // }
    // ```
    fun prev(): Int? {
        // What:     `val current: Int = pos ?: return null` declares a read-only `Int`
        //           local `current` using the Elvis operator `?:` again: take `pos`'s
        //           value when non-null, otherwise `return null` from `prev`
        //           immediately.
        // Why:      Nothing to go back to when there is no cursor; bail out early and
        //           smart-cast away the nullability.
        // TS map:   `if (this.pos === null) return null; const current = this.pos;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.pos === null) return null;
        // const current = this.pos;
        // ```
        val current: Int = pos ?: return null
        // What:     `if (current > 0) { ... }` is a control-flow check: there is a
        //           previous slot in the scope.
        // Why:      A normal backward step is possible without wrapping.
        // TS map:   `if (current > 0) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (current > 0) { this.pos = current - 1; return this.order[current - 1]; }
        // ```
        if (current > 0) {
            // What:     `pos = current - 1` decrements the cursor field. `- 1` is plain
            //           integer arithmetic.
            // Why:      Move to the previous track.
            // TS map:   `this.pos = current - 1;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.pos = current - 1;
            // ```
            pos = current - 1
            // What:     `return order[current - 1]` indexes `order` one slot back and
            //           returns that load-order index (the `Int?` result).
            // Why:      Hand back the previous track.
            // TS map:   `return this.order[current - 1];`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return this.order[current - 1];
            // ```
            return order[current - 1]
        }
        // What:     `val last: Int = order.size - 1` declares a read-only `Int` local
        //           `last`, the index of the LAST scope slot (`size - 1`).
        // Why:      At the start of the scope, Previous wraps to its end.
        // TS map:   `const last: number = this.order.length - 1;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const last: number = this.order.length - 1;
        // ```
        val last: Int = order.size - 1
        // What:     `pos = last` sets the cursor field to the last slot.
        // Why:      Wrap behaviour: the scope always loops, so Previous from the start
        //           jumps to the end.
        // TS map:   `this.pos = last;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.pos = last;
        // ```
        pos = last
        // What:     `return order[last]` indexes the last element of `order` and
        //           returns it (the `Int?` result).
        // Why:      Play the wrapped (last) track of the scope.
        // TS map:   `return this.order[last];`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.order[last];
        // ```
        return order[last]
    }
    //endregion

    //region Scope helpers
    // What:     `private fun scopeIndices(anchor: Int): List<Int> { ... }` declares a
    //           PRIVATE instance method (visible only inside this class) taking one
    //           non-null `Int` parameter `anchor` (a load-order index) and returning
    //           a read-only `List<Int>`, block body.
    // Why:      Compute the load-order indices that make up the playback scope around
    //           the `anchor` track, in ascending load order: the whole queue for
    //           `ShuffleMode.ALL`, otherwise the anchor's page. Falls back to the
    //           whole queue when the anchor belongs to no page (an empty/invalid
    //           anchor), never producing an empty scope for a real track.
    // TS map:   `private scopeIndices(anchor: number): number[] { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private scopeIndices(anchor: number): number[] {
    //   if (this.shuffle === ShuffleMode.ALL) {
    //     return [...this.tracks.keys()];
    //   }
    //   const names = this.displayPaths();
    //   const pages = paginate(names);
    //   const page = pageOfIndex(pages, anchor);
    //   return page !== null
    //     ? pages[page].entries.map((e) => e.index)
    //     : [...this.tracks.keys()];
    // }
    // ```
    private fun scopeIndices(anchor: Int): List<Int> {
        // What:     `if (shuffle == ShuffleMode.ALL) { ... }` is a control-flow check.
        //           `==` compares the `shuffle` field against the `ShuffleMode.ALL`
        //           enum constant (enum value equality, like TS `===`).
        // Why:      `ALL` ignores pages entirely: the scope is every track.
        // TS map:   `if (this.shuffle === ShuffleMode.ALL) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.shuffle === ShuffleMode.ALL) return [...this.tracks.keys()];
        // ```
        if (shuffle == ShuffleMode.ALL) {
            // What:     `return tracks.indices.toList()` builds and returns the list of
            //           every load-order index.
            //           - `tracks.indices` is a stdlib property giving the `IntRange`
            //             `0 until tracks.size` (all valid index positions).
            //           - `.toList()` is a type-CONVERSION call: it materialises that
            //             range into a concrete `List<Int>` (the declared return type).
            // Why:      Every load-order index, ascending — the whole-queue scope.
            // TS map:   `return [...Array(this.tracks.length).keys()];` (or
            //           `[...this.tracks.keys()]`). Kotlin's `range.toList()` is the
            //           "spread a range into an array" step TS does with `keys()`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return [...Array(this.tracks.length).keys()];
            // ```
            return tracks.indices.toList()
        }
        // What:     `val names: List<String> = displayPaths()` declares a read-only
        //           `List<String>` local `names`, the relative display strings (one
        //           per track, in load order) from `displayPaths()`.
        // Why:      Pagination groups these display strings into pages.
        // TS map:   `const names: string[] = this.displayPaths();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const names: string[] = this.displayPaths();
        // ```
        val names: List<String> = displayPaths()
        // What:     `val pages: List<Page> = paginate(names)` declares a read-only
        //           `List<Page>` local `pages`. `paginate(names)` calls the sibling
        //           package-level function (from `Pagination.kt`) that groups the
        //           display strings into `Page` objects (each `Page` has a label and
        //           a list of entries). `Page` is the sibling data class.
        // Why:      We need the set of indices sharing the anchor's page. Using the
        //           SAME `paginate` the UI tab bar uses means the playback scope and
        //           the visible page can never drift apart.
        // TS map:   `const pages: Page[] = paginate(names);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const pages: Page[] = paginate(names);
        // ```
        val pages: List<Page> = paginate(names)
        // What:     `val page: Int? = pageOfIndex(pages, anchor)` declares a read-only
        //           NULLABLE `Int?` local `page`. `pageOfIndex(pages, anchor)` is the
        //           sibling function (from `Pagination.kt`) that returns the POSITION
        //           of the page holding `anchor`, or `null` when no page holds it.
        // Why:      That page IS the confined scope; `null` signals "anchor not on any
        //           page" (only for an empty/invalid anchor).
        // TS map:   `const page: number | null = pageOfIndex(pages, anchor);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const page: number | null = pageOfIndex(pages, anchor);
        // ```
        val page: Int? = pageOfIndex(pages, anchor)
        // What:     `return if (page != null) { ... } else { ... }` returns the value
        //           of an IF/ELSE used as an EXPRESSION (it evaluates to one of the
        //           two branch values, like a TS ternary). The condition
        //           `page != null` is a null check that ALSO smart-casts `page` to a
        //           non-null `Int` inside the `then` branch.
        // Why:      If the anchor is on a page, that page's indices are the scope;
        //           otherwise fall back to the whole queue.
        // TS map:   `return page !== null ? pages[page].entries.map(e => e.index) : [...this.tracks.keys()];`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return page !== null
        //   ? pages[page].entries.map((e) => e.index)
        //   : [...Array(this.tracks.length).keys()];
        // ```
        return if (page != null) {
            // What:     `pages[page].entries.map { it.index }` is the `then`-branch
            //           value.
            //           - `pages[page]` indexes the pages list at the (smart-cast
            //             non-null) `page` position, giving one `Page`.
            //           - `.entries` is that page's list of `PageEntry` (each entry
            //             pairs a load-order `index` with a display `name`).
            //           - `.map { it.index }` runs a TRAILING LAMBDA over each entry,
            //             pulling out its `index` field. `it` is the implicit lambda
            //             parameter (one `PageEntry`). The result is a `List<Int>` of
            //             load-order indices, already in ascending load order because
            //             pagination preserves order. This is the branch's value and
            //             thus part of the returned expression.
            // Why:      The page's track indices form the confined scope.
            // TS map:   `pages[page].entries.map((entry) => entry.index)` — Kotlin's
            //           `{ it.index }` trailing lambda is TS's `(entry) => entry.index`;
            //           the implicit `it` replaces the named arrow parameter.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // pages[page].entries.map((entry) => entry.index)
            // ```
            pages[page].entries.map { it.index }
        } else {
            // What:     `tracks.indices.toList()` is the `else`-branch value: the whole
            //           queue's load-order indices, same construction as the `ALL`
            //           branch above (`tracks.indices` is the index range; `.toList()`
            //           materialises it into a `List<Int>`).
            // Why:      Defensive fallback: never produce an empty scope for a real
            //           track when the anchor matched no page.
            // TS map:   `[...Array(this.tracks.length).keys()]`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // [...Array(this.tracks.length).keys()]
            // ```
            tracks.indices.toList()
        }
    }

    // What:     `private fun shuffleSlice(slice: List<Int>): List<Int> { ... }`
    //           declares a private instance method taking one read-only `List<Int>`
    //           parameter `slice` (scope indices to permute) and returning a new
    //           read-only `List<Int>`, block body.
    // Why:      Fisher-Yates shuffle of a scope's indices using the seeded `rng`;
    //           returns a NEW list so the caller's input is left untouched. Unchanged
    //           for 0- or 1-element inputs.
    // TS map:   `private shuffleSlice(slice: readonly number[]): number[] { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private shuffleSlice(slice: readonly number[]): number[] {
    //   if (slice.length < 2) return slice;
    //   const result = [...slice];
    //   let i = result.length - 1;
    //   while (i > 0) {
    //     const j = this.rng.nextInt(i + 1);
    //     const swap = result[i];
    //     result[i] = result[j];
    //     result[j] = swap;
    //     i -= 1;
    //   }
    //   return result;
    // }
    // ```
    private fun shuffleSlice(slice: List<Int>): List<Int> {
        // What:     `if (slice.size < 2) return slice` is an early return. `slice.size`
        //           is the element count; for 0 or 1 elements there is nothing to
        //           shuffle, so the original `slice` is returned unchanged.
        // Why:      Avoid the `size - 1` underflow on an empty slice and skip needless
        //           work for a single element.
        // TS map:   `if (slice.length < 2) return slice;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (slice.length < 2) return slice;
        // ```
        if (slice.size < 2) return slice
        // What:     `val result: MutableList<Int> = slice.toMutableList()` declares a
        //           read-only BINDING `result` (the `val` means we will not point
        //           `result` at a different list) whose type is `MutableList<Int>` — a
        //           list whose ELEMENTS can be reassigned in place (`result[i] = ...`).
        //           Sibling: the plain `List<Int>` (read-only elements) used elsewhere.
        //           `slice.toMutableList()` is a type-CONVERSION call that COPIES the
        //           input into a fresh mutable list.
        // Why:      Fisher-Yates swaps elements in place, so we need a mutable copy;
        //           copying also keeps the caller's input untouched.
        // TS map:   `const result: number[] = [...slice];` — TS arrays are always
        //           element-mutable, so there is no `List` vs `MutableList` split; the
        //           spread `[...slice]` is the `toMutableList()` copy.
        // Gotcha:   `val result` does NOT make the elements immutable; `val` only locks
        //           the BINDING. `result[i] = x` is still legal because the TYPE is
        //           `MutableList`. (Kotlin separates "can I rebind the name?" from "can
        //           I mutate the contents?".)
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const result: number[] = [...slice];
        // ```
        val result: MutableList<Int> = slice.toMutableList()
        // What:     `var i: Int = result.size - 1` declares a REASSIGNABLE (`var`)
        //           `Int` loop counter `i`, initialised to the last index.
        // Why:      Fisher-Yates walks from the last index down to 1.
        // TS map:   `let i: number = result.length - 1;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let i: number = result.length - 1;
        // ```
        var i: Int = result.size - 1
        // What:     `while (i > 0) { ... }` is a condition-controlled loop, run while
        //           `i` is greater than 0. Plain control flow, identical to TS.
        // Why:      Standard Fisher-Yates traversal from the end toward the start.
        // TS map:   `while (i > 0) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // while (i > 0) { ... }
        // ```
        while (i > 0) {
            // What:     `val j: Int = rng.nextInt(i + 1)` declares a read-only `Int`
            //           local `j`. `rng.nextInt(i + 1)` calls the seeded `Random`'s
            //           `nextInt(bound)` method, which returns a uniformly random `Int`
            //           in the half-open range `0 until (i + 1)` (i.e. `0..i`
            //           inclusive). `rng` is the private `Random` field from the
            //           constructor.
            // Why:      Pick a random slot `j` in `0..i` to swap with slot `i`.
            // TS map:   `const j: number = this.rng.nextInt(i + 1);` — equivalently
            //           `Math.floor(rand() * (i + 1))` with a seedable `rand`.
            // Gotcha:   This is the KOTLIN seeded RNG (`kotlin.random.Random.nextInt`),
            //           NOT the desktop's hand-rolled xorshift64. `nextInt(bound)` is
            //           exclusive of `bound`, so `i + 1` makes slot `i` reachable.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const j: number = this.rng.nextInt(i + 1); // 0..=i inclusive
            // ```
            val j: Int = rng.nextInt(i + 1)
            // What:     `val swap: Int = result[i]` declares a read-only `Int` local
            //           `swap` holding the value currently at slot `i` (so it is not
            //           lost when we overwrite slot `i`). `result[i]` reads the mutable
            //           list at index `i`.
            // Why:      Temporary holder for the classic three-step element swap.
            // TS map:   `const swap: number = result[i];`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const swap: number = result[i];
            // ```
            val swap: Int = result[i]
            // What:     `result[i] = result[j]` writes the value at slot `j` into slot
            //           `i`. Indexed assignment into a `MutableList` (legal because the
            //           type is mutable, even though the `result` binding is `val`).
            // Why:      First half of the swap.
            // TS map:   `result[i] = result[j];`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // result[i] = result[j];
            // ```
            result[i] = result[j]
            // What:     `result[j] = swap` writes the saved original `result[i]` value
            //           (held in `swap`) into slot `j`.
            // Why:      Second half of the swap; slots `i` and `j` are now exchanged.
            // TS map:   `result[j] = swap;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // result[j] = swap;
            // ```
            result[j] = swap
            // What:     `i -= 1` decrements the loop counter (`i = i - 1`). Plain
            //           integer arithmetic, same as TS.
            // Why:      Move toward the loop's end (counter reaches 0, loop stops).
            // TS map:   `i -= 1;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // i -= 1;
            // ```
            i -= 1
        }
        // What:     `return result` returns the now-shuffled mutable list. Its declared
        //           type `MutableList<Int>` is a `List<Int>`, so it satisfies the
        //           method's `List<Int>` return type (callers see only the read-only
        //           view).
        // Why:      Hand back the shuffled copy.
        // TS map:   `return result;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return result;
        // ```
        return result
    }

    // What:     `private fun rebuildScopeOrder(anchor: Int?) { ... }` declares a
    //           private instance method taking one NULLABLE `Int?` parameter `anchor`
    //           and returning `Unit` (void), block body.
    // Why:      Recompute the scope `order` and cursor `pos` so the `anchor` track
    //           stays current; called whenever the scope might change (`setTracks`,
    //           `setShuffle`, `playIndex` to another page). A `null` anchor defaults
    //           to the first track; a stale index past the end is clamped into range;
    //           an empty queue clears the order and cursor.
    // TS map:   `private rebuildScopeOrder(anchor: number | null): void { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private rebuildScopeOrder(anchor: number | null): void {
    //   if (this.tracks.length === 0) { this.order = []; this.pos = null; return; }
    //   const clamped = Math.min(anchor ?? 0, this.tracks.length - 1);
    //   const scope = this.scopeIndices(clamped);
    //   const ordered = this.shuffle !== ShuffleMode.OFF ? this.shuffleSlice(scope) : scope;
    //   const found = ordered.indexOf(clamped);
    //   this.order = ordered;
    //   this.pos = found < 0 ? 0 : found;
    // }
    // ```
    private fun rebuildScopeOrder(anchor: Int?) {
        // What:     `if (tracks.isEmpty()) { ... }` is a control-flow check using the
        //           `List.isEmpty()` predicate (true when there are zero tracks).
        // Why:      An empty queue has no order and no cursor; guard the index math
        //           below.
        // TS map:   `if (this.tracks.length === 0) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.tracks.length === 0) { this.order = []; this.pos = null; return; }
        // ```
        if (tracks.isEmpty()) {
            // What:     `order = emptyList()` assigns the shared zero-length read-only
            //           list (see the `emptyList()` note) to the `order` field.
            // Why:      No tracks means no playback order.
            // TS map:   `this.order = [];`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.order = [];
            // ```
            order = emptyList()
            // What:     `pos = null` clears the cursor field (assigning the `null`
            //           variant to the `Int?` field).
            // Why:      Nothing is selected in an empty queue.
            // TS map:   `this.pos = null;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.pos = null;
            // ```
            pos = null
            // What:     `return` exits the method early (returning `Unit`/void). Bare
            //           `return` with no value, legal because the method returns `Unit`.
            // Why:      The empty-queue case is fully handled; skip the rest.
            // TS map:   `return;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return;
            // ```
            return
        }
        // What:     `val clamped: Int = minOf(anchor ?: 0, tracks.size - 1)` declares a
        //           read-only `Int` local `clamped`. Two pieces:
        //           - `anchor ?: 0` is the ELVIS operator: use `anchor`'s value when
        //             non-null, otherwise `0`. This turns the `Int?` parameter into a
        //             plain `Int` defaulting to the first track.
        //           - `minOf(x, y)` is a stdlib function returning the smaller of two
        //             values; here it CLAMPS the anchor to at most `tracks.size - 1`
        //             (the last valid index).
        // Why:      Always anchor on a real, in-range index: default a missing anchor
        //           to the first track, and clamp a stale index that points past the
        //           end.
        // TS map:   `const clamped: number = Math.min(anchor ?? 0, this.tracks.length - 1);`
        //           — Kotlin's `?:` is TS's `??`; `minOf` is `Math.min`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const clamped: number = Math.min(anchor ?? 0, this.tracks.length - 1);
        // ```
        val clamped: Int = minOf(anchor ?: 0, tracks.size - 1)
        // What:     `val scope: List<Int> = scopeIndices(clamped)` declares a read-only
        //           `List<Int>` local `scope`, the scope's indices in ascending load
        //           order, by calling the private `scopeIndices` helper with the
        //           clamped anchor.
        // Why:      Starting point for the playback order (before any shuffle).
        // TS map:   `const scope: number[] = this.scopeIndices(clamped);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const scope: number[] = this.scopeIndices(clamped);
        // ```
        val scope: List<Int> = scopeIndices(clamped)
        // What:     `val ordered: List<Int> = if (shuffle != ShuffleMode.OFF) shuffleSlice(scope) else scope`
        //           declares a read-only `List<Int>` local `ordered` from an IF/ELSE
        //           EXPRESSION (it evaluates to one of the two branch values, like a
        //           TS ternary).
        //           - `shuffle != ShuffleMode.OFF` uses `!=` (not-equal) on the enum:
        //             true for both `WITHIN_PAGE` and `ALL`.
        //           - `then` branch `shuffleSlice(scope)` returns a shuffled copy;
        //             `else` branch `scope` keeps load order.
        // Why:      `OFF` keeps load order; the other two modes randomise the scope.
        // TS map:   `const ordered: number[] = this.shuffle !== ShuffleMode.OFF ? this.shuffleSlice(scope) : scope;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const ordered: number[] =
        //   this.shuffle !== ShuffleMode.OFF ? this.shuffleSlice(scope) : scope;
        // ```
        val ordered: List<Int> = if (shuffle != ShuffleMode.OFF) shuffleSlice(scope) else scope
        // What:     `val found: Int = ordered.indexOf(clamped)` declares a read-only
        //           `Int` local `found`. `ordered.indexOf(clamped)` returns the
        //           position of the anchor within the (possibly shuffled) `ordered`
        //           list, or `-1` when absent.
        // Why:      The cursor must point at the anchor after the rebuild, so we locate
        //           it in the final order.
        // TS map:   `const found: number = ordered.indexOf(clamped);`
        // Gotcha:   `.indexOf` returns `-1` (not `null`) when not found; the next line
        //           tests `found < 0`, not a null check.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const found: number = ordered.indexOf(clamped);
        // ```
        val found: Int = ordered.indexOf(clamped)
        // What:     `order = ordered` assigns the rebuilt list into the `order` field
        //           (the `List<Int>` field accepts the `List<Int>` value).
        // Why:      Adopt the rebuilt scope order.
        // TS map:   `this.order = ordered;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.order = ordered;
        // ```
        order = ordered
        // What:     `pos = if (found < 0) 0 else found` assigns the cursor field from
        //           an IF/ELSE EXPRESSION (ternary-like). If the anchor was not found
        //           (`found < 0`), use `0` (the scope's start); otherwise use the
        //           found position. The non-null `Int` result is stored into the
        //           `Int?` field.
        // Why:      Point the cursor at the anchor, or the scope's start if the anchor
        //           somehow fell outside (which cannot happen for a real track).
        // TS map:   `this.pos = found < 0 ? 0 : found;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.pos = found < 0 ? 0 : found;
        // ```
        pos = if (found < 0) 0 else found
    }
    //endregion
}
