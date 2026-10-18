import { ArtifactParseError, } from '@monochromatic-dev/translation-repair-artifact-pool/ts';
import {
  choiceTallyOf,
  consistencyLabels,
  type ConsistencyRendering,
  type ConsistencyWinner,
  majorityChoiceOf,
  runOffWinnerOf,
  tiedForFirstOf,
  usableVoicesOf,
  winnerOf,
} from '@monochromatic-dev/translation-repair-consistency/ts';
import type { ArtifactConsistencyGroup, } from './artifact-two-lane-consistency.ts';

//region Artifact consistency span winner
// THE WINNER A RECORDED GROUP OF THE SIXTEENTH SHAPE MUST HAVE, from its ballots:
// the strict majority of the first round, or, when the choices tied for first,
// the winner of the run-off that settled the tie. A run-off recorded for choices
// that did not tie, missing for choices that did, among other finalists, or
// counted otherwise than its ballots give is refused.

/**
 A group the bench was asked about.
 */
type AskedGroup = ArtifactConsistencyGroup & { readonly verdict: { readonly kind: 'asked'; }; };

/**
 What a count came to for a place, in the shape a group's winner and a carry's
 decision share: a label chosen, or the reason none was.
 */
type CountedOutcome =
  | {
    readonly kind: 'chosen';
    readonly label: string
  }
  | {
    readonly kind: 'none';
    readonly reason: string
  }
  | {
    readonly kind: 'failed';
    readonly detail: string
  };

/**
 Whether two outcomes of a count name the same label or give the same reason
 for none, a winner of a group and a decision of a carry alike.

 @param left - one outcome

 @param right - the other outcome

 @returns Whether they agree

 @example
 ```ts
 const agree = sameWinner({ left: expected, right: recorded, },);
 ```
 */
export function sameWinner(
  {
    left,
    right,
  }: {
    readonly left: CountedOutcome;
    readonly right: CountedOutcome;
  },
): boolean {
  if ((left.kind === 'chosen') && (right.kind === 'chosen'))
    return left.label === right.label;
  if ((left.kind === 'none') && (right.kind === 'none'))
    return left.reason === right.reason;
  return false;
}

/**
 The winner the ballots give, after the run-off when the choices tied for first,
 and a refusal where the run-off recorded is not the one the ballots call for.

 @param group - the group, asked of the bench

 @param renderings - each place's rendering in the counter's form

 @param path - where the group sits, for the parse error

 @returns The winner the ballots, the quorum and the run-off give

 @throws {@link ArtifactParseError} when a run-off is recorded for choices that did not tie, is missing for choices that did, names other finalists, or counts otherwise than its ballots give

 @example
 ```ts
 const expected = expectedWinnerOf({ group, renderings, path, },);
 ```
 */
export function expectedWinnerOf(
  {
    group,
    renderings,
    path,
  }: {
    readonly group: AskedGroup;
    readonly renderings: readonly ConsistencyRendering[];
    readonly path: string;
  },
): ConsistencyWinner {
  /**
   Labels the sheet showed.
   */
  const labels = consistencyLabels({ count: group.occurrences
    .length, },);
  /**
   The usable ballots of the group.
   */
  const voices = usableVoicesOf({
    voices: group.verdict
      .ballots,
    labels,
  },);
  /**
   Voices the first round closed on.
   */
  const { quorum, } = group.verdict;
  /**
   The places that tied for first, which are run off when the ballots reach the quorum.
   */
  const finalists = ((voices.length === 0) || (voices.length < quorum))
    ? []
    : tiedForFirstOf({
      voices,
      labels,
    },);
  /**
   The run-off the file records.
   */
  const { runOff, } = group.verdict;
  if (finalists.length === 0) {
    if (runOff !== undefined) {
      throw new ArtifactParseError({
        path: `${path}.verdict.runOff`,
        reason: 'no run-off, since the usable ballots did not tie for first',
      },);
    }
    return winnerOf({
      usable: voices.length,
      quorum,
      chosen: majorityChoiceOf({ voices, },),
      labels,
      renderings,
    },);
  }
  if ((runOff === undefined) || (runOff.finalists
    .join('\n',)
    !== finalists.join('\n',))) {
    throw new ArtifactParseError({
      path: `${path}.verdict.runOff`,
      reason: `a run-off among ${finalists.join(', ',)}, which tied for first`,
    },);
  }
  /**
   Seats heard in the run-off, each once or not.
   */
  const seats = new Set(runOff.ballots
    .map(function seatOf({ seat, },): string {
      return seat;
    },),);
  /**
   What the run-off's ballots can be counted for.
   */
  const { usable, } = choiceTallyOf({
    voices: runOff.ballots,
    labels: finalists,
  },);
  if ((runOff.quorum < 1) || (seats.size
    !== runOff.ballots
    .length)
    || (usable !== runOff.usable)) {
    throw new ArtifactParseError({
      path: `${path}.verdict.runOff`,
      reason: 'a quorum of one at least, each seat heard once, and the number of ballots that can be counted against the finalists',
    },);
  }
  return runOffWinnerOf({
    voices: runOff.ballots,
    finalists,
    quorum: runOff.quorum,
    labels,
    renderings,
  },)
    .winner;
}

//endregion Artifact consistency span winner
