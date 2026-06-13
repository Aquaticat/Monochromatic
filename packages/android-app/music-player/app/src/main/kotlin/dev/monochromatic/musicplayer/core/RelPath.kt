// Summary (folded in from the original KDoc on this file):
//   Pure relative-path display. We strip the longest common directory prefix from a queue's track
//   paths so the UI shows each track relative to the loaded root (`Artist/Album/01.flac` instead of
//   the full path, or a bare filename when the whole queue is one folder). This is a faithful port of
//   the desktop player's `relpath.rs`; it has no platform dependency and is fully unit-tested against
//   the same Rust test vectors. The pagination grouping consumes this output, and the fallback to the
//   full path guards a degenerate input that would otherwise collapse a UI row to an empty label.

// What:     `package dev.monochromatic.musicplayer.core` names the namespace this file's
//           declarations live in. Every Kotlin file starts with a `package` line; the dotted name
//           mirrors the directory path `dev/monochromatic/musicplayer/core/`. Anything declared here
//           (the `SEPARATOR` constant, the three functions) is reachable from other files in the same
//           package without an import, and from other packages by importing this name.
// Why:      We need the namespace so the rest of the app (the queue, the pagination code) can refer to
//           `relativeDisplayPaths` as a member of `dev.monochromatic.musicplayer.core`.
// TS map:   Closest equivalent is the folder/module a `.ts` file lives in plus its barrel re-exports.
//           TS has no `package` keyword; the module path comes from the file path and `import`
//           specifiers, not a line of code.
//
// In TS you'd write (pseudocode):
// ```ts
// // No 1:1 equivalent — in TS the module identity comes from the file path, there is no
// // `package` statement. Picture this file living at src/core/RelPath.ts and being imported as
// // `import { relativeDisplayPaths } from "./core/RelPath";`.
// ```
package dev.monochromatic.musicplayer.core

// What:     `private const val SEPARATOR = "/"` declares a top-level constant.
//           - `private` limits visibility to THIS file (other files cannot see `SEPARATOR`).
//           - `const val` is a COMPILE-TIME constant: its value is baked into the bytecode wherever
//             it is used, so it must be a primitive or `String` literal known at compile time.
//             Siblings the reader might have expected:
//               * plain `val` — a read-only binding computed at runtime (can hold any object, not
//                 inlined). `const val` is the stricter, compile-time-only form.
//               * `var` — a re-assignable (mutable) binding. We do not want that here.
//           - The type is inferred as `String` from the `"/"` literal; we did not write `: String`.
// Why:      The queue is path-based and the UI/pagination expect a single `/` separator; naming it
//           once avoids a bare `"/"` literal scattered through the split and the re-join below.
// TS map:   `const SEPARATOR = "/";` — a module-scoped `const`. TS `const` already implies "do not
//           reassign", so the `const val` vs `val` vs `var` distinction collapses to just `const`.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEPARATOR = "/";
// ```
private const val SEPARATOR = "/"

// What:     `private fun normalComponents(path: String): List<String>` declares a function.
//           - `private` keeps it visible only inside this file (an internal helper).
//           - `fun` is the function keyword.
//           - `path: String` is the single parameter: an owned, immutable text string. (Kotlin
//             `String` is a reference type but is immutable, so there is no borrowed-vs-owned
//             question the way Rust has `&str` vs `String`.)
//           - `: List<String>` is the return type: a READ-ONLY list of strings. Siblings the reader
//             might have expected:
//               * `MutableList<String>` — the same data but with `add`/`remove` methods exposed.
//               * `Array<String>` — a fixed-size, mutable-element JVM array.
//             We return the read-only `List` interface so callers cannot mutate what we hand back.
// Why:      We need to split a path into just its named folder/file segments, dropping the root and
//           any `.`/`..` markers, so the prefix comparison and re-joining below are clean.
// TS map:   `function normalComponents(path: string): string[]` — TS `string[]` is the everyday
//           array; it is always mutable, so TS has no read-only-`List` vs `MutableList` split.
//
// In TS you'd write (pseudocode):
// ```ts
// function normalComponents(path: string): string[] {
//   return path.split("/").filter((seg) => seg !== "" && seg !== "." && seg !== "..");
// }
// ```
private fun normalComponents(path: String): List<String> =
    // What:     The `=` after the signature is Kotlin's EXPRESSION-BODY function form: instead of a
    //           `{ ... }` block with a `return`, the whole function IS the single expression on the
    //           right, and its value is returned implicitly. So this entire `path.split(...).filter(...)`
    //           line is both the body and the return value.
    //           Piece by piece:
    //           - `path.split(SEPARATOR)` cuts the string at every `/` and returns a `List<String>`
    //             of the pieces (including empty pieces for leading/trailing or doubled slashes).
    //           - `.filter { ... }` keeps only the elements for which the lambda returns `true`,
    //             producing a new list. The `{ ... }` is a TRAILING LAMBDA: when a lambda is the last
    //             argument, Kotlin lets you move it outside the parentheses (here `filter`'s only
    //             argument is the lambda, so the parentheses vanish entirely).
    //           - Inside the lambda, `it` is the IMPLICIT single parameter name Kotlin gives a lambda
    //             that takes exactly one argument; here `it` is each segment string. `it.isNotEmpty()`
    //             drops empty pieces; `it != "."` and `it != ".."` drop the relative-path markers.
    // Why:      Dropping empties and `.`/`..` leaves just the real folder and file names, so two paths
    //           can be compared segment-by-segment and rejoined consistently.
    // TS map:   `return path.split("/").filter((seg) => seg !== "" && seg !== "." && seg !== "..");`
    //           — `it` becomes a named arrow parameter `seg`, and `.isNotEmpty()` becomes `!== ""`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return path.split("/").filter((seg) => seg !== "" && seg !== "." && seg !== "..");
    // ```
    path.split(SEPARATOR).filter { it.isNotEmpty() && it != "." && it != ".." }

