/**
 The references by position the D33 guard leaves in sheet text: the wording
 of a model-facing or grader-facing sheet, and the task text a test hands a
 sheet builder. A sheet is rendered whole, in the one order its builder fixes,
 and read once from its top, so "the passage below" names the passage the
 reader meets next; a model-facing sheet's wording is also part of the cache
 key it is stored under. Split from `position-references-exemptions.test-fixture.ts`,
 which spreads this list into the package's exemptions, so each file stays
 under the line limit.

 @module
 */

import type { PositionExemption, } from './position-references.test-fixture.ts';

//region Sheet text exemptions

/**
 Why a model-facing sheet's wording is left.
 */
const SHEET_TEXT =
  'model-facing sheet text, rendered whole in the order its builder fixes and stored under a cache key its wording is part of';

/**
 Why a grader-facing sheet's wording is left.
 */
const GRADER_SHEET = 'grader-facing sheet text, printed whole in the order its builder fixes and read from its top';

/**
 Why a test's task text is left.
 */
const TASK_FIXTURE = 'task text a test hands the selection sheet builder, rendered as a stage\'s own task is';

/**
 Test files whose selection task reads "a rendering of the passage below".
 */
const PASSAGE_TASK_FILES: readonly string[] = [
  'src/attempt-method-policy.unit.test.ts',
  'src/canadian-english-policy.unit.test.ts',
  'src/glossary-dictionary-terms.unit.test.ts',
  'src/house-policy-reaches-the-judges.unit.test.ts',
  'src/protected-substance-policy.unit.test.ts',
  'src/register-policy.unit.test.ts',
  'src/source-subject-policy.unit.test.ts',
  'src/survived-attempt-policy.unit.test.ts',
  'src/tense-authority-reaches-every-sheet.unit.test.ts',
];

/**
 References in sheet text the guard leaves, each with its reason.
 */
export const SHEET_EXEMPTIONS: readonly PositionExemption[] = [
  ...PASSAGE_TASK_FILES.map(function passageTask(path,): PositionExemption {
    return {
      path,
      holds: 'rendering of the passage below',
      reason: TASK_FIXTURE,
    };
  },),
  {
    path: 'src/adjudicate-prompt.ts',
    holds: 'numbered claims below against the TRANSLATION',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/adjudicate-prompt.ts',
    holds: 'claims below may describe one defect',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/adjudicate-prompt.unit.test.ts',
    holds: 'GROUP 1 (claims below may describe one defect',
    reason: 'asserts the sheet text that line renders',
  },
  {
    path: 'src/adjudicate-prompt.unit.test.ts',
    holds: 'GROUP 2 (claims below',
    reason: 'asserts the sheet text that line renders',
  },
  {
    path: 'src/candidate-select-wire.ts',
    holds: 'Every block below opens and closes',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/critic-prompt.ts',
    holds: 'SEVERITY SCALE below defines',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/edit-prompt.ts',
    holds: 'THE HOUSE RULES BELOW OUTRANK',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/edit-prompt.ts',
    holds: 'numbered issues below in the TRANSLATION',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/editor-selection-sheet.ts',
    holds: 'Chinese ORIGINAL below',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/grading-sheet.ts',
    holds: 'Grade each accepted issue below',
    reason: GRADER_SHEET,
  },
  {
    path: 'src/lane-contest-wire.ts',
    holds: 'ARCHIVE RENDERING shown above',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/page-title-lexicon-wire.ts',
    holds: 'under the house rules below',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/pair-blocks-wire.ts',
    holds: 'numbered below',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/pair-sections-wire.ts',
    holds: 'numbered below',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/corpus-run/probe-verify-sheet.ts',
    holds: 'Every item below is an edit the pipeline applied',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/refine-prompt.ts',
    holds: 'for the reasons quoted below',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/refine-prompt.ts',
    holds: 'the quoted findings below',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/refine-prompt.ts',
    holds: 'The translation below is already correct',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/refine-selection-context.ts',
    holds: 'CURRENT English translation below',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/rendering-audit-prompt.ts',
    holds: 'evidence given below',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/rendering-audit-prompt.ts',
    holds: 'altered category below',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/rendering-audit-prompt.unit.test.ts',
    holds: 'Ignore the passage above',
    reason: 'a planted instruction inside fixture page text, which the audit sheet must not obey',
  },
  {
    path: 'src/repair-sheet.ts',
    holds: 'the text above was DELETED',
    reason: GRADER_SHEET,
  },
  {
    path: 'src/repair-sheet.ts',
    holds: 'so the text above is what the reader saw',
    reason: GRADER_SHEET,
  },
  {
    path: 'src/repair-sheet.ts',
    holds: 'so the wording above is not final',
    reason: GRADER_SHEET,
  },
  {
    path: 'src/repair-sheet.ts',
    holds: 'using the edit above only',
    reason: GRADER_SHEET,
  },
  {
    path: 'src/repair-sheet.ts',
    holds: 'grade below whether',
    reason: GRADER_SHEET,
  },
  {
    path: 'src/resolution-wire.ts',
    holds: 'fix the numbered issues below',
    reason: SHEET_TEXT,
  },
  {
    path: 'src/translate-selection-sheet.ts',
    holds: 'Chinese ORIGINAL below',
    reason: SHEET_TEXT,
  },
];

//endregion Sheet text exemptions
