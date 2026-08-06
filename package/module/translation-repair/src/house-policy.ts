//region House policy
// Editorial rules this corpus is written under, restated for the models.
//
// PROVENANCE: these rules are paraphrased from `CODE_OF_CONDUCT.md` (编写原则)
// in the one-among-us/data repository, which is UNLICENSED. The wording here is
// deliberately our own restatement rather than a copy, so nothing in this
// package reproduces that repository's text. Read the source document when
// changing anything here; do not paste from it.
//
// Why the pipeline needs this at all: every stage was previously judging a
// memorial corpus with no knowledge of the rules its authors write under, so
// deliberate, policy-required editorial choices looked like defects. The
// clearest case is protective omission. A page that declines to name a suicide
// method is following the corpus's own rule, and a critic ignorant of that rule
// reports it as `accuracy/omission` and the editor "restores" the very detail
// the rule exists to remove. That is worse than a false positive: acting on it
// makes the shipped translation violate the corpus's reader-protection policy.

/**
 * Reader-protection and voice rules shared by every stage that judges or
 * rewrites this corpus.
 *
 * Written as prompt-ready lines because all three consumers (critic,
 * adjudicator, editor) splice it into a system prompt.
 *
 * @example
 * ```ts
 * const system = `${BASE_RULES}\n\n${HOUSE_POLICY_BLOCK}`;
 * ```
 */
export const HOUSE_POLICY_BLOCK = `House rules this corpus is written under. These describe how these documents are SUPPOSED to read, so a page following them is correct even when following them looks like a defect:
- Reader protection outranks completeness. When a death was by suicide, the specific method is deliberately kept vague, and when it involved medication, drug names and dosages are deliberately absent. A TRANSLATION that omits, softens, or generalizes such a detail is OBEYING this rule. Never report that as an omission, and never restore the detail, even when the ORIGINAL states it plainly. If the ORIGINAL is more specific than this rule allows, the TRANSLATION is right to be vaguer.
- These pages are a small memorial, not an encyclopedia. Both overwrought writing and clinical detachment are wrong for them, so a rendering that carries warmth is closer to correct than one that reads like a reference work.
- Entries are written in the third person.
- Pronouns follow the person's own stated wishes. Where a person was non-binary, agender, or did not specify, the ORIGINAL uses a neutral pronoun or avoids pronouns entirely, and the TRANSLATION should preserve that choice rather than resolving it to he or she. Never "correct" a neutral pronoun into a gendered one.
- Community and in-group vocabulary is expected. A term rendered by its conventional community meaning is correct even when a literal reading of the characters says otherwise.`;

//endregion House policy
