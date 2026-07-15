// What:     `package dev.monochromatic.musicplayer.core` names the namespace this test
//           file's declarations live under. Because it is the SAME package as the code
//           under test (`AudioExtensions.kt` declares the same package), this file can
//           call `isAudioFile`, `audioFilesSorted`, and read `AUDIO_EXTENSIONS` by their
//           short names with no import. In Kotlin/Java the package must mirror the
//           directory path, so this file physically lives at
//           `.../app/src/test/kotlin/dev/monochromatic/musicplayer/core/`.
// Why:      Sharing the package is how the tests reach the package-level (top-level,
//           non-`private`) functions without importing them; the test source set and the
//           main source set are merged into one package at compile time.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path IS the module; here it shares a namespace with the SUT.
// ```
package dev.monochromatic.musicplayer.core

// What:     `import org.junit.Assert.assertEquals` pulls one STATIC FUNCTION named
//           `assertEquals` (from JUnit 4's `org.junit.Assert` class) into this file by its
//           short name, so we can call `assertEquals(...)` instead of
//           `Assert.assertEquals(...)`. `org.junit.Assert` is the class; `assertEquals` is
//           a static member of it. Importing a static member by its fully-qualified name is
//           Kotlin's way of getting Java statics unqualified.
// Why:      The value-equality assertions below (`assertEquals(expected, actual)`) need this
//           function in scope.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertEquals } from "@junit/assert";
// ```
import org.junit.Assert.assertEquals

// What:     `import org.junit.Assert.assertFalse` imports the static `assertFalse` function
//           (asserts that a `Boolean` argument is `false`) from `org.junit.Assert`, the same
//           way as `assertEquals` above.
// Why:      The negative predicate checks below (`assertFalse(isAudioFile("cover.jpg"))`)
//           need it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertFalse } from "@junit/assert";
// ```
import org.junit.Assert.assertFalse

// What:     `import org.junit.Assert.assertTrue` imports the static `assertTrue` function
//           (asserts that a `Boolean` is `true`) from `org.junit.Assert`.
// Why:      The positive predicate checks below (`assertTrue(isAudioFile("a.flac"))`) need
//           it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertTrue } from "@junit/assert";
// ```
import org.junit.Assert.assertTrue

// What:     `import org.junit.Test` imports the `Test` ANNOTATION class from JUnit 4. Unlike
//           the three lines above (which import functions), `Test` is a type used as the
//           marker `@Test` on each test method below; the test runner discovers and runs
//           every method tagged with it. `org.junit` is the package; `Test` is the
//           annotation.
// Why:      Without importing `Test`, we could not write `@Test`, and the runner would find
//           no tests in this class.
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
// Host-JVM unit tests for `isAudioFile` and `audioFilesSorted`, ported from the desktop
// player's Rust `playback_tests.rs` so the Kotlin port stays faithful to the Rust
// behaviour. The predicate tests port one-to-one. The two filesystem-walk tests are
// adapted to the pure `audioFilesSorted` ordering primitive, reusing the same filename
// vectors and expected results, because the recursive directory traversal those Rust
// tests exercised is deferred to the Android storage layer (see `AudioExtensions.kt`'s
// module summary). These tests pin down the PURE behaviour: extension recognition,
// case-insensitivity, leading-dot/dotfile rejection, parent-directory dot handling, junk
// filtering, and the case-SENSITIVE code-unit sort.

