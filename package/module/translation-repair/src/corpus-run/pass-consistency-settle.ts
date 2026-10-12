import { countConsistency, } from '../consistency-count.ts';
import type { ConsistencyRendering, } from '../consistency-count-types.ts';
import { planConsistencyEdit, } from '../consistency-splice.ts';
import { consistencyLabel, } from '../consistency-wire.ts';
import type { RepeatGroup, } from '../repeat-groups-types.ts';
import type {
  ArtifactConsistencyBallot,
  ArtifactConsistencyUnplaced,
  ArtifactConsistencyVerdict,
  ConsistencyNotAskedReason,
  ConsistencyOccurrenceOutcome,
  ArtifactConsistencyRepeat
} from './artifact-two-lane-consistency.ts';
import type { ConsistencyAsked, } from './pass-consistency-ask.ts';
import type { ConsistencyPlace, } from './pass-consistency-group.ts';
import { ConsistencyInvariantError, } from '../consistency-invariant-error.ts';

//region Pass consistency settle
// WHAT A GROUP COMES TO once its ballots are counted: a verdict, a rendering
// and a provisional outcome for each place, and the replacements the winner
// would make. The outcomes become final in `pass-consistency-apply.ts`, where
// replacements meet each other and the floors.

/**
 One replacement a group would make, before the floors have spoken.

 @example
 ```ts
 const edit: PendingEdit = { placePosition: 1, sliceIndex: 3, start: 0, end: 12, text: 'the cat naps', };
 ```
 */
export type PendingEdit = {
  /**
   Position of the receiving place among the group's places.
   */
  readonly placePosition: number;

  /**
   Slice the replacement is made in.
   */
  readonly sliceIndex: number;

  /**
   Offset in the slice's English where the replaced words start.
   */
  readonly start: number;

  /**
   Exclusive offset where they end.
   */
  readonly end: number;

  /**
   The words that go in.
   */
  readonly text: string;
};

/**
 A group with its verdict, its places' renderings and outcomes, and its pending replacements.

 @example
 ```ts
 const settled: SettledGroup = { repeat, places, unplaced, verdict, renderings: [], outcomes: [], edits: [], findings: [], };
 ```
 */
export type SettledGroup = {
  /**
   The repeated wording or frame.
   */
  readonly repeat: ArtifactConsistencyRepeat;

  /**
   The places a slice holds whole, in page order.
   */
  readonly places: readonly ConsistencyPlace[];

  /**
   The places no slice holds whole.
   */
  readonly unplaced: readonly ArtifactConsistencyUnplaced[];

  /**
   What was asked of the bench and what it answered.
   */
  readonly verdict: ArtifactConsistencyVerdict;

  /**
   Each place's rendering, in the order of the places.
   */
  readonly renderings: readonly ConsistencyRendering[];

  /**
   Each place's outcome so far, in the order of the places; `replaced` is
   provisional until the floors have spoken.
   */
  readonly outcomes: readonly ConsistencyOccurrenceOutcome[];

  /**
   The replacements the winner would make.
   */
  readonly edits: readonly PendingEdit[];

  /**
   What the gather reported.
   */
  readonly findings: readonly string[];
};

/**
 The places no slice holds whole, as the artifact records them.

 @param group - repeat group of the original

 @returns One entry per place the detector left unplaced

 @example
 ```ts
 const unplaced = unplacedOf({ group, },);
 ```
 */
export function unplacedOf({ group, }: { readonly group: RepeatGroup; },): readonly ArtifactConsistencyUnplaced[] {
  return group.unplaced
    .map(function toUnplaced(place,): ArtifactConsistencyUnplaced {
      return {
        startOffset: place.startOffset,
        endOffset: place.endOffset,
        line: place.line,
        reason: place.reason,
      };
    },);
}

/**
 Settles a group the bench is not asked about.

 @param repeat - the repeated wording or frame

 @param places - the places a slice holds whole

 @param unplaced - the places no slice holds whole

 @param reason - why the bench is not asked

 @returns The group with every place left as it stands, or all consistent

 @example
 ```ts
 const settled = settleUnasked({ repeat, places, unplaced, reason: 'consistent', },);
 ```
 */
export function settleUnasked(
  {
    repeat,
    places,
    unplaced,
    reason,
  }: {
    readonly repeat: ArtifactConsistencyRepeat;
    readonly places: readonly ConsistencyPlace[];
    readonly unplaced: readonly ArtifactConsistencyUnplaced[];
    readonly reason: ConsistencyNotAskedReason;
  },
): SettledGroup {
  return {
    repeat,
    places,
    unplaced,
    verdict: {
      kind: 'not-asked',
      reason,
    },
    renderings: places.map(function notLooked(): ConsistencyRendering {
      return {
        kind: 'unlocated',
        reason: 'not-asked',
      };
    },),
    outcomes: places.map(function outcomeOf(): ConsistencyOccurrenceOutcome {
      return (reason === 'consistent') ? 'consistent' : 'untouched';
    },),
    edits: [],
    findings: [],
  };
}

