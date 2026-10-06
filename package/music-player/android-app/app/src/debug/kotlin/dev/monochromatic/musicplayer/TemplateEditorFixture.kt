//region Authored template editor states, literal copy rather than a parser or evaluator
// What: Package places this debug fixture beside the other authored Compose studies.
// Why: The template editor study reads its seven states here without touching production source.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

/**
 * What: A data class is a record with read-only `val` fields and value equality; `internal` keeps it
 * inside this app module. String holds immutable text; the sibling a reader might expect is
 * CharSequence (any text-like value).
 * Why: A preview row pairs a track title with the line the template yields for it, and String
 * (not CharSequence) gives value equality so one drifted character fails a plain equality assertion.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type TemplateEditorPreviewRow = Readonly<{ title: string; supporting: string }>;
 * ```
 */
internal data class TemplateEditorPreviewRow(
    /** Title of one file from the authored library, or of a stand-in when no library is open. */
    val title: String,
    /** Line the shown template yields for that file; empty text means no second line is drawn. */
    val supporting: String,
)

/**
 * What: A data class records the typing help for the call that holds the caret: the call's shape,
 * the name of the parameter the caret is in, and a sentence describing that parameter.
 * Why: The reference prints these three texts for the `help` state, so the study draws them as
 * authored instead of working them out from the template.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type TemplateEditorHelp = Readonly<{ signature: string; parameter: string; description: string }>;
 * ```
 */
internal data class TemplateEditorHelp(
    /** Whole call shape, for example `tf(seconds, [format])`. */
    val signature: String,
    /** Name of the parameter the caret is inside; carried from the reference and not drawn alone. */
    val parameter: String,
    /** Sentence describing that parameter. */
    val description: String,
)

/**
 * What: A data class records one entry of the field list: its visible name, the call a tap would
 * insert, and the value that call yields for the first preview file.
 * Why: Showing a real value beside each name teaches what the field holds before it is used.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type TemplateEditorField = Readonly<{ label: string; insert: string; value: string }>;
 * ```
 */
internal data class TemplateEditorField(
    /** Visible name of the field, for example `Duration`. */
    val label: String,
    /** Call text a tap would insert at the caret, for example `mi(len)`; insertion is not connected. */
    val insert: String,
    /** Value of the field for the first preview file; empty text when that file has none. */
    val value: String,
)

/**
 * What: A data class records how the Settings page lists the template: a name and a current result.
 * Why: The list page shows what the template produces now, so its effect is visible before opening it.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type TemplateEditorListEntry = Readonly<{ title: string; supporting: string }>;
 * ```
 */
internal data class TemplateEditorListEntry(
    /** Name of the template as the Settings page lists it. */
    val title: String,
    /** Line the template currently produces for the first preview file. */
    val supporting: String,
)

/**
 * What: A data class records everything one authored state draws. Int is a 32-bit whole number; the
 * siblings a reader might expect are Long (64-bit) and the nullable Int? (a number or null).
 * `List<T>` is a read-only ordered collection; its siblings are MutableList (changeable after
 * creation) and Array (fixed-size, compared by identity). `TemplateEditorHelp?` ends in `?`, which
 * makes it nullable: a help record or null. Boolean is exactly true or false; its sibling is the
 * nullable Boolean?, which adds a third "unset" value.
 * Why: `caret` uses Int (not Long or Int?) because a text position fits 32 bits and -1 already says
 * "the field is not focused", so no null check is needed. The lists use List (not MutableList or
 * Array) for value equality in tests and so no state can be edited after it is authored. `help` is
 * nullable (not an empty record) because most states draw no help at all. `resetEnabled` uses
 * Boolean (not Boolean?) because the button is either usable or not.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type TemplateEditorFixture = Readonly<{
 *   page: 'list' | 'editor'; template: string; caret: number;
 *   previewRows: readonly TemplateEditorPreviewRow[]; previewNote: string; errors: readonly string[];
 *   help: TemplateEditorHelp | null; fields: readonly TemplateEditorField[];
 *   resetEnabled: boolean; listEntry: TemplateEditorListEntry;
 * }>;
 * ```
 */
internal data class TemplateEditorFixture(
    /** Which page the state shows: `list` for the Settings page, `editor` for the template editor. */
    val page: String,
    /** Template text exactly as the field shows it. */
    val template: String,
    /** Caret position in the template while the field is focused; -1 means it is not focused. */
    val caret: Int,
    /** The two preview rows, in the order they are drawn. */
    val previewRows: List<TemplateEditorPreviewRow>,
    /** Sentence under the preview saying where its rows come from. */
    val previewNote: String,
    /** One line per mistake in the template; empty when the template applies. */
    val errors: List<String>,
    /** Typing help for the call holding the caret, or null when none is shown. */
    val help: TemplateEditorHelp?,
    /** The seven insertable fields, in the order they are listed. */
    val fields: List<TemplateEditorField>,
    /** Whether the way back to the default is usable, which is when the template is not the default. */
    val resetEnabled: Boolean,
    /** How the Settings page lists this template. */
    val listEntry: TemplateEditorListEntry,
)

