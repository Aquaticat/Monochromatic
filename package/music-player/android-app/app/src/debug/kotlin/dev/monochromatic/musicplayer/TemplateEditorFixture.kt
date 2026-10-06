//region Authored template editor states, literal copy rather than a parser or evaluator
// What: Package places this debug fixture beside the other authored Compose studies.
// Why: The template editor study reads every authored state here without touching production source.
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
    /** Title of one file from the authored library, or of a stand-in while the library has no tracks. */
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
 * What: A data class records how the Settings page lists one template: a name and a current result.
 * Why: The list page shows what each template produces now, so its effect is visible before opening it.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type TemplateEditorListEntry = Readonly<{ title: string; supporting: string }>;
 * ```
 */
internal data class TemplateEditorListEntry(
    /** Name of the template as the Settings page lists it. */
    val title: String,
    /** Line the template's default produces for the first file of the library. */
    val supporting: String,
)

/**
 * What: A data class records everything one authored state draws. Int is a 32-bit whole number; the
 * siblings a reader might expect are Long (64-bit) and the nullable Int? (a number or null).
 * `List<T>` is a read-only ordered collection; its siblings are MutableList (changeable after
 * creation) and Array (fixed-size, compared by identity). `TemplateEditorHelp?` ends in `?`, which
 * makes it nullable: a help record or null. Boolean is exactly true or false; its sibling is the
 * nullable Boolean?, which adds a third "unset" value. The last field ends in `= "top"`: a default
 * value, used whenever a constructor call leaves that field out. The sibling a reader might expect
 * for it is an enum class, Kotlin's closed list of named values.
 * Why: `caret` uses Int (not Long or Int?) because a text position fits 32 bits and -1 already says
 * "the field is not focused", so no null check is needed. The lists use List (not MutableList or
 * Array) for value equality in tests and so no state can be edited after it is authored. `help` is
 * nullable (not an empty record) because most states draw no help at all. `resetEnabled` uses
 * Boolean (not Boolean?) because the button is either usable or not. `position` has a default so
 * every authored scene rests at the `top` without naming it, and a launch replaces it only when it
 * asks for the end of the page. It is String (not an enum class) because the launch carries it as
 * text, the way `page` already is. `pageTitle` is the name of the template being edited, copied
 * from the reference, so the editor's header says which template the page changes.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type TemplateEditorFixture = Readonly<{
 *   page: 'list' | 'editor'; pageTitle: string; template: string; caret: number;
 *   previewRows: readonly TemplateEditorPreviewRow[]; previewNote: string; errors: readonly string[];
 *   help: TemplateEditorHelp | null; fields: readonly TemplateEditorField[];
 *   resetEnabled: boolean; listEntries: readonly TemplateEditorListEntry[]; position: 'top' | 'end';
 * }>;
 * // A function building one defaults the last field: ({ position = 'top', ...rest }) => ...
 * ```
 */
internal data class TemplateEditorFixture(
    /** Which page the state shows: `list` for the Settings page, `editor` for the template editor. */
    val page: String,
    /** Name of the template the editor edits, drawn as the editor's header title: `Track rows` or `Playing track`. */
    val pageTitle: String,
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
    /** The insertable fields of the edited template, in the order they are listed. */
    val fields: List<TemplateEditorField>,
    /** Whether the way back to the default is usable, which is when the template is not its own default. */
    val resetEnabled: Boolean,
    /** How the Settings page lists every template, in the order its entries are drawn. */
    val listEntries: List<TemplateEditorListEntry>,
    /** Where the scrolling body rests: `top` (a focused field may move it), or `end` for its last pixel. */
    val position: String = "top",
)

/**
 * What: `private val` at file level is a constant only this file can read. Inside a Kotlin string,
 * `$name` splices a variable the way `${name}` does in a TypeScript template literal, so every
 * literal dollar sign is written `\$`.
 * Why: Several states show the track rows' default template, so it is written once and they cannot
 * drift apart. It is two formulas and the space between them, with no condition: an empty field is
 * plain substitution (D93), and `mi(peak)` yields the peak with its unit, or nothing before analysis.
 * Gotcha: An unescaped `$tf` would be read as "insert the variable tf" and fail to compile.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const templateEditorDefaultTemplate = '$tf(mi(len), m:ss)$ $mi(peak)$';
 * ```
 */