/**
 Settles a group whose handling failed: every place stays as it stands.

 @param repeat - the repeated wording or frame

 @param places - the places a slice holds whole

 @param unplaced - the places no slice holds whole

 @param detail - what went wrong, naming no corpus text

 @returns The group with every place left as it stands

 @example
 ```ts
 const settled = settleFailed({ repeat, places, unplaced, detail: 'Error', },);
 ```
 */
export function settleFailed(
  {
    repeat,
    places,
    unplaced,
    detail,
  }: {
    readonly repeat: ArtifactConsistencyRepeat;
    readonly places: readonly ConsistencyPlace[];
    readonly unplaced: readonly ArtifactConsistencyUnplaced[];
    readonly detail: string;
  },
): SettledGroup {
  return {
    ...settleUnasked({
      repeat,
      places,
      unplaced,
      reason: 'too-few-placed',
    },),
    verdict: {
      kind: 'failed',
      detail,
    },
  };
}

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
 Counts what the bench said about a group and plans what the winner would change.

 @param repeat - the repeated wording or frame

 @param places - the places a slice holds whole

 @param unplaced - the places no slice holds whole

 @param asked - the ballots heard, the quorum and the gather's findings

 @returns The group with its verdict, renderings, provisional outcomes and pending replacements

 @example
 ```ts
 const settled = settleAsked({ repeat, places, unplaced, asked, },);
 ```
 */
export function settleAsked(
  {
    repeat,
    places,
    unplaced,
    asked,
  }: {
    readonly repeat: ArtifactConsistencyRepeat;
    readonly places: readonly ConsistencyPlace[];
    readonly unplaced: readonly ArtifactConsistencyUnplaced[];
    readonly asked: ConsistencyAsked;
  },
): SettledGroup {
  /**
   What the usable ballots come to.
   */
  const count = countConsistency({
    voices: asked.voices,
    places: places.map(function placeOf(
      place,
      position,
    ) {
      return {
        label: consistencyLabel({ position, },),
        english: place.slice
          .current,
      };
    },),
    framed: repeat.kind === 'refrain',
    quorum: asked.quorum,
  },);
  /**
   Rendering of the winning place, absent when no place won.
   */
  const chosen = count.renderings
    .find(function isChosen(
      _rendering,
      position,
    ): boolean {
      return (count.winner
        .kind
        === 'chosen') && (count.winner
          .label
          === consistencyLabel({ position, },));
    },);
  /**
   Replacements the winner would make, and every place's provisional outcome.
   */
  const planned = places.map(function planFor(
    place,
    position,
  ): {
    readonly outcome: ConsistencyOccurrenceOutcome;
    readonly edits: readonly PendingEdit[];
  } {
    /**
     This place's rendering and whether a majority keeps it.
     */
    const rendering = count.renderings[position];
    if ((chosen === undefined) || (rendering === undefined)) {
      return {
        outcome: 'untouched',
        edits: [],
      };
    }
    if (rendering === chosen) {
      return {
        outcome: 'chosen',
        edits: [],
      };
    }
    if (rendering.kind === 'unlocated') {
      return {
        outcome: 'unlocated',
        edits: [],
      };
    }
    if (count.kept[position] === true) {
      return {
        outcome: 'kept-context',
        edits: [],
      };
    }
    if (chosen.kind !== 'located') {
      throw new ConsistencyInvariantError({ invariant: 'a winner is named only where its own rendering is located', },);
    }
    /**
     What putting the chosen words here amounts to.
     */
    const plan = planConsistencyEdit({
      chosen,
      target: rendering,
    },);
    if (plan.kind === 'same') {
      return {
        outcome: 'consistent',
        edits: [],
      };
    }
    return {
      outcome: 'replaced',
      edits: [
        {
          placePosition: position,
          sliceIndex: place.slice
            .sliceIndex,
          start: plan.start,
          end: plan.end,
          text: plan.text,
        },
      ],
    };
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
      winner: count.winner,
    },
    renderings: count.renderings,
    outcomes: planned.map(function outcomeOf(entry,): ConsistencyOccurrenceOutcome {
      return entry.outcome;
    },),
    edits: planned.flatMap(function editsOf(entry,): readonly PendingEdit[] {
      return entry.edits;
    },),
    findings: asked.findings,
  };
}

//endregion Pass consistency settle
