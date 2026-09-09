import {
  MIN_SELECTION_WEIGHT,
  SELF_VOTE_WEIGHT,
} from './candidate-select-model.ts';
import {
  type FanOutMode,
  firstRoundWindow,
} from './stage-fanout-window.ts';

//region Selection fan-out
// A WINDOW THAT COULD NEVER SHIP A UNANIMOUS SLATE IS NO WINDOW. The select
// stage seats producers as judges at half weight (`SELF_VOTE_WEIGHT`) and
// ships nothing under `MIN_SELECTION_WEIGHT`; a candidate every seated model
// wrote (the archive-block review, where the reviewers are the judges and
// byte-identical revisions merge into one candidate) is carried by self-votes
// alone. On a four-seat bench the window of quorum plus one is three seats,
// and three halves fall short of the minimum, so the stage would decline
// every unanimous revision that four halves used to ship
// (`corpus-run/archive-block-repair.unit.test.ts`). The window is a saving,
// not a verdict: where its self-votes alone could not reach the minimum the
// whole bench is asked, which on such a bench is one seat more.

/**
 * Chooses how many judges a selection round asks.
 *
 * @param judgeCount - seats on the judge bench
 *
 * @param requested - what the caller asked for; absent for the production
 * default
 *
 * @returns Whole bench where the window's self-votes alone could not reach
 * the minimum; the request otherwise
 *
 * @example
 * ```ts
 * const mode = selectionFanOut({ judgeCount: 4, },);
 * ```
 */
export function selectionFanOut(
  {
    judgeCount,
    requested = 'window',
  }: {
    readonly judgeCount: number;
    readonly requested?: FanOutMode;
  },
): FanOutMode {
  if (requested === 'whole-bench')
    return 'whole-bench';
  /**
   * Weight the window's seats carry when every one of them wrote the slate.
   */
  const windowSelfWeight = firstRoundWindow({ benchSize: judgeCount, },) * SELF_VOTE_WEIGHT;
  return (windowSelfWeight < MIN_SELECTION_WEIGHT) ? 'whole-bench' : 'window';
}

//endregion Selection fan-out
