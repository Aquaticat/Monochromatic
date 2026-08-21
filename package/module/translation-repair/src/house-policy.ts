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
//
// TWO RULES WERE ADDED 2026-08-18 FROM A GRADED SHEET, both from one passage.
// The archive read "This is her last self-description:" and the pipeline shipped
// "Below is her final self-description image.", which the grader marked as an
// accessibility defect: a listener has no page to look down. The same passage
// carried a bare "()" copied from the original's trailing emoticon, which says
// nothing in English. Both are production rules rather than grounds for
// reopening text that already reads well.

/**
 * Reader-protection and voice rules shared by every stage that judges or
 * rewrites this corpus.
 *
 * Written as prompt-ready lines because every consumer splices it into a system
 * prompt. THE LIST OF CONSUMERS IS NOT STATED HERE ANY MORE: it used to name
 * the critic, the adjudicator and the editor, and the editor was not one of
 * them, which is exactly the stage this block's own header says it exists to
 * stop. A comment naming consumers is a claim nothing checks; `rg` on this
 * symbol answers it correctly.
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
- Community and in-group vocabulary is expected. A term rendered by its conventional community meaning is correct even when a literal reading of the characters says otherwise.
- Refer to a passage, image or section by NAMING it, never by its position on the page. Do not write "below", "above", "the following" or "earlier" in English prose. Where the ORIGINAL uses such a word, render what it points AT instead: an original reading "the picture below is her last self-description" becomes "this is her last self-description", not "below is her last self-description". A screen reader gives its listener no page to look down, so a positional reference tells them nothing.
- Do not carry punctuation that means nothing in English. A trailing emoticon, a bare pair of empty brackets, or a run of full-width marks that carried tone in Chinese is not rendered by copying the characters across; render the tone in words or leave it out.`;

/**
 * What English forces on a translator and Chinese does not, shared by every
 * sheet that grades a rendering.
 *
 * ONE PARAGRAPH, NO CLOSING SENTENCE. The sentence that used to end it, telling
 * a reader to hold a forced choice against a CANDIDATE, names a term only the
 * judging sheets define, so each consumer supplies its own close in its own
 * vocabulary.
 *
 * @example
 * ```ts
 * const opening = FORCED_DIFFERENCES;
 * ```
 */
const FORCED_DIFFERENCES =
  'Obligatory differences between the two languages are never faults. Each language forces choices the other leaves open, and meeting English\'s own requirements is not an addition or an alteration: supplying a pronoun, a number, an article or A TENSE that the ORIGINAL leaves unmarked is REQUIRED. Chinese marks no tense, so rendering it in past or present is a choice English forces, never a change to the time the ORIGINAL refers to.';

/**
 * Judge-facing close of `JUDGE_POLICY_BLOCK`.
 *
 * SEPARATE FROM `FORCED_DIFFERENCES` because it names a candidate and a
 * criterion, and the measuring sheets have neither. They speak of findings,
 * issues, regions and the text under review, so a shared close would put two
 * undefined terms in front of three checkers.
 *
 * @example
 * ```ts
 * const tail = JUDGE_POLICY_TAIL;
 * ```
 */
const JUDGE_POLICY_TAIL = `Hold it against a candidate only when the choice it made is the WRONG one, and say which reading the ORIGINAL supports.

WHERE A CRITERION AND A HOUSE RULE DISAGREE, THE HOUSE RULE WINS. A candidate vaguer than the ORIGINAL because reader protection asks for it has left nothing out, and a candidate naming what it points at rather than where it sits on the page is obeying a rule rather than departing from the text.`;

