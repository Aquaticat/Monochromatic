//region Authored feedback outcomes, never a real trash, restore or file operation
// What: Package places this pure debug fixture beside the isolated first-run host.
// Why: The owned study can test truthful outcome gating without reaching production services.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

/**
 * What: A data class holds read-only authored operation fields; Boolean is a truth value,
 * and String is text rather than a nullable String? or an executable recovery descriptor.
 * Why: Request generation, acceptance, per-item success and restore capability remain separate authored facts.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type LightTrashOutcomeFixture = { outcome: string; restoreHandle: boolean; expired: boolean };
 * ```
 */
data class LightTrashOutcomeFixture(
    /** Authored per-item outcome; verified-success is a premise, never a RESULT_OK adapter or provider query. */
    val outcome: String,
    /** Authored owner has a restoration handle; not proof that a real restore will succeed. */
    val restoreHandle: Boolean,
    /** Authored Undo interval has expired; no real timer is implemented by this field. */
    val expired: Boolean,
)

/**
 * What: A named function classifies one authored operation record and returns Boolean.
 * Why: Pending or accepted-but-unverified requests cannot advertise successful-trash Undo.
 * Accepted-but-unverified may be a finished request, not failure or a still-pending task;
 * the fixture does not query a provider or choose a production verification mechanism.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function lightFeedbackCanOfferUndo(input: LightTrashOutcomeFixture): boolean {
 *   // Validate outcome; require authored per-item verified success, handle and active interval.
 * }
 * ```
 */
internal fun lightFeedbackCanOfferUndo(input: LightTrashOutcomeFixture): Boolean {
    // What: listOf creates a read-only List<String>, not a MutableList or fixed Array.
    // Why: Unknown fixture outcomes must fail rather than render a plausible success toast.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const outcomes = ['pending', 'approved-but-unverified', 'cancelled', 'failed', 'verified-success'] as const;
    // ```
    val outcomes: List<String> = listOf("pending", "approved-but-unverified", "cancelled", "failed", "verified-success")
    // What: !in tests non-membership and throws a typed argument exception.
    // Why: A typo in the acquisition route must not silently select a success branch.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!outcomes.includes(input.outcome)) throw new Error('Unknown authored trash outcome');
    // ```
    if (input.outcome !in outcomes) throw IllegalArgumentException("Unknown authored trash outcome: ${input.outcome}")
    return input.outcome == "verified-success" && input.restoreHandle && !input.expired
}

/**
 * What: Another read-only record contains literal copy and omitted authored row names.
 * Why: The renderer can prove layout and row removal without touching real file identities.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type LightFeedbackFixture = { error: string; undo: boolean; omittedTitles: readonly string[] };
 * ```
 */
data class LightFeedbackFixture(
    /** Empty string means no authored error notice, not an unknown failure being ignored. */
    val error: String,
    /** Whether authored per-item verified trash success has a live restoration handle. */
    val undo: Boolean,
    /** Literal debug-row titles omitted for these declared fixture outcomes. */
    val omittedTitles: List<String>,
)

/**
 * What: Exact scene branches return authored view inputs; any other scene throws.
 * Why: Capture cannot substitute an unrelated fallback after a routing mistake.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function lightFeedbackFixture(scene: string): LightFeedbackFixture { /* exact branches */ }
 * ```
 */
internal fun lightFeedbackFixture(scene: String): LightFeedbackFixture {
    if (scene == "missing") {
        // What: A record constructor uses named fields, not positional command descriptors.
        // Why: Known missing-file copy remains adjacent to the exact authored omitted row.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { error: 'Burning Aquamarine is no longer available.', undo: false, omittedTitles: [...] };
        // ```
        return LightFeedbackFixture(
            error = "Burning Aquamarine is no longer available and was removed from this list.",
            undo = false,
            omittedTitles = listOf("Burning Aquamarine"),
        )
    }
    if (scene == "undo" || scene == "combined") {
        // Require authored per-item verified success plus its restore handle, not request acceptance alone.
        val undo: Boolean = lightFeedbackCanOfferUndo(LightTrashOutcomeFixture("verified-success", true, false))
        if (scene == "combined") {
            return LightFeedbackFixture(
                error = "3 unavailable files were removed from this list.",
                undo = undo,
                omittedTitles = listOf("Burning Aquamarine", "Dokuhebi", "KillerToy", "Ghost"),
            )
        }
        return LightFeedbackFixture(error = "", undo = undo, omittedTitles = listOf("Ghost"))
    }
    if (scene == "trash-failed") {
        return LightFeedbackFixture(
            error = "Ghost was not moved to trash. Its folder did not allow this operation.",
            undo = lightFeedbackCanOfferUndo(LightTrashOutcomeFixture("failed", false, false)),
            omittedTitles = emptyList(),
        )
    }
    if (scene == "detail-heavy") {
        // What: Escaped newlines retain separate diagnostic paragraphs in an ordinary immutable String.
        // Why: Native log read-back must preserve non-ASCII detail and the final marker, not just a prefix.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const detail = '音楽の読み込み failed.\\nProvider detail ...\\nFinal marker';
        // ```
        return LightFeedbackFixture(
            error = "音楽の読み込み failed for the authored track. The source returned an operation detail too long for this transient notice.\nThe second diagnostic paragraph retains quotes, punctuation and 日本語 without claiming real provider behavior.\nFinal authored diagnostic marker: feedback-detail-tail-2026.",
            undo = false,
            omittedTitles = emptyList(),
        )
    }
    if (scene == "trash-pending") {
        return LightFeedbackFixture(
            error = "", undo = lightFeedbackCanOfferUndo(LightTrashOutcomeFixture("pending", false, false)),
            omittedTitles = emptyList(),
        )
    }
    throw IllegalArgumentException("Unknown light feedback fixture: $scene")
}
//endregion
