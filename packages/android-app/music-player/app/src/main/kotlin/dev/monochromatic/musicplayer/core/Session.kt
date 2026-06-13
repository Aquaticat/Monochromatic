// What:     `package dev.monochromatic.musicplayer.core` names the namespace this
//           file's declarations live under. The single top-level name below
//           (`Session`, the data class) becomes reachable from other files as
//           `dev.monochromatic.musicplayer.core.Session`, or via an `import`. It is
//           not a statement that runs; it is metadata the compiler reads to decide
//           where these symbols belong.
// Why:      Without it the `Session` type would land in the unnamed default package
//           and collide with everything else; the build expects this file's package
//           to match its directory path (`.../core/`).
// TS map:   There is no per-file `package` keyword in TS. The closest mental model
//           is "this whole file is a module, and its directory `core/` is the
//           namespace." Importers write `import { Session } from ".../core/..."`.
//
// In TS you'd write (pseudocode):
// ```ts
// // No statement equivalent — the file's path *is* its namespace in TS.
// ```
package dev.monochromatic.musicplayer.core

// MODULE SUMMARY (folded in from the old KDoc that lived on the class):
//
// The saved "where the user left off" state: queue, cursor, position, volume,
// shuffle, and the repeat-track flag. This is a PURE model ported from the
// desktop player's Rust `Session` (session.rs). The desktop persists this blob as
// JSON under the user's config directory and, on the Rust side, the same type also
// owns load/save/path-finding helpers that touch the disk. This core Kotlin type
// deliberately carries ONLY the in-memory shape and the pruning logic; the actual
// filesystem access (does this file still exist? where does the JSON live?) is
// left to the platform layer and injected in as a function argument. That keeps
// this model deterministic: it reads only its own fields and its arguments, touches
// no disk, and returns the same output for the same input.
//
// The default values on the primary constructor reproduce the desktop's
// `impl Default for Session` exactly: empty queue, no cursor, zero position, full
// volume, shuffle off, no repeat-track.
//
// Field domain notes (from the old `@property` KDoc):
//   - tracks       : queue track paths in load order.
//   - current      : index of the current track, or `null` when the queue is empty.
//   - positionSecs : saved playback position of the current track, in seconds.
//   - volume       : saved gain in the range 0.0..=1.0.
//   - shuffle      : saved shuffle mode (off, within-page, or all).
//   - repeatTrack  : whether "repeat track" was enabled.
//
// No imports appear in this file: `ShuffleMode` and `isAudioFile` both live in this
// same `core` package, so they are visible without an `import` line; everything else
// (`List`, `Int`, `Double`, `Float`, `Boolean`, `mutableListOf`, `emptyList`) is
// Kotlin's always-imported standard prelude.

