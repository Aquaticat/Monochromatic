// ===========================================================================
// File summary (domain, for a TypeScript-only reader)
//
// This file defines the two plain record types used by the music player's
// "pagination" feature: `PageEntry` (one track's row on a page) and `Page`
// (one tab in the browser, holding a label plus its rows). It is a faithful
// port of the desktop app's `pagination.rs` (`PageEntry` / `Page` structs).
//
// What pagination means here (folded in from the desktop module header):
// a long music queue is split into pages so it can be browsed a page at a
// time. There are two grouping axes, chosen PER track from the track's
// display string (its path relative to the queue's common root):
//   - A track inside a subfolder (its relative path contains a `/`) groups by
//     its TOP-LEVEL folder under the loaded root, one level only: the page
//     label is that single folder name (e.g. `Artist`), while any deeper
//     nesting (`Artist/Album/01.flac`) still shows in the row's full path.
//   - A track sitting directly at the root (no `/`) groups by its first
//     letter into fixed buckets: the 26 English letters A-Z
//     (case-insensitive), plus a single `#` catch-all page for digits,
//     symbols, CJK, and non-English letters.
// Pages come out sorted folder-pages-first (case-insensitively by path),
// then the A-Z letter pages, then the `#` catch-all.
//
// This file holds ONLY the data shapes; the grouping/sorting logic lives
// elsewhere. Nothing here does I/O, audio, or UI. The whole file is two
// `data class` declarations and their properties.
// ===========================================================================

// What:     `package dev.monochromatic.musicplayer.core` declares which
//           "package" (Kotlin's namespace) every type in this file belongs
//           to. A package is just a dotted name that groups related types;
//           the dotted path conventionally mirrors the on-disk folder path
//           (`.../kotlin/dev/monochromatic/musicplayer/core/`). Other files
//           refer to `Page` / `PageEntry` either by importing
//           `dev.monochromatic.musicplayer.core.Page` or by living in the
//           same package.
// Why:      We need this so the two types below have a stable, fully-qualified
//           name (`dev.monochromatic.musicplayer.core.PageEntry`) that the
//           rest of the app can import; without a package line the types land
//           in an unnamed default package that is awkward to import from.
// Gotcha:   Unlike a TS `import`, this line imports NOTHING and runs no code.
//           It only NAMES the current file's namespace. It must be the first
//           non-comment line in the file.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword for this. The file's location is its namespace:
// //   src/core/Page.ts  ->  imported as "@app/core/Page"
// // and you'd `export` each type below instead of declaring a package.
// ```
package dev.monochromatic.musicplayer.core

// What:     `data class PageEntry( ... )` declares a "data class" named
//           `PageEntry`. A plain Kotlin `class` would give you only a type
//           with reference identity. The `data` modifier tells the compiler
//           to AUTO-GENERATE, from the properties listed in the parentheses
//           (the "primary constructor"), these members: `equals` + `hashCode`
//           (structural, field-by-field comparison), `toString` (a readable
//           `PageEntry(index=3, name=...)` dump), `copy(...)` (make a near-
//           duplicate changing only chosen fields), and `componentN()`
//           accessors that enable destructuring. The two values inside the
//           `( ... )` are this entry: a position in the queue plus the
//           display name shown for that row.
// Why:      We need value-style records: the pagination code builds and
//           compares whole `PageEntry` values, and the unit tests assert two
//           entries are equal by their fields (not by object identity). The
//           generated `equals`/`hashCode`/`toString` give us exactly that for
//           free.
// Gotcha:   Two `PageEntry` instances with equal fields are `==` (Kotlin's
//           structural-equality operator), which is NOT how a plain Kotlin
//           class behaves and NOT how TS object references compare with
//           `===`. `data` is what flips `==` from "same object" to "same
//           contents". (Reference identity is still available via `===` in
//           Kotlin, the opposite spelling from TS.)
//
// In TS you'd write (pseudocode):
// ```ts
// // A record: position in the queue + the row's display name.
// type PageEntry = {
//   index: number;
//   name: string;
// };
// ```
/**
 * Defines page entry type for this music-player component; the TypeScript-oriented notes above explain its role.
 */
