// What:     `package dev.monochromatic.musicplayer.core` names the namespace this
//           file's declarations live under. Every top-level name below
//           (`AUDIO_EXTENSIONS`, `isAudioFile`, `audioFilesSorted`, …) becomes
//           reachable from other files as `dev.monochromatic.musicplayer.core.<name>`,
//           or via an `import`. It is not a statement that runs; it is metadata
//           the compiler reads to decide where these symbols belong.
// Why:      Without it the symbols would land in the unnamed default package and
//           collide with everything else; the build expects this file's package
//           to match its directory path (`.../core/`).
//
// In TS you'd write (pseudocode):
// ```ts
// // No statement equivalent — the file's path *is* its namespace in TS.
// ```
package dev.monochromatic.musicplayer.core

// MODULE SUMMARY (folded in from the old KDoc that lived here):
//
// Pure audio-file recognition and within-folder ordering. This is a faithful
// port of the desktop player's Rust `playback.rs`. It covers three things:
//   1. the allowlist of playable file extensions (`AUDIO_EXTENSIONS`),
//   2. the case-insensitive "is this filename an audio file?" predicate
//      (`isAudioFile`), and
//   3. the pure filter-then-sort applied to the names found directly inside one
//      directory (`audioFilesSorted`).
//
// What is deliberately NOT in this file: the recursive directory traversal
// itself (reading directory entries, skipping symlinked folders to stay
// loop-safe, the depth-first "a folder's own files before its subfolders'
// files, subfolders ascending" ordering, and the single-file passthrough). That
// part retargets to Android storage APIs later and is intentionally left out
// here; when it is written, it will reuse `audioFilesSorted` once per directory
// as its pure ordering primitive. Cross-directory ordering (parent files before
// child files) stays with that future traversal, not here.
//
// "Pure" means: these functions read only their arguments and the constant
// allowlist, touch no disk, and return the same output for the same input. That
// is what lets the desktop and Android sides agree on what counts as audio.

// What:     `private const val SEPARATOR: Char = '/'`. Declares a compile-time
//           constant named `SEPARATOR` holding the single character `'/'`.
//           - `private` limits visibility to THIS file (other files cannot see it).
//           - `const` means the value is known at compile time and inlined at every
//             use site — stricter than a plain `val`, which is merely "assigned once
//             at runtime".
//           - `val` means read-only (cannot be reassigned), the opposite of `var`.
//           - `: Char` is the type. `Char` is a SINGLE 16-bit UTF-16 code unit, not a
//             string. Siblings a TS reader might expect instead: `String` (a sequence
//             of chars) — TS has no dedicated char type at all.
//           - `'/'` uses SINGLE quotes, which in Kotlin means a `Char` literal;
//             DOUBLE quotes `"/"` would be a `String`.
// Why:      The path-splitting code below asks "where is the last `/`?" to isolate the
//           final path component; naming the slash once keeps that intent legible and
//           prevents a stray typo'd literal.
// Gotcha:   `'/'` (single quotes) is a `Char` in Kotlin but would be a SyntaxError in
//           TS, where single and double quotes both make strings. Do not read `'/'` as
//           a TS string literal.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEPARATOR = "/"; // one-char string; TS has no Char type
// ```
/**
 * Defines separator value for this music-player component; the TypeScript-oriented notes above explain its
 * source and use.
 */
private const val SEPARATOR: Char = '/'

// What:     `private const val EXTENSION_DOT: Char = '.'`. Same construct as the line
//           above, declaring a file-private compile-time `Char` constant holding the
//           dot `'.'` that separates a filename from its extension.
//           - `private` / `const` / `val` / `: Char` / single-quoted literal all mean
//             exactly what they did for `SEPARATOR` above.
//           Sibling type the reader might expect: `String` (`"."`); we use `Char`
//           because the extension search works one character at a time.
// Why:      The extension-extraction code asks "where is the last `.`?"; naming it
//           keeps that search self-documenting and matches `SEPARATOR`'s style.
// Gotcha:   Single quotes = `Char`, not a TS-style string. Same trap as `SEPARATOR`.
//
// In TS you'd write (pseudocode):
// ```ts
// const EXTENSION_DOT = "."; // one-char string; TS has no Char type
// ```
/**
 * Defines extension dot value for this music-player component; the TypeScript-oriented notes above explain its
 * source and use.
 */
