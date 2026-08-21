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
  `Declared names, handles and archive terminology used exactly as given. ${DECLARED_NAME_IS_NOT_OWED_CONTENT}`,
  'Markdown structure of the ORIGINAL preserved: block quotes, list markers, '
  + 'headings, footnote markers, links, and the breaks between blocks.',
  'Natural, idiomatic English reading as one coherent passage.',
];

//endregion Translate selection sheet
