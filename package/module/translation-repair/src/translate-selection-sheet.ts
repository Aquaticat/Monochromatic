//region Translate selection sheet
// What the judges of the translate lane are asked, kept apart from the stage
// that asks it.
//
// WHY IT IS ITS OWN FILE: `#84` measures whether these judges can tell a
// faithful rendering from a fluent one, and a measurement that carries its own
// copy of the sheet measures a copy. The harness and the stage import the same
// two values, so the sheet cannot drift out from under the number that says it
// works.

/**
 * One sentence naming what the candidates are, given to every judge.
 */
export const TRANSLATE_SELECTION_TASK: string =
  'Each candidate is a complete English translation of the Chinese ORIGINAL below, for a memorial archive.';

/**
 * What the faithfulness rule says about a name the documents declare.
 *
 * NAMED SEPARATELY so it can be asserted on, and so the sentence a judge
 * misread cannot be edited without the edit being visible.
 *
 * SCOPED TO A PASSAGE THAT REFERS TO THE PERSON. The unscoped version told
 * judges a declared name is never an addition "however little of it the passage
 * itself spells out", which reads as a licence to put the archive's identity
 * block anywhere at all.
 */
const DECLARED_NAME_IS_NOT_AN_ADDITION =
  'Where the passage refers to this person, A DECLARED NAME OR HANDLE IS NEVER AN ADDITION, even where the ORIGINAL only says "she".';

/**
 * What the names rule says about a candidate that names nobody.
 *
 * WHAT THIS REPLACED, and why. The rule used to read "a candidate dropping one
 * has left something out". Measured on the consolidation bed: one judge
 * abstained from a whole slate because no candidate carried the declared
 * location, and one shipped rendering signed a note left by a FRIEND of the
 * deceased with the deceased's own name, alias and city. A declared name is a
 * spelling authority and a defence, never content a passage owes.
 */
const DECLARED_NAME_IS_NOT_OWED_CONTENT =
  'It is not content a passage owes: a candidate that does not name this person has left nothing out, and a line attributing the passage to someone ELSE never takes this person\'s name.';

/**
 * What the names rule says when every candidate spells a name the same wrong way.
 *
 * MEASURED, at `lintong` slice 1, twice. The identity block declares one
 * spelling of the handle and the archive's own passage writes another, so both
 * lanes and every consolidation built from them carried the archive's form. A
 * judge read criterion three literally, found that NO candidate complied, and
 * abstained from the entire slate; the slice kept its incumbent and the round
 * bought nothing.
 *
 * A FAULT EVERY CANDIDATE SHARES CANNOT ORDER THEM. Refusing the slate over it
 * does not fix the spelling, because the incumbent that survives the decline is
 * where the spelling came from. The producers are told separately that the
 * declared spelling outranks the archive's, which is where that gets fixed.
 */
const A_SHARED_SPELLING_CANNOT_SEPARATE_CANDIDATES =
  'Prefer a candidate using a DECLARED spelling over one that does not; where NO candidate uses one, that fault is shared and cannot separate them, so decide on the other criteria rather than declining.';

/**
 * Clause allowing a candidate to carry a shape the ORIGINAL does not have.
 *
 * NAMED SO TWO CRITERIA CAN SHARE ONE SPELLING. The shape criterion states it
 * and {@link TRANSLATE_LINE_STRUCTURE_CRITERION} overrides it by quoting it
 * back, which only works while the two spell it identically. Sharing a constant
 * makes that true by construction, rather than by a test that would have to
 * notice an edit to one of them and would pass while the override silently
 * named a rule no judge was given.
 */
const A_SHAPE_THE_ORIGINAL_LACKS_IS_NOT_A_FAULT = 'A SHAPE THE ORIGINAL DOES NOT HAVE IS NOT A FAULT';

/**
 * What the shape rule can ask of a judge that is never shown the page.
 *
 * WHAT THIS REPLACED, and why. The rule used to read "Markdown structure of the
 * ORIGINAL preserved". Producers are now floored on the PAGE AS IT STANDS
 * (`translate-validate.ts`), and that page splits blocks, merges them, and
 * quotes lines the ORIGINAL runs as prose, so a rendering that keeps the page's
 * shape departs from the ORIGINAL's BY DESIGN. A judge told the ORIGINAL is the
 * standard marks down the very candidates the guard demands, at exactly the
 * reshaped slices this stage exists for.
 *
 * WHY IT DOES NOT NAME THE PAGE INSTEAD. The existing translation reaches these
 * judges anonymously, as one candidate among the others, and never travels as
 * labelled evidence; `translate-judge.ts` says so where it assembles the
 * evidence list. A criterion naming a text the judge cannot see is a criterion
 * it has to guess at. What is left is what a judge CAN check from a candidate
 * alone.
 */
const SHAPE_IS_JUDGED_WITHIN_THE_CANDIDATE =
  `Markdown that holds together: block quotes, list markers, headings, footnote markers and links used consistently, with breaks between blocks. ${A_SHAPE_THE_ORIGINAL_LACKS_IS_NOT_A_FAULT}, because this archive's pages split, merge and quote passages of their own accord.`;