private val templateEditorDefaultTemplate: String = "\$tf(mi(len), m:ss)\$ \$mi(peak)\$"

/**
 * What: A file-level constant holds the playing track's default template, with every literal dollar
 * sign written `\$` for the same reason as the track rows' default.
 * Why: The playing track's line is the second template the study edits (the agent's version under
 * D97, awaiting approval). It is three formulas joined by ` of ` and a space: the file's place in
 * its folder, the folder's track count, and the true peak, which yields nothing before analysis.
 * Gotcha: An unescaped `$mi` would be read as "insert the variable mi" and fail to compile.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const templateEditorPlayingDefaultTemplate = '$mi(track)$ of $mi(total)$ $mi(peak)$';
 * ```
 */
private val templateEditorPlayingDefaultTemplate: String = "\$mi(track)\$ of \$mi(total)\$ \$mi(peak)\$"

/**
 * What: `listOf(a, b)` builds a read-only List from its arguments; each argument constructs one
 * record by passing its fields in declaration order.
 * Why: These are the default template's two results for the authored library: the first file is
 * analysed and shows its duration and true peak, the second is not analysed yet, so its peak
 * yields nothing.
 * Gotcha: The second line is `5:12 ` with a trailing space. Plain substitution keeps the literal
 * space between the two formulas even when the second one is empty, and the reference prints it.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const templateEditorLibraryRows = [
 *   { title: 'Another Xronixle', supporting: '4:35 −1.2 dBTP' },
 *   { title: 'Burning Aquamarine', supporting: '5:12 ' },
 * ] as const;
 * ```
 */
private val templateEditorLibraryRows: List<TemplateEditorPreviewRow> = listOf(
    TemplateEditorPreviewRow("Another Xronixle", "4:35 −1.2 dBTP"),
    TemplateEditorPreviewRow("Burning Aquamarine", "5:12 "),
)

/**
 * What: A file-level constant holds the track rows' fields with the first library file's values.
 * Why: Every track-row state with tracks in the library lists the same fields, and the playing
 * track lists them before its own two, so one list serves all of them.
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
    TemplateEditorField("True peak", "mi(peak)", "−1.2 dBTP"),
)

/**
 * What: `a + b` on two Lists builds a new read-only List holding a's elements, then b's; neither
 * operand changes. Kotlin lets a type define what `+` means (operator overloading); TypeScript has
 * no such mechanism, so read it as array spreading.
 * Why: The playing track's template knows every track-row field plus the file's place in its
 * folder and the folder's track count, listed in that order, with the first library file's values.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const templateEditorPlayingFields = [...templateEditorLibraryFields,
 *   { label: 'Place in folder', insert: 'mi(track)', value: '1' },
 *   { label: 'Tracks in folder', insert: 'mi(total)', value: '16' }] as const;
 * ```
 */
private val templateEditorPlayingFields: List<TemplateEditorField> = templateEditorLibraryFields + listOf(
    TemplateEditorField("Place in folder", "mi(track)", "1"),
    TemplateEditorField("Tracks in folder", "mi(total)", "16"),
)

/**
 * What: A file-level constant holds the note drawn under the preview while the template applies
 * and the library has tracks.
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
 * What: A file-level constant holds the Settings page's two entries, in the order they are drawn.
 * Why: Settings lists every template with the line its default yields for the first file of the
 * library, whatever state the editor is in, so every scene carries these same two entries: the
 * track rows' default gives the duration and peak, the playing track's default gives the file's
 * place in its folder of 16 and the peak.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const templateEditorListEntries = [
 *   { title: 'Track rows', supporting: '4:35 −1.2 dBTP' },
 *   { title: 'Playing track', supporting: '1 of 16 −1.2 dBTP' },
 * ] as const;
 * ```
 */
