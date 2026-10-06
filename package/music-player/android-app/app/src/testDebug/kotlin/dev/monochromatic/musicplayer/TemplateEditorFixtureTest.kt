//region Authored template editor states checked against the reference's printed output, not native fit
// What: Package shares the internal debug-only template editor fixture with these tests.
// Why: Checking authored copy never opens a library, a preference store or a template evaluator.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named JUnit imports expose value, Boolean and null assertions plus the test marker.
// Why: Host-JVM checks reject a drifted character or a wrong state before any native capture.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test, expect } from 'test';
// ```
import org.junit.Assert.assertEquals
// Boolean absence assertion.
import org.junit.Assert.assertFalse
// Asserts that a nullable value is null.
import org.junit.Assert.assertNull
// Boolean presence assertion.
import org.junit.Assert.assertTrue
// Host test registration marker.
import org.junit.Test

/**
 * What: A class groups annotated test methods, without an Android activity.
 * Why: Every expected text is written here as a literal copied from what
 * `package/music-player/design/template-editor-scenes.mjs` prints, so the fixture is compared with
 * the reference's output and not with itself.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * describe('authored template editor states', () => { ... });
 * ```
 */
class TemplateEditorFixtureTest {
    /**
     * What: A private val is a read-only field of the test class. Inside a Kotlin string, `$name`
     * splices a variable the way `${name}` does in a TypeScript template literal, so every literal
     * dollar sign is written `\$`.
     * Why: Four states show the default template, and the reset rule compares against it.
     * Gotcha: An unescaped `$tf` would be read as "insert the variable tf" and fail to compile.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * const defaultTemplate = '$tf(mi(len), m:ss)$ $mi(peak)$';
     * ```
     */
    private val defaultTemplate: String = "\$tf(mi(len), m:ss)\$ \$mi(peak)\$"

    /**
     * What: A private val holds the playing track's default template, every literal dollar sign
     * written `\$` for the same reason as the track rows' default.
     * Why: The playing state shows it, and the reset rule compares that state against it rather
     * than against the track rows' default.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * const playingDefaultTemplate = '$mi(track)$ of $mi(total)$ $mi(peak)$';
     * ```
     */
    private val playingDefaultTemplate: String = "\$mi(track)\$ of \$mi(total)\$ \$mi(peak)\$"

    /**
     * What: `listOf(a, b, ...)` builds a read-only List of the native scene names. `List<String>` is
     * an ordered read-only collection; the siblings a reader might expect are MutableList
     * (changeable after creation) and Array (fixed-size, compared by identity).
     * Why: The rules that hold for every state loop over one list, and List (not MutableList or
     * Array) keeps a test from adding or dropping a scene by accident. The reference also prints
     * `custom-end`, which is the `custom` state captured at the end of the page, not a scene of
     * its own, so it is not listed here.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * const scenes = ['list', 'default', 'help', 'unknown-field', 'open-formula', 'custom', 'empty-library', 'playing'] as const;
     * ```
     */
    private val scenes: List<String> =
        listOf("list", "default", "help", "unknown-field", "open-formula", "custom", "empty-library", "playing")

    /**
     * What: A private method returns the track rows' fields with the first library file's values; each
     * list element constructs one record by passing its fields in declaration order.
     * Why: Most states list these same fields, and the playing state lists them first, so their
     * expected values are written once.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * function libraryFields(): readonly TemplateEditorField[] { return [{ label: 'Title', insert: 'mi(title)', value: 'Another Xronixle' }, ...]; }
     * ```
     */
    private fun libraryFields(): List<TemplateEditorField> {
        return listOf(
            TemplateEditorField("Title", "mi(title)", "Another Xronixle"),
            TemplateEditorField("File name", "mi(file)", "かめりあ(Camellia) - Another Xronixle"),
            TemplateEditorField("Extension", "mi(ext)", "flac"),
            TemplateEditorField("Folder", "mi(folder)", "Camellia"),
            TemplateEditorField("Path", "mi(path)", "Camellia/かめりあ(Camellia) - Another Xronixle.flac"),
            TemplateEditorField("Duration", "mi(len)", "275"),
            TemplateEditorField("True peak", "mi(peak)", "−1.2 dBTP"),
        )
    }