data class PageEntry(
    // What:     `val index: Int`. `val` declares a READ-ONLY property: it is
    //           both a primary-constructor parameter AND a field you can read
    //           but never reassign after construction. `Int` is Kotlin's
    //           32-bit signed integer (range roughly +/-2.1 billion). Sibling
    //           integer types the reader might have expected: `Long` (64-bit),
    //           `Short` (16-bit), `Byte` (8-bit). `index` is this track's
    //           position inside the full queue.
    // Why:      `val` (not `var`) because an entry never changes after the
    //           page is built; mutability would only invite bugs. `Int` (not
    //           `Long`) because Kotlin's collection-size and element-access
    //           APIs (`List.size`, `list[i]`, `get(index: Int)`) are all
    //           Int-typed, so storing the index as `Long` would force a
    //           `.toInt()` conversion at every queue lookup.
    // Gotcha:   `Int` is a fixed-width 32-bit integer, NOT TS's arbitrary
    //           `number`; it can overflow (wrap around) past ~2.1 billion,
    //           whereas TS `number` would keep widening to a float.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly index: number;
    // ```
    val index: Int,
    // What:     `val name: String`. `val` again means a read-only property
    //           (set once in the constructor, never reassigned). `String` is
    //           Kotlin's immutable, GC-managed sequence of UTF-16 characters.
    //           This holds the row's display text: the queue-relative path
    //           (e.g. `Artist/Album/01.flac`) for a subfolder track, or a
    //           bare filename for a root-level track.
    // Why:      `val` because the display name is fixed once the page is
    //           assembled. `String` is the only sensible choice for text in
    //           Kotlin; its super-interface `CharSequence` (the sibling a
    //           reader might wonder about) is an abstract read-only view used
    //           for accepting many text-like types, not for STORING a concrete
    //           string, so a field uses `String`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly name: string;
    // ```
    val name: String,
)

// What:     `data class Page( ... )` declares a second data class named
//           `Page`: one page (one tab) in the two-axis pagination. As with
//           `PageEntry`, the `data` modifier auto-generates structural
//           `equals`/`hashCode`/`toString`/`copy`/`componentN` from the two
//           primary-constructor properties below. A `Page` carries its tab
//           caption plus the list of track rows shown under that tab.
// Why:      We need a value record per page so the UI can render one tab per
//           page (using its label) and list that page's tracks, and so tests
//           can compare whole `Page` values by their contents. This is the
//           desktop's `#[derive(Debug, Clone, PartialEq, Eq)] struct Page`.
// Gotcha:   Same as `PageEntry`: `==` on two `Page` values compares their
//           fields (structural), unlike a plain class or a TS `===` reference
//           check. Because `entries` is itself compared field-by-field, two
//           pages are equal only when their labels match AND their entry
//           lists are element-for-element equal.
//
// In TS you'd write (pseudocode):
// ```ts
// // One tab: its caption plus the rows shown under it.
// type Page = {
//   label: string;
//   entries: PageEntry[];
// };
// ```
/**
 * Defines page type for this music-player component; the TypeScript-oriented notes above explain its role.
 */
data class Page(
    // What:     `val label: String`. A read-only (`val`) property holding the
    //           page's tab caption: either a top-level folder name (e.g.
    //           `Artist`), a single A-Z letter, or the literal `#` catch-all.
    //           `String` is Kotlin's immutable UTF-16 text type (see the
    //           `name` block above for siblings).
    // Why:      `val` because a page's label is fixed once the page is built.
    //           `String` because the label is plain text built fresh while
    //           grouping (sliced from a path or chosen as a letter/`#`).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly label: string;
    // ```
    val label: String,
    // What:     `val entries: List<PageEntry>`. A read-only (`val`) property
    //           whose type is `List<PageEntry>`. `List<T>` is Kotlin's
    //           READ-ONLY list interface: an ordered collection exposing
    //           `size`, indexed access, and iteration, but NO add/remove/set
    //           methods. The `<PageEntry>` is the element type (generic
    //           parameter), so this is "an ordered, non-mutating list of
    //           `PageEntry`". Siblings the reader might have expected:
    //           `MutableList<T>` (adds `add`/`remove`/`set`), `Array<T>`
    //           (fixed-size, mutable elements), `Set<T>` (unordered, unique),
    //           `Collection<T>` (the unindexed super-interface).
    // Why:      `val` plus `List` (not `MutableList`) because a page's rows are
    //           assembled once and then only read: the UI iterates them, tests
    //           compare them, nothing mutates them afterwards. Choosing the
    //           read-only `List` interface documents that and blocks
    //           accidental mutation. (`val` freezes the REFERENCE; `List` as
    //           the type freezes the CONTENTS' mutating API; both are wanted.)
    // Gotcha:   Kotlin's `List` is a read-only VIEW/interface, not a deep-
    //           immutable guarantee: the same underlying object could be held
    //           elsewhere as a `MutableList` and changed behind your back.
    //           Think TS `readonly PageEntry[]` (the array type forbids
    //           mutation through THIS reference), not a frozen/`Object.freeze`
    //           deep copy.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly entries: readonly PageEntry[];
    // ```
    val entries: List<PageEntry>,
)
