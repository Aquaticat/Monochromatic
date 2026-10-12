import type {
  ConsistencyCount,
  ConsistencyRendering,
} from '../consistency-count-types.ts';
import { ConsistencyInvariantError, } from '../consistency-invariant-error.ts';
import { runOffWinnerOf, } from '../consistency-run-off.ts';
import { planConsistencyEdit, } from '../consistency-splice.ts';
import { consistencyLabel, } from '../consistency-wire.ts';
import type {
  ArtifactConsistencyRunOff,
  ConsistencyOccurrenceOutcome,
} from './artifact-two-lane-consistency.ts';
import type { ConsistencyPlace, } from './pass-consistency-group.ts';
import type { ConsistencyRunOffAsked, } from './pass-consistency-run-off.ts';
import type {
  CarryReceiver,
  LocatedPlace,
} from './pass-consistency-types.ts';

//region Pass consistency decide
// WHO WON, AND WHAT EACH PLACE IS TO RECEIVE: the winner after any run-off, the
// winning place with its located rendering, and for every other place its
// provisional outcome and, where the chosen rendering is to be carried to it, the
// receiver. `pass-consistency-settle.ts` assembles these into the group.

/**
 The winner and the run-off's record, after a tie for first is run off.

 @param count - what the first round's ballots came to

 @param labels - labels of the places, in order

 @param runOff - what the run-off heard, as a list of zero or one: none when the choices did not tie

 @returns The winner, and the run-off as the artifact records it when there was one, as a list of zero or one

 @throws {@link ConsistencyInvariantError} when a run-off was heard for choices that did not tie, or the choices tied and no run-off was heard

 @example
 ```ts
 const { winner, } = afterRunOff({ count, labels, runOff: [], },);
 ```
 */
export function afterRunOff(
  {
    count,
    labels,
    runOff,
  }: {
    readonly count: ConsistencyCount;
    readonly labels: readonly string[];
    readonly runOff: readonly ConsistencyRunOffAsked[];
  },
): {
  readonly winner: ConsistencyCount['winner'];
  readonly runOff: readonly ArtifactConsistencyRunOff[];
} {
  /**
   What the run-off heard, when it was asked.
   */
  const [heard,] = runOff;
  if (heard === undefined) {
    if (count.finalists
      .length
      > 0) {
      throw new ConsistencyInvariantError({ invariant:
        'the choices tied for first and the bench was not asked again, and a tie is run off before the group is settled', },);
    }
    return {
      winner: count.winner,
      runOff: [],
    };
  }
  if (count.finalists
    .length
    === 0) {
    throw new ConsistencyInvariantError({ invariant:
      'a run-off was heard for choices that did not tie for first, and the bench is asked again only on a tie', },);
  }
  /**
   What the run-off's choices come to.
   */
  const decided = runOffWinnerOf({
    voices: heard.voices,
    finalists: count.finalists,
    quorum: heard.quorum,
    labels,
    renderings: count.renderings,
  },);
  return {
    winner: decided.winner,
    runOff: [
      {
        finalists: count.finalists,
        ballots: heard.voices
          .map(function recordedChoice({
            seat,
            reason,
            choice,
          },) {
            return {
              seat,
              reason,
              choice,
            };
          },),
        usable: decided.usable,
        quorum: heard.quorum,
      },
    ],
  };
}

/**
 The winning place with its located rendering.

 @param places - the places a slice holds whole

 @param renderings - each place's rendering, in the order of the places

 @param position - position of the winner among the places, minus one when none won

 @returns The place and its rendering as a list of one, none when no place won

 @throws {@link ConsistencyInvariantError} when a winner's place or rendering is missing or its rendering is not located, since a winner is named only where its own rendering is located

 @example
 ```ts
 const chosen = chosenPlaceOf({ places, renderings, position: 0, },);
 ```
 */
export function chosenPlaceOf(
  {
    places,
    renderings,
    position,
  }: {
    readonly places: readonly ConsistencyPlace[];
    readonly renderings: readonly ConsistencyRendering[];
    readonly position: number;
  },
): readonly LocatedPlace[] {
  if (position === (-1))
    return [];
  /**
   The winning place.
   */
  const place = places[position];
  /**
   Its rendering.
   */
  const rendering = renderings[position];
  if ((place === undefined) || (rendering?.kind !== 'located')) {
    throw new ConsistencyInvariantError({ invariant: 'a winner is named only where its own rendering is located', },);
  }
  return [
    {
      place,
      rendering,
    },
  ];
}

/**
 What one place comes to once the winner is known: its provisional outcome, and
 the receiver it makes when the chosen rendering is to be carried to it.

 @param chosen - the winning place, as a list of zero or one

 @param place - the place

 @param position - position of the place among the group's places

 @param count - what the first round's ballots came to

 @param framed - whether the group is a frame with a slot

 @returns The provisional outcome and the receiver, as a list of zero or one

 @example
 ```ts
 const { outcome, receiver, } = plannedPlace({ chosen, place, position: 1, count, framed: false, },);
 ```
 */
export function plannedPlace(
  {
    chosen,
    place,
    position,
    count,
    framed,
  }: {
    readonly chosen: readonly LocatedPlace[];
    readonly place: ConsistencyPlace;
    readonly position: number;
    readonly count: ConsistencyCount;
    readonly framed: boolean;
  },
): {
  readonly outcome: ConsistencyOccurrenceOutcome;
  readonly receiver: readonly CarryReceiver[];
} {
  /**
   This place's rendering.
   */
  const rendering = count.renderings[position];
  /**
   The winner, when there is one.
   */
  const [winning,] = chosen;
  if ((winning === undefined) || (rendering === undefined)) {
    return {
      outcome: 'untouched',
      receiver: [],
    };
  }
  if (winning.place === place) {
    return {
      outcome: 'chosen',
      receiver: [],
    };
  }
  if (rendering.kind === 'unlocated') {
    return {
      outcome: 'unlocated',
      receiver: [],
    };
  }
  if (count.kept[position] === true) {
    return {
      outcome: 'kept-context',
      receiver: [],
    };
  }
  /**
   What putting the chosen words here by code amounts to.
   */
  const plan = planConsistencyEdit({
    chosen: winning.rendering,
    target: rendering,
    framed,
  },);
  if (plan.kind === 'same') {
    return {
      outcome: 'consistent',
      receiver: [],
    };
  }
  return {
    outcome: 'kept-current',
    receiver: [
      {
        place,
        rendering,
        position,
        label: consistencyLabel({ position, },),
        plan,
      },
    ],
  };
}

//endregion Pass consistency decide