    /**
     * What: A private method returns the default template's two results for the authored library.
     * Why: Five states draw these rows: the three that apply the default, and the two whose
     * mistake makes the rows keep the last valid template.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * function libraryRows(): readonly TemplateEditorPreviewRow[] { return [{ title: 'Another Xronixle', supporting: '4:35 −1.2 dBTP' }, { title: 'Burning Aquamarine', supporting: '5:12 ' }]; }
     * ```
     */
    private fun libraryRows(): List<TemplateEditorPreviewRow> {
        return listOf(
            TemplateEditorPreviewRow("Another Xronixle", "4:35 −1.2 dBTP"),
            TemplateEditorPreviewRow("Burning Aquamarine", "5:12 "),
        )
    }

    /**
     * What: A private method returns the Settings page's two entries, in the order they are drawn.
     * Why: The reference lists every template with the line its default yields for the first file
     * of the library, whatever state the editor is in, so every state carries these same entries.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * function listEntries(): readonly TemplateEditorListEntry[] { return [{ title: 'Track rows', supporting: '4:35 −1.2 dBTP' },
     *   { title: 'Playing track', supporting: '1 of 16 −1.2 dBTP' }]; }
     * ```
     */
    private fun listEntries(): List<TemplateEditorListEntry> {
        return listOf(
            TemplateEditorListEntry("Track rows", "4:35 −1.2 dBTP"),
            TemplateEditorListEntry("Playing track", "1 of 16 −1.2 dBTP"),
        )
    }

