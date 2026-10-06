//region Authored first-run inputs, not production inventory or permission evaluation
// What: The package places this debug fixture beside the existing Compose studies.
// Why: The isolated activity can use it without changing production visibility.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

/**
 * What: A data class is a record with read-only fields; String is text and Int is a count,
 * rather than a floating-point Double or an optional Int?.
 * Why: Explicit authored coverage and count prevent a failed/partial fixture from claiming emptiness.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type FirstRunDiscoveryFixture = { coverage: string; audioCount: number };
 * ```
 */
data class FirstRunDiscoveryFixture(
    /** Authored coverage marker, not a returned production scan verdict. */
    val coverage: String,
    /** Nonnegative count of eligible audio in the authored scope. */
    val audioCount: Int,
)

/**
 * What: A named function takes one authored record and returns a Boolean classification.
 * Why: The study must not treat an empty batch, failed read or unread scope as confirmed absence.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function firstRunCanClaimNoAudio(input: FirstRunDiscoveryFixture): boolean {
 *   // Validate known coverage and a nonnegative count; then test complete and zero.
 * }
 * ```
 */
internal fun firstRunCanClaimNoAudio(input: FirstRunDiscoveryFixture): Boolean {
    // What: listOf creates a read-only List<String>, unlike a MutableList or a fixed Array.
    // Why: Validate all fixture markers rather than silently interpreting unknown coverage.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const coverage = ['complete', 'partial', 'failed', 'unread'] as const;
    // ```
    val coverage: List<String> = listOf("complete", "partial", "failed", "unread")
    // What: !in tests non-membership and IllegalArgumentException throws, rather than returning null.
    // Why: Unknown fixture input must fail capture rather than become a plausible empty screen.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!coverage.includes(input.coverage)) throw new Error('Unknown first-run coverage');
    // ```
    if (input.coverage !in coverage) throw IllegalArgumentException("Unknown first-run coverage: ${input.coverage}")
    // Reject an invalid authored count without silently correcting it.
    if (input.audioCount < 0) throw IllegalArgumentException("First-run audio count must be nonnegative.")
    return input.coverage == "complete" && input.audioCount == 0
}

/**
 * What: Another data class holds literal display copy, not an executable recovery descriptor.
 * Why: The debug surface can measure text without launching a picker, service, scan or Settings.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type FirstRunAccessFixture = {
 *   title: string; body: string; primary: string; primaryEvent: string;
 *   secondary: string | null; analysis: boolean;
 * };
 * ```
 */
data class FirstRunAccessFixture(
    /** Authored state headline, not inferred from the production track list. */
    val title: String,
    /** Names only the assessed source and never claims the whole device contains no music. */
    val body: String,
    /** Label for a debug event only, not a connected production action. */
    val primary: String,
    /**
     * What: Plain String naming the debug event the filled button passes to the activity callback.
     * Why: Declined access asks for access while no-audio scenes open a folder; one shared label cannot route both.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * primaryEvent: 'allow-access' | 'open-folder';
     * ```
     */
    val primaryEvent: String,
    /**
     * What: String? is nullable text; null means no outlined folder button, not an empty label.
     * Why: Only the unreadable device library offers the folder route beside its primary action.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * secondary: string | null; // Its button always emits 'open-folder'.
     * ```
     */
    val secondary: String?,
    /** Whether D10's analysis explanation belongs to the authored scene. */
    val analysis: Boolean,
)

/**
 * What: Explicit branches return copy for an exact scene string and throw for other strings.
 * Why: No permissive scene fallback can hide routing mistakes in native evidence.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function firstRunAccessFixture(scene: string): FirstRunAccessFixture {
 *   // Exact authored scenes only; unknown scenes throw.
 * }
 * ```
 */
internal fun firstRunAccessFixture(scene: String): FirstRunAccessFixture {
    if (scene == "declined") {
        // What: The record constructor uses named fields instead of positional descriptor arrays.
        // Why: D95 and D100 keep the device library open when access is refused, so the copy names
        // an open but unreadable source and offers access or a folder; no state lacks a source.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { title: "The device music library can't be read", body: '...', primary: 'Allow access',
        //   primaryEvent: 'allow-access', secondary: 'Open a folder', analysis: true };
        // ```
        return FirstRunAccessFixture(
            title = "The device music library can't be read",
            body = "It is open as your library, but access to music on this device was not granted. Allow access, or open a folder instead.",
            primary = "Allow access",
            primaryEvent = "allow-access",
            secondary = "Open a folder",
            analysis = true,
        )
    }
    if (scene == "system-no-audio" || scene == "folder-no-audio") {
        // Check the explicit complete/zero fixture premise, not an empty production List<Track>.
        if (!firstRunCanClaimNoAudio(FirstRunDiscoveryFixture("complete", 0))) {
            throw IllegalStateException("Complete zero-audio fixture did not permit the scoped claim.")
        }
        if (scene == "system-no-audio") {
            // What: null fills the nullable secondary field, like TS `secondary: null`.
            // Why: The filled button already opens a folder, so no second folder button is drawn.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return { ..., primary: 'Open a folder', primaryEvent: 'open-folder', secondary: null, analysis: false };
            // ```
            return FirstRunAccessFixture(
                title = "No audio found in the device music library",
                body = "The device music library was checked completely. You can open a folder that is not listed there.",
                primary = "Open a folder",
                primaryEvent = "open-folder",
                secondary = null,
                analysis = false,
            )
        }
        // The chosen-folder scene also opens a folder from its filled button and draws no secondary button.
        return FirstRunAccessFixture(
            title = "No audio found in Cult of Luna",
            body = "The chosen folder was checked completely and contains no supported audio files. Opening a different folder changes the music source.",
            primary = "Open a folder",
            primaryEvent = "open-folder",
            secondary = null,
            analysis = false,
        )
    }
    throw IllegalArgumentException("Unknown first-run access fixture: $scene")
}
//endregion
