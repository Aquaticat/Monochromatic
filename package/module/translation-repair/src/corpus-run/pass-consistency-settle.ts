import { countConsistency, } from '../consistency-count.ts';
import type { ConsistencyCount, } from '../consistency-count-types.ts';
import { ConsistencyInvariantError, } from '../consistency-invariant-error.ts';
import { consistencyLabel, } from '../consistency-wire.ts';
import type {
  ArtifactConsistencyBallot,
  ArtifactConsistencyCarry,
  ArtifactConsistencyRepeat,
  ArtifactConsistencyUnplaced,
  ConsistencyOccurrenceOutcome,
} from './artifact-two-lane-consistency.ts';
import type { ConsistencyAsked, } from './pass-consistency-ask.ts';
import {
  afterRunOff,
  chosenPlaceOf,
  plannedPlace,
} from './pass-consistency-decide.ts';
import type { ConsistencyPlace, } from './pass-consistency-group.ts';
import type { ConsistencyRunOffAsked, } from './pass-consistency-run-off.ts';
import type {
  CarryReceiver,
  DecidedGroup,
  PendingEdit,
  PlaceCarried,
  SettledGroup,
} from './pass-consistency-types.ts';

//region Pass consistency settle
// WHAT A GROUP COMES TO once its ballots are counted and a tie for first is run
// off: a verdict, a rendering and a provisional outcome for each place, and the
// places the chosen rendering is still to be carried to (`receivers`). The carry
// (`pass-consistency-carry.ts`) turns each receiver into a record and, when the
// bench chooses a text other than the place's own, a replacement. The outcomes
// become final in `pass-consistency-apply.ts`, where replacements meet each other
// and the floors.

/**
 A ballot as the artifact records it.

 @param voice - ballot with its seat

 @returns The recorded ballot

 @example
 ```ts
 const ballot = recordedBallot({ voice, },);
 ```
 */
function recordedBallot(
  { voice, }: { readonly voice: ConsistencyAsked['voices'][number]; },
): ArtifactConsistencyBallot {
  return {
    seat: voice.seat,
    reason: voice.reason,
    quotes: voice.quotes
      .map(function recordedQuote(quote,): ArtifactConsistencyBallot['quotes'][number] {
        return {
          label: quote.label,
          quote: quote.quote,
          ...((quote.slot === undefined) ? {} : { slot: quote.slot, }),
        };
      },),
    choice: voice.choice,
    keep: voice.keep,
  };
}

/**
 Counts the first round's ballots over the places.

 @param repeat - the repeated wording or frame

 @param places - the places a slice holds whole

 @param asked - the ballots heard, the quorum and the gather's findings

 @returns What the usable ballots come to, the finalists of a tie for first included

 @example
 ```ts
 const count = countAsked({ repeat, places, asked, },);
 ```
 */
export function countAsked(
  {
    repeat,
    places,
    asked,
  }: {
    readonly repeat: ArtifactConsistencyRepeat;
    readonly places: readonly ConsistencyPlace[];
    readonly asked: ConsistencyAsked;
  },
): ConsistencyCount {
  return countConsistency({
    voices: asked.voices,
    places: places.map(function placeOf(
      place,
      position,
    ) {
      return {
        label: consistencyLabel({ position, },),
        english: place.slice
          .current,
        sliceIndex: place.slice
          .sliceIndex,
      };
    },),
    framed: repeat.kind === 'refrain',
    quorum: asked.quorum,
  },);
}

/**
 Counts what the bench said about a group and decides what each place is to
 receive.

 @param repeat - the repeated wording or frame

 @param places - the places a slice holds whole

 @param unplaced - the places no slice holds whole

 @param asked - the ballots heard, the quorum and the gather's findings

 @param runOff - what the run-off heard when the choices tied for first

 @returns The group with its verdict, renderings and provisional outcomes, and the places the chosen rendering is still to be carried to

 @throws {@link ConsistencyInvariantError} when the winner is not a located place of the group

 @example
 ```ts
 const decided = settleAsked({ repeat, places, unplaced, asked, },);
 ```
 */
