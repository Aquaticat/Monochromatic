import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { AdjudicatedIssue, } from '../adjudicate-model.ts';
import { runCheckerStage, } from '../repair-edit-stages.ts';
import {
  createRunClient,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Checker sensitivity
// Asks whether the resolution checkers can say NO.
//
// Across real-corpus artifacts the checkers called 2215 of 2257 accepted issues
// resolved, 98.1 percent. That number is quoted as evidence the repair works,
// and it cannot carry that weight until the stage is shown to discriminate: a
// checker that answers `fixed` to everything produces exactly this rate whether
// or not anything was repaired, and `resolvedIssueIds` feeds both candidate
// selection and the milestone's headline.
//
// The probe sensitivity check settled the same question for the introduced-
// defect stage and was worth every one of its three calls. This is the same
// experiment aimed at the older, more load-bearing stage.
//
// Cat-themed invention throughout. No corpus text, licensed or otherwise, and
// nothing is written.

/**
 * Original the checkers judge against.
 */
const SOURCE_TEXT = '猫猫在窗台上睡觉，太阳移动时她会醒来。';

/**
 * Accepted issue every case asks about: the progressive gloss.
 */
const TENSE_ISSUE: AdjudicatedIssue = {
  issueId: 'adjudicated/tense',
  status: 'accepted',
  severity: 'major',
  claims: [
    {
      claimId: 'claim/tense',
      claim: {
        category: 'style/awkward-phrasing',
        severity: 'major',
        summary: 'Progressive gloss "is doing the sleeping" reads as machine output.',
        spans: [],
      },
    },
  ],
  tallies: {},
};

/**
 * Translation carrying the defect, used as the baseline for every case.
 */
const DEFECTIVE_TEXT = 'The cat is doing the sleeping on the windowsill, and she wakes when the sun moves.';

/**
 * Asks the checkers about one candidate and reports the tally.
 *
 * @param label - case name for the verdict line
 *
 * @param patchedText - candidate the checkers judge
 *
 * @param expectation - what a discriminating checker should answer
 *
 * @example
 * ```ts
 * await checkOne({ label: 'unfixed', patchedText: DEFECTIVE_TEXT, expectation: 'not-fixed', },);
 * ```
 */
async function checkOne(
  {
    label,
    patchedText,
    expectation,
  }: {
    readonly label: string;
    readonly patchedText: string;
    readonly expectation: string;
  },
): Promise<void> {
  /**
   * Checker result for this single issue.
   */
  const checker = await runCheckerStage({
    client: createRunClient(),
    checkerModelIds: RUN_MODELS.checkerModelIds,
    sourceText: SOURCE_TEXT,
    patchedText,
    issues: [TENSE_ISSUE,],
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: tagged({ tag: 'checker-sensitivity', },),
  },);

  /**
   * Tally for the single issue.
   */
  const tally = checker.tallies[TENSE_ISSUE.issueId];

  console.log(
    `CHECKER ${label} expected=${expectation} heard=${
      String(checker.heardCheckers,)
    } fixed=${String(tally?.fixed ?? 0,)} notFixed=${
      String(tally?.notFixed ?? 0,)
    } worse=${String(tally?.worse ?? 0,)} resolved=${
      String(tally?.resolved ?? false,)
    } regressed=${String(tally?.regressed ?? false,)}`,
  );
}

/**
 * Second accepted issue of the mixed sheet: a genuine mistranslation.
 */
const MEANING_ISSUE: AdjudicatedIssue = {
  issueId: 'adjudicated/meaning',
  status: 'accepted',
  severity: 'critical',
  claims: [
    {
      claimId: 'claim/meaning',
      claim: {
        category: 'accuracy/mistranslation',
        severity: 'critical',
        summary: 'The original says the cat wakes when the sun moves, not that she sleeps through it.',
        spans: [],
      },
    },
  ],
  tallies: {},
};

/**
 * Third accepted issue of the mixed sheet: a fabricated defect that is not in
 * the text at all.
 *
 * Nothing in either version mentions a dog. A checker reading the revision can
 * only answer `not-fixed` or refuse; one that answers `fixed` is agreeing with
 * the sheet rather than reading.
 */
const ABSENT_ISSUE: AdjudicatedIssue = {
  issueId: 'adjudicated/absent',
  status: 'accepted',
  severity: 'major',
  claims: [
    {
      claimId: 'claim/absent',
      claim: {
        category: 'accuracy/omission',
        severity: 'major',
        summary: 'The translation omits the dog barking in the garden.',
        spans: [],
      },
    },
  ],
  tallies: {},
};

/**
 * Asks the checkers about a SHEET of issues at once, as production does.
 *
 * The single-issue cases establish that the stage can discriminate at all. This
 * one asks whether it still discriminates when the sheet is mixed, which is the
 * only shape the 98.1 percent rate was ever measured on: production passes
 * every accepted issue of a chunk in one call, so a checker that keeps up on
 * one issue and agrees with everything on seven would produce that rate while
 * proving nothing.
 *
 * @example
 * ```ts
 * await checkMixedSheet();
 * ```
 */
async function checkMixedSheet(): Promise<void> {
  /**
   * Candidate fixing the tense only: the meaning defect survives untouched and
   * the fabricated one was never there.
   */
  const patchedText = 'The cat sleeps on the windowsill, and she sleeps on through the sun moving.';

  /**
   * Checker result over the mixed sheet.
   */
  const checker = await runCheckerStage({
    client: createRunClient(),
    checkerModelIds: RUN_MODELS.checkerModelIds,
    sourceText: SOURCE_TEXT,
    patchedText,
    issues: [
      TENSE_ISSUE,
      MEANING_ISSUE,
      ABSENT_ISSUE,
    ],
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: tagged({ tag: 'checker-sensitivity', },),
  },);

  for (const [
    issueId,
    expectation,
  ] of [
    [
      TENSE_ISSUE.issueId,
      'fixed',
    ],
    [
      MEANING_ISSUE.issueId,
      'not-fixed',
    ],
    [
      ABSENT_ISSUE.issueId,
      'not-fixed-defect-was-never-there',
    ],
  ] as const) {
    /**
     * Tally for this issue of the sheet.
     */
    const tally = checker.tallies[issueId];
    console.log(
      `CHECKER mixed-sheet/${issueId} expected=${expectation} fixed=${
        String(tally?.fixed ?? 0,)
      } notFixed=${String(tally?.notFixed ?? 0,)} worse=${
        String(tally?.worse ?? 0,)
      } resolved=${String(tally?.resolved ?? false,)}`,
    );
  }
}

/**
 * Asks the checkers about a sheet of three issues that were ALL fixed.
 *
 * Isolates the variable the mixed sheet left confounded. That sheet changed two
 * things at once against the single-issue case: it grew to three issues AND its
 * candidate carried a loud unfixed defect, so under-crediting there could have
 * come from either. Here the sheet is the same size and every issue really is
 * repaired. Continued under-crediting indicts SHEET SIZE; correct crediting
 * points at contamination from the unfixed defect instead.
 *
 * @example
 * ```ts
 * await checkAllFixedSheet();
 * ```
 */
async function checkAllFixedSheet(): Promise<void> {
  /**
   * Candidate repairing all three stated defects.
   */
  const patchedText = 'The cat sleeps on the windowsill, she wakes when the sun moves, '
    + 'and a dog barks in the garden.';

  /**
   * Checker result over the all-fixed sheet.
   */
  const checker = await runCheckerStage({
    client: createRunClient(),
    checkerModelIds: RUN_MODELS.checkerModelIds,
    sourceText: `${SOURCE_TEXT}花园里有狗在叫。`,
    patchedText,
    issues: [
      TENSE_ISSUE,
      MEANING_ISSUE,
      ABSENT_ISSUE,
    ],
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: tagged({ tag: 'checker-sensitivity', },),
  },);

  for (const issue of [
    TENSE_ISSUE,
    MEANING_ISSUE,
    ABSENT_ISSUE,
  ]) {
    /**
     * Tally for this issue of the sheet.
     */
    const tally = checker.tallies[issue.issueId];
    console.log(
      `CHECKER all-fixed/${issue.issueId} expected=fixed fixed=${
        String(tally?.fixed ?? 0,)
      } notFixed=${String(tally?.notFixed ?? 0,)} worse=${
        String(tally?.worse ?? 0,)
      } resolved=${String(tally?.resolved ?? false,)}`,
    );
  }
}

/**
 * Runs the three cases that separate a discriminating checker from a
 * rubber-stamping one.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  // Sequential so this never competes with a running corpus pass for the
  // per-model stream slots.
  /* oxlint-disable no-await-in-loop -- sequential by design, see comment */
  for (const check of [
    {
      label: 'genuinely-fixed',
      patchedText: 'The cat sleeps on the windowsill, and she wakes when the sun moves.',
      expectation: 'fixed',
    },
    {
      // The candidate IS the defective text. Nothing was repaired at all, and a
      // checker calling this fixed is answering the question it was asked with
      // the answer it always gives.
      label: 'untouched',
      patchedText: DEFECTIVE_TEXT,
      expectation: 'not-fixed',
    },
    {
      // The gloss is gone, so the stated defect is addressed, but the rewrite
      // drops the second clause. A checker reading only for the issue text will
      // call this fixed; one reading the revision will call it worse.
      label: 'fixed-but-damaged',
      patchedText: 'The cat sleeps on the windowsill.',
      expectation: 'fixed-or-worse',
    },
  ])
    await checkOne(check,);
  /* oxlint-enable no-await-in-loop */

  await checkMixedSheet();
  await checkAllFixedSheet();

  console.log(
    'NOTE the untouched case is the one that matters: a majority calling an '
      + 'unrepaired text fixed would mean the 98.1 percent resolution rate '
      + 'measures the checkers rather than the repairs. The mixed sheet asks '
      + 'the same question under the shape that rate was measured on, since '
      + 'production passes every accepted issue of a chunk in one call.',
  );
}

// Guarded so this runs only when INVOKED. Unguarded it ran on IMPORT, so
// anything pulling this module into the bundle performed the whole task as a
// side effect of loading the library: for the probing scripts that means live
// model calls, and for every one of them it means writing files.
if (import.meta.main)
  await main();

//endregion Checker sensitivity
