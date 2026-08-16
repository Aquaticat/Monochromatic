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
 * Decision rules the judges apply, most important first.
 *
 * COVERAGE AND FAITHFULNESS LEAD, and fluency comes last, which is the ordering
 * the whole lane rests on: a candidate that reads better while saying less must
 * lose. Whether the judges actually honour that ordering is the open question in
 * `#84`, and it is not answerable from the wording alone.
 */
export const TRANSLATE_SELECTION_CRITERIA: readonly string[] = [
  'Complete coverage: every proposition of the ORIGINAL is rendered, nothing left out.',
  'Faithfulness: nothing added, and no change to who acts, what is referred to, '
  + 'negation, certainty, time, number, or how things relate.',
  'Declared names, handles and archive terminology used exactly as given.',
  'Markdown structure of the ORIGINAL preserved: block quotes, list markers, '
  + 'headings, footnote markers, links, and the breaks between blocks.',
  'Natural, idiomatic English reading as one coherent passage.',
];

//endregion Translate selection sheet
