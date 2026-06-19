// What:     `package dev.monochromatic.musicplayer.core` declares which namespace
//           (logical folder of names) every declaration in this file belongs to.
//           In Kotlin/Java the package name must mirror the directory path under
//           `src/main/kotlin`, so this file physically lives at
//           `.../dev/monochromatic/musicplayer/core/DisplayPath.kt`. Other files
//           refer to `sanitizeComponent` / `joinDisplayPath` either by importing
//           `dev.monochromatic.musicplayer.core.sanitizeComponent` or by sitting in
//           this same package.
// Why:      Without a package line everything would land in the unnamed "root"
//           package, which Kotlin discourages and which collides as the app grows.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path ./core/DisplayPath.ts IS the module name.
// ```
package dev.monochromatic.musicplayer.core

// This file is the single place where a provider-supplied name is turned into one
// path segment of a folder-relative display path.
//
// Background for a TS reader: on Android, a "Storage Access Framework (SAF) tree"
// is a user-granted folder handle. The app walks that tree one directory at a time,
// and at each step it appends a child's `DISPLAY_NAME` to a running folder prefix to
// build a path like `Artist/Album/01.flac`. Those names come from a
// `DocumentsProvider` (an app, a cloud backend, a virtual store), NOT a real
// filesystem, so a single name can legally contain the path separator `/`, newlines,
// or other control characters. That is the hazard this file defends against.
//
// Two invariants matter:
//   1. Depth accounting. The pagination layer groups folders by counting separators
//      in the path, so one name component must contribute EXACTLY one segment and
//      zero stray separators. A `/` smuggled inside a name would fake an extra
//      directory level.
//   2. Single-line display. The result is shown on a one-line notification or
//      lockscreen title, so a newline or carriage return inside a name would split
//      the visible path or break rendering.
//
// Note on `..`: a name containing `..` is left UNCHANGED and is harmless here. The
// actual playable URI is built from opaque document IDs, never from this display
// path, so `..` can never escape the chosen tree. The clamping in this file protects
// the pure path-grammar invariants (depth, single-line display), not file access.

// What:     `private const val SEPARATOR: Char = '/'` declares a file-private,
//           compile-time constant named `SEPARATOR` whose type is `Char` and whose
//           value is the single character `/`. Breaking down each keyword:
//           - `private` limits visibility to THIS file (other files cannot see it).
//           - `const` means the value is known at compile time and inlined at every
//             use site (stronger than a plain `val`, which is merely read-once).
//           - `val` is a read-only binding (Kotlin's immutable `let`/`const`); the
//             opposite is `var` (reassignable).
//           - `: Char` is the type. `Char` is a SINGLE 16-bit character, written
//             with single quotes `'/'`. The sibling the reader might expect is
//             `String` (zero-or-more characters, written with DOUBLE quotes `"/"`).
// Why:      The sanitizer below compares one character at a time against this value,
//           so it must be a `Char`, not a length-1 `String`. Naming it also keeps the
//           bare `'/'` literal from being scattered around.
// Gotcha:   TS uses `"/"` (double quotes) for both strings and "single characters".
//           Kotlin's single quotes `'/'` are NOT an alternate string syntax; they
//           specifically mean `Char`, and `'/' == "/"` would not even compile.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEPARATOR = "/"; // a length-1 string; TS has no Char type
// ```
/**
 * Defines separator value for this music-player component; the TypeScript-oriented notes above explain its
 * source and use.
 */
private const val SEPARATOR: Char = '/'

// What:     `private const val SEPARATOR_REPLACEMENT: Char = '∕'` declares another
//           file-private compile-time `Char` constant. Its value is U+2215 DIVISION
//           SLASH (`∕`), a character that LOOKS like `/` but is not the real path
//           separator. Same `private`/`const`/`val`/`Char` story as above; only the
//           name and the literal differ.
// Why:      When a name component contains a literal `/`, we swap it for this
//           look-alike so the segment reads naturally to a human yet contributes ZERO
//           real separators, keeping depth accounting correct.
// Gotcha:   The source literal `'∕'` is the U+2215 glyph itself, NOT an ASCII `/`.
//           They are visually near-identical; do not "tidy" it into `'/'` or the
//           whole defense collapses.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEPARATOR_REPLACEMENT = "∕"; // looks like "/" but isn't the separator
// ```
/**
 * Defines separator replacement value for this music-player component; the TypeScript-oriented notes above
 * explain its source and use.
 */
private const val SEPARATOR_REPLACEMENT: Char = '∕'