    /**
     * What: @Test registers a named function. `val fixture: TemplateEditorFixture = ...` binds a
     * read-only local with its type written out. assertEquals compares two values, and two data-class
     * records or two lists are equal when every field or element is; assertNull requires null.
     * Why: The Settings page lists every template with the line its default produces for the first
     * file, and carries the track rows' title as the reference prints it for this state.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('list', () => { const fixture = templateEditorFixture('list'); expect(fixture.page).toBe('list'); ... });
     * ```
     */
    @Test fun listSceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("list")
        assertEquals("list", fixture.page)
        assertEquals("Track rows", fixture.pageTitle)
        assertEquals(defaultTemplate, fixture.template)
        assertEquals(-1, fixture.caret)
        assertEquals(libraryRows(), fixture.previewRows)
        assertEquals("From your library. The second file is not analysed yet.", fixture.previewNote)
        assertEquals(0, fixture.errors.size)
        assertNull(fixture.help)
        assertEquals(libraryFields(), fixture.fields)
        assertFalse(fixture.resetEnabled)
        assertEquals(listEntries(), fixture.listEntries)
    }

    /** The editor as first opened shows the default template, not focused, with nothing to reset. */
    @Test fun defaultSceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("default")
        assertEquals("editor", fixture.page)
        assertEquals("Track rows", fixture.pageTitle)
        assertEquals(defaultTemplate, fixture.template)
        assertEquals(-1, fixture.caret)
        assertEquals(libraryRows(), fixture.previewRows)
        assertEquals("From your library. The second file is not analysed yet.", fixture.previewNote)
        assertEquals(0, fixture.errors.size)
        assertNull(fixture.help)
        assertEquals(libraryFields(), fixture.fields)
        assertFalse(fixture.resetEnabled)
        assertEquals(listEntries(), fixture.listEntries)
    }

    /** A caret inside the format argument of `tf` shows that call's signature and description. */
    @Test fun helpSceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("help")
        assertEquals("editor", fixture.page)
        assertEquals("Track rows", fixture.pageTitle)
        assertEquals(defaultTemplate, fixture.template)
        assertEquals(15, fixture.caret)
        assertEquals(libraryRows(), fixture.previewRows)
        assertEquals("From your library. The second file is not analysed yet.", fixture.previewNote)
        assertEquals(0, fixture.errors.size)
        assertEquals(TemplateEditorHelp(
            "tf(seconds, [format])",
            "format",
            "Format: h, m and s for hours, minutes and seconds; a doubled letter pads with a zero; text between apostrophes is kept. Without it, m:ss.",
        ), fixture.help)
        assertEquals(libraryFields(), fixture.fields)
        assertFalse(fixture.resetEnabled)
        assertEquals(listEntries(), fixture.listEntries)
    }

    /** A misspelt field name gives one error line while the rows keep the last valid template. */
    @Test fun unknownFieldSceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("unknown-field")
        assertEquals("editor", fixture.page)
        assertEquals("Track rows", fixture.pageTitle)
        assertEquals("\$tf(mi(len), m:ss)\$ \$mi(peek)\$", fixture.template)
        assertEquals(30, fixture.caret)
        assertEquals(libraryRows(), fixture.previewRows)
        assertEquals("Rows keep the last valid template.", fixture.previewNote)
        assertEquals(listOf("mi: unknown field peek"), fixture.errors)
        assertNull(fixture.help)
        assertEquals(libraryFields(), fixture.fields)
        assertTrue(fixture.resetEnabled)
        assertEquals(listEntries(), fixture.listEntries)
    }

    /** A formula left without its closing dollar sign is reported with the place it was opened. */
    @Test fun openFormulaSceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("open-formula")
        assertEquals("editor", fixture.page)
        assertEquals("Track rows", fixture.pageTitle)
        assertEquals("\$tf(mi(len), m:ss)", fixture.template)
        assertEquals(18, fixture.caret)
        assertEquals(libraryRows(), fixture.previewRows)
        assertEquals("Rows keep the last valid template.", fixture.previewNote)
        assertEquals(listOf("formula: the \$ at character 1 has no closing \$"), fixture.errors)
        assertNull(fixture.help)
        assertEquals(libraryFields(), fixture.fields)
        assertTrue(fixture.resetEnabled)
        assertEquals(listEntries(), fixture.listEntries)
    }

    /** A valid template other than the default changes both rows; Settings still lists each template's default line. */
    @Test fun customSceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("custom")
        assertEquals("editor", fixture.page)
        assertEquals("Track rows", fixture.pageTitle)
        assertEquals("\$tc(up, mi(ext))\$ · \$tf(mi(len), m:ss)\$ · \$mi(peak)\$", fixture.template)
        assertEquals(-1, fixture.caret)
        assertEquals(listOf(
            TemplateEditorPreviewRow("Another Xronixle", "FLAC · 4:35 · −1.2 dBTP"),
            TemplateEditorPreviewRow("Burning Aquamarine", "FLAC · 5:12 · "),
        ), fixture.previewRows)
        assertEquals("From your library. The second file is not analysed yet.", fixture.previewNote)
        assertEquals(0, fixture.errors.size)
        assertNull(fixture.help)
        assertEquals(libraryFields(), fixture.fields)
        assertTrue(fixture.resetEnabled)
        assertEquals(listEntries(), fixture.listEntries)
    }

    /** With a library that holds no tracks yet, the preview rows and every field value are stand-ins. */
    @Test fun emptyLibrarySceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("empty-library")
        assertEquals("editor", fixture.page)
        assertEquals("Track rows", fixture.pageTitle)
        assertEquals(defaultTemplate, fixture.template)
        assertEquals(-1, fixture.caret)
        assertEquals(listOf(
            TemplateEditorPreviewRow("Track title", "3:20 −1.0 dBTP"),
            TemplateEditorPreviewRow("Track not analysed yet", "3:20 "),
        ), fixture.previewRows)
        assertEquals("Your library has no tracks yet. These are sample values.", fixture.previewNote)
        assertEquals(0, fixture.errors.size)
        assertNull(fixture.help)
        assertEquals(listOf(
            TemplateEditorField("Title", "mi(title)", "Track title"),
            TemplateEditorField("File name", "mi(file)", "File name"),
            TemplateEditorField("Extension", "mi(ext)", "flac"),
            TemplateEditorField("Folder", "mi(folder)", "Folder"),
            TemplateEditorField("Path", "mi(path)", "Folder/File name.flac"),
            TemplateEditorField("Duration", "mi(len)", "200"),
            TemplateEditorField("True peak", "mi(peak)", "−1.0 dBTP"),
        ), fixture.fields)
        assertFalse(fixture.resetEnabled)
        assertEquals(listEntries(), fixture.listEntries)
    }

    /**
     * What: `libraryFields() + listOf(...)` builds a new List holding the track rows' fields, then
     * the two listed after them, like `[...libraryFields(), a, b]` in TypeScript.
     * Why: The playing track's editor (D97 version) carries its own title and default template,
     * nothing to reset, rows saying each file's place in its folder of 16, and the track rows'
     * fields followed by the place in the folder and the folder's track count. The second row ends
     * in the space before its empty peak, as the reference prints it.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('playing', () => { const fixture = templateEditorFixture('playing'); expect(fixture.pageTitle).toBe('Playing track'); ... });
     * ```
     */
    @Test fun playingSceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("playing")
        assertEquals("editor", fixture.page)
        assertEquals("Playing track", fixture.pageTitle)
        assertEquals(playingDefaultTemplate, fixture.template)
        assertEquals(-1, fixture.caret)
        assertEquals(listOf(
            TemplateEditorPreviewRow("Another Xronixle", "1 of 16 −1.2 dBTP"),
            TemplateEditorPreviewRow("Burning Aquamarine", "2 of 16 "),
        ), fixture.previewRows)
        assertEquals("From your library. The second file is not analysed yet.", fixture.previewNote)
        assertEquals(0, fixture.errors.size)
        assertNull(fixture.help)
        assertEquals(libraryFields() + listOf(
            TemplateEditorField("Place in folder", "mi(track)", "1"),
            TemplateEditorField("Tracks in folder", "mi(total)", "16"),
        ), fixture.fields)
        assertFalse(fixture.resetEnabled)
        assertEquals(listEntries(), fixture.listEntries)
    }

    /**
     * What: `previewRows[1]` reads the second row by position, as an array index does in TypeScript,
     * and `.supporting` reads its line. Each expected text is written inline, trailing space included.
     * Why: Plain substitution keeps the literal text before a field that yields nothing, so the row
     * of a file not analysed yet ends in a space, exactly as the reference prints it. A line trimmed
     * anywhere between the reference and the fixture fails here by name.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * expect(templateEditorFixture('default').previewRows[1].supporting).toBe('5:12 ');
     * ```
     */
    @Test fun unanalysedRowKeepsTheSpaceBeforeItsEmptyPeak() {
        assertEquals("5:12 ", templateEditorFixture("default").previewRows[1].supporting)
        assertEquals("FLAC · 5:12 · ", templateEditorFixture("custom").previewRows[1].supporting)
        assertEquals("3:20 ", templateEditorFixture("empty-library").previewRows[1].supporting)
        assertEquals("2 of 16 ", templateEditorFixture("playing").previewRows[1].supporting)
    }

    /** The default template is two formulas and the space between them, with no condition. */
    @Test fun defaultTemplateIsPlainSubstitution() {
        assertEquals("\$tf(mi(len), m:ss)\$ \$mi(peak)\$", templateEditorFixture("default").template)
    }

    /**
     * What: `var message: String? = null` is a replaceable local that holds text or null.
     * `try { ... } catch (error: IllegalArgumentException) { ... }` runs the block and, only if that
     * exception type is thrown, runs the handler with the caught value bound to `error`.
     * Why: An unplanned scene name must stop the study with a message naming it. If nothing is
     * thrown the message stays null and the comparison fails, so a silent fallback cannot pass.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * let message: string | null = null;
     * try { templateEditorFixture('unplanned'); } catch (error) { message = (error as Error).message; }
     * expect(message).toBe('Unknown authored template editor scene: unplanned');
     * ```
     */
    @Test fun unknownSceneIsRejectedByName() {
        var message: String? = null
        try {
            templateEditorFixture("unplanned")
        } catch (error: IllegalArgumentException) {
            message = error.message
        }
        assertEquals("Unknown authored template editor scene: unplanned", message)
    }

    /** An empty scene name is rejected like any other unknown name, never read as a default. */
    @Test fun emptySceneNameIsRejected() {
        var message: String? = null
        try {
            templateEditorFixture("")
        } catch (error: IllegalArgumentException) {
            message = error.message
        }
        assertEquals("Unknown authored template editor scene: ", message)
    }

    /**
     * What: A `for (scene in scenes)` loop visits each list element in order, like TypeScript's
     * `for...of`. The first argument of assertFalse is a message shown when the check fails.
     * Why: Mistakes take the place of typing help under the field, so no state may carry both, and
     * a failure names the scene that broke the rule.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * for (const scene of scenes) { const fixture = templateEditorFixture(scene); expect(fixture.errors.length > 0 && fixture.help !== null).toBe(false); }
     * ```
     */
    @Test fun errorsAndHelpNeverAppearTogether() {
        for (scene in scenes) {
            val fixture: TemplateEditorFixture = templateEditorFixture(scene)
            assertFalse(scene, fixture.errors.isNotEmpty() && fixture.help != null)
        }
    }

    /** Help describes the call holding the caret, so a state without a caret has none. */
    @Test fun helpAppearsOnlyWithACaret() {
        for (scene in scenes) {
            val fixture: TemplateEditorFixture = templateEditorFixture(scene)
            if (fixture.help != null) assertTrue(scene, fixture.caret >= 0)
        }
    }

    /** Every state previews exactly two rows: an analysed file and one not analysed yet. */
    @Test fun everySceneHasTwoPreviewRows() {
        for (scene in scenes) {
            assertEquals(scene, 2, templateEditorFixture(scene).previewRows.size)
        }
    }

    /**
     * What: `Regex("mi\\([a-z]+\\)")` builds a regular expression; inside a Kotlin string `\\` is
     * one backslash, so the pattern is `mi\([a-z]+\)`. `matches` is true only when the whole text
     * fits the pattern.
     * `if (...) 9 else 7` is an expression yielding one of the two counts, like `cond ? 9 : 7`.
     * Why: A track-row state lists the seven track-row fields and the playing track's state lists
     * those plus its two folder fields, nine in all, and a tap inserts a `mi` call with one mode
     * word, the only kind of field the language has.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * expect(fixture.fields.length).toBe(fixture.pageTitle === 'Playing track' ? 9 : 7);
     * for (const field of fixture.fields) expect(/^mi\([a-z]+\)$/.test(field.insert)).toBe(true);
     * ```
     */
    @Test fun everySceneListsTheInsertableFieldsOfItsTemplate() {
        for (scene in scenes) {
            val fixture: TemplateEditorFixture = templateEditorFixture(scene)
            // The playing track's template knows two fields more than the track rows' template.
            val expectedCount: Int = if (fixture.pageTitle == "Playing track") 9 else 7
            assertEquals(scene, expectedCount, fixture.fields.size)
            for (field in fixture.fields) {
                assertTrue(scene + " " + field.insert, Regex("mi\\([a-z]+\\)").matches(field.insert))
            }
        }
    }

    /**
     * What: The loop picks, per state, the default of the template that state edits, chosen by its
     * page title, and compares the shown template with it.
     * Why: The way back to the default is usable exactly when the template is not its own
     * template's default, as the reference computes it per template; the playing track's default
     * differs from the track rows' default and still has nothing to reset.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * for (const scene of scenes) { const fixture = templateEditorFixture(scene);
     *   const ownDefault = fixture.pageTitle === 'Playing track' ? playingDefaultTemplate : defaultTemplate;
     *   expect(fixture.resetEnabled).toBe(fixture.template !== ownDefault); }
     * ```
     */
    @Test fun resetIsEnabledExactlyWhenTheTemplateDiffersFromItsOwnDefault() {
        for (scene in scenes) {
            val fixture: TemplateEditorFixture = templateEditorFixture(scene)
            // The default of the template this state edits.
            val ownDefault: String = if (fixture.pageTitle == "Playing track") playingDefaultTemplate else defaultTemplate
            assertEquals(scene, fixture.template != ownDefault, fixture.resetEnabled)
        }
    }

    /** Every state carries the same Settings entries, whatever template it edits or shows. */
    @Test fun everySceneCarriesTheSameListEntries() {
        for (scene in scenes) {
            assertEquals(scene, listEntries(), templateEditorFixture(scene).listEntries)
        }
    }

    /** A caret is either absent (-1) or a position from the start of the template to its end. */
    @Test fun caretIsAbsentOrInsideTheTemplate() {
        for (scene in scenes) {
            val fixture: TemplateEditorFixture = templateEditorFixture(scene)
            val absent: Boolean = fixture.caret == -1
            val inside: Boolean = fixture.caret >= 0 && fixture.caret <= fixture.template.length
            assertTrue(scene, absent || inside)
        }
    }

    /**
     * What: `templateEditorPosition(null)` passes Kotlin's null, the value an Android launch yields
     * for a name it was not given.
     * Why: A launch that names no position must leave the scrolling body at its top. The position
     * names are this study's own presentation choices, not text the reference prints, so they are
     * checked against the names the study's launches use.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('position default', () => { expect(templateEditorPosition(null)).toBe('top'); });
     * ```
     */
    @Test fun positionDefaultsToTopWhenTheLaunchNamesNone() {
        assertEquals("top", templateEditorPosition(null))
    }

    /** Each of the two position names is returned exactly as given. */
    @Test fun positionKeepsEachAllowedName() {
        assertEquals("top", templateEditorPosition("top"))
        assertEquals("end", templateEditorPosition("end"))
    }

    /** A position name outside the two stops the study with a message naming it. */
    @Test fun unknownPositionIsRejectedByName() {
        var message: String? = null
        try {
            templateEditorPosition("middle")
        } catch (error: IllegalArgumentException) {
            message = error.message
        }
        assertEquals("Unknown template editor position: middle", message)
    }

    /** An empty position name is rejected like any other unknown name, never read as the default. */
    @Test fun emptyPositionNameIsRejected() {
        var message: String? = null
        try {
            templateEditorPosition("")
        } catch (error: IllegalArgumentException) {
            message = error.message
        }
        assertEquals("Unknown template editor position: ", message)
    }

    /** An authored scene carries the default position until a launch replaces it. */
    @Test fun authoredSceneCarriesTheDefaultPosition() {
        val fixture: TemplateEditorFixture = templateEditorFixture("help")
        assertEquals("top", fixture.position)
    }
}
//endregion
