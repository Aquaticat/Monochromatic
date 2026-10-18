import { ArtifactParseError, } from '@monochromatic-dev/translation-repair-artifact-pool/ts';
import {
  carryChoiceOf,
  tiedChoicesOf,
} from '@monochromatic-dev/translation-repair-consistency/ts';
import type {
  ArtifactConsistencyCarry,
  ConsistencyOccurrenceOutcome,
} from './artifact-two-lane-consistency.ts';
import { sameWinner, } from './artifact-two-lane-read-consistency-span-winner.ts';
import { assertSeatsHeardOnce, } from './artifact-two-lane-read-consistency-tally.ts';

//region Artifact consistency carry recount
// WHAT A RECORDED CARRY SAYS ABOUT ITSELF, recounted from its own ballots:
// candidates labelled in order, the current English once, the splice at most
// once, each seat heard once, the usable count and the decision a strict majority
// of the usable ballots reaching the quorum give. What a carry says about the
// group's places and outcomes is the coherence check's question
// (`artifact-two-lane-read-consistency-span.ts`).

/**
 Checks the candidates of a carry: labelled in order, the current English once,
 the splice at most once, and each writer's seat at most once.

 @param carry - the carry

 @param path - where it sits, for the parse error

 @throws {@link ArtifactParseError} when a label, a kind or a seat does not fit

 @example
 ```ts
 assertCandidatesFit({ carry, path, },);
 ```
 */
function assertCandidatesFit(
  {
    carry,
    path,
  }: {
    readonly carry: ArtifactConsistencyCarry;
    readonly path: string;
  },
): void {
  /**
   Seats named so far, across every candidate.
   */
  const seen = new Set<string>();
  carry.candidates
    .forEach(function fits(
    candidate,
    at,
  ): void {
    /**
     Where the candidate sits, for the parse error.
     */
    const here = `${path}.candidates[${String(at,)}]`;
    if (candidate.label !== `CANDIDATE ${String(at + 1,)}`) {
      throw new ArtifactParseError({
        path: `${here}.label`,
        reason: `the label CANDIDATE ${String(at + 1,)}, since the candidates are labelled in order`,
      },);
    }
    if ((candidate.kind === 'writer') && (candidate.writers
      .length
      === 0)) {
      throw new ArtifactParseError({
        path: `${here}.writers`,
        reason: 'a seat at least, since a writer candidate is a writer\'s paragraph',
      },);
    }
    for (const seat of candidate.writers) {
      if (seen.has(seat,)) {
        throw new ArtifactParseError({
          path: `${here}.writers`,
          reason: 'a seat in one candidate only, since a seat gives one reply',
        },);
      }
      seen.add(seat,);
    }
  },);
  /**
   How many candidates are the current English and the splice.
   */
  const kinds = {
    current: carry.candidates
      .filter(function isCurrent(candidate,): boolean {
        return candidate.kind === 'current';
      },)
      .length,
    splice: carry.candidates
      .filter(function isSplice(candidate,): boolean {
        return candidate.kind === 'splice';
      },)
      .length,
  };
  if ((carry.candidates
    .length
    > 0) && ((kinds.current !== 1) || (kinds.splice > 1))) {
    throw new ArtifactParseError({
      path: `${path}.candidates`,
      reason: 'the current English once and the splice at most once',
    },);
  }
}

/**
 Checks a carry against its own ballots: no ballots where the bench was not
 asked, and where it was asked the usable count and the decision recounted.

 @param carry - the carry

 @param path - where it sits, for the parse error

 @throws {@link ArtifactParseError} when a count or the decision is not what the ballots give

 @example
 ```ts
 assertCarryRecounts({ carry, path, },);
 ```
 */