// What:     `private fun commonPrefixLen(lists: List<List<String>>): Int` declares a function.
//           - `private` — file-internal helper.
//           - `lists: List<List<String>>` is the parameter: a read-only list whose elements are
//             themselves read-only lists of strings (one segment-list per track).
//           - `: Int` is the return type: a 32-bit signed integer. Sibling the reader might have
//             expected: `Long` (a 64-bit signed integer). We use `Int` because collection sizes and
//             indices in Kotlin are `Int` (`List.size` is `Int`, `list[i]` indexes with `Int`); using
//             `Long` would force `.toInt()`/`.toLong()` conversions at every index and is pointless
//             for in-memory list lengths.
// Why:      We need to know how many LEADING segments every track shares (capped so the filename
//           always survives); that shared run is the "loaded root" we strip off.
// TS map:   `function commonPrefixLen(lists: string[][]): number` — TS has only `number`, so the
//           `Int` vs `Long` choice does not arise.
//
// In TS you'd write (pseudocode):
// ```ts
// function commonPrefixLen(lists: string[][]): number { ... }
// ```
private fun commonPrefixLen(lists: List<List<String>>): Int {
    // What:     `val shortest = lists.minOfOrNull { it.size } ?: 0`.
    //           - `val` declares a read-only local binding (cannot be reassigned). Sibling: `var`
    //             would be reassignable; we do not need that.
    //           - `lists.minOfOrNull { it.size }` walks every inner list, takes its `.size` (an `Int`),
    //             and returns the SMALLEST size. The trailing lambda `{ it.size }` is the selector;
    //             `it` is each inner list. The `OrNull` suffix means: if `lists` is EMPTY there is no
    //             minimum, so it returns `null` instead of throwing. Its result type is therefore
    //             `Int?` (a nullable `Int`).
    //           - `?: 0` is the ELVIS operator: "if the left side is `null`, use `0` instead". So
    //             `shortest` ends up a plain non-null `Int`.
    // Why:      The common prefix can never be longer than the shortest path's segment count; and an
    //           empty queue must fall back to `0` rather than crash on a `null`.
    // TS map:   `const shortest = lists.length ? Math.min(...lists.map((l) => l.length)) : 0;`
    //           The Elvis `?: 0` is TS's `?? 0` (nullish-coalescing): supply a default when the left is
    //           null/undefined.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const sizes = lists.map((l) => l.length);
    // const shortest = sizes.length === 0 ? 0 : Math.min(...sizes);
    // ```
    val shortest = lists.minOfOrNull { it.size } ?: 0
    // What:     `if (shortest == 0) return 0`. An early `return` when some path has no named segments
    //           at all (so there is nothing to strip). `==` in Kotlin is STRUCTURAL equality (it calls
    //           `.equals()`), which for `Int` is just numeric equality.
    // Why:      Guards the `shortest - 1` line below: if we let `shortest` be 0 the cap would be -1 and
    //           the loop bounds would be nonsense. (In the Rust twin this also avoids unsigned
    //           underflow; in Kotlin `Int` is signed so it would not panic, but the early return is the
    //           same clean guard.)
    // TS map:   `if (shortest === 0) return 0;` — note Kotlin's `==` maps to TS's `===` for these
    //           value comparisons, because Kotlin `==` does not do JS-style loose coercion.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (shortest === 0) return 0;
    // ```
    if (shortest == 0) return 0
    // What:     `val cap = shortest - 1`. A read-only `Int` holding the most segments we are allowed to
    //           strip, leaving at least the final one (the filename) on every track. `- 1` is ordinary
    //           integer subtraction, identical to TS.
    // Why:      A UI row must never collapse to an empty label, so we always keep at least one segment.
    // TS map:   `const cap = shortest - 1;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const cap = shortest - 1;
    // ```
    val cap = shortest - 1
    // What:     `var run = 0`. A MUTABLE local `Int`, the counter for how many leading segments match
    //           so far. We use `var` (not `val`) precisely because the loop below reassigns it.
    // Why:      We need a running count we can increment as we confirm each shared segment.
    // TS map:   `let run = 0;` — Kotlin `var` is TS `let`; Kotlin `val` is TS `const`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let run = 0;
    // ```
    var run = 0
    // What:     `while (run < cap && lists.all { it[run] == lists[0][run] }) { ... }`.
    //           - The loop continues while BOTH conditions hold (`&&` short-circuits, so the
    //             right side is only evaluated while `run < cap`).
    //           - `lists.all { ... }` returns `true` only when the trailing-lambda predicate holds for
    //             EVERY element. `it` is each inner list; `it[run]` indexes that list at position
    //             `run` (safe here because `run < cap < shortest <= every list's size`).
    //           - `lists[0]` is the first track's segment list, used as the reference; `lists[0][run]`
    //             is its segment at position `run`. `==` is structural string equality.
    // Why:      One linear scan finds the longest shared leading run without recursion: as soon as any
    //           track disagrees at position `run`, `.all` is `false` and we stop.
    // TS map:   `while (run < cap && lists.every((l) => l[run] === lists[0][run])) { ... }`
    //           — Kotlin `.all { }` is TS `.every(() => ...)`; the implicit `it` becomes a named `l`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (run < cap && lists.every((l) => l[run] === lists[0][run])) {
    //   run++;
    // }
    // ```
    while (run < cap && lists.all { it[run] == lists[0][run] }) {
        // What:     `run++`. Post-increment: advance the counter past a segment that all tracks share.
        //           This is the one mutation that justifies `run` being a `var`. Character-identical to
        //           TS.
        // Why:      Move on to compare the next position.
        // TS map:   `run++;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // run++;
        // ```
        run++
    }
    // What:     `return run`. Hand back the shared-prefix length. Because this function has a `{ }`
    //           block body (not the expression-body `=` form used above), the return is EXPLICIT.
    // Why:      The caller needs to know how many leading segments to drop from every track.
    // TS map:   `return run;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return run;
    // ```
    return run
}

