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
  'Markdown that holds together: block quotes, list markers, headings, footnote markers and links used consistently, with breaks between blocks. A SHAPE THE ORIGINAL DOES NOT HAVE IS NOT A FAULT, because this archive\'s pages split, merge and quote passages of their own accord.';

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

//endregion Translate selection sheet