/**
 * Decision rules the judges apply, most important first.
 *
 * COVERAGE AND FAITHFULNESS LEAD, and fluency comes last, which is the ordering
 * the whole lane rests on: a candidate that reads better while saying less must
 * lose. Whether the judges actually honour that ordering is the open question in
 * `#84`, and it is not answerable from the wording alone.
 *
 * WHY FAITHFULNESS NAMES DECLARED NAMES ITSELF. A separate criterion has always
 * said declared names are used exactly as given, and judges read that as
 * spelling guidance rather than as an exemption: `nothing added` is the rule
 * they applied to the name. Measured on one contested slice, THREE OF SIX
 * judges, every one of them shown the declared names, rejected a candidate for
 * carrying a declared alias, calling it an addition the original does not
 * support. That is the translate lane stripping accurate detail, which
 * `doc/audit/eight-entries-read-against-the-original.md` recorded as its
 * characteristic failure, arriving through the judges rather than the
 * translators. The carve-out has to sit inside the faithfulness rule, because
 * that is the rule being applied.
 */
export const TRANSLATE_SELECTION_CRITERIA: readonly string[] = [
  'Complete coverage: every proposition of the ORIGINAL is rendered, nothing left out.',
  `Faithfulness: nothing added, and no change to who acts, what is referred to, negation, certainty, time, number, or how things relate. ${DECLARED_NAME_IS_NOT_AN_ADDITION}`,
  `Declared names, handles and archive terminology used exactly as given. ${DECLARED_NAME_IS_NOT_OWED_CONTENT} ${A_SHARED_SPELLING_CANNOT_SEPARATE_CANDIDATES}`,
  SHAPE_IS_JUDGED_WITHIN_THE_CANDIDATE,
  'Natural, idiomatic English reading as one coherent passage.',
];

/**
 * Criterion added where the enclosing chunk's ORIGINAL is line-structured.
 *
 * WRITTEN FOR A JUDGE RATHER THAN A TRANSLATOR, which is why it is not
 * `TRANSLATE_LINE_STRUCTURE_RULE` from `translate-wire.ts`. That one tells a
 * producer what to build, in imperatives it can follow: produce one line per
 * original line, unmerge what the existing translation merged. A judge builds
 * nothing and chooses between candidates already written, so the same fact has
 * to arrive as a test it can apply to each one.
 *
 * IT OVERRIDES CRITERION FOUR RATHER THAN SITTING BESIDE IT. Without this, a
 * judge on a verse slice reads
 * {@link SHAPE_IS_JUDGED_WITHIN_THE_CANDIDATE} and is told that a shape the
 * ORIGINAL lacks is no fault, which on this archive is the right rule pointed
 * the wrong way: here the ORIGINAL is what HAS the line structure and the page
 * is what merged it. A producer obeying the verse rule unmerges, and a judge
 * reading criterion four alone has been handed a reason to prefer the merged
 * rival it was measured against.
 *
 * THE SAME CONTRADICTION `#150` FIXED, on the other side of the round. That
 * task made the verse rule outrank the page rule for producers and said so in
 * the rule text rather than by ordering, because a model resolves a
 * contradiction however it likes when neither side defers. Ordering alone
 * would be the same mistake here.
 */
export const TRANSLATE_LINE_STRUCTURE_CRITERION: string =
  `The ORIGINAL is line-structured: each original line is a unit, and this criterion OUTRANKS the rule that ${A_SHAPE_THE_ORIGINAL_LACKS_IS_NOT_A_FAULT}, which governs prose and not verse. Count the lines against the ORIGINAL: a candidate that merges two original lines into one, splits one across two, or drops or invents a line is FAULTY here however well it reads, and a candidate carrying one line per original line is correct even where the EXISTING TRANSLATION merged them.`;

/**
 * Decision rules for a slice, carrying the line-structure criterion only where
 * the rule governs.
 *
 * A FUNCTION RATHER THAN A SECOND ARRAY. Two arrays would answer the same
 * question in two places and drift the moment either is edited, and the
 * ungoverned answer is the one `#84` measured, so it has to stay exactly what
 * it was.
 *
 * INSERTED BY IDENTITY, NOT BY INDEX. The criterion belongs immediately ahead
 * of the shape rule it overrides, and finding that position by searching for
 * the rule keeps it there if the list is ever reordered. An index would silently
 * put it somewhere else.
 *
 * @param lineStructured - whether the enclosing chunk is governed by the verse
 * rule, decided by the caller from the same set that gates the producer sheet
 *
 * @returns Criteria to give every judge of this slice, most important first
 *
 * @example
 * ```ts
 * const criteria = translateSelectionCriteria({ lineStructured: true, },);
 * ```
 */
export function translateSelectionCriteria(
  { lineStructured, }: { readonly lineStructured: boolean; },
): readonly string[] {
  // THE UNGOVERNED ANSWER IS THE ARRAY ITSELF, returned rather than rebuilt, so
  // a prose slice is asked byte for byte what it was asked before this existed.
  if (!lineStructured)
    return TRANSLATE_SELECTION_CRITERIA;

  return TRANSLATE_SELECTION_CRITERIA
    .flatMap(function aheadOfTheRuleItOverrides(criterion,): readonly string[] {
      return (criterion === SHAPE_IS_JUDGED_WITHIN_THE_CANDIDATE)
        ? [
          TRANSLATE_LINE_STRUCTURE_CRITERION,
          criterion,
        ]
        : [criterion,];
    },);
}

//endregion Translate selection sheet