// What:     `data class Session( ... )` declares a DATA CLASS named `Session`. A
//           `data class` is Kotlin's "plain record" shape: from the properties
//           listed in its PRIMARY CONSTRUCTOR (the parameter list in parentheses
//           right after the name), the compiler AUTO-GENERATES a bundle of methods
//           for free —
//             - `equals()` / `hashCode()`: structural (value) equality, so two
//               sessions with identical fields compare equal.
//             - `toString()`: a readable `Session(tracks=[...], current=...)` dump.
//             - `copy(...)`: a "make a near-duplicate with some fields changed"
//               helper used at the bottom of this file.
//             - `componentN()`: destructuring support (`val (a, b) = session`).
//           Each constructor parameter that is prefixed with `val` (every one here)
//           is BOTH a constructor argument AND a public read-only property of the
//           class — declaring the parameter declares the field, in one stroke. The
//           `= ...` after each type is that parameter's DEFAULT value, used when a
//           caller omits it.
//           Siblings the reader might expect instead of `data class`: a plain
//           `class` (no auto-generated `equals`/`copy`/etc.; you would write them by
//           hand), or an `object` (a singleton, exactly one instance). We want
//           `data class` precisely for the value-equality and `copy()` the pruning
//           logic relies on.
// Why:      One serializable-shaped record describing "where the user left off",
//           with cheap value-equality (used in tests) and a `copy()` that lets
//           `pruneUnplayable` build a new session without mutating the old one.
// TS map:   `data class` has no single TS keyword. Mentally it is an `interface` for
//           the shape PLUS a constructor that fills defaults PLUS free structural
//           equality. The defaults map onto a factory:
//
// In TS you'd write (pseudocode):
// ```ts
// interface Session {
//   tracks: string[];
//   current: number | null;
//   positionSecs: number;
//   volume: number;
//   shuffle: ShuffleMode;
//   repeatTrack: boolean;
// }
// function makeSession(p: Partial<Session> = {}): Session {
//   return {
//     tracks: p.tracks ?? [],
//     current: p.current ?? null,
//     positionSecs: p.positionSecs ?? 0,
//     volume: p.volume ?? 1,
//     shuffle: p.shuffle ?? ShuffleMode.OFF,
//     repeatTrack: p.repeatTrack ?? false,
//   };
// }
// ```
data class Session(
    // What:     `val tracks: List<String> = emptyList()`. A read-only property
    //           holding the queue's track paths in load order.
    //           - `val` = read-only (cannot be reassigned), the opposite of `var`.
    //           - `: List<String>` is the type. `List<String>` is a READ-ONLY
    //             ordered sequence of strings (indexable, allows duplicates).
    //             Siblings the reader might expect: `MutableList<String>` (one you
    //             can add to / remove from — used as scratch space lower down),
    //             `Array<String>` (fixed-size, mutable slots), `Set<String>`
    //             (unordered, unique, membership-only). We pick the immutable
    //             `List` because a session's queue is a fixed, ordered snapshot we
    //             only read; nobody should mutate it through this field. Mirrors the
    //             Rust port's `Vec<PathBuf>` (an owned, growable array of paths).
    //           - `= emptyList()` is the DEFAULT: `emptyList()` is a factory
    //             FUNCTION returning a shared, allocation-free empty `List`. It is
    //             not a `new`-constructor call; Kotlin collections are built via
    //             these `xxxOf` / `emptyXxx` factory functions. This default is the
    //             "empty queue" half of the desktop's `impl Default`.
    // Why:      Rebuild the queue on restore; default empty means "no session yet".
    // TS map:   `tracks: string[]` with a default of `[]`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // tracks: string[]; // default []
    // ```
    val tracks: List<String> = emptyList(),
    // What:     `val current: Int? = null`. A read-only property holding the index
    //           of the current track, OR `null`.
    //           - `: Int?` is the type. `Int` is a 32-bit SIGNED integer; the
    //             trailing `?` makes it NULLABLE, so the field is either an `Int` or
    //             the special value `null`. Sibling integer types the reader might
    //             expect: `Long` (64-bit), `Short` (16-bit), `UInt` (32-bit
    //             unsigned). We use plain `Int` because a queue index never needs
    //             more than 32 bits (no playlist has billions of entries) and `Int`
    //             is Kotlin's default, friction-free integer; this mirrors the Rust
    //             port's `usize` "an index" choice. The `?` is what lets "empty
    //             queue, no current track" be representable.
    //           - `= null` is the DEFAULT: no cursor, matching the desktop's `None`.
    // Why:      Which track was current; `null` when the queue was empty.
    // TS map:   `current: number | null` with a default of `null`. Kotlin's `Int?`
    //           is exactly TS's `number | null` union.
    // Gotcha:   Kotlin distinguishes a NON-nullable `Int` (cannot hold `null`) from
    //           a nullable `Int?`. TS `number` is always nullable-by-convention via
    //           `| null`; there is no separate non-null number type to confuse here.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // current: number | null; // default null
    // ```
    val current: Int? = null,
    // What:     `val positionSecs: Double = 0.0`. A read-only property: the saved
    //           playback position of the current track, in seconds.
    //           - `: Double` is the type. `Double` is a 64-bit IEEE-754 floating
    //             point number (about 15 to 17 significant decimal digits). The
    //             sibling the reader might expect is `Float` (32-bit, ~7 digits —
    //             which IS used for `volume` two lines down). We pick `Double` for
    //             the position because seconds-into-a-track wants the extra
    //             precision (a long track plus sub-second seek accuracy), exactly
    //             the reasoning the Rust port used to pick `f64` here.
    //           - `= 0.0` is the DEFAULT: start of the track. The `.0` makes the
    //             literal a floating-point `Double`, not an `Int`.
    // Why:      Resume the current track where it left off; default `0.0` is "start".
    // TS map:   `positionSecs: number` with a default of `0`. TS has only one
    //           number type, so the `Double`-vs-`Float` distinction vanishes there.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // positionSecs: number; // default 0
    // ```
    val positionSecs: Double = 0.0,
    // What:     `val volume: Float = 1.0f`. A read-only property: the saved gain in
    //           the range 0.0..=1.0.
    //           - `: Float` is the type. `Float` is a 32-bit IEEE-754 floating point
    //             number (~7 significant digits). The sibling the reader might
    //             expect is `Double` (64-bit, used by `positionSecs` just above). We
    //             pick the narrower `Float` here because volume is a coarse 0..1 gain
    //             that the audio path itself stores as 32-bit; matching that type
    //             avoids needless widen/narrow conversions, exactly as the Rust port
    //             chose `f32` for the same field.
    //           - `= 1.0f` is the DEFAULT: FULL volume. The `f` SUFFIX is
    //             load-bearing: `1.0` alone is a `Double` literal and would NOT fit a
    //             `Float` field, so `1.0f` explicitly types the literal as a 32-bit
    //             `Float`.
    // Why:      Restore the user's last volume; default `1.0f` is "full gain".
    // TS map:   `volume: number` with a default of `1`. TS has no `Float`/`Double`
    //           split and no `f` suffix — every numeric literal is just `number`.
    // Gotcha:   The `f` in `1.0f` is NOT a TS thing. In TS you would write plain `1`.
    //           Forgetting the `f` in Kotlin is a compile error here, not a no-op.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // volume: number; // default 1
    // ```
    val volume: Float = 1.0f,
    // What:     `val shuffle: ShuffleMode = ShuffleMode.OFF`. A read-only property:
    //           the saved shuffle mode.
    //           - `: ShuffleMode` is the type — the three-state enum (`OFF`,
    //             `WITHIN_PAGE`, `ALL`) declared in the sibling `ShuffleMode.kt`. It
    //             is visible here without an `import` because it lives in this same
    //             `core` package. Sibling shapes the reader might expect instead of
    //             an `enum class`: a plain string union, or a sealed class; the
    //             desktop persists these as serde variant strings, and the Kotlin
    //             side keeps an idiomatic enum.
    //           - `= ShuffleMode.OFF` is the DEFAULT. `ShuffleMode.OFF` is ENUM
    //             MEMBER ACCESS: it names one specific constant of the `ShuffleMode`
    //             enum (the `EnumName.MEMBER` form), here the "no shuffle" mode that
    //             matches the desktop default `ShuffleMode::Off`.
    // Why:      Restore the user's shuffle choice; default `OFF` is "not shuffling".
    // TS map:   `shuffle: ShuffleMode` with a default of `ShuffleMode.OFF`. If
    //           `ShuffleMode` were a TS string union, the default would be `"off"`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // shuffle: ShuffleMode; // default ShuffleMode.OFF
    // ```
    val shuffle: ShuffleMode = ShuffleMode.OFF,
    // What:     `val repeatTrack: Boolean = false`. A read-only property: whether
    //           "repeat track" was enabled.
    //           - `: Boolean` is Kotlin's true/false type; it maps cleanly onto TS
    //             `boolean` (no sibling-type subtlety here).
    //           - `= false` is the DEFAULT: repeat off, matching the desktop default.
    // Why:      Restore the repeat-track flag; default `false` is "do not repeat".
    // TS map:   `repeatTrack: boolean` with a default of `false`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // repeatTrack: boolean; // default false
    // ```
    val repeatTrack: Boolean = false,
) {
    // What:     `fun pruneUnplayable(fileExists: (String) -> Boolean): Session`
    //           declares a PUBLIC method on `Session` (no `private`, so other code
    //           can call it).
    //           - `fun` is Kotlin's keyword to start a function (like TS `function`).
    //           - `pruneUnplayable` is the name.
    //           - `(fileExists: (String) -> Boolean)` is the single parameter:
    //             `fileExists`, whose type `(String) -> Boolean` is a FUNCTION TYPE.
    //             That arrow-typed parameter means "pass me a function that takes a
    //             `String` and returns a `Boolean`" — a callback. This is the
    //             DEPENDENCY INJECTION that keeps the model pure: instead of touching
    //             the disk itself (the Rust port called `path.exists()` directly),
    //             this method asks the caller's supplied predicate "does this path
    //             still exist?".
    //           - `: Session` is the RETURN type. Crucially this returns a NEW
    //             `Session`; it does NOT mutate `this`. (The Rust twin
    //             `prune_unplayable(&mut self)` mutates in place and returns nothing
    //             — this Kotlin version is a different, pure shape on purpose.)
    //           Behaviour: keep a track only when it still exists (per the injected
    //           predicate) AND its extension is in the audio allowlist; dropping
    //           earlier tracks shifts later indices, so `current` is remapped onto
    //           the survivor's new position; when no current track survives, both the
    //           cursor and `positionSecs` reset.
    // Why:      Files may have moved since the session was saved, and a session saved
    //           before audio filtering existed may hold non-audio junk; neither
    //           belongs in the queue. Taking `fileExists` as a parameter (rather than
    //           hitting the disk) keeps this model deterministic and testable.
    // TS map:   A pure method returning a fresh object, with a callback parameter:
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // pruneUnplayable(fileExists: (path: string) => boolean): Session {
    //   const kept: string[] = [];
    //   let newCurrent: number | null = null;
    //   this.tracks.forEach((path, oldIndex) => {
    //     if (fileExists(path) && isAudioFile(path)) {
    //       if (this.current === oldIndex) newCurrent = kept.length;
    //       kept.push(path);
    //     }
    //   });
    //   return {
    //     ...this,
    //     tracks: kept.slice(),
    //     current: newCurrent,
    //     positionSecs: newCurrent === null ? 0 : this.positionSecs,
    //   };
    // }
    // ```
    fun pruneUnplayable(fileExists: (String) -> Boolean): Session {
        // What:     `val kept = mutableListOf<String>()`. Declares a read-only local
        //           BINDING `kept` (the `val` means the binding cannot be reassigned)
        //           whose value is a freshly built MUTABLE list of strings.
        //           - `mutableListOf<String>()` is a factory FUNCTION (not a `new`
        //             call) that returns a new, empty `MutableList<String>`. The
        //             `<String>` is the element-type argument.
        //           - `MutableList<String>` is the type the factory yields: an
        //             ordered list you CAN add to / remove from. Sibling the reader
        //             might expect: the read-only `List<String>` produced by
        //             `listOf(...)` / `emptyList()` (the `tracks` field's type),
        //             which has no `.add`. We need the MUTABLE one here because this
        //             is scratch space we append survivors to in the loop below.
        //           Note: `kept` being a `val` and the list being `Mutable` are
        //           independent — the binding never points at a different list, but
        //           the list's CONTENTS still grow.
        // Why:      Collect only the still-playable tracks as we scan, before
        //           freezing them into the immutable `tracks` of the new session.
        // TS map:   `const kept: string[] = [];` — a TS array is already mutable, so
        //           there is no separate "mutable vs read-only list" type to pick.
        // Gotcha:   `val` here pins only the BINDING, not the list contents. This is
        //           the same as TS `const kept = []` then `kept.push(...)`: `const`
        //           forbids reassigning `kept`, not mutating the array it points to.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const kept: string[] = [];
        // ```
        val kept = mutableListOf<String>()
        // What:     `var newCurrent: Int? = null`. Declares a MUTABLE local holding
        //           the remapped cursor, starting as "none yet".
        //           - `var` means REASSIGNABLE (the opposite of `val`); we need it
        //             because the loop below may overwrite `newCurrent` once it finds
        //             the surviving current track.
        //           - `: Int?` is the nullable 32-bit-integer type, same choice and
        //             same sibling (`Long`) as the `current` field above; `?` lets it
        //             start as `null`.
        //           - `= null` is the initial value: no surviving cursor found yet.
        // Why:      The old index shifts once earlier tracks are dropped, so we
        //           rebuild the cursor from scratch as we walk the survivors.
        // TS map:   `let newCurrent: number | null = null;` — Kotlin `var` ↔ TS
        //           `let` (reassignable), Kotlin `val` ↔ TS `const`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let newCurrent: number | null = null;
        // ```
        var newCurrent: Int? = null
        // What:     `tracks.forEachIndexed { oldIndex, path -> ... }`. Iterates the
        //           `tracks` list, running the trailing block once per element.
        //           - `forEachIndexed` is a standard-library method that yields BOTH
        //             the element's INDEX and the element ITSELF to its callback.
        //           - `{ oldIndex, path -> ... }` is a LAMBDA (an inline anonymous
        //             function) written in Kotlin's TRAILING-LAMBDA form: when a
        //             function's last argument is a lambda, you may write it AFTER the
        //             parentheses (and, as here, drop the now-empty `()` entirely).
        //             Inside the braces, the part before `->` names the parameters and
        //             the part after is the body. So `oldIndex` is the position and
        //             `path` is the track string.
        // Why:      We need BOTH the value and its original index: the value to test
        //           for playability, the index to detect "this was the current track".
        // TS map:   `this.tracks.forEach((path, oldIndex) => { ... })`.
        // Gotcha:   PARAMETER ORDER IS FLIPPED. Kotlin `forEachIndexed` passes
        //           (index, element) — so here `oldIndex` comes FIRST, `path` second.
        //           TS `Array.forEach` passes (element, index) — element FIRST. Read
        //           the Kotlin block as "index, then value"; the TS translation must
        //           swap them back to `(path, oldIndex)`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.tracks.forEach((path, oldIndex) => { ... });
        // ```
        tracks.forEachIndexed { oldIndex, path ->
            // What:     `if (fileExists(path) && isAudioFile(path))`. A plain
            //           conditional whose `if (...)` syntax is identical to TS; the
            //           two CALLS inside it carry the meaning.
            //           - `fileExists(path)` INVOKES the injected callback parameter
            //             (the `(String) -> Boolean` function this method was handed),
            //             asking "does this path still exist on disk?". This is where
            //             the impurity is delegated OUT to the caller.
            //           - `&&` is short-circuiting logical AND (same as TS): if
            //             `fileExists` is false, `isAudioFile` is never evaluated.
            //           - `isAudioFile(path)` calls the same-package predicate from
            //             `AudioExtensions.kt` that checks the extension against the
            //             audio allowlist.
            // Why:      Keep only present audio files; drop moved-away paths and any
            //           non-audio junk a pre-filtering session persisted.
            // TS map:   `if (fileExists(path) && isAudioFile(path)) { ... }` —
            //           character-identical, since calling a callback and `&&` look
            //           the same in TS.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (fileExists(path) && isAudioFile(path)) { ... }
            // ```
            if (fileExists(path) && isAudioFile(path)) {
                // What:     `if (current == oldIndex)`. Compares the saved cursor
                //           field `current` (an `Int?`) against this loop position
                //           `oldIndex` (an `Int`).
                //           - `==` in Kotlin is STRUCTURAL equality: it compares
                //             VALUES (and safely handles the nullable side — if
                //             `current` is `null` it is simply not equal to any `Int`).
                //             Unlike the Rust twin, which had to write `Some(old_idx)`
                //             to wrap the index up to its `Option` before comparing,
                //             Kotlin's `==` compares an `Int?` to an `Int` directly,
                //             so no wrapper construction is needed here.
                // Why:      If the surviving track was the current one, we must record
                //           its NEW position in the compacted list.
                // TS map:   `if (this.current === oldIndex) { ... }`.
                // Gotcha:   Kotlin `==` is VALUE equality (it calls `equals`), the
                //           opposite of Java's `==`. The closest TS operator is `===`
                //           for these primitives; do NOT translate Kotlin `==` to TS
                //           loose `==`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (this.current === oldIndex) { ... }
                // ```
                if (current == oldIndex) {
                    // What:     `newCurrent = kept.size`. Reassigns the mutable
                    //           `newCurrent` to the current length of `kept`.
                    //           - `kept.size` reads the `.size` PROPERTY of the list
                    //             (the count of elements added so far). In Kotlin a
                    //             list's length is the `.size` property, NOT a method
                    //             call and NOT `.length`.
                    //           Because this runs BEFORE the matching track is added
                    //           just below, `kept.size` equals the index the current
                    //           track will occupy once appended.
                    // Why:      Remap the cursor onto the compacted survivor list: the
                    //           new index is "how many survivors came before me".
                    // TS map:   `newCurrent = kept.length;` — Kotlin `.size` ↔ TS
                    //           `.length` for arrays/lists.
                    // Gotcha:   It is `.size` (a property), not `.length` and not
                    //           `.size()`. TS arrays use `.length`; do not carry the
                    //           Kotlin spelling over.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // newCurrent = kept.length;
                    // ```
                    newCurrent = kept.size
                }
                // What:     `kept.add(path)`. Appends `path` to the end of the
                //           `kept` mutable list.
                //           - `.add(x)` is the `MutableList` MUTATION method that
                //             grows the list by one element (it returns a `Boolean`
                //             we ignore). The read-only `List` type has no `.add`,
                //             which is why `kept` had to be a `MutableList`.
                //           No `.clone()` / copy is needed (the Rust twin wrote
                //           `path.clone()` to satisfy ownership): Kotlin strings are
                //           immutable references, so appending the same `path` is
                //           safe and shares nothing mutable.
                // Why:      Build the survivors list in load order.
                // TS map:   `kept.push(path);` — Kotlin `MutableList.add` ↔ TS
                //           `Array.push`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // kept.push(path);
                // ```
                kept.add(path)
            }
        }
        // What:     `return copy( ... )`. Builds and returns the new pruned session.
        //           - `copy(...)` is the method the `data class` AUTO-GENERATED: it
        //             creates a DUPLICATE of `this` with the listed fields replaced
        //             and every unlisted field copied unchanged (so `volume`,
        //             `shuffle`, and `repeatTrack` carry over untouched here). This
        //             is what makes `pruneUnplayable` pure — `this` is never mutated.
        //           - The `field = value` items inside are NAMED ARGUMENTS: Kotlin
        //             lets you pass a parameter by name (`tracks = ...`) rather than
        //             by position, which is required for `copy` since you are
        //             cherry-picking which fields to override.
        //           - `return` makes this the method's result (the function has a
        //             `{ }` block body, so an explicit `return` is needed).
        // Why:      Produce the cleaned-up session without touching the original, so
        //           callers can compare old vs new or discard the old safely.
        // TS map:   `return { ...this, tracks: ..., current: ..., positionSecs: ... };`
        //           — the spread `...this` copies the unchanged fields, the explicit
        //           keys override the three we recompute. There is no `copy` keyword
        //           in TS; the object spread plays that role.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return {
        //   ...this,
        //   tracks: kept.slice(),
        //   current: newCurrent,
        //   positionSecs: newCurrent === null ? 0 : this.positionSecs,
        // };
        // ```
        return copy(
            // What:     `tracks = kept.toList()`. The named argument overriding the
            //           `tracks` field.
            //           - `kept.toList()` is a TYPE-CONVERSION call: it builds a NEW
            //             read-only `List<String>` snapshot from the `MutableList`
            //             scratch buffer. This "freezes" the survivors so the
            //             returned session's `tracks` cannot be mutated through the
            //             old `kept` reference.
            // Why:      The session's `tracks` field is the immutable `List<String>`
            //           type, so the mutable scratch list must be converted before it
            //           can be stored there.
            // TS map:   `tracks: kept.slice()` — `.toList()` here is a defensive copy
            //           into an immutable snapshot, which in TS you approximate with
            //           `.slice()` (a fresh array). Plain `kept` would also type-check
            //           in TS, but `.toList()` is doing the immutability conversion.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // tracks: kept.slice(),
            // ```
            tracks = kept.toList(),
            // What:     `current = newCurrent`. The named argument overriding the
            //           `current` field with the remapped cursor. `newCurrent` is the
            //           `Int?` we built in the loop — either the survivor's new index
            //           or `null` if the current track did not survive. No wrapper or
            //           conversion is involved; a plain assignment of an `Int?` into
            //           an `Int?` field.
            // Why:      Point the new session at the surviving current track, or at
            //           `null` when it was dropped.
            // TS map:   `current: newCurrent,`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // current: newCurrent,
            // ```
            current = newCurrent,
            // What:     `positionSecs = if (newCurrent == null) 0.0 else positionSecs`.
            //           The named argument overriding `positionSecs`, whose value is
            //           computed by an `if` used as an EXPRESSION.
            //           - In Kotlin `if/else` is an EXPRESSION that PRODUCES a value
            //             (like a TS ternary `cond ? a : b`), not just a statement.
            //             Here it yields `0.0` when `newCurrent == null`, otherwise
            //             the existing `positionSecs`.
            //           - `newCurrent == null` is the structural null check (`==`
            //             value-compares against `null`).
            //           - `0.0` is a `Double` literal (the `.0` keeps it floating
            //             point), matching the field's `Double` type.
            //           - the trailing `positionSecs` in the `else` reads the current
            //             session's existing position field unchanged.
            // Why:      If no current track survived, there is no track to resume, so
            //           the saved position is meaningless and resets to the start;
            //           otherwise keep the position we had.
            // TS map:   `positionSecs: newCurrent === null ? 0 : this.positionSecs,`
            //           — Kotlin's `if/else` expression is TS's `?:` ternary.
            // Gotcha:   This `if` RETURNS a value (it is an expression). A TS reader
            //           used to `if` being a statement-only construct must read it as
            //           a ternary, not as a side-effecting block.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // positionSecs: newCurrent === null ? 0 : this.positionSecs,
            // ```
            positionSecs = if (newCurrent == null) 0.0 else positionSecs,
        )
    }
}