export function settleAsked(
  {
    repeat,
    places,
    unplaced,
    asked,
    runOff,
  }: {
    readonly repeat: ArtifactConsistencyRepeat;
    readonly places: readonly ConsistencyPlace[];
    readonly unplaced: readonly ArtifactConsistencyUnplaced[];
    readonly asked: ConsistencyAsked;
    readonly runOff?: ConsistencyRunOffAsked;
  },
): DecidedGroup {
  /**
   What the usable ballots come to.
   */
  const count = countAsked({
    repeat,
    places,
    asked,
  },);
  /**
   Labels of the places, in order.
   */
  const labels = places.map(function labelOf(
    _place,
    position,
  ): string {
    return consistencyLabel({ position, },);
  },);
  /**
   The winner after any run-off, and the run-off as recorded.
   */
  const ruled = afterRunOff({
    count,
    labels,
    runOff: (runOff === undefined) ? [] : [runOff,],
  },);
  /**
   The winning place with its located rendering, as a list of zero or one.
   */
  const chosen = chosenPlaceOf({
    places,
    renderings: count.renderings,
    position: labels.findIndex(function isWinner(label,): boolean {
      return (ruled.winner
        .kind
        === 'chosen') && (ruled.winner
          .label
          === label);
    },),
  },);
  /**
   Every place's provisional outcome, and the receiving places among them.
   */
  const planned = places.map(function planFor(
    place,
    position,
  ) {
    return plannedPlace({
      chosen,
      place,
      position,
      count,
      framed: repeat.kind === 'refrain',
    },);
  },);
  return {
    repeat,
    places,
    unplaced,
    verdict: {
      kind: 'asked',
      ballots: asked.voices
        .map(function toBallot(voice,): ArtifactConsistencyBallot {
          return recordedBallot({ voice, },);
        },),
      usable: count.usable,
      quorum: asked.quorum,
      winner: ruled.winner,
      ...((ruled.runOff[0] === undefined) ? {} : { runOff: ruled.runOff[0], }),
    },
    renderings: count.renderings,
    outcomes: planned.map(function outcomeOf(entry,): ConsistencyOccurrenceOutcome {
      return entry.outcome;
    },),
    edits: [],
    carries: [],
    findings: [
      ...asked.findings,
      ...(runOff?.findings ?? []),
    ],
    chosen,
    receivers: planned.flatMap(function receiverOf(entry,): readonly CarryReceiver[] {
      return entry.receiver;
    },),
  };
}

/**
 Settles a decided group once its receiving places are carried to.

 @param decided - the group with its receivers

 @param carried - how each receiver's carry ended, in the order of the receivers

 @returns The group with the carries' records, the replacements the chosen candidates make, and each receiver's provisional outcome

 @throws {@link ConsistencyInvariantError} when the carries are not one per receiver

 @example
 ```ts
 const settled = settleCarried({ decided, carried, },);
 ```
 */
export function settleCarried(
  {
    decided,
    carried,
  }: {
    readonly decided: DecidedGroup;
    readonly carried: readonly PlaceCarried[];
  },
): SettledGroup {
  if (carried.length
    !== decided.receivers
    .length) {
    throw new ConsistencyInvariantError({ invariant:
      `the pass carries to each receiving place once, and the number of carries differs from the number of receiving places (carried: ${String(carried.length,)}, receiving: ${String(decided.receivers
        .length,)})`, },);
  }
  /**
   The positions of the places whose carry makes a replacement.
   */
  const replacing = new Set(carried.flatMap(function positionsOf(entry,): readonly number[] {
    return entry.edits
      .map(function positionOf(edit,): number {
      return edit.placePosition;
    },);
  },),);
  return {
    repeat: decided.repeat,
    places: decided.places,
    unplaced: decided.unplaced,
    verdict: decided.verdict,
    renderings: decided.renderings,
    outcomes: decided.outcomes
      .map(function outcomeOf(
        outcome,
        position,
      ): ConsistencyOccurrenceOutcome {
        return replacing.has(position,) ? 'replaced' : outcome;
      },),
    edits: carried.flatMap(function editsOf(entry,): readonly PendingEdit[] {
      return entry.edits;
    },),
    carries: carried.map(function carryOf(entry,): ArtifactConsistencyCarry {
      return entry.carry;
    },),
    findings: [
      ...decided.findings,
      ...carried.flatMap(function findingsOf(entry,): readonly string[] {
        return entry.findings;
      },),
    ],
  };
}

//endregion Pass consistency settle