/**
 * Measurement-facing close, for sheets that grade or check rather than choose.
 *
 * WHY THE PRECEDENCE SENTENCE IS RESTATED RATHER THAN SHARED: a measuring sheet
 * has no ranked criteria, so `WHERE A CRITERION AND A HOUSE RULE DISAGREE`
 * names something that is not in front of it, and a model reading a rule about
 * an absent thing may take the whole block as addressed to someone else.
 *
 * SUPPORTED BY THE ORIGINAL IS SAID OUTRIGHT because `introduced-defect-wire`
 * carries the opposite rule in as many words: content the AFTER text drops is
 * damage only if the ORIGINAL supports it. On a protected detail the ORIGINAL
 * DOES support it, which is the entire point of reader protection, so a spliced
 * block that did not name the interaction would leave two live rules in
 * disagreement.
 *
 * VERDICT NAMES ARE NOT HERE. The three consumers have disjoint vocabularies,
 * so each splice site adds the one line mapping this principle onto its own
 * verdicts. Restating the principle in three places is what would drift; naming
 * three different verdicts once each cannot.
 *
 * @example
 * ```ts
 * const tail = MEASUREMENT_POLICY_TAIL;
 * ```
 */
const MEASUREMENT_POLICY_TAIL = `Hold a forced choice against the text under review only when the choice it made is the WRONG one, and say which reading the ORIGINAL supports.

WHERE A RULE YOU HAVE BEEN GIVEN AND A HOUSE RULE DISAGREE, THE HOUSE RULE WINS. You are measuring, and a measurement that penalises a page for obeying the rules it was written under reports damage where there is none.

SUPPORTED BY THE ORIGINAL IS NOT ENOUGH TO MAKE SOMETHING MISSING A DEFECT. Reader protection keeps specific detail out of these pages precisely where the ORIGINAL states it, so text vaguer than the ORIGINAL about how a death happened, or about a medication, is obeying the rule rather than omitting. Never file that as a finding and never count it as damage.

WHERE AN ISSUE OR FINDING YOU WERE GIVEN ASKS FOR SUCH A DETAIL, THE ISSUE ITSELF IS WRONG. Do not agree that the text should carry it. Where the text under review HAS restored a detail reader protection keeps out, that restoration is new damage rather than a fix, however plainly the ORIGINAL states it.`;

/**
 * House rules plus the two things a JUDGE needs that a producer does not.
 *
 * WHY JUDGES NEEDED THEIR OWN BLOCK. Every producing sheet splices
 * `HOUSE_POLICY_BLOCK`; no judging sheet did. So the stages that decide what
 * SHIPS were the only ones that had never been told what this corpus is written
 * under, and criterion one, "every proposition of the ORIGINAL is rendered,
 * nothing left out", contradicts reader protection outright.
 *
 * AND THE TENSE RULE, which existed only in `critic-prompt.ts`. Chinese leaves
 * tense unmarked and English cannot. Measured on the consolidation bed: of the
 * four slates a judge refused ENTIRELY, three were refused for tense, one of
 * them saying every candidate had altered the time reference by rendering a
 * tenseless copula as "was". The rule that answers that was in the codebase and
 * out of reach.
 *
 * PRECEDENCE IS STATED, because a numbered list reads as the standard and
 * anything beside it reads as background. Three measured refusals came from
 * judges applying a numbered criterion literally.
 *
 * @example
 * ```ts
 * const system = \`${task}\n\n${JUDGE_POLICY_BLOCK}\`;
 * ```
 */
export const JUDGE_POLICY_BLOCK: string = `${HOUSE_POLICY_BLOCK}

${FORCED_DIFFERENCES} ${JUDGE_POLICY_TAIL}`;

/**
 * House rules for the sheets that MEASURE rather than write or choose.
 *
 * The rendering auditor, the resolution checker and the introduced-defect
 * prober all grade text against the ORIGINAL, and all three scored a page
 * obeying reader protection as a defect because none had ever been told the
 * rule. Nothing ships from any of them, which is why they were fixed after the
 * deciding sheets rather than with them; what they do decide is which defects
 * get worked on next.
 *
 * @example
 * ```ts
 * const system = \`${task}\n\n${MEASUREMENT_POLICY_BLOCK}\`;
 * ```
 */
export const MEASUREMENT_POLICY_BLOCK: string = `${HOUSE_POLICY_BLOCK}

${FORCED_DIFFERENCES} ${MEASUREMENT_POLICY_TAIL}`;

//endregion House policy