// What:     `private const val CONTROL_REPLACEMENT: Char = ' '` declares a third
//           file-private compile-time `Char` constant whose value is a single ASCII
//           space character. Same `private`/`const`/`val`/`Char` keywords as the two
//           constants above; sibling type `String` again declined in favor of `Char`.
// Why:      Any control character (newline, carriage return, tab, etc.) inside a name
//           would break single-line rendering, so each one collapses to this space.
//
// In TS you'd write (pseudocode):
// ```ts
// const CONTROL_REPLACEMENT = " "; // one space, swapped in for control chars
// ```
/**
 * Defines control replacement value for this music-player component; the TypeScript-oriented notes above explain
 * its source and use.
 */
private const val CONTROL_REPLACEMENT: Char = ' '

// What:     `fun sanitizeComponent(name: String): String = ...` declares a top-level
//           (package-level, no enclosing class) function named `sanitizeComponent`.
//           - Parameter `name: String` is one provider-supplied display name, owned
//             by the caller; `String` (double-quote text) is the only sensible type
//             here, NOT `Char`, because a name is many characters.
//           - `: String` after the parens is the RETURN type.
//           - The `=` (instead of a `{ ... }` block body) makes this an
//             "expression-body" function: the single expression that follows IS the
//             return value. There is no `return` keyword; the whole `.map { ... }
//             .joinToString(...)` chain below is the result.
// Why:      This reduces one raw `DISPLAY_NAME` to a single safe path segment: every
//           literal separator becomes the look-alike (so the segment cannot widen the
//           path's depth) and every control character becomes a space (so it cannot
//           break single-line display). All other characters, including `..`, pass
//           through unchanged.
// Gotcha:   Because there is no `return` and no braces, the LAST chained call's value
//           silently becomes the return. A TS reader scanning for `return` will not
//           find one; the `=` is doing that job.
//
// In TS you'd write (pseudocode):
// ```ts
// function sanitizeComponent(name: string): string {
//   return [...name]
//     .map((character) => { /* ...when... *\/ })
//     .join("");
// }
// ```
/**
 * Defines sanitize component behavior for this music-player component; the TypeScript-oriented notes above
 * explain its call shape and effects.
 */
fun sanitizeComponent(name: String): String =
    // What:     `name` on its own line is the start of the expression body: the
    //           receiver that the following `.map { ... }` and `.joinToString(...)`
    //           calls are chained onto. It is the `String` parameter from above.
    // Why:      We begin from the raw name and transform it character by character.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // [...name] // spread the string into its characters, then transform
    // ```
    name
        // What:     `.map { character -> ... }` walks `name` ONE CHARACTER AT A TIME
        //           and produces a new collection of the per-character results.
        //           `{ character -> ... }` is a Kotlin lambda (closure): `character`
        //           is the parameter (one `Char`), and everything after `->` is the
        //           body whose value becomes that element's replacement.
        // Why:      Inspect every character so separators and control characters can
        //           be swapped while everything else is kept.
        // Gotcha:   `String.map` in Kotlin does NOT return a `String`. It returns a
        //           `List<Char>` (an array of characters). That is precisely why the
        //           next line calls `.joinToString("")` to glue the list back into a
        //           `String`. TS strings have no `.map` at all; you must spread to an
        //           array first (`[...name]`), which is why the TS map shows `[...name]`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // [...name].map((character) => {
        //   // ...returns one replacement character per input character...
        // })
        // ```
        .map { character ->
            // What:     `when { ... }` is a subject-less conditional EXPRESSION: each
            //           `condition -> value` arm is tested top to bottom, and the
            //           first whose condition is true supplies the value of the whole
            //           `when`. With no subject in the parentheses it behaves like an
            //           if / else-if / else chain. Because it is the last thing in the
            //           lambda, its value is what `.map` collects for this character.
            // Why:      Choose this character's replacement based on what kind of
            //           character it is.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // // return (
            // //   character === SEPARATOR ? SEPARATOR_REPLACEMENT
            // //   : isISOControl(character) ? CONTROL_REPLACEMENT
            // //   : character
            // // );
            // ```
            when {
                // What:     `character == SEPARATOR -> SEPARATOR_REPLACEMENT` is one
                //           `when` arm. The condition `character == SEPARATOR` compares
                //           this `Char` to the `/` constant; `->` separates the
                //           condition from the value `SEPARATOR_REPLACEMENT` (the
                //           look-alike `∕`) that the arm yields when true.
                // Why:      A real separator inside a name would fake an extra
                //           directory level, so swap it for the harmless look-alike.
                // Gotcha:   Kotlin's `==` calls structural equality (`.equals`), but on
                //           `Char` it is a plain value compare, exactly like TS `===`
                //           on two length-1 strings. The `->` is `when`-arm syntax, not
                //           a TS arrow function.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (character === SEPARATOR) return SEPARATOR_REPLACEMENT;
                // ```
                character == SEPARATOR -> SEPARATOR_REPLACEMENT
                // What:     `character.isISOControl() -> CONTROL_REPLACEMENT` is the
                //           second `when` arm. `character.isISOControl()` is a stdlib
                //           method on `Char` returning a `Boolean`: true when the
                //           character is an ISO control character (U+0000..U+001F or
                //           U+007F..U+009F: newline, carriage return, tab, etc.). On
                //           true, the arm yields `CONTROL_REPLACEMENT` (a space).
                // Why:      Control characters break single-line rendering, so collapse
                //           each to a space.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (isISOControl(character)) return CONTROL_REPLACEMENT;
                // ```
                character.isISOControl() -> CONTROL_REPLACEMENT
                // What:     `else -> character` is the fallback `when` arm. `else`
                //           matches when no earlier condition did, and it yields
                //           `character` UNCHANGED. As the last arm of the last
                //           expression in the lambda, this is the implicit value
                //           `.map` collects for an ordinary character.
                // Why:      Every other character (letters, digits, `.`, `..`, spaces,
                //           Unicode) is safe and must pass through untouched.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // return character; // pass anything else through unchanged
                // ```
                else -> character
            }
        }
        // What:     `.joinToString(separator = "")` collapses the `List<Char>` that
        //           `.map` produced back into a single `String`. `separator = ""` is a
        //           NAMED argument (Kotlin lets you pass an argument by its parameter
        //           name) saying "put nothing between elements", so the characters are
        //           concatenated with no glue. This call's result is the function's
        //           return value (it is the tail of the expression body).
        // Why:      `.map` gave us a list of characters; the function must return a
        //           `String`, so we glue them together with no separator.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // .join(""); // List<Char> -> string, no glue between characters
        // ```
        .joinToString(separator = "")