// What:     `fun relativeDisplayPaths(tracks: List<String>): List<String>` declares the one PUBLIC
//           function of this file (no `private`, so it is visible to the rest of the module — Kotlin's
//           default visibility is `public`).
//           - `tracks: List<String>` is the parameter: a read-only list of full track-path strings, in
//             load order. Sibling the reader might expect: `MutableList<String>`; we take the read-only
//             `List` because we never mutate the input.
//           - `: List<String>` returns one relative display string per track, in the same order.
// Why:      The UI shows folders, not just bare filenames, but the shared absolute prefix (e.g. a long
//           music-library root) is noise; this strips it once per queue.
// TS map:   `function relativeDisplayPaths(tracks: string[]): string[]`
//
// In TS you'd write (pseudocode):
// ```ts
// function relativeDisplayPaths(tracks: string[]): string[] {
//   if (tracks.length === 0) return [];
//   const componentLists = tracks.map(normalComponents);
//   const prefixLen = commonPrefixLen(componentLists);
//   return componentLists.map((list, i) => {
//     const relative = list.slice(prefixLen).join("/");
//     return relative === "" ? tracks[i] : relative;
//   });
// }
// ```
fun relativeDisplayPaths(tracks: List<String>): List<String> {
    // What:     `if (tracks.isEmpty()) return emptyList()`. An early `return` for an empty queue.
    //           - `tracks.isEmpty()` is `true` when the list has no elements.
    //           - `emptyList()` is a factory function that returns a shared, immutable empty
    //             `List<String>`. Siblings the reader might have expected:
    //               * `listOf()` — also makes an immutable list, but `emptyList()` is the canonical
    //                 zero-element form.
    //               * `mutableListOf()` — would make a NEW empty MUTABLE list each call.
    //             We use `emptyList()` because we are returning, not building up, and it avoids an
    //             allocation (the empty list is a singleton).
    // Why:      Nothing to relativize, and `commonPrefixLen` of nothing has no meaningful prefix.
    // TS map:   `if (tracks.length === 0) return [];` — `emptyList()` is just the literal `[]`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (tracks.length === 0) return [];
    // ```
    if (tracks.isEmpty()) return emptyList()
    // What:     `val componentLists = tracks.map { normalComponents(it) }`.
    //           - `val` — read-only local; its inferred type is `List<List<String>>`.
    //           - `tracks.map { ... }` transforms each element into a new value, producing a new list
    //             of the same length. The `{ ... }` is a trailing lambda; `it` is each track path
    //             string, and we pass it to `normalComponents` to get that track's segment list.
    // Why:      Compute each path's named segments ONCE here, then reuse them both for the shared
    //           prefix and for each track's remainder below.
    // TS map:   `const componentLists = tracks.map(normalComponents);` — Kotlin's `it` is the arrow
    //           parameter; here we could even write `tracks.map(::normalComponents)`, the function
    //           reference, mirroring TS passing the function directly.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const componentLists = tracks.map((it) => normalComponents(it));
    // ```
    val componentLists = tracks.map { normalComponents(it) }
    // What:     `val prefixLen = commonPrefixLen(componentLists)`. A read-only `Int`: how many leading
    //           segments are the shared root. Plain function call, no special syntax; Kotlin passes the
    //           list by reference (there is no borrow annotation as in Rust).
    // Why:      Decide how many leading segments to strip from every track.
    // TS map:   `const prefixLen = commonPrefixLen(componentLists);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const prefixLen = commonPrefixLen(componentLists);
    // ```
    val prefixLen = commonPrefixLen(componentLists)
    // What:     `return componentLists.zip(tracks).map { (list, path) -> ... }`. The final, returned
    //           expression, built from two chained calls:
    //           - `componentLists.zip(tracks)` pairs up the two equal-length lists element-by-element,
    //             producing a `List<Pair<List<String>, String>>`: each entry is (this track's segment
    //             list, this track's original full path). We keep the original path around so the
    //             empty-result fallback can reach it.
    //           - `.map { (list, path) -> ... }` transforms each pair into one display string. The
    //             `(list, path)` inside the lambda is a DESTRUCTURING declaration: it unpacks the
    //             `Pair` into two named locals (`list` = the segment list, `path` = the original full
    //             path) instead of using the implicit single `it`.
    // Why:      Produce one relative display string per track while preserving load order.
    // TS map:   `return componentLists.map((list, i) => { ... using tracks[i] ... });` — TS has no
    //           `zip`, so you carry the index `i` and read `tracks[i]`; Kotlin's `zip` + destructuring
    //           gives you both halves directly.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return componentLists.map((list, i) => {
    //   const path = tracks[i];
    //   const relative = list.slice(prefixLen).join("/");
    //   return relative === "" ? path : relative;
    // });
    // ```
    return componentLists.zip(tracks).map { (list, path) ->
        // What:     `val relative = list.drop(prefixLen).joinToString(SEPARATOR)`.
        //           - `list.drop(prefixLen)` returns a NEW list with the first `prefixLen` elements
        //             removed — i.e. the segments that come AFTER the shared root. (It drops a COUNT
        //             from the front; it is not a start..end range slice.)
        //           - `.joinToString(SEPARATOR)` glues the remaining segments back together with `/`
        //             between them, yielding a single `String`.
        // Why:      The segments past the common root ARE the relative path we want to show.
        // TS map:   `const relative = list.slice(prefixLen).join("/");` — Kotlin's `drop(n)` is TS's
        //           `slice(n)` (drop the first `n`); `joinToString(sep)` is TS's `join(sep)`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const relative = list.slice(prefixLen).join("/");
        // ```
        val relative = list.drop(prefixLen).joinToString(SEPARATOR)
        // What:     `if (relative.isEmpty()) path else relative`. This is an IF-EXPRESSION: in Kotlin
        //           `if/else` produces a value (like a ternary), so this whole line evaluates to one of
        //           the two branches and, being the last expression in the lambda, becomes the lambda's
        //           result for this element. `relative.isEmpty()` is `true` for the empty string.
        //           NOTE: both branches are already plain `String`s — `path` is the untouched original
        //           input string — so there is no conversion or copying step here (unlike the Rust
        //           twin, whose paths needed a lossy-UTF-8 `to_string_lossy()`; that concern does not
        //           exist in this Kotlin file).
        // Why:      Defensive fallback: a pathological path with no named segments would relativize to
        //           the empty string, which would render as a blank UI row; show its full original text
        //           instead.
        // TS map:   `return relative === "" ? path : relative;` — Kotlin's value-producing `if/else`
        //           is TS's `cond ? a : b`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return relative === "" ? path : relative;
        // ```
        if (relative.isEmpty()) path else relative
    }
}