/**
 * What: `private val` at file level is a constant only this file can read. Inside a Kotlin string,
 * `$name` splices a variable the way `${name}` does in a TypeScript template literal, so every
 * literal dollar sign is written `\$`; `\"` is a literal double quote.
 * Why: Four states show the default template, so it is written once and they cannot drift apart.
 * Gotcha: An unescaped `$tf` would be read as "insert the variable tf" and fail to compile.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const templateEditorDefaultTemplate = '$tf(mi(len), m:ss)$$if(mi(peak) != "", " · " + mi(peak) + " dBTP")$';
 * ```
 */
private val templateEditorDefaultTemplate: String =
    "\$tf(mi(len), m:ss)\$\$if(mi(peak) != \"\", \" · \" + mi(peak) + \" dBTP\")\$"

/**
 * What: `listOf(a, b)` builds a read-only List from its arguments; each argument constructs one
 * record by passing its fields in declaration order.
 * Why: These are the default template's two results for the authored library: the first file is
 * analysed and shows its true peak, the second is not analysed yet and shows its duration alone.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const templateEditorLibraryRows = [
 *   { title: 'Another Xronixle', supporting: '4:35 · −1.2 dBTP' },
 *   { title: 'Burning Aquamarine', supporting: '5:12' },
 * ] as const;
 * ```
 */
private val templateEditorLibraryRows: List<TemplateEditorPreviewRow> = listOf(
    TemplateEditorPreviewRow("Another Xronixle", "4:35 · −1.2 dBTP"),
    TemplateEditorPreviewRow("Burning Aquamarine", "5:12"),
)

/**
 * What: A file-level constant holds the seven fields with the first library file's values.
 * Why: Every state with an open library lists the same fields, so one list serves six states.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const templateEditorLibraryFields = [{ label: 'Title', insert: 'mi(title)', value: 'Another Xronixle' }, ...] as const;
 * ```
 */
private val templateEditorLibraryFields: List<TemplateEditorField> = listOf(
    TemplateEditorField("Title", "mi(title)", "Another Xronixle"),
    TemplateEditorField("File name", "mi(file)", "かめりあ(Camellia) - Another Xronixle"),
    TemplateEditorField("Extension", "mi(ext)", "flac"),
    TemplateEditorField("Folder", "mi(folder)", "Camellia"),
    TemplateEditorField("Path", "mi(path)", "Camellia/かめりあ(Camellia) - Another Xronixle.flac"),
    TemplateEditorField("Duration", "mi(len)", "275"),
    TemplateEditorField("True peak", "mi(peak)", "−1.2"),
)

/**
 * What: A file-level constant holds the note drawn under the preview while the template applies
 * and a library is open.
 * Why: The second row has no true peak, and the note says why instead of leaving it unexplained.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const templateEditorLibraryNote = 'From your library. The second file is not analysed yet.';
 * ```
 */
private val templateEditorLibraryNote: String = "From your library. The second file is not analysed yet."

/**
 * What: A file-level constant holds the note drawn under the preview while the template has a mistake.
 * Why: The rows then still show the last valid template's results, and the note says so.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const templateEditorKeptNote = 'Rows keep the last valid template.';
 * ```
 */
private val templateEditorKeptNote: String = "Rows keep the last valid template."

/**
 * What: A file-level constant holds the Settings entry for the default template on the library.
 * Why: Five states list the template with the first library file's default line.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const templateEditorLibraryEntry = { title: 'Track row supporting line', supporting: '4:35 · −1.2 dBTP' } as const;
 * ```
 */
private val templateEditorLibraryEntry: TemplateEditorListEntry =
    TemplateEditorListEntry("Track row supporting line", "4:35 · −1.2 dBTP")

/**
 * What: A named function returns the authored record for one exact scene name, and throws for any
 * other name. Each branch is a plain `if` with an early `return`.
 * Why: Every text here is copied from what `package/music-player/design/template-editor-scenes.mjs`
 * prints, so the study draws only results the reference grammar yields, and a mistyped scene name
 * stops the study instead of drawing some default state. Nothing in this file parses or evaluates
 * a template.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function templateEditorFixture(scene: string): TemplateEditorFixture {
 *   // Exact authored scenes only; unknown scenes throw.
 * }
 * ```
 */