private const val EXTENSION_DOT: Char = '.'

// What:     `private const val APPLE_DOUBLE_PREFIX: String = "._"` declares a file-private
//           compile-time string constant holding the filename prefix Apple uses for AppleDouble
//           resource-fork sidecar files. `String` is Kotlin's immutable text type; sibling
//           `Char` would hold only one code unit, which cannot represent this two-character
//           marker.
// Why:      Naming the marker once keeps every source path aligned on the exact sidecar rule.
//
// In TS you'd write (pseudocode):
// ```ts
// const APPLE_DOUBLE_PREFIX = "._";
// ```
/**
 * Defines AppleDouble prefix value for this music-player component; the TypeScript-oriented notes above explain
 * its source and use.
 */
private const val APPLE_DOUBLE_PREFIX: String = "._"

// What:     `val AUDIO_EXTENSIONS: Set<String> = setOf( ... )`. Declares a read-only
//           top-level constant holding a collection of lowercased extension strings.
//           - no `private`, so this IS visible to other files in the package (the
//             scan and any session-restore code both read it).
//           - `val` = read-only binding (not `var`).
//           - `: Set<String>` is the type. `Set<String>` is an UNORDERED collection of
//             unique strings whose primary operation is membership ("is X in here?").
//             Siblings the reader might expect: `List<String>` (ordered, allows
//             duplicates, indexable), `Array<String>` (fixed-size, mutable slots),
//             `MutableSet<String>` (a Set you can add to / remove from). We pick the
//             plain immutable `Set` because we only ever ASK whether an extension is a
//             member; order and indexing are irrelevant, and `Set` makes that lookup
//             clear and (typically) O(1).
//           - `setOf(...)` is the factory FUNCTION that builds an immutable `Set` from
//             the listed elements. It is not a constructor call with `new`; Kotlin
//             collections are made via these `xxxOf` factory functions.
//           This mirrors the Rust port's `&[&str]` slice + `contains` check: the Rust
//           side uses a slice and a linear `contains`; here a `Set` expresses the same
//           "membership only" intent more directly.
// Why:      A music folder holds more than music (cover art, playlists, system files
//           like `.DS_Store` / `.nomedia`). This allowlist is the SINGLE rule deciding
//           what a scan enqueues, so junk never reaches the playback queue. The codec
//           set matches the desktop's documented support: FLAC, WAV/PCM, MP3, Vorbis
//           (Ogg), Opus, AAC-LC/ALAC (MP4), and AIFF.
//
// In TS you'd write (pseudocode):
// ```ts
// const AUDIO_EXTENSIONS: ReadonlySet<string> = new Set([
//   "flac", "wav", "wave", "mp3", "ogg", "oga", "opus",
//   "m4a", "m4b", "mp4", "aac", "aiff", "aif", "aifc",
// ]);
// ```
/**
 * Defines audio extensions value for this music-player component; the TypeScript-oriented notes above explain
 * its source and use.
 */
val AUDIO_EXTENSIONS: Set<String> = setOf(
    // The 14 entries below are plain data — each is an ordinary string literal,
    // character-identical to a TS array element, so they need no per-line block.
    "flac",
    "wav",
    "wave",
    "mp3",
    "ogg",
    "oga",
    "opus",
    "m4a",
    "m4b",
    "mp4",
    "aac",
    "aiff",
    "aif",
    "aifc",
)

// What:     `private fun fileNameOf(path: String): String` declares a file-private helper.
//           `String` is Kotlin's immutable text type; sibling `Char` would hold only one code
//           unit, and sibling `String?` would allow null even though every input path has some
//           final component text (possibly the whole path). The `=` body means the single
//           expression after it is returned.
// Why:      Both sidecar detection and extension extraction must inspect the same final path
//           component, so this helper prevents the two rules from drifting apart.
//
// In TS you'd write (pseudocode):
// ```ts
// function fileNameOf(path: string): string {
//   return path.slice(path.lastIndexOf("/") + 1);
// }
// ```
/**
 * Defines file name of behavior for this music-player component; the TypeScript-oriented notes above explain its
 * call shape and effects.
 */
