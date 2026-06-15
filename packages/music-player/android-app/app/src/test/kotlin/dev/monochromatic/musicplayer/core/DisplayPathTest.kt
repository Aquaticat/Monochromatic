// What:     `package dev.monochromatic.musicplayer.core` names the namespace this test
//           file's declarations live under. It is the SAME package as the code under test
//           (`DisplayPath.kt`), so this file calls `sanitizeComponent` and `joinDisplayPath`
//           by their short names with no import. In Kotlin/Java the package must mirror the
//           directory path, so this file lives at `.../test/kotlin/.../core/`.
// Why:      Sharing the package is how the tests reach the package-level (top-level)
//           functions without importing them; test and main source sets merge into one
//           package at compile time.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path IS the module; here it shares a namespace with the SUT.
// ```
package dev.monochromatic.musicplayer.core

// What:     `import org.junit.Assert.assertEquals` pulls the STATIC FUNCTION `assertEquals`
//           (from JUnit 4's `org.junit.Assert` class) into scope by its short name. Importing
//           a static member by its fully-qualified name is Kotlin's way of getting Java
//           statics unqualified.
// Why:      The value-equality assertions below (`assertEquals(expected, actual)`) need it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertEquals } from "@junit/assert";
// ```
import org.junit.Assert.assertEquals

// What:     `import org.junit.Assert.assertFalse` imports the static `assertFalse` function
//           (asserts a `Boolean` is `false`) from `org.junit.Assert`.
// Why:      The negative assertions below (`assertFalse("...", got.contains('/'))`) need it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertFalse } from "@junit/assert";
// ```
import org.junit.Assert.assertFalse

// What:     `import org.junit.Assert.assertTrue` imports the static `assertTrue` function
//           (asserts a `Boolean` is `true`) from `org.junit.Assert`.
// Why:      The positive assertions below (`assertTrue(got.startsWith("Rock/"))`) need it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertTrue } from "@junit/assert";
// ```
import org.junit.Assert.assertTrue

// What:     `import org.junit.Test` imports the `Test` ANNOTATION class from JUnit 4 (a type,
//           not a function). It is used as the marker `@Test` on each test method; the runner
//           discovers and runs every method tagged with it.
// Why:      Without it we could not write `@Test`, and the runner would find no tests here.
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
// Host-JVM unit tests for `sanitizeComponent` and `joinDisplayPath`, the boundary where a
// `DocumentsProvider`-supplied name becomes ONE path segment. A Storage Access Framework
// provider (unlike a real filesystem) can hand back a name containing the path separator
// `/`, `..`, or control characters, so these tests cover the adversarial cases the
// transformer must neutralise:
//   - a separator INSIDE a name must not widen the path's depth (pagination keys folders on
//     separator count), so it is swapped for a look-alike `∕` (U+2215);
//   - a control character (newline, tab, carriage return) must not break single-line title
//     display, so it collapses to a space;
//   - `..` must pass through UNTOUCHED, because no path here is resolved against a
//     filesystem (the playable URI is built from opaque document IDs).
// They also pin the prefix-join shape: empty prefix yields a bare segment (no leading
// separator); a non-empty prefix glues exactly one `/`.

