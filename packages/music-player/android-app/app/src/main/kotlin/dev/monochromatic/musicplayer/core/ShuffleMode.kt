// File summary (folds in the old KDoc's domain content):
//
// This file declares ONE type, `ShuffleMode`, a three-state setting that controls both
// (a) whether playback order is shuffled and (b) the SCOPE that playback loops over. It is
// a faithful port of the desktop player's `ShuffleMode` (desktop file `command.rs`).
//
// The three states and what each one means for the listener:
//   - OFF .......... play the current page in load order, looping WITHIN the page.
//   - WITHIN_PAGE .. shuffle the current page, looping WITHIN the page once all are played.
//   - ALL .......... shuffle the WHOLE queue, looping the whole queue once all are played.
//
// "Page" here is a domain term: a track's top-level folder, or (for a track that sits at the
// library root) its A-Z / `#` letter bucket.
//
// Deliberate limitation (this is a feature, not an omission): OFF and WITHIN_PAGE both confine
// playback to the current page and loop within it; only ALL traverses and loops the whole queue.
// So there is intentionally NO "play the whole queue in load order, looped" mode. The reasoning:
// when a listener is playing in order (not shuffling), they do not want playback to jump to a
// different artist the moment one folder ends; staying inside the current folder/page is the
// desired behaviour.
//
// Wire-form note (matters for cross-device sessions): the desktop persists these values using
// serde's variant names, i.e. the strings `"Off"`, `"WithinPage"`, and `"All"`. The session
// port maps to and from that wire form at the serialization boundary, which lets the Kotlin
// enum constants below stay idiomatic Kotlin (SCREAMING_SNAKE_CASE) rather than mirroring the
// desktop's PascalCase spelling.
//
// Important difference from the desktop port (do NOT carry the desktop comment over): the
// desktop Rust enum marks `Off` with `#[default]` + `derive(Default)` so that
// `ShuffleMode::default()` returns it. This Kotlin file has NO such default marker, and Kotlin
// enums have no language-level "default variant" concept at all. None of the constants below is
// special; whatever code constructs a fresh session must choose its own starting value.

// What:     `package dev.monochromatic.musicplayer.core` declares which "package" (Kotlin's
//           word for a namespace, i.e. a named bucket that fully-qualifies the names in this
//           file) this file belongs to. Every top-level name declared below, like the enum
//           `ShuffleMode`, becomes reachable from elsewhere as
//           `dev.monochromatic.musicplayer.core.ShuffleMode`. By convention the package name
//           mirrors the on-disk directory path (.../dev/monochromatic/musicplayer/core/).
// Why:      We need it so other files in the project can import `ShuffleMode` by its fully
//           qualified name, and so the compiler groups this file with the rest of the `core`
//           package. Omitting it would dump the name into an unnamed "default package" that
//           other packages cannot import from cleanly.
//
// In TS you'd write (pseudocode):
// ```ts
// // No `package` line in TS. Module identity comes from the file path itself, e.g.
// // import { ShuffleMode } from "./core/ShuffleMode";
// ```
package dev.monochromatic.musicplayer.core

// What:     `enum class ShuffleMode { ... }` declares an "enum class": a type whose value must
//           be exactly ONE of a fixed, named list of constants (here OFF, WITHIN_PAGE, ALL).
//           Each constant is a fieldless tag (it carries no extra data). `class` is part of the
//           keyword spelling Kotlin uses for enums; it does NOT mean these tags hold mutable
//           per-instance state.
//           Siblings a TS reader cannot know exist, and why we did NOT pick them:
//             - `sealed class` / `sealed interface`: would let each variant carry its own
//               different data/shape (like a discriminated union with payloads). We don't need
//               payloads here, just three plain tags, so the heavier sealed machinery is
//               overkill.
//             - three separate `object` singletons grouped under an interface: also supports
//               per-variant behaviour but loses the built-in "iterate all values" / "name" /
//               "ordinal" conveniences an enum gives for free.
//             - bare `String`/`Int` constants (e.g. `const val OFF = "off"`): no type safety;
//               nothing stops an unrelated string from being passed where a mode is expected.
//           An `enum class` is the simplest of these that gives a closed, type-safe set of tags.
// Why:      We need a single type that encodes the three shuffle behaviours so the rest of the
//           player can branch on "which mode are we in" with full compiler-checked exhaustiveness
//           (the compiler can warn if a `when` forgets a case). It also subsumes what a separate
//           repeat-all/off setting would have done, since the mode itself fixes the loop scope.
// Gotcha:   `enum class ShuffleMode` is PUBLIC by default. Kotlin's default visibility is public,
//           so the absence of any modifier here is the same as writing `public`. (Contrast the
//           desktop Rust port, which had to write an explicit `pub` to get the same reach.) A TS
//           reader seeing no `export`/no modifier should NOT assume this is file-private; it is
//           visible to the whole module graph.
//
// In TS you'd write (pseudocode):
// ```ts
// // String-literal union; the strings match the desktop's serialized wire form.
// export type ShuffleMode = "Off" | "WithinPage" | "All";
// ```
/**
 * Defines shuffle mode type for this music-player component; the TypeScript-oriented notes above explain its
 * role.
 */
enum class ShuffleMode {
    // What:     `OFF` is the first enum constant (a fieldless tag of type `ShuffleMode`). The
    //           trailing comma simply separates it from the next constant.
    // Why:      Represents "play the current page in load order, looping within the page." This
    //           is the un-shuffled, stay-in-this-folder behaviour.
    // Gotcha:   Despite being listed first, `OFF` is NOT a language-level default here. Unlike
    //           the desktop Rust enum (which tagged its `Off` variant with `#[default]`), Kotlin
    //           enums have no default variant; callers must pick a starting mode explicitly.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // "Off"
    // ```
    /**
     * Defines off case for this music-player state; the TypeScript-oriented notes above explain when it is
     * selected.
     */
    OFF,

    // What:     `WITHIN_PAGE` is the second enum constant (a fieldless tag of type `ShuffleMode`).
    //           The underscore spelling is just Kotlin's SCREAMING_SNAKE_CASE convention for enum
    //           constants; it maps to the desktop's PascalCase `"WithinPage"` at the wire boundary.
    // Why:      Represents "shuffle the current page, looping within the page once all are
    //           played." Shuffling is confined to the current folder/letter-bucket.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // "WithinPage"
    // ```
    /**
     * Defines within page case for this music-player state; the TypeScript-oriented notes above explain when it
     * is selected.
     */
    WITHIN_PAGE,

    // What:     `ALL` is the third and final enum constant (a fieldless tag of type
    //           `ShuffleMode`). Kotlin permits the trailing comma after the last constant; it is
    //           legal syntax and not an extra empty member, so it must stay exactly as written.
    // Why:      Represents "shuffle the whole queue, looping the queue once all are played." This
    //           is the only mode that crosses page/folder boundaries.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // "All"
    // ```
    /**
     * Defines all case for this music-player state; the TypeScript-oriented notes above explain when it is
     * selected.
     */
    ALL,
}
