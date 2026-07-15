// ============================================================================
// File summary (folds in the old KDoc that sat on the `Track` type below)
// ============================================================================
//
// This file declares ONE type, `Track`: a single library entry, the bridge
// between a storage source and the player. The engine plays a track's `uri`,
// while the UI and pagination group and label rows by its `displayPath`. The
// two fields are deliberately SEPARATE because an Android `content://` URI does
// not relativize into a readable folder path the way the desktop's filesystem
// path does; the source supplies a real relative path for display AND an opaque
// URI for playback. `PlayerController` feeds the display paths to the ported
// `Queue` (whose pagination treats them exactly like the desktop's relative
// paths) and keeps the URIs in a PARALLEL list it loads by the queue's
// load-order index.
//
// The whole file is one `data class` declaration with two read-only fields.
// Nothing here does I/O, audio, or UI; it is a pure data shape.
//
// Field meanings folded in from the old `@property` KDoc:
//   - `uri`: the opaque locator the `AudioEngine` loads (a MediaStore
//     `content://media/...` URI, a SAF document URI, or a bare filesystem path).
//   - `displayPath`: the source-root-relative slash path shown in the list and
//     grouped into pages, e.g. `Artist/Album/01.flac`.
// ============================================================================

// What:     `package dev.monochromatic.musicplayer` declares which "package"
//           (Kotlin's word for a namespace, i.e. a named bucket that fully
//           qualifies the names in this file) this file belongs to. The single
//           top-level type declared below, `Track`, becomes reachable elsewhere
//           as `dev.monochromatic.musicplayer.Track`. By convention the package
//           name mirrors the on-disk directory path
//           (.../kotlin/dev/monochromatic/musicplayer/).
// Why:      We need it so `PlayerController`, the storage sources, and the UI
//           (which all live in this same package and so don't even need an
//           import) can refer to `Track` by a stable, fully-qualified name.
// Gotcha:   Unlike a TS `import`, this line imports NOTHING and runs no code. It
//           only NAMES the current file's namespace, and must be the first
//           non-comment line in the file.
//
// In TS you'd write (pseudocode):
// ```ts
// // No `package` line in TS. Module identity comes from the file path itself:
// //   src/musicplayer/Track.ts  ->  imported via that path.
// ```
package dev.monochromatic.musicplayer

// What:     `data class Track(val uri: String, val displayPath: String)` declares
//           a "data class" named `Track`. A plain Kotlin `class` would give you
//           only a type with reference identity (two instances are "equal" only
//           if they are literally the same object). The `data` modifier tells the
//           compiler to AUTO-GENERATE, from the properties listed in the
//           parentheses (the "primary constructor"), these members: `equals` +
//           `hashCode` (structural, field-by-field comparison), `toString` (a
//           readable `Track(uri=..., displayPath=...)` dump), `copy(...)` (make a
//           near-duplicate changing only chosen fields), and `componentN()`
//           accessors enabling destructuring. The two values inside the `( ... )`
//           are the record's fields:
//           - `val uri: String`. `val` declares a READ-ONLY property: it is both
//             a primary-constructor parameter AND a field you can read but never
//             reassign after construction. `String` is Kotlin's immutable UTF-16
//             text type. Sibling type the reader might have expected: `CharSequence`
//             (the read-only super-interface `String` implements). There is NO
//             owned-vs-borrowed split here (unlike Rust's `String`/`&str` a TS
//             reader may have heard of); every Kotlin `String` is GC-managed.
//           - `val displayPath: String`. The same: a read-only `String` property.
// Why:      We need a value-style record so the player can hold, compare, and copy
//           library entries cheaply. The generated structural `equals`/`hashCode`
//           let two `Track`s with the same `uri`/`displayPath` count as equal, and
//           `copy(...)` would let a caller derive a tweaked entry without mutating
//           the original. Both fields are `val` (not `var`) because a library
//           entry is immutable once read from a source. Both are `String` (not a
//           richer URI/Path type) because the engine takes a string URI and the
//           pagination takes a string display path, so storing them as plain text
//           avoids conversions at every use.
// Gotcha:   Two `Track` instances with equal fields are `==` (Kotlin's structural-
//           equality operator), which is NOT how a plain Kotlin class behaves and
//           NOT how TS object references compare with `===`. `data` is what flips
//           `==` from "same object" to "same contents". Reference identity is still
//           available via `===` in Kotlin, the OPPOSITE spelling from TS where
//           `===` means value/strict equality. Also: `data class` is PUBLIC by
//           default (Kotlin's default visibility is public), so the absence of any
//           modifier here is the same as writing `public`; a TS reader seeing no
//           `export` should NOT assume this is file-private.
//
// In TS you'd write (pseudocode):
// ```ts
// // An immutable library entry: an opaque playback URI plus a display path.
// type Track = {
//   readonly uri: string;
//   readonly displayPath: string;
// };
// // Construction is a plain object literal (no `new`, no generated `copy`):
// const t: Track = { uri, displayPath };
// ```
/**
 * Defines track type for this music-player component; the TypeScript-oriented notes above explain its role.
 */
data class Track(val uri: String, val displayPath: String)