internal fun templateEditorFixture(scene: String): TemplateEditorFixture {
    if (scene == "list") {
        // What: The record constructor takes `name = value` pairs instead of positional values;
        // `listOf()` with no arguments is an empty list, and `null` fills the nullable help field.
        // Why: Ten fields in a row are only readable by name. The Settings page lists the default
        // template with the line it produces for the first library file.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { page: 'list', template: defaultTemplate, caret: -1, previewRows: libraryRows, previewNote: libraryNote,
        //   errors: [], help: null, fields: libraryFields, resetEnabled: false, listEntry: libraryEntry };
        // ```
        return TemplateEditorFixture(
            page = "list",
            template = templateEditorDefaultTemplate,
            caret = -1,
            previewRows = templateEditorLibraryRows,
            previewNote = templateEditorLibraryNote,
            errors = listOf(),
            help = null,
            fields = templateEditorLibraryFields,
            resetEnabled = false,
            listEntry = templateEditorLibraryEntry,
        )
    }
    if (scene == "default") {
        // The editor as opened from Settings: default template, field not focused, nothing to reset.
        return TemplateEditorFixture(
            page = "editor",
            template = templateEditorDefaultTemplate,
            caret = -1,
            previewRows = templateEditorLibraryRows,
            previewNote = templateEditorLibraryNote,
            errors = listOf(),
            help = null,
            fields = templateEditorLibraryFields,
            resetEnabled = false,
            listEntry = templateEditorLibraryEntry,
        )
    }
    if (scene == "help") {
        // The caret sits at position 15, inside the format argument of `tf`, so its help is shown.
        return TemplateEditorFixture(
            page = "editor",
            template = templateEditorDefaultTemplate,
            caret = 15,
            previewRows = templateEditorLibraryRows,
            previewNote = templateEditorLibraryNote,
            errors = listOf(),
            help = TemplateEditorHelp(
                signature = "tf(seconds, [format])",
                parameter = "format",
                // Kept on one line so the sentence can be compared with the reference as written.
                description = "Format: h, m and s for hours, minutes and seconds; a doubled letter pads with a zero; text between apostrophes is kept. Without it, m:ss.",
            ),
            fields = templateEditorLibraryFields,
            resetEnabled = false,
            listEntry = templateEditorLibraryEntry,
        )
    }
    if (scene == "unknown-field") {
        // A misspelt field name: one error line, and the rows keep the default template's results.
        return TemplateEditorFixture(
            page = "editor",
            template = "\$tf(mi(len), m:ss)\$ · \$mi(peek)\$ dBTP",
            caret = 37,
            previewRows = templateEditorLibraryRows,
            previewNote = templateEditorKeptNote,
            errors = listOf("mi: unknown field peek"),
            help = null,
            fields = templateEditorLibraryFields,
            resetEnabled = true,
            listEntry = templateEditorLibraryEntry,
        )
    }
    if (scene == "open-formula") {
        // A formula left without its closing dollar sign is reported, not shown as literal text.
        return TemplateEditorFixture(
            page = "editor",
            template = "\$tf(mi(len), m:ss)",
            caret = 18,
            previewRows = templateEditorLibraryRows,
            previewNote = templateEditorKeptNote,
            errors = listOf("formula: the formula opened at character 1 is not closed"),
            help = null,
            fields = templateEditorLibraryFields,
            resetEnabled = true,
            listEntry = templateEditorLibraryEntry,
        )
    }
    if (scene == "custom") {
        // A valid template other than the default: both rows change and the way back is usable.
        return TemplateEditorFixture(
            page = "editor",
            template = "\$tc(up, mi(ext))\$ · \$tf(mi(len), m:ss)\$",
            caret = -1,
            previewRows = listOf(
                TemplateEditorPreviewRow("Another Xronixle", "FLAC · 4:35"),
                TemplateEditorPreviewRow("Burning Aquamarine", "FLAC · 5:12"),
            ),
            previewNote = templateEditorLibraryNote,
            errors = listOf(),
            help = null,
            fields = templateEditorLibraryFields,
            resetEnabled = true,
            listEntry = TemplateEditorListEntry("Track row supporting line", "FLAC · 4:35"),
        )
    }
    if (scene == "no-library") {
        // No library is open, so the preview rows and the field values are stand-ins.
        return TemplateEditorFixture(
            page = "editor",
            template = templateEditorDefaultTemplate,
            caret = -1,
            previewRows = listOf(
                TemplateEditorPreviewRow("Track title", "3:20 · −1.0 dBTP"),
                TemplateEditorPreviewRow("Track not analysed yet", "3:20"),
            ),
            previewNote = "No library is open. These are sample values.",
            errors = listOf(),
            help = null,
            fields = listOf(
                TemplateEditorField("Title", "mi(title)", "Track title"),
                TemplateEditorField("File name", "mi(file)", "File name"),
                TemplateEditorField("Extension", "mi(ext)", "flac"),
                TemplateEditorField("Folder", "mi(folder)", "Folder"),
                TemplateEditorField("Path", "mi(path)", "Folder/File name.flac"),
                TemplateEditorField("Duration", "mi(len)", "200"),
                TemplateEditorField("True peak", "mi(peak)", "−1.0"),
            ),
            resetEnabled = false,
            listEntry = TemplateEditorListEntry("Track row supporting line", "3:20 · −1.0 dBTP"),
        )
    }
    // What: `throw` raises an exception; `$scene` splices the rejected name into the message.
    // Why: A capture launched with an unplanned scene must fail loudly, never fall back to a state.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // throw new Error(`Unknown authored template editor scene: ${scene}`);
    // ```
    throw IllegalArgumentException("Unknown authored template editor scene: $scene")
}
//endregion