// What:     `class AudioExtensionsTest { ... }` declares a class named `AudioExtensionsTest`.
//           In JUnit 4 a "test class" is just an ordinary class; the runner instantiates it
//           and invokes each `@Test`-marked method. There is no constructor, no state, and
//           no inheritance here, so it is a plain bag of test methods. The `{ ... }` is the
//           class body holding those methods.
// Why:      JUnit groups related test methods inside a class; this one groups every test for
//           the `AudioExtensions.kt` functions.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("AudioExtensions", () => {
//   // ...each @Test fun below becomes a test(...) call inside here...
// });
// ```
class AudioExtensionsTest {
    // What:     `@Test` is an ANNOTATION attached to the function just below it. It carries no
    //           code; it is metadata the JUnit runner reads to decide "this method is a test,
    //           run it and report pass/fail." The `@` prefix marks an annotation usage.
    // Why:      Marks `isAudioFileMatchesExtensionsCaseInsensitively` as a test case so the
    //           runner executes it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("isAudioFile matches extensions case-insensitively", () => {
    // ```
    @Test
    // What:     `fun isAudioFileMatchesExtensionsCaseInsensitively() { ... }` declares a test
    //           method taking no parameters and returning `Unit` (Kotlin's "void"; no return
    //           type written means `Unit`). The long descriptive name IS the test's label in
    //           the report. Block body `{ ... }`.
    // Why:      Pins down that `isAudioFile` accepts known audio extensions regardless of
    //           letter case (`a.flac`, `A.FLAC`, mixed-case `b.OpUs`) and rejects non-audio
    //           (`cover.jpg`), dotfiles (`.DS_Store`), and extensionless names (`noext`). This
    //           case matters because real music folders mix cases and contain junk.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertions below... *\/ }
    // ```
    fun isAudioFileMatchesExtensionsCaseInsensitively() {
        // What:     `assertTrue(isAudioFile("a.flac"))` calls JUnit's `assertTrue`, which FAILS
        //           the test unless its `Boolean` argument is `true`. The argument is
        //           `isAudioFile("a.flac")` (the function under test applied to a lowercase
        //           `.flac` name).
        // Why:      A plain lowercase `.flac` must be recognised as audio (the baseline happy
        //           case).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile("a.flac")).toBe(true);
        // ```
        assertTrue(isAudioFile("a.flac"))
        // What:     `assertTrue(isAudioFile("A.FLAC"))` asserts the predicate is `true` for an
        //           ALL-UPPERCASE name and extension.
        // Why:      Proves the case-insensitivity: `A.FLAC` must match the lowercased allowlist
        //           entry `flac` (the function lowercases the extension before lookup).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile("A.FLAC")).toBe(true);
        // ```
        assertTrue(isAudioFile("A.FLAC"))
        // What:     `assertTrue(isAudioFile("/x/y/b.OpUs"))` asserts `true` for a path with
        //           parent directories AND a MIXED-case extension `OpUs`.
        // Why:      Pins two things at once: the function isolates the final component
        //           (`b.OpUs`) past the `/` separators, and folds `OpUs` to `opus` before the
        //           allowlist check.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile("/x/y/b.OpUs")).toBe(true);
        // ```
        assertTrue(isAudioFile("/x/y/b.OpUs"))
        // What:     `assertFalse(isAudioFile("cover.jpg"))` calls `assertFalse`, which FAILS the
        //           test unless its `Boolean` argument is `false`. Here the argument is the
        //           predicate applied to a `.jpg` (cover art) name.
        // Why:      Cover-art images must NOT be treated as audio; `jpg` is absent from the
        //           allowlist.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile("cover.jpg")).toBe(false);
        // ```
        assertFalse(isAudioFile("cover.jpg"))
        // What:     `assertFalse(isAudioFile(".DS_Store"))` asserts `false` for a macOS dotfile
        //           (`.DS_Store`) whose name begins with a dot and has no real extension.
        // Why:      A leading-dot name has its only dot at index 0, which `extensionOf` treats as
        //           "no extension", so it must be rejected (system junk, not audio).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile(".DS_Store")).toBe(false);
        // ```
        assertFalse(isAudioFile(".DS_Store"))
        // What:     `assertFalse(isAudioFile("noext"))` asserts `false` for a name with NO dot at
        //           all.
        // Why:      A name lacking any extension cannot be audio; `extensionOf` returns `null`,
        //           so the predicate returns `false`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile("noext")).toBe(false);
        // ```
        assertFalse(isAudioFile("noext"))
        // What:     `assertFalse(isAudioFile("._song.mp3"))` asserts `false` for an AppleDouble
        //           sidecar whose name starts with `._` but still ends in an allowlisted extension.
        // Why:      Sidecars copy the real track's extension, so the explicit prefix guard must beat
        //           the extension allowlist.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile("._song.mp3")).toBe(false);
        // ```
        assertFalse(isAudioFile("._song.mp3"))
        // What:     `assertTrue(isAppleDoubleSidecar("/music/._Track.FLAC"))` asserts `true` for
        //           the shared sidecar predicate when the marker sits on the final path component.
        // Why:      MediaStore passes only a display name while SAF may pass nested names; both must
        //           classify the same sidecar shape.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAppleDoubleSidecar("/music/._Track.FLAC")).toBe(true);
        // ```
        assertTrue(isAppleDoubleSidecar("/music/._Track.FLAC"))
        // What:     `assertFalse(isAppleDoubleSidecar("/music/Track.FLAC"))` asserts `false`
        //           for an ordinary track whose final path component does not start with `._`.
        // Why:      The helper must not reject real tracks just because they live beside sidecars.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAppleDoubleSidecar("/music/Track.FLAC")).toBe(false);
        // ```
        assertFalse(isAppleDoubleSidecar("/music/Track.FLAC"))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test case (metadata only;
    //           see the first `@Test` block for the full explanation).
    // Why:      Registers `isAudioFileRejectsLeadingDotEvenWhenExtensionWouldMatch` with the
    //           runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("isAudioFile rejects leading dot even when extension would match", () => {
    // ```
    @Test
    // What:     `fun isAudioFileRejectsLeadingDotEvenWhenExtensionWouldMatch() { ... }` declares
    //           a no-arg `Unit`-returning test method, block body.
    // Why:      Pins the subtle rule that a name like `.flac` is rejected EVEN THOUGH the text
    //           after the dot (`flac`) is a valid extension. This matters because a naive
    //           "split on last dot" would wrongly accept dotfiles named after a codec.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertions below... *\/ }
    // ```
    fun isAudioFileRejectsLeadingDotEvenWhenExtensionWouldMatch() {
        // What:     `assertFalse(isAudioFile(".flac"))` asserts `false` for a bare dotfile whose
        //           name is literally `.flac`.
        // Why:      The dot is at index 0 (leading dot), so `extensionOf` reports "no extension"
        //           and the file is rejected despite `flac` being allowlisted.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile(".flac")).toBe(false);
        // ```
        assertFalse(isAudioFile(".flac"))
        // What:     `assertFalse(isAudioFile("/music/.opus"))` asserts `false` for a dotfile
        //           `.opus` sitting inside a `/music/` directory.
        // Why:      Confirms the leading-dot rejection still holds after the final component
        //           (`.opus`) is isolated from its parent path; the leading dot of the COMPONENT
        //           is what counts, not the slashes before it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile("/music/.opus")).toBe(false);
        // ```
        assertFalse(isAudioFile("/music/.opus"))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `isAudioFileAcceptsEveryAllowlistedExtension` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("isAudioFile accepts every allowlisted extension", () => {
    // ```
    @Test
    // What:     `fun isAudioFileAcceptsEveryAllowlistedExtension() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that EVERY entry in `AUDIO_EXTENSIONS` is actually accepted by `isAudioFile`
    //           when used as a real extension. This guards against the allowlist and the
    //           predicate drifting apart (e.g. an extension added to the set but mishandled by
    //           the matcher).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...loop below... *\/ }
    // ```
    fun isAudioFileAcceptsEveryAllowlistedExtension() {
        // What:     `AUDIO_EXTENSIONS.forEach { extension -> ... }` iterates the `Set<String>`
        //           allowlist, running the trailing lambda once per element.
        //           - `.forEach { ... }` is a stdlib higher-order function; the `{ ... }` after
        //             it is a TRAILING LAMBDA (Kotlin lets the last lambda argument sit outside
        //             the parentheses).
        //           - `extension ->` NAMES the lambda's single parameter `extension`. This is the
        //             explicit-name form; contrast Queue.kt's `{ order[it] }`, which used the
        //             implicit single-parameter name `it`. Here we name it for readability.
        // Why:      Drive the same assertion across all 14 allowlisted extensions without writing
        //           14 lines.
        // Gotcha:   `forEach` here is a Kotlin COLLECTION method (eager, returns `Unit`), not a
        //           control-flow keyword; the `extension ->` arrow is INSIDE the braces, unlike
        //           a TS arrow whose `=>` sits before the braces.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // AUDIO_EXTENSIONS.forEach((extension) => {
        //   // ...assertion below...
        // });
        // ```
        AUDIO_EXTENSIONS.forEach { extension ->
            // What:     `assertTrue(extension, isAudioFile("track.$extension"))` calls the
            //           TWO-argument overload of `assertTrue`: `assertTrue(message, condition)`.
            //           - The FIRST argument `extension` is the failure MESSAGE printed if the
            //             assertion fails (so a failure says which extension broke). This is the
            //             message-FIRST overload, easy to misread as the condition.
            //           - The SECOND argument is the condition: `isAudioFile("track.$extension")`.
            //           - `"track.$extension"` is STRING INTERPOLATION: inside a double-quoted
            //             string, `$extension` (a bare `$` + identifier, NO braces) splices the
            //             loop variable's value in, producing `"track.flac"`, `"track.wav"`, etc.
            // Why:      Assert that a filename built from each allowlisted extension is recognised,
            //           labelling any failure with the offending extension.
            // Gotcha:   Two traps on one line. (1) Argument order: `assertTrue(message, cond)` is
            //           backwards from `expect(cond)`. (2) Interpolation: Kotlin uses `$name`
            //           with NO braces (braces only for expressions, `${expr}`); TS ALWAYS needs
            //           `${...}` and backticks. A TS reader sees `$extension` and may not realise
            //           it is interpolated.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // expect(isAudioFile(`track.${extension}`)).toBe(true); // message arg has no expect() analogue
            // ```
            assertTrue(extension, isAudioFile("track.$extension"))
        }
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `isAudioFileIgnoresDotsInParentDirectories` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("isAudioFile ignores dots in parent directories", () => {
    // ```
    @Test
    // What:     `fun isAudioFileIgnoresDotsInParentDirectories() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that dots in PARENT folder names do not leak into the extension decision:
    //           only the final path component's last dot matters. This matters because album
    //           folders are often named like `album.2020`, which must not fool the matcher.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertions below... *\/ }
    // ```
    fun isAudioFileIgnoresDotsInParentDirectories() {
        // What:     `assertFalse(isAudioFile("/cover.jpg/noext"))` asserts `false` for a path
        //           whose PARENT folder is named `cover.jpg` but whose final component `noext`
        //           has no dot.
        // Why:      The dot lives in the parent (`cover.jpg`), not the final component; after
        //           isolating `noext`, there is no extension, so the result is `false`. Proves
        //           parent-directory dots are ignored.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile("/cover.jpg/noext")).toBe(false);
        // ```
        assertFalse(isAudioFile("/cover.jpg/noext"))
        // What:     `assertTrue(isAudioFile("/album.2020/01.flac"))` asserts `true` for a `.flac`
        //           file inside a dotted folder name `album.2020`.
        // Why:      Confirms the converse: even with a dot in the PARENT (`album.2020`), the final
        //           component `01.flac` still yields the real extension `flac`, so it is accepted.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(isAudioFile("/album.2020/01.flac")).toBe(true);
        // ```
        assertTrue(isAudioFile("/album.2020/01.flac"))
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `audioFilesSortedKeepsOnlyAudioFilesAndSkipsJunk` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("audioFilesSorted keeps only audio files and skips junk", () => {
    // ```
    @Test
    // What:     `fun audioFilesSortedKeepsOnlyAudioFilesAndSkipsJunk() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that `audioFilesSorted` drops every non-audio name (images, playlists,
    //           dotfiles, sidecar databases) and keeps only the genuine audio files. This is the
    //           junk-filtering contract a folder scan relies on.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...arrange + assert below... *\/ }
    // ```
    fun audioFilesSortedKeepsOnlyAudioFilesAndSkipsJunk() {
        // What:     `val got = audioFilesSorted(listOf( ... ))` declares a read-only local binding
        //           `got` (`val` = cannot be reassigned; its type `List<String>` is inferred from
        //           the call). Its value is the result of calling the function under test,
        //           `audioFilesSorted`, on a mixed input list. The call spans several lines for
        //           readability.
        // Why:      Capture the function's output once so the assertion below can compare it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const got = audioFilesSorted([
        //   "song.mp3", "tune.flac", "cover.jpg", "playlist.m3u",
        //   ".DS_Store", ".nomedia", ".database_uuid", "._song.mp3",
        // ]);
        // ```
        val got =
            audioFilesSorted(
                // What:     `listOf( ... )` is a FACTORY FUNCTION that builds an immutable
                //           `List<String>` from the listed elements. It is NOT a constructor call
                //           with `new`; Kotlin makes read-only collections via these `xxxOf`
                //           factories. Sibling factories the reader might expect:
                //           `mutableListOf(...)` (a list you can add to), `setOf(...)` (unordered,
                //           unique), `arrayOf(...)` (fixed-size array).
                // Why:      Supply the mixed bag of filenames (audio + junk) the function must
                //           filter and sort.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // ["song.mp3", "tune.flac", "cover.jpg", "playlist.m3u", ".DS_Store", ".nomedia", ".database_uuid", "._song.mp3"]
                // ```
                listOf(
                    "song.mp3",
                    "tune.flac",
                    "cover.jpg",
                    "playlist.m3u",
                    ".DS_Store",
                    ".nomedia",
                    ".database_uuid",
                    "._song.mp3",
                ),
            )
        // What:     `assertEquals(listOf("song.mp3", "tune.flac"), got)` calls the two-argument
        //           `assertEquals(expected, actual)`, which FAILS unless the two are value-equal.
        //           - The FIRST argument `listOf("song.mp3", "tune.flac")` is the EXPECTED list
        //             (built with the `listOf` immutable-list factory described above).
        //           - The SECOND argument `got` is the ACTUAL result captured earlier.
        //           Lists compare by structural equality (same elements, same order).
        // Why:      Assert the junk was removed and only the two audio files survive, in sorted
        //           order (`song.mp3` before `tune.flac`).
        // Gotcha:   Argument order: `assertEquals(expected, actual)` is backwards from
        //           `expect(actual).toEqual(expected)`. Kotlin `==` / `assertEquals` on `List`
        //           is a deep structural compare, like TS `toEqual`, NOT reference identity.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(got).toEqual(["song.mp3", "tune.flac"]);
        // ```
        assertEquals(listOf("song.mp3", "tune.flac"), got)
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `audioFilesSortedSortsRetainedFiles` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("audioFilesSorted sorts retained files", () => {
    // ```
    @Test
    // What:     `fun audioFilesSortedSortsRetainedFiles() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins that surviving audio files are returned in ASCENDING order even when the
    //           input is out of order (`b.flac` before `a.flac` in, `a.flac` before `b.flac`
    //           out). The queue depends on a stable, predictable order.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertion below... *\/ }
    // ```
    fun audioFilesSortedSortsRetainedFiles() {
        // What:     `assertEquals(listOf("a.flac", "b.flac"), audioFilesSorted(listOf("b.flac", "a.flac")))`
        //           is one `assertEquals(expected, actual)` call holding THREE concept-introducing
        //           pieces on this multi-line statement:
        //           - the EXPECTED `listOf("a.flac", "b.flac")` (immutable-list factory),
        //           - the ACTUAL `audioFilesSorted(...)` call (function under test),
        //           - its argument `listOf("b.flac", "a.flac")` (another immutable-list factory),
        //             deliberately given in REVERSE order.
        // Why:      Feeding `b` before `a` and expecting `a` before `b` proves the function sorts
        //           rather than preserving input order.
        // Gotcha:   Same expected-vs-actual order trap as the other `assertEquals` calls.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(audioFilesSorted(["b.flac", "a.flac"])).toEqual(["a.flac", "b.flac"]);
        // ```
        assertEquals(
            listOf("a.flac", "b.flac"),
            audioFilesSorted(listOf("b.flac", "a.flac")),
        )
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `audioFilesSortedIsCaseSensitiveCodeUnitOrder` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("audioFilesSorted is case-sensitive code-unit order", () => {
    // ```
    @Test
    // What:     `fun audioFilesSortedIsCaseSensitiveCodeUnitOrder() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins the SORT SEMANTICS precisely: the order is case-SENSITIVE by UTF-16 code
    //           unit, so uppercase `A` (code unit 65) sorts BEFORE lowercase `a` (code unit 97).
    //           This matters because a case-insensitive sort would give the opposite answer; the
    //           test locks in parity with the Rust port's `PathBuf` ordering.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertion below... *\/ }
    // ```
    fun audioFilesSortedIsCaseSensitiveCodeUnitOrder() {
        // What:     `assertEquals(listOf("A.flac", "a.flac"), audioFilesSorted(listOf("a.flac", "A.flac")))`
        //           is one `assertEquals(expected, actual)` call: EXPECTED `listOf("A.flac",
        //           "a.flac")` (uppercase first), ACTUAL the sort of `listOf("a.flac", "A.flac")`
        //           (lowercase given first). Both `listOf(...)` are immutable-list factories; the
        //           inner one is the function-under-test's argument.
        // Why:      Input `a` before `A`, expected output `A` before `a`, demonstrates the sort
        //           compares raw code units (uppercase < lowercase), i.e. it is case-sensitive.
        // Gotcha:   `"A" < "a"` here because the comparison is by UTF-16 code unit, exactly like
        //           TS's default `Array.prototype.sort` on strings, and like Rust's byte/`PathBuf`
        //           order for ASCII; do NOT expect locale-aware or case-folded ordering.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(audioFilesSorted(["a.flac", "A.flac"])).toEqual(["A.flac", "a.flac"]);
        // ```
        assertEquals(
            listOf("A.flac", "a.flac"),
            audioFilesSorted(listOf("a.flac", "A.flac")),
        )
    }

    // What:     `@Test` annotation marking the next method as a JUnit test (metadata only).
    // Why:      Registers `audioFilesSortedYieldsEmptyWhenNoAudioPresent` with the runner.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("audioFilesSorted yields empty when no audio present", () => {
    // ```
    @Test
    // What:     `fun audioFilesSortedYieldsEmptyWhenNoAudioPresent() { ... }` declares a no-arg
    //           `Unit`-returning test method, block body.
    // Why:      Pins the boundary case: an input of only junk yields an EMPTY list, not a
    //           partial or null result. A scan of a folder with no music must produce an empty
    //           queue cleanly.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertion below... *\/ }
    // ```
    fun audioFilesSortedYieldsEmptyWhenNoAudioPresent() {
        // What:     `assertTrue(audioFilesSorted(listOf("cover.jpg", ".nomedia", "noext")).isEmpty())`
        //           asserts a `Boolean` is `true`. The condition is built by:
        //           - `listOf("cover.jpg", ".nomedia", "noext")` — an immutable-list factory of
        //             three non-audio names.
        //           - `audioFilesSorted(...)` — filter+sort the junk, yielding a `List<String>`.
        //           - `.isEmpty()` — a stdlib `List` predicate returning `true` when the list has
        //             zero elements.
        // Why:      All three inputs are junk, so the result must be empty; `.isEmpty()` turns
        //           that into the `true` the assertion needs.
        // Gotcha:   Kotlin's `List.isEmpty()` is a METHOD (parentheses required); there is no
        //           `.length`-vs-`.size` confusion to worry about because we never read the size
        //           here, only the emptiness predicate.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(audioFilesSorted(["cover.jpg", ".nomedia", "noext"]).length === 0).toBe(true);
        // ```
        assertTrue(audioFilesSorted(listOf("cover.jpg", ".nomedia", "noext")).isEmpty())
    }
}
