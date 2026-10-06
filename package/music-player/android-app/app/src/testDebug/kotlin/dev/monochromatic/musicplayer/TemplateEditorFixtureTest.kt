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
     * dollar sign is written `\$`; `\"` is a literal double quote.
     * Why: Four states show the default template, and the reset rule compares against it.
     * Gotcha: An unescaped `$tf` would be read as "insert the variable tf" and fail to compile.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * const defaultTemplate = '$tf(mi(len), m:ss)$$if(mi(peak) != "", " · " + mi(peak) + " dBTP")$';
     * ```
     */
    private val defaultTemplate: String =
        "\$tf(mi(len), m:ss)\$\$if(mi(peak) != \"\", \" · \" + mi(peak) + \" dBTP\")\$"

    /**
     * What: `listOf(a, b, ...)` builds a read-only List of the seven scene names. `List<String>` is
     * an ordered read-only collection; the siblings a reader might expect are MutableList
     * (changeable after creation) and Array (fixed-size, compared by identity).
     * Why: The rules that hold for every state loop over one list, and List (not MutableList or
     * Array) keeps a test from adding or dropping a scene by accident.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * const scenes = ['list', 'default', 'help', 'unknown-field', 'open-formula', 'custom', 'no-library'] as const;
     * ```
     */
    private val scenes: List<String> =
        listOf("list", "default", "help", "unknown-field", "open-formula", "custom", "no-library")

    /**
     * What: A private method returns the seven fields with the first library file's values; each
     * list element constructs one record by passing its fields in declaration order.
     * Why: Six states list these same fields, so their expected values are written once.
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
            TemplateEditorField("True peak", "mi(peak)", "−1.2"),
        )
    }

    /**
     * What: A private method returns the default template's two results for the authored library.
     * Why: Five states draw these rows: the three that apply the default, and the two whose
     * mistake makes the rows keep the last valid template.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * function libraryRows(): readonly TemplateEditorPreviewRow[] { return [{ title: 'Another Xronixle', supporting: '4:35 · −1.2 dBTP' }, { title: 'Burning Aquamarine', supporting: '5:12' }]; }
     * ```
     */
    private fun libraryRows(): List<TemplateEditorPreviewRow> {
        return listOf(
            TemplateEditorPreviewRow("Another Xronixle", "4:35 · −1.2 dBTP"),
            TemplateEditorPreviewRow("Burning Aquamarine", "5:12"),
        )
    }

    /**
     * What: @Test registers a named function. `val fixture: TemplateEditorFixture = ...` binds a
     * read-only local with its type written out. assertEquals compares two values, and two data-class
     * records or two lists are equal when every field or element is; assertNull requires null.
     * Why: The Settings page lists the default template with the line it produces for the first file.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('list', () => { const fixture = templateEditorFixture('list'); expect(fixture.page).toBe('list'); ... });
     * ```
     */
    @Test fun listSceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("list")
        assertEquals("list", fixture.page)
        assertEquals(defaultTemplate, fixture.template)
        assertEquals(-1, fixture.caret)
        assertEquals(libraryRows(), fixture.previewRows)
        assertEquals("From your library. The second file is not analysed yet.", fixture.previewNote)
        assertEquals(0, fixture.errors.size)
        assertNull(fixture.help)
        assertEquals(libraryFields(), fixture.fields)
        assertFalse(fixture.resetEnabled)
        assertEquals(TemplateEditorListEntry("Track row supporting line", "4:35 · −1.2 dBTP"), fixture.listEntry)
    }

    /** The editor as first opened shows the default template, not focused, with nothing to reset. */
    @Test fun defaultSceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("default")
        assertEquals("editor", fixture.page)
        assertEquals(defaultTemplate, fixture.template)
        assertEquals(-1, fixture.caret)
        assertEquals(libraryRows(), fixture.previewRows)
        assertEquals("From your library. The second file is not analysed yet.", fixture.previewNote)
        assertEquals(0, fixture.errors.size)
        assertNull(fixture.help)
        assertEquals(libraryFields(), fixture.fields)
        assertFalse(fixture.resetEnabled)
        assertEquals(TemplateEditorListEntry("Track row supporting line", "4:35 · −1.2 dBTP"), fixture.listEntry)
    }

    /** A caret inside the format argument of `tf` shows that call's signature and description. */
    @Test fun helpSceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("help")
        assertEquals("editor", fixture.page)
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
        assertEquals(TemplateEditorListEntry("Track row supporting line", "4:35 · −1.2 dBTP"), fixture.listEntry)
    }

    /** A misspelt field name gives one error line while the rows keep the last valid template. */
    @Test fun unknownFieldSceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("unknown-field")
        assertEquals("editor", fixture.page)
        assertEquals("\$tf(mi(len), m:ss)\$ · \$mi(peek)\$ dBTP", fixture.template)
        assertEquals(37, fixture.caret)
        assertEquals(libraryRows(), fixture.previewRows)
        assertEquals("Rows keep the last valid template.", fixture.previewNote)
        assertEquals(listOf("mi: unknown field peek"), fixture.errors)
        assertNull(fixture.help)
        assertEquals(libraryFields(), fixture.fields)
        assertTrue(fixture.resetEnabled)
        assertEquals(TemplateEditorListEntry("Track row supporting line", "4:35 · −1.2 dBTP"), fixture.listEntry)
    }

    /** A formula left without its closing dollar sign is reported with the place it was opened. */
    @Test fun openFormulaSceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("open-formula")
        assertEquals("editor", fixture.page)
        assertEquals("\$tf(mi(len), m:ss)", fixture.template)
        assertEquals(18, fixture.caret)
        assertEquals(libraryRows(), fixture.previewRows)
        assertEquals("Rows keep the last valid template.", fixture.previewNote)
        assertEquals(listOf("formula: the \$ at character 1 has no closing \$"), fixture.errors)
        assertNull(fixture.help)
        assertEquals(libraryFields(), fixture.fields)
        assertTrue(fixture.resetEnabled)
        assertEquals(TemplateEditorListEntry("Track row supporting line", "4:35 · −1.2 dBTP"), fixture.listEntry)
    }

    /** A valid template other than the default changes both rows and the Settings entry. */
    @Test fun customSceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("custom")
        assertEquals("editor", fixture.page)
        assertEquals("\$tc(up, mi(ext))\$ · \$tf(mi(len), m:ss)\$", fixture.template)
        assertEquals(-1, fixture.caret)
        assertEquals(listOf(
            TemplateEditorPreviewRow("Another Xronixle", "FLAC · 4:35"),
            TemplateEditorPreviewRow("Burning Aquamarine", "FLAC · 5:12"),
        ), fixture.previewRows)
        assertEquals("From your library. The second file is not analysed yet.", fixture.previewNote)
        assertEquals(0, fixture.errors.size)
        assertNull(fixture.help)
        assertEquals(libraryFields(), fixture.fields)
        assertTrue(fixture.resetEnabled)
        assertEquals(TemplateEditorListEntry("Track row supporting line", "FLAC · 4:35"), fixture.listEntry)
    }

    /** With no library open, the preview rows and every field value are stand-ins. */
    @Test fun noLibrarySceneMatchesReference() {
        val fixture: TemplateEditorFixture = templateEditorFixture("no-library")
        assertEquals("editor", fixture.page)
        assertEquals(defaultTemplate, fixture.template)
        assertEquals(-1, fixture.caret)
        assertEquals(listOf(
            TemplateEditorPreviewRow("Track title", "3:20 · −1.0 dBTP"),
            TemplateEditorPreviewRow("Track not analysed yet", "3:20"),
        ), fixture.previewRows)
        assertEquals("No library is open. These are sample values.", fixture.previewNote)
        assertEquals(0, fixture.errors.size)
        assertNull(fixture.help)
        assertEquals(listOf(
            TemplateEditorField("Title", "mi(title)", "Track title"),
            TemplateEditorField("File name", "mi(file)", "File name"),
            TemplateEditorField("Extension", "mi(ext)", "flac"),
            TemplateEditorField("Folder", "mi(folder)", "Folder"),
            TemplateEditorField("Path", "mi(path)", "Folder/File name.flac"),
            TemplateEditorField("Duration", "mi(len)", "200"),
            TemplateEditorField("True peak", "mi(peak)", "−1.0"),
        ), fixture.fields)
        assertFalse(fixture.resetEnabled)
        assertEquals(TemplateEditorListEntry("Track row supporting line", "3:20 · −1.0 dBTP"), fixture.listEntry)
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
     * Why: Every state lists exactly seven fields, and a tap inserts a `mi` call with one mode
     * word, the only kind of field the language has.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * for (const field of fixture.fields) expect(/^mi\([a-z]+\)$/.test(field.insert)).toBe(true);
     * ```
     */
    @Test fun everySceneHasSevenInsertableFields() {
        for (scene in scenes) {
            val fixture: TemplateEditorFixture = templateEditorFixture(scene)
            assertEquals(scene, 7, fixture.fields.size)
            for (field in fixture.fields) {
                assertTrue(scene + " " + field.insert, Regex("mi\\([a-z]+\\)").matches(field.insert))
            }
        }
    }

    /** The way back to the default is usable exactly when the template is not the default. */
    @Test fun resetIsEnabledExactlyWhenTheTemplateDiffersFromDefault() {
        val defaultSceneTemplate: String = templateEditorFixture("default").template
        for (scene in scenes) {
            val fixture: TemplateEditorFixture = templateEditorFixture(scene)
            assertEquals(scene, fixture.template != defaultSceneTemplate, fixture.resetEnabled)
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
     * What: `templateEditorLayout(null)` passes Kotlin's null, the value an Android launch yields
     * for a name it was not given.
     * Why: A launch that names no layout must keep `flow`, the layout every scene was authored in.
     * The layout and position names are this study's own presentation choices, not text the
     * reference prints, so they are checked against the names the study's launches use.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * test('layout default', () => { expect(templateEditorLayout(null)).toBe('flow'); });
     * ```
     */
    @Test fun layoutDefaultsToFlowWhenTheLaunchNamesNone() {
        assertEquals("flow", templateEditorLayout(null))
    }

    /** Each of the three layout names is returned exactly as given. */
    @Test fun layoutKeepsEachAllowedName() {
        assertEquals("flow", templateEditorLayout("flow"))
        assertEquals("rows", templateEditorLayout("rows"))
        assertEquals("lines", templateEditorLayout("lines"))
    }

    /** A layout name outside the three stops the study with a message naming it. */
    @Test fun unknownLayoutIsRejectedByName() {
        var message: String? = null
        try {
            templateEditorLayout("grid")
        } catch (error: IllegalArgumentException) {
            message = error.message
        }
        assertEquals("Unknown template editor layout: grid", message)
    }

    /** An empty layout name is rejected like any other unknown name, never read as the default. */
    @Test fun emptyLayoutNameIsRejected() {
        var message: String? = null
        try {
            templateEditorLayout("")
        } catch (error: IllegalArgumentException) {
            message = error.message
        }
        assertEquals("Unknown template editor layout: ", message)
    }

    /** A launch that names no position leaves the scrolling body at its top. */
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

    /** An authored scene carries the default layout and position until a launch replaces them. */
    @Test fun authoredSceneCarriesTheDefaultLayoutAndPosition() {
        val fixture: TemplateEditorFixture = templateEditorFixture("help")
        assertEquals("flow", fixture.layout)
        assertEquals("top", fixture.position)
    }
}
//endregion
