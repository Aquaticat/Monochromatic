//region Authored Settings switch state, never a persisted preference or production behaviour
// What: Package groups the isolated study's immutable inputs with its future native host.
// Why: No session store, filename helper or analysis worker is needed to draw the accepted pane.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

/**
 * What: A data class gives read-only val fields, value equality and copy-with-changes.
 * Boolean holds exactly true or false; the siblings a reader might expect are a nullable Boolean?
 * (a third "unset" value) or a String naming a mode.
 * Why: D11's three rows are two-state switches, so Boolean (not Boolean? or String) keeps an
 * impossible third position out of the authored state.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type SettingsPaneState = Readonly<{ stripCommonPrefixes: boolean; resumeWhereLeftOff: boolean; analyseInBackground: boolean }>;
 * ```
 */
internal data class SettingsPaneState(
    /** Authored position of "Strip common prefixes from filenames"; no filename is rewritten. */
    val stripCommonPrefixes: Boolean,
    /** Authored position of "Resume where I left off"; no session is restored. */
    val resumeWhereLeftOff: Boolean,
    /** Authored position of "Analyse true peak in the background"; no analysis runs. */
    val analyseInBackground: Boolean,
)

/**
 * What: A data class describes one visible row: a stable id, two text lines and a switch position.
 * String holds immutable text; the sibling a reader might expect is CharSequence (any text-like value).
 * Why: The native pane and the unit test read the same copy, and String (not CharSequence) gives
 * value equality so a drifted label fails a plain equality assertion.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type SettingsPaneRow = Readonly<{ id: string; title: string; supporting: string; checked: boolean }>;
 * ```
 */
internal data class SettingsPaneRow(
    /** Stable identifier used by events and measurement names, never shown to the user. */
    val id: String,
    /** First text line, copied from the accepted settings-a source. */
    val title: String,
    /** Second text line, copied from the accepted settings-a source. */
    val supporting: String,
    /** Switch position derived from the authored state. */
    val checked: Boolean,
)

/**
 * What: A named function returns one immutable fixture or throws for an unrecognized scene.
 * Why: A capture scene cannot silently fall through to some default switch arrangement.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function settingsPaneFixture(scene: string): SettingsPaneState;
 * ```
 */
internal fun settingsPaneFixture(scene: String): SettingsPaneState {
    // The accepted mock: prefixes stripped, resume on, background analysis off.
    if (scene == "accepted") return SettingsPaneState(true, true, false)
    // Every row in the opposite position, so both switch positions are drawn for each row.
    if (scene == "inverse") return SettingsPaneState(false, false, true)
    throw IllegalArgumentException("Unknown authored Settings scene: $scene")
}

/**
 * What: A function returns a read-only List of three rows; listOf builds that list from its arguments.
 * List<SettingsPaneRow> is an ordered read-only collection; the siblings a reader might expect are
 * MutableList (can be changed after creation) and Array (fixed-size, compared by identity).
 * Why: The row order is part of D11, and List (not MutableList or Array) gives value equality and
 * prevents a caller from reordering the accepted rows.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function settingsPaneRows(state: SettingsPaneState): readonly SettingsPaneRow[];
 * ```
 */
internal fun settingsPaneRows(state: SettingsPaneState): List<SettingsPaneRow> {
    return listOf(
        SettingsPaneRow(
            "strip-common-prefixes",
            "Strip common prefixes from filenames",
            "Shows “Another Xronixle” instead of “かめりあ(Camellia) - Another Xronixle.flac”.",
            state.stripCommonPrefixes,
        ),
        SettingsPaneRow(
            "resume-where-left-off",
            "Resume where I left off",
            "Restores the folder, track and position on launch, paused.",
            state.resumeWhereLeftOff,
        ),
        SettingsPaneRow(
            "analyse-in-background",
            "Analyse true peak in the background",
            "Off means each track is measured just before it plays instead — under a second, but no head start.",
            state.analyseInBackground,
        ),
    )
}

/**
 * What: A function returns the page title as fixed text.
 * Why: The header and its accessibility heading read one authored value.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function settingsPaneTitle(): string;
 * ```
 */
internal fun settingsPaneTitle(): String {
    return "Settings"
}

/**
 * What: A function returns the closing paragraph as fixed text.
 * Why: D11 accepted a pane that says out loud that it is short; the sentence predates D81's
 * template requirement and is drawn here only as accepted copy, not as a claim about templates.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function settingsPaneClosing(): string;
 * ```
 */
internal fun settingsPaneClosing(): String {
    return "That's everything. There is no library to configure, no tags to read, and no audio processing " +
        "beyond normalisation — so this pane stays short until the app grows."
}
//endregion