// What:     `class DisplayPathTest { ... }` declares a JUnit 4 test class: an ordinary class
//           the runner instantiates to invoke each `@Test`-marked method. No constructor, no
//           state, no inheritance; just a bag of test methods in the `{ ... }` body.
// Why:      Groups every test for the `DisplayPath.kt` functions.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("DisplayPath", () => {
//   // ...each @Test fun below becomes a test(...) call inside here...
// });
// ```
class DisplayPathTest {
    // What:     `@Test` is an ANNOTATION (metadata, no code) telling the JUnit runner the
    //           method below is a test to run and report. The `@` prefix marks an annotation
    //           usage.
    // Why:      Marks `joinsUnderAPrefixWithASingleSeparator` as a runnable test.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("joins under a prefix with a single separator", () => {
    // ```
    @Test
    // What:     `fun joinsUnderAPrefixWithASingleSeparator() { ... }` declares a no-parameter
    //           test method returning `Unit` (Kotlin's "void"; no return type written means
    //           `Unit`), block body. The descriptive name IS the test's report label.
    // Why:      Pins that a normal child name appended under a multi-level prefix
    //           (`Artist/Album`) produces the prefix, ONE added `/`, then the segment. The
    //           prefix's own internal `/` (already sanitised in real use) passes through.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertion below... *\/ }
    // ```
    fun joinsUnderAPrefixWithASingleSeparator() {
        // What:     `assertEquals("Artist/Album/01 song.flac", joinDisplayPath("Artist/Album", "01 song.flac"))`
        //           calls the two-argument `assertEquals(expected, actual)`, which FAILS unless
        //           the two are value-equal.
        //           - FIRST arg `"Artist/Album/01 song.flac"` is the EXPECTED string.
        //           - SECOND arg is the ACTUAL: `joinDisplayPath("Artist/Album", "01 song.flac")`,
        //             which sanitises only the child `name` and glues it under `prefix` with one
        //             `/`.
        // Why:      A clean child under a clean prefix gains exactly one separator level.
        // Gotcha:   Argument order: `assertEquals(expected, actual)` is backwards from
        //           `expect(actual)`. On `String` it is a value compare (like TS `toEqual`),
        //           not reference identity.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(joinDisplayPath("Artist/Album", "01 song.flac")).toEqual("Artist/Album/01 song.flac");
        // ```
        assertEquals("Artist/Album/01 song.flac", joinDisplayPath("Artist/Album", "01 song.flac"))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `rootFileHasNoSeparator` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("root file has no separator", () => {
    // ```
    @Test
    // What:     `fun rootFileHasNoSeparator() { ... }` declares a no-arg `Unit`-returning test
    //           method, block body.
    // Why:      Pins the empty-prefix case: a file directly in the chosen tree root yields just
    //           the bare sanitised segment with NO leading separator. This matters because the
    //           join must not emit a stray `/` for root-level files.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun rootFileHasNoSeparator() {
        // What:     `val got = joinDisplayPath("", "loose.flac")` declares a read-only local
        //           binding `got` (`val` = cannot be reassigned; type `String` inferred) holding
        //           the result of joining the child `"loose.flac"` under an EMPTY prefix `""`.
        // Why:      Capture the output once so both assertions below can inspect it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const got = joinDisplayPath("", "loose.flac");
        // ```
        val got = joinDisplayPath("", "loose.flac")
        // What:     `assertEquals("loose.flac", got)` is `assertEquals(expected, actual)`:
        //           EXPECTED `"loose.flac"`, ACTUAL `got`.
        // Why:      With an empty prefix the result is exactly the sanitised name, nothing added.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(got).toEqual("loose.flac");
        // ```
        assertEquals("loose.flac", got)
        // What:     `assertFalse("a root file must contribute no separator", got.contains('/'))`
        //           calls the TWO-argument overload `assertFalse(message, condition)`.
        //           - FIRST arg is the failure MESSAGE printed if the assertion fails (message
        //             FIRST, easy to misread as the condition).
        //           - SECOND arg `got.contains('/')` is the condition. `.contains('/')` is a
        //             stdlib `CharSequence` method asking "does this string contain that
        //             character?". `'/'` uses SINGLE quotes, which in Kotlin means a `Char`
        //             literal, NOT a `String`; the sibling `"/"` (double quotes) would be a
        //             length-1 `String`, and `.contains` has both a `Char` and a `String`
        //             overload.
        // Why:      Assert the root-level result holds NO real separator, labelling any failure.
        // Gotcha:   Two traps. (1) `assertFalse(message, cond)` is message-FIRST, backwards from
        //           `expect(cond)`. (2) `'/'` is a `Char` (single quotes) here; a TS reader
        //           must not read it as a string literal.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(got.includes("/")).toBe(false); // message arg has no expect() analogue
        // ```
        assertFalse("a root file must contribute no separator", got.contains('/'))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `separatorInsideANameCannotWidenDepth` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("separator inside a name cannot widen depth", () => {
    // ```
    @Test
    // What:     `fun separatorInsideANameCannotWidenDepth() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      The load-bearing security case. A provider name like `"AC/DC"` must become ONE
    //           segment, not two folder levels: the embedded `/` is swapped for the look-alike
    //           `∕` (U+2215) so depth accounting (pagination counts separators) is not fooled
    //           into inventing an extra directory. (Folds in the original inline note: a
    //           provider name "AC/DC" must become one segment, not two folder levels.)
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assertions below... *\/ }
    // ```
    fun separatorInsideANameCannotWidenDepth() {
        // What:     `val got = joinDisplayPath("Rock", "AC/DC - song.flac")` declares a read-only
        //           `String` local `got` holding the joined path. The child name contains a real
        //           `/`, which sanitisation turns into `∕`, so `got` is `"Rock/AC∕DC - song.flac"`
        //           with exactly ONE real separator (between `Rock` and the segment).
        // Why:      Capture the adversarial result once for the three assertions below.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const got = joinDisplayPath("Rock", "AC/DC - song.flac");
        // ```
        val got = joinDisplayPath("Rock", "AC/DC - song.flac")
        // What:     `assertEquals(1, got.count { it == '/' })` is `assertEquals(expected, actual)`.
        //           - EXPECTED is the `Int` literal `1` (note: an integer here, whereas the other
        //             `assertEquals` calls compare `String`s; JUnit picks the matching overload).
        //           - ACTUAL `got.count { it == '/' }` counts characters matching a predicate.
        //             `.count { ... }` is a stdlib method taking a TRAILING LAMBDA; `it` is
        //             Kotlin's implicit name for the lambda's single parameter (one `Char`);
        //             `it == '/'` compares it to the `Char` literal `'/'` (single quotes).
        // Why:      Prove only ONE real separator survives, i.e. the embedded slash did not add a
        //           second level.
        // Gotcha:   `it` is the auto-named lambda parameter (one `Char`), and `'/'` is a `Char`
        //           literal; this counts a CHARACTER, not a substring.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect([...got].filter((c) => c === "/").length).toEqual(1);
        // ```
        assertEquals(1, got.count { it == '/' })
        // What:     `assertFalse("the embedded slash must be neutralized", got.contains("AC/DC"))`
        //           is the message-first `assertFalse(message, condition)`. The condition
        //           `got.contains("AC/DC")` uses the `String` overload of `.contains` (DOUBLE
        //           quotes = `String` substring search), asking whether the literal `"AC/DC"`
        //           (with a real slash) appears.
        // Why:      Assert the original `AC/DC` substring is GONE (it became `AC∕DC`), confirming
        //           the real slash was replaced rather than preserved.
        // Gotcha:   This `.contains` takes a `String` (substring), unlike the `.contains('/')`
        //           above which took a `Char`. Same method name, two overloads.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(got.includes("AC/DC")).toBe(false);
        // ```
        assertFalse("the embedded slash must be neutralized", got.contains("AC/DC"))
        // What:     `assertTrue(got.startsWith("Rock/"))` is the SINGLE-argument overload
        //           `assertTrue(condition)` (condition only, NO message, unlike the message-first
        //           `assertFalse` above). `got.startsWith("Rock/")` is a stdlib `String` method
        //           returning `Boolean`: true when `got` begins with the given prefix string.
        // Why:      Confirm the prefix and its single real separator lead the result, so the one
        //           surviving `/` is the legitimate prefix join.
        // Gotcha:   Contrast the `assertFalse(message, cond)` two-arg call above: this
        //           `assertTrue(cond)` is the one-arg form. The overload count differs per call.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(got.startsWith("Rock/")).toBe(true);
        // ```
        assertTrue(got.startsWith("Rock/"))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `controlCharactersCollapseToSpaces` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("control characters collapse to spaces", () => {
    // ```
    @Test
    // What:     `fun controlCharactersCollapseToSpaces() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that control characters embedded in a name (newline, tab, carriage return)
    //           each become a single SPACE, so the result stays renderable on one line.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertions below... *\/ }
    // ```
    fun controlCharactersCollapseToSpaces() {
        // What:     `assertEquals("a b c", joinDisplayPath("", "a\nb\tc"))` is
        //           `assertEquals(expected, actual)`. The ACTUAL joins (under an empty prefix) the
        //           name `"a\nb\tc"`, where `\n` is a NEWLINE escape and `\t` is a TAB escape
        //           inside the string literal. Each control character sanitises to a space, so
        //           the expected result is `"a b c"`.
        // Why:      Prove newline and tab both collapse to spaces (single-line safety).
        // Gotcha:   `\n` and `\t` are ONE control character each (not two literal characters); the
        //           expected `"a b c"` has single spaces where they were.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(joinDisplayPath("", "a\nb\tc")).toEqual("a b c");
        // ```
        assertEquals("a b c", joinDisplayPath("", "a\nb\tc"))
        // What:     `assertEquals("side a side b", joinDisplayPath("", "side a\rside b"))` is
        //           `assertEquals(expected, actual)`. The name `"side a\rside b"` contains `\r`, a
        //           CARRIAGE-RETURN escape, which sanitises to a space, giving `"side a side b"`.
        // Why:      Carriage return is also a control character and must collapse to a space, not
        //           split the visible title.
        // Gotcha:   `\r` is one control character; do not read it as the two characters `\` and
        //           `r`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(joinDisplayPath("", "side a\rside b")).toEqual("side a side b");
        // ```
        assertEquals("side a side b", joinDisplayPath("", "side a\rside b"))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `dotDotPassesThroughUnchanged` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("dot dot passes through unchanged", () => {
    // ```
    @Test
    // What:     `fun dotDotPassesThroughUnchanged() { ... }` declares a no-arg `Unit`-returning
    //           test method, block body.
    // Why:      Pins that a `..` name is NOT clamped or stripped: the playable URI is built from
    //           an opaque document ID, never from this display path, so `..` is harmless and
    //           must round-trip verbatim. (Folds in the original inline note: ".." is harmless;
    //           the playable URI is built from a document id, never from this path.)
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertion below... *\/ }
    // ```
    fun dotDotPassesThroughUnchanged() {
        // What:     `assertEquals("Music/..", joinDisplayPath("Music", ".."))` is
        //           `assertEquals(expected, actual)`. Joining `".."` under prefix `"Music"`
        //           yields `"Music/.."` because `..` contains no separator and no control
        //           character, so sanitisation leaves it untouched.
        // Why:      Confirm `..` passes through unchanged (no path-traversal defence applied
        //           here, by design).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(joinDisplayPath("Music", "..")).toEqual("Music/..");
        // ```
        assertEquals("Music/..", joinDisplayPath("Music", ".."))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `ordinaryNamesAreUnchanged` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("ordinary names are unchanged", () => {
    // ```
    @Test
    // What:     `fun ordinaryNamesAreUnchanged() { ... }` declares a no-arg `Unit`-returning test
    //           method, block body.
    // Why:      Pins that `sanitizeComponent` leaves ordinary names (including non-ASCII Unicode
    //           like `é`, and bracket characters) completely untouched, so the sanitiser only
    //           ever touches separators and control characters, nothing else.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertions below... *\/ }
    // ```
    fun ordinaryNamesAreUnchanged() {
        // What:     `assertEquals("Café del Mar", sanitizeComponent("Café del Mar"))` is
        //           `assertEquals(expected, actual)`. The ACTUAL calls `sanitizeComponent`
        //           directly (NOT `joinDisplayPath`) on a name containing the accented Unicode
        //           character `é`. Expected equals input: nothing is changed.
        // Why:      Prove non-ASCII letters survive sanitisation unmodified (only separators and
        //           control characters are replaced).
        // Gotcha:   `é` is a normal printable character, not a control character, so
        //           `isISOControl` is false for it and it passes through.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(sanitizeComponent("Café del Mar")).toEqual("Café del Mar");
        // ```
        assertEquals("Café del Mar", sanitizeComponent("Café del Mar"))
        // What:     `assertEquals("track [01].opus", sanitizeComponent("track [01].opus"))` is
        //           `assertEquals(expected, actual)`. The name contains square brackets and a dot;
        //           none are separators or control characters, so `sanitizeComponent` returns it
        //           verbatim.
        // Why:      Prove ordinary punctuation (brackets, dots, spaces) is also left untouched.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(sanitizeComponent("track [01].opus")).toEqual("track [01].opus");
        // ```
        assertEquals("track [01].opus", sanitizeComponent("track [01].opus"))
    }
}