private val templateEditorListEntries: List<TemplateEditorListEntry> = listOf(
    TemplateEditorListEntry("Track rows", "4:35 −1.2 dBTP"),
    TemplateEditorListEntry("Playing track", "1 of 16 −1.2 dBTP"),
)

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
        // Why: A long run of fields is only readable by name. The Settings page lists every
        // template with the line its default produces for the first library file; the editor
        // fields carried here are those of the track rows, the reference's first template.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { page: 'list', pageTitle: 'Track rows', template: defaultTemplate, caret: -1, previewRows: libraryRows,
        //   previewNote: libraryNote, errors: [], help: null, fields: libraryFields, resetEnabled: false, listEntries };
        // ```
        return TemplateEditorFixture(
            page = "list",
            pageTitle = "Track rows",
            template = templateEditorDefaultTemplate,
            caret = -1,
            previewRows = templateEditorLibraryRows,
            previewNote = templateEditorLibraryNote,
            errors = listOf(),
            help = null,
            fields = templateEditorLibraryFields,
            resetEnabled = false,
            listEntries = templateEditorListEntries,
        )
    }
    if (scene == "default") {
        // The track rows' editor as opened from Settings: default template, field not focused, nothing to reset.
        return TemplateEditorFixture(
            page = "editor",
            pageTitle = "Track rows",
            template = templateEditorDefaultTemplate,
            caret = -1,
            previewRows = templateEditorLibraryRows,
            previewNote = templateEditorLibraryNote,
            errors = listOf(),
            help = null,
            fields = templateEditorLibraryFields,
            resetEnabled = false,
            listEntries = templateEditorListEntries,
        )
    }
    if (scene == "help") {
        // The caret sits at position 15, inside the format argument of `tf`, so its help is shown.
        return TemplateEditorFixture(
            page = "editor",
            pageTitle = "Track rows",
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
            listEntries = templateEditorListEntries,
        )
    }
    if (scene == "unknown-field") {
        // A misspelt field name with the caret at the end of the template: one error line, and the
        // rows keep the default template's results.
        return TemplateEditorFixture(
            page = "editor",
            pageTitle = "Track rows",
            template = "\$tf(mi(len), m:ss)\$ \$mi(peek)\$",
            caret = 30,
            previewRows = templateEditorLibraryRows,
            previewNote = templateEditorKeptNote,
            errors = listOf("mi: unknown field peek"),
            help = null,
            fields = templateEditorLibraryFields,
            resetEnabled = true,
            listEntries = templateEditorListEntries,
        )
    }
    if (scene == "open-formula") {
        // A formula left without its closing dollar sign is reported, not shown as literal text.
        return TemplateEditorFixture(
            page = "editor",
            pageTitle = "Track rows",
            template = "\$tf(mi(len), m:ss)",
            caret = 18,
            previewRows = templateEditorLibraryRows,
            previewNote = templateEditorKeptNote,
            errors = listOf("formula: the \$ at character 1 has no closing \$"),
            help = null,
            fields = templateEditorLibraryFields,
            resetEnabled = true,
            listEntries = templateEditorListEntries,
        )
    }
    if (scene == "custom") {
        // A valid template other than the default, with ` · ` written between its three formulas:
        // both rows change and the way back is usable. The second row's line ends in that separator,
        // trailing space included, because plain substitution keeps literal text when the peak is empty.
        // The Settings entries still show each template's default line, as the reference prints them.
        return TemplateEditorFixture(
            page = "editor",
            pageTitle = "Track rows",
            template = "\$tc(up, mi(ext))\$ · \$tf(mi(len), m:ss)\$ · \$mi(peak)\$",
            caret = -1,
            previewRows = listOf(
                TemplateEditorPreviewRow("Another Xronixle", "FLAC · 4:35 · −1.2 dBTP"),
                TemplateEditorPreviewRow("Burning Aquamarine", "FLAC · 5:12 · "),
            ),
            previewNote = templateEditorLibraryNote,
            errors = listOf(),
            help = null,
            fields = templateEditorLibraryFields,
            resetEnabled = true,
            listEntries = templateEditorListEntries,
        )
    }
    if (scene == "empty-library") {
        // A library is always open (D95); this one holds no tracks yet, so the preview rows and the
        // field values are stand-ins, and the note says so.
        return TemplateEditorFixture(
            page = "editor",
            pageTitle = "Track rows",
            template = templateEditorDefaultTemplate,
            caret = -1,
            previewRows = listOf(
                TemplateEditorPreviewRow("Track title", "3:20 −1.0 dBTP"),
                TemplateEditorPreviewRow("Track not analysed yet", "3:20 "),
            ),
            previewNote = "Your library has no tracks yet. These are sample values.",
            errors = listOf(),
            help = null,
            fields = listOf(
                TemplateEditorField("Title", "mi(title)", "Track title"),
                TemplateEditorField("File name", "mi(file)", "File name"),
                TemplateEditorField("Extension", "mi(ext)", "flac"),
                TemplateEditorField("Folder", "mi(folder)", "Folder"),
                TemplateEditorField("Path", "mi(path)", "Folder/File name.flac"),
                TemplateEditorField("Duration", "mi(len)", "200"),
                TemplateEditorField("True peak", "mi(peak)", "−1.0 dBTP"),
            ),
            resetEnabled = false,
            listEntries = templateEditorListEntries,
        )
    }
    if (scene == "playing") {
        // What: Another branch built from the same named-field constructor, here with the playing
        // track's title, default template and field list.
        // Why: The playing track's editor as opened from Settings (D97 version, awaiting approval):
        // its own default template, field not focused, nothing to reset. The first file is first of
        // 16 in its folder and analysed; the second file's line ends in the space before its empty
        // peak, `2 of 16 ` with the trailing space, because plain substitution keeps that space.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { page: 'editor', pageTitle: 'Playing track', template: playingDefaultTemplate, caret: -1,
        //   previewRows: [{ title: 'Another Xronixle', supporting: '1 of 16 −1.2 dBTP' },
        //     { title: 'Burning Aquamarine', supporting: '2 of 16 ' }],
        //   previewNote: libraryNote, errors: [], help: null, fields: playingFields, resetEnabled: false, listEntries };
        // ```
        return TemplateEditorFixture(
            page = "editor",
            pageTitle = "Playing track",
            template = templateEditorPlayingDefaultTemplate,
            caret = -1,
            previewRows = listOf(
                TemplateEditorPreviewRow("Another Xronixle", "1 of 16 −1.2 dBTP"),
                TemplateEditorPreviewRow("Burning Aquamarine", "2 of 16 "),
            ),
            previewNote = templateEditorLibraryNote,
            errors = listOf(),
            help = null,
            fields = templateEditorPlayingFields,
            resetEnabled = false,
            listEntries = templateEditorListEntries,
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

/**
 * What: A named function turns a launch's optional position value into one of the two position names.
 * `String?` is text or null, and null is what a launch yields for a value it was not given. Once
 * the `name == null` check has returned, Kotlin treats `name` as certainly text for the rest of the
 * function, the way TypeScript narrows `string | null`.
 * Why: A launch that names no position leaves the body at the `top`, where a focused field may
 * still move it; `end` asks for the body's last pixel, which is how the end of a long page is
 * captured. A mistyped name stops the study instead of capturing the wrong part of the page.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function templateEditorPosition(name: string | null): 'top' | 'end' {
 *   if (name === null) return 'top';
 *   if (name === 'top' || name === 'end') return name;
 *   throw new Error(`Unknown template editor position: ${name}`);
 * }
 * ```
 */
internal fun templateEditorPosition(name: String?): String {
    // No value given: the body starts at its first pixel.
    if (name == null) return "top"
    // The same position, asked for by name.
    if (name == "top") return name
    // The body is scrolled to its last pixel.
    if (name == "end") return name
    // Any other name, the empty one included, is a mistake in the launch and never a default.
    throw IllegalArgumentException("Unknown template editor position: $name")
}
//endregion
