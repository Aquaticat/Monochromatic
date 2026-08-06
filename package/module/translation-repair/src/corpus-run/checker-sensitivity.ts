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

  console.log(
    'NOTE the untouched case is the one that matters: a majority calling an '
      + 'unrepaired text fixed would mean the 98.1 percent resolution rate '
      + 'measures the checkers rather than the repairs.',
  );
}

await main();

//endregion Checker sensitivity