function assertCarryRecounts(
  {
    carry,
    path,
  }: {
    readonly carry: ArtifactConsistencyCarry;
    readonly path: string;
  },
): void {
  assertCandidatesFit({
    carry,
    path,
  },);
  /**
   Whether the bench was asked: a decision among candidates is a recount of ballots.
   */
  const asked = (carry.decision
    .kind
    === 'chosen')
    || ((carry.decision
      .kind
      === 'none') && (carry.decision
        .reason
        !== 'no-alternative'));
  if (!asked) {
    if ((carry.ballots
      .length
      > 0) || (carry.usable !== 0)
      || (carry.quorum !== 0)) {
      throw new ArtifactParseError({
        path,
        reason: 'no ballots, no usable count and no quorum, since the bench was not asked among the candidates',
      },);
    }
    if ((carry.decision
      .kind
      === 'none') && (carry.candidates
        .length
        !== 1)) {
      throw new ArtifactParseError({
        path: `${path}.candidates`,
        reason: 'the current English alone, since no alternative was on offer',
      },);
    }
    return;
  }
  if ((carry.candidates
    .length
    < 2) || (carry.quorum < 1)) {
    throw new ArtifactParseError({
      path,
      reason: 'two candidates at least and a quorum of one at least, since the bench was asked among the candidates',
    },);
  }
  /**
   Labels the sheet showed.
   */
  const labels = carry.candidates
    .map(function labelOf({ label, },): string {
      return label;
    },);
  assertSeatsHeardOnce({
    seats: carry.ballots
      .map(function seatOf({ seat, },): string {
        return seat;
      },),
    path: `${path}.ballots`,
  },);
  /**
   What the ballots give.
   */
  const {
    usable,
    choice,
  } = carryChoiceOf({
    voices: carry.ballots,
    labels,
    quorum: carry.quorum,
  },);
  if (usable !== carry.usable) {
    throw new ArtifactParseError({
      path: `${path}.usable`,
      reason: 'the number of ballots that can be counted against the candidates',
    },);
  }
  if (carry.runOff === undefined) {
    // A split recorded with no run-off is read as it was written: the runs before the rule ended there.
    if (!sameWinner({
      left: choice,
      right: carry.decision,
    },)) {
      throw new ArtifactParseError({
        path: `${path}.decision`,
        reason: 'the decision a strict majority of the usable ballots, reaching the quorum, give',
      },);
    }
    return;
  }
  /**
   The bench asked once more among the candidates that tied for first.
   */
  const { runOff, } = carry;
  if ((choice.kind !== 'none') || (choice.reason !== 'no-majority')) {
    throw new ArtifactParseError({
      path: `${path}.runOff`,
      reason: 'a run-off only beside first ballots that reached their quorum and gave no candidate a strict majority',
    },);
  }
  /**
   The candidates the first ballots tied for first.
   */
  const tied = tiedChoicesOf({
    voices: carry.ballots,
    labels,
  },);
  /**
   The finalists the run-off records.
   */
  const { finalists, } = runOff;
  if ((tied.length !== finalists.length) || tied.some(function differs(
    label,
    at,
  ): boolean {
    return label !== finalists[at];
  },)) {
    throw new ArtifactParseError({
      path: `${path}.runOff.finalists`,
      reason: 'the candidates tied for first among the first ballots, in sheet order, and at least two',
    },);
  }
  if (runOff.quorum < 1) {
    throw new ArtifactParseError({
      path: `${path}.runOff.quorum`,
      reason: 'a quorum of one at least, since the bench was asked among the finalists',
    },);
  }
  assertSeatsHeardOnce({
    seats: runOff.ballots
      .map(function seatOf({ seat, },): string {
        return seat;
      },),
    path: `${path}.runOff.ballots`,
  },);
  /**
   What the run-off's ballots give, counted against the finalists only.
   */
  const counted = carryChoiceOf({
    voices: runOff.ballots,
    labels: runOff.finalists,
    quorum: runOff.quorum,
  },);
  if (counted.usable !== runOff.usable) {
    throw new ArtifactParseError({
      path: `${path}.runOff.usable`,
      reason: 'the number of run-off ballots that can be counted against the finalists',
    },);
  }
  if (!sameWinner({
    left: counted.choice,
    right: carry.decision,
  },)) {
    throw new ArtifactParseError({
      path: `${path}.decision`,
      reason: 'the decision a strict majority of the usable run-off ballots, reaching the run-off quorum, give',
    },);
  }
}

/**
 Checks every carry of a group against its own ballots.

 @param carries - the group's carries

 @param path - where they sit, for the parse error

 @throws {@link ArtifactParseError} when a carry is not what its ballots give

 @example
 ```ts
 assertCarriesRecount({ carries, path: `${path}.carries`, },);
 ```
 */
export function assertCarriesRecount(
  {
    carries,
    path,
  }: {
    readonly carries: readonly ArtifactConsistencyCarry[];
    readonly path: string;
  },
): void {
  carries.forEach(function recounts(
    carry,
    at,
  ): void {
    assertCarryRecounts({
      carry,
      path: `${path}[${String(at,)}]`,
    },);
  },);
}

/**
 The outcomes a carry's decision allows its place to end in, before the floors
 and the other groups' replacements have spoken.

 @param carry - the carry

 @param spliceMovesIt - whether code can move the chosen words into the place,
 which a reader of a section that records a unit carried in part answers from the
 place's recomputed plan; false for a place whose plan is `unavailable`, which
 keeps its words when the splice was chosen. A writer's paragraph rewrites the
 place whatever the plan was, so the answer changes nothing for one.

 @returns Outcomes the place may have: kept-current for the current English, a
 failure, no decision, or the splice for a place the splice does not move;
 replaced, kept-floor or overlapped for a splice or a writer's paragraph
 otherwise

 @example
 ```ts
 const allowed = outcomesAfter({ carry, spliceMovesIt: true, },);
 ```
 */
export function outcomesAfter(
  {
    carry,
    spliceMovesIt = true,
  }: {
    readonly carry: ArtifactConsistencyCarry;
    readonly spliceMovesIt?: boolean;
  },
): readonly ConsistencyOccurrenceOutcome[] {
  if (carry.decision
    .kind
    !== 'chosen')
    return ['kept-current',];
  /**
   Label of the candidate chosen.
   */
  const { label, } = carry.decision;
  /**
   The candidate chosen.
   */
  const chosen = carry.candidates
    .find(function isChosen(candidate,): boolean {
      return candidate.label === label;
    },);
  return ((chosen?.kind === 'current') || ((chosen?.kind === 'splice') && (!spliceMovesIt)))
    ? ['kept-current',]
    : [
      'replaced',
      'kept-floor',
      'overlapped',
    ];
}

//endregion Artifact consistency carry recount