private fun fileNameOf(path: String): String = path.substringAfterLast(SEPARATOR)

// What:     `fun isAppleDoubleSidecar(path: String): Boolean` declares a PUBLIC top-level
//           predicate. `Boolean` is Kotlin's true/false type, the direct sibling of TS
//           `boolean`; no nullable `Boolean?` is needed because every path is either a sidecar
//           or it is not.
// Why:      MediaStore rows and the shared audio-extension predicate both need to drop Apple's
//           `._name.ext` sidecar files before they can reach a queue.
//
// In TS you'd write (pseudocode):
// ```ts
// function isAppleDoubleSidecar(path: string): boolean {
//   return fileNameOf(path).startsWith(APPLE_DOUBLE_PREFIX);
// }
// ```
/**
 * Defines is AppleDouble sidecar behavior for this music-player component; the TypeScript-oriented notes above
 * explain its call shape and effects.
 */
fun isAppleDoubleSidecar(path: String): Boolean = fileNameOf(path).startsWith(APPLE_DOUBLE_PREFIX)

// What:     `private fun extensionOf(path: String): String?` declares a file-private
//           function.
//           - `private` = visible only inside this file.
//           - `fun` is Kotlin's keyword to start a function (like TS `function`).
//           - `extensionOf` is the name.
//           - `(path: String)` is the one parameter: `path`, typed `String` (an
//             immutable text string — the only string type in Kotlin, so there is no
//             owned-vs-borrowed sibling to choose between, unlike Rust's `String` vs
//             `&str`).
//           - `: String?` is the RETURN type. The trailing `?` makes it NULLABLE:
//             the function returns either a `String` OR the special value `null`.
//             Sibling the reader might expect: a non-nullable `String`, which would
//             FORBID returning `null`. We need the `?` because "this path has no
//             extension" must be expressible, and `null` carries that.
//           Behaviour copied from Rust's `Path::extension`: the text after the final
//           dot of the LAST path component, but only when that dot is neither absent
//           nor the component's leading character.
// Why:      Both a leading-dot name (`.DS_Store`) and an extensionless name (`noext`)
//           must yield "no extension" so neither is mistaken for audio; isolating the
//           final component first means dots inside parent directories are ignored.
//
// In TS you'd write (pseudocode):
// ```ts
// function extensionOf(path: string): string | null {
//   // ...body below...
// }
// ```
/**
 * Defines extension of behavior for this music-player component; the TypeScript-oriented notes above explain its
 * call shape and effects.
 */