// What:     `fun joinDisplayPath(prefix: String, name: String): String { ... }`
//           declares a top-level function that takes TWO positional parameters,
//           `prefix` and `name` (both `String`), and returns a `String`. Unlike
//           `sanitizeComponent`, this one uses a BLOCK body `{ ... }` with an explicit
//           `return`, not an expression body.
//           - `prefix`: the already-sanitized folder path of the parent (empty `""`
//             for the chosen tree root).
//           - `name`: the raw `DISPLAY_NAME` of the child to append (NOT yet
//             sanitized).
// Why:      Append a child name to the running folder prefix, sanitizing the name
//           first so the join adds exactly one path level. The prefix is already the
//           output of earlier joins (already sanitized), so only `name` needs
//           neutralizing here.
// Gotcha:   This is two SEPARATE positional params, not a single options object. (The
//           house style normally prefers one destructured object parameter, but this
//           is finished, on-device-tested code; it is being explained, not rewritten.)
//
// In TS you'd write (pseudocode):
// ```ts
// function joinDisplayPath(prefix: string, name: string): string {
//   const segment = sanitizeComponent(name);
//   return prefix === "" ? segment : `${prefix}${SEPARATOR}${segment}`;
// }
// ```
/**
 * Defines join display path behavior for this music-player component; the TypeScript-oriented notes above
 * explain its call shape and effects.
 */
fun joinDisplayPath(prefix: String, name: String): String {
    // What:     `val segment = sanitizeComponent(name)` declares a read-only local
    //           binding `segment` (Kotlin `val` = immutable; `var` would be mutable)
    //           and assigns it the sanitized form of `name`. The type is inferred as
    //           `String` from the function's return type.
    // Why:      Neutralize the child name once so the path-building below cannot widen
    //           depth or break single-line display.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const segment = sanitizeComponent(name);
    // ```
    /**
     * Defines segment value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val segment = sanitizeComponent(name)
    // What:     `return if (prefix.isEmpty()) segment else "$prefix$SEPARATOR$segment"`.
    //           Several pieces:
    //           - `if (...) ... else ...` is used here as an EXPRESSION (it produces a
    //             value), so `return` returns whichever branch is chosen, just like a
    //             TS ternary.
    //           - `prefix.isEmpty()` is a stdlib `String` method returning `Boolean`,
    //             true when the string has length 0.
    //           - the `else` branch `"$prefix$SEPARATOR$segment"` is a Kotlin STRING
    //             TEMPLATE: inside double quotes, `$prefix`, `$SEPARATOR`, and
    //             `$segment` are spliced in by value (`$SEPARATOR` interpolates the
    //             `Char` `/`). It yields `<prefix>/<segment>`.
    // Why:      A file directly in the chosen tree root has an empty `prefix`, so we
    //           return just the bare sanitized segment with no leading separator;
    //           otherwise we glue the parent path, a `/`, and the new segment into one
    //           level deeper.
    // Gotcha:   `$SEPARATOR` splices a `Char` directly into a string; there is no
    //           explicit `.toString()`. In TS you would just interpolate the length-1
    //           string the same way.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return prefix === "" ? segment : `${prefix}${SEPARATOR}${segment}`;
    // ```
    return if (prefix.isEmpty()) segment else "$prefix$SEPARATOR$segment"
}