private fun extensionOf(path: String): String? {
    // What:     `val component = fileNameOf(path)`. Declares a read-only local
    //           `component`. `fileNameOf(path)` returns the part after the final `/`;
    //           its type (`String`) is inferred, so no explicit annotation is written.
    // Why:      Reuse the same final-component extraction as the AppleDouble sidecar rule, so
    //           a dot inside a parent directory name cannot be misread as the extension
    //           separator.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const component = fileNameOf(path);
    // ```
    /**
     * Defines component value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val component = fileNameOf(path)
    // What:     `val dotIndex = component.lastIndexOf(EXTENSION_DOT)`. Declares a
    //           read-only local `dotIndex` holding the position (an `Int`, inferred) of
    //           the LAST `'.'` inside `component`. `lastIndexOf` is a `String` method
    //           returning the zero-based index, or `-1` when the character is absent.
    //           (`Int` is a 32-bit signed integer; the index sibling you might expect,
    //           `Long` (64-bit), is unnecessary because no filename is billions of
    //           characters long.)
    // Why:      We need the dot's position to (a) reject names with no dot or a leading
    //           dot, and (b) slice the extension out after it.
    // Gotcha:   `-1` for "not found" is the load-bearing detail that the next `if`
    //           guard depends on.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const dotIndex = component.lastIndexOf(".");
    // ```
    /**
     * Defines dot index value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val dotIndex = component.lastIndexOf(EXTENSION_DOT)
    // What:     `if (dotIndex <= 0)`. A plain conditional whose syntax is identical to
    //           TS. The comparison is what carries meaning: `dotIndex <= 0` is true in
    //           TWO cases at once —
    //             - `dotIndex == -1`: there was no dot at all (extensionless name), and
    //             - `dotIndex == 0`: the dot is the FIRST character (a leading-dot file
    //               like `.DS_Store`).
    //           Both mean "this name has no usable extension".
    // Why:      Collapsing both rejection cases into one `<= 0` test matches the Rust
    //           `Path::extension` rule exactly: a dotfile and an extensionless file are
    //           treated the same — neither has an extension.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (dotIndex <= 0) {
    //   return null;
    // }
    // ```
    if (dotIndex <= 0) {
        // What:     `return null`. Returns the `null` value, which is allowed because
        //           the function's return type is the nullable `String?`. `null` is
        //           Kotlin's "no value" — the same word and idea as TS `null`.
        // Why:      Signal "this path has no extension" so the caller (`isAudioFile`)
        //           can reject it without crashing.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return null;
        // ```
        return null
    }
    // What:     `return component.substring(dotIndex + 1).lowercase()`. The success
    //           path. Reading left to right:
    //             - `component.substring(dotIndex + 1)` takes everything AFTER the dot
    //               (start index `dotIndex + 1`, runs to the end) — that is the raw
    //               extension text.
    //             - `.lowercase()` is a TYPE-PRESERVING conversion call: it returns a
    //               NEW `String` with every character folded to lower case, leaving the
    //               original untouched (Kotlin strings are immutable).
    //           This is the function's normal return value.
    // Why:      The allowlist stores lowercased extensions, so we lowercase here once to
    //           make the membership check case-insensitive (`SONG.FLAC` matches `flac`).
    // Gotcha:   `.lowercase()` allocates a fresh string; it does NOT mutate `component`.
    //           (TS `.toLowerCase()` behaves the same, so no surprise here.)
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return component.slice(dotIndex + 1).toLowerCase();
    // ```
    return component.substring(dotIndex + 1).lowercase()
}

// What:     `fun isAudioFile(path: String): Boolean` declares a PUBLIC top-level
//           function (no `private`, so other files in the package may call it).
//           - `fun` / name / `(path: String)` parameter all as before.
//           - `: Boolean` is the return type. `Boolean` is Kotlin's true/false type and
//             maps cleanly onto TS `boolean` (no sibling-type subtlety here).
//           Decides whether `path` names an audio file by first rejecting AppleDouble
//           resource-fork sidecars, then comparing its extension against `AUDIO_EXTENSIONS`
//           case-insensitively. Shared by the folder scan and any session restore so the two
//           cannot disagree on what belongs in a music queue. Faithful to the Rust
//           `is_audio_file`.
// Why:      One canonical predicate for "is this audio?" keeps every code path that
//           builds a queue consistent.
//
// In TS you'd write (pseudocode):
// ```ts
// function isAudioFile(path: string): boolean {
//   // ...body below...
// }
// ```
/**
 * Defines is audio file behavior for this music-player component; the TypeScript-oriented notes above explain
 * its call shape and effects.
 */
fun isAudioFile(path: String): Boolean {
    // What:     `if (isAppleDoubleSidecar(path)) { return false }` calls the shared sidecar
    //           predicate and immediately returns `false` when the final filename starts with
    //           `._`.
    // Why:      AppleDouble sidecars often copy the real track's extension (for example
    //           `._song.mp3`), so extension allowlisting alone would enqueue junk.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (isAppleDoubleSidecar(path)) return false;
    // ```
    if (isAppleDoubleSidecar(path)) {
        return false
    }
    // What:     `val extension = extensionOf(path) ?: return false`. Two concepts on one
    //           line:
    //             - `extensionOf(path)` returns a `String?` (a `String` OR `null`).
    //             - `?:` is the ELVIS operator. It means: "use the left-hand value if it
    //               is non-null; otherwise evaluate the right-hand side." Here the
    //               right-hand side is itself `return false`, so when `extensionOf`
    //               returns `null`, the WHOLE function `isAudioFile` returns `false`
    //               immediately. When it returns a string, that string is bound to
    //               `extension`, whose type is the NON-nullable `String` (the `?:` has
    //               stripped the `null` possibility away).
    // Why:      A path with no extension is not audio; bail out early with `false` and,
    //           on the happy path, get a guaranteed-non-null `extension` to test next.
    // Gotcha:   Putting a `return` on the RIGHT of an operator is alien to TS. Read
    //           `?: return false` as "if null, leave the function returning false",
    //           NOT as "assign the result of `return`".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const extension = extensionOf(path);
    // if (extension === null) return false;
    // ```
    /**
     * Defines extension value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val extension = extensionOf(path) ?: return false
    // What:     `return extension in AUDIO_EXTENSIONS`. The `in` operator here is a
    //           MEMBERSHIP test: `x in someCollection` calls the collection's
    //           `.contains(x)` and returns a `Boolean`. So this asks "is `extension`
    //           one of the strings in the `AUDIO_EXTENSIONS` set?" and returns that
    //           true/false answer as the function's result.
    // Why:      This is the actual allowlist decision: lowercased extension present in
    //           the set ⇒ audio file.
    // Gotcha:   Kotlin's `in` is NOT JavaScript/TypeScript's `in`. JS `"key" in obj`
    //           checks for an OBJECT PROPERTY KEY; Kotlin `x in collection` checks
    //           collection MEMBERSHIP via `.contains`. Same two letters, different
    //           meaning — translate to `.has(...)`, never to JS `in`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return AUDIO_EXTENSIONS.has(extension);
    // ```
    return extension in AUDIO_EXTENSIONS
}

// What:     `fun audioFilesSorted(names: List<String>): List<String> =` declares a
//           public top-level function written in EXPRESSION-BODY form. Instead of a
//           `{ ... }` block, the `=` after the return type means "this function's body
//           is the single expression that follows, and its value is the return value"
//           (no explicit `return` keyword needed).
//           - `(names: List<String>)` is the parameter: `names`, typed `List<String>`.
//             `List<String>` is a READ-ONLY ordered sequence of strings. Siblings the
//             reader might expect: `MutableList<String>` (one you can add to / remove
//             from), `Array<String>` (fixed-size, mutable slots). We take the read-only
//             `List` because this function only READS the input and produces a new
//             output; it never mutates what it was given.
//           - `: List<String>` return type is the same read-only list interface.
// Why:      Expose the pure per-directory rule the Rust walk uses for the files of a
//           single folder, so the deferred recursive traversal can reuse it once per
//           directory without re-implementing filter+sort.
//
// In TS you'd write (pseudocode):
// ```ts
// function audioFilesSorted(names: readonly string[]): string[] {
//   // ...the single tail expression below becomes the return...
// }
// ```
/**
 * Defines audio files sorted behavior for this music-player component; the TypeScript-oriented notes above
 * explain its call shape and effects.
 */
fun audioFilesSorted(names: List<String>): List<String> =
    // What:     `names.filter(::isAudioFile).sorted()`. This is the function's TAIL
    //           EXPRESSION — because of the `=` body above, its value IS the return
    //           value (there is no `return` keyword). Reading the chain:
    //             - `names.filter(::isAudioFile)` keeps only the elements for which the
    //               predicate is true, returning a new `List<String>`.
    //             - `::isAudioFile` is a FUNCTION REFERENCE: the `::` turns the named
    //               function `isAudioFile` into a value that can be passed as the
    //               predicate, instead of writing the lambda `{ p -> isAudioFile(p) }`.
    //             - `.sorted()` returns a NEW list with the kept elements in natural
    //               (ascending) order. This is code-unit (per-character `Char`-value)
    //               order — the same case-SENSITIVE ordering as Rust's `PathBuf` sort
    //               for the ASCII filenames a music library produces, so capitalized
    //               names are NOT folded to lowercase before comparing.
    // Why:      Filter junk out, then put the surviving audio files in a stable,
    //           predictable order for the queue; cross-directory ordering is handled
    //           elsewhere by the (future) traversal.
    // Gotcha:   `.sorted()` does NOT mutate `names` (it returns a fresh list); TS's
    //           `.sort()` WOULD mutate, so the TS translation must copy first to match
    //           this function's purity. Also: this sort is case-SENSITIVE, so `"Z.mp3"`
    //           sorts before `"a.mp3"` (uppercase code units are lower), exactly like
    //           the Rust port — do not assume a case-insensitive sort.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return names.filter(isAudioFile).slice().sort();
    // ```
    names.filter(::isAudioFile).sorted()
