import {
  type CarryBlock,
  carryChoiceOf,
  type CarryOffer,
} from '../consistency-carry.ts';
import type {
  ArtifactConsistencyCandidate,
  ArtifactConsistencyCarry,
  ArtifactConsistencyRepeat,
} from './artifact-two-lane-consistency.ts';
import { askCarryChoice, } from './pass-consistency-carry-ask.ts';
import { occurrenceViewOf, } from './pass-consistency-group.ts';
import type {
  CarryContext,
  CarryReceiver,
  LocatedPlace,
  PendingEdit,
  PlaceCarried,
} from './pass-consistency-types.ts';
import { RUN_PER_CALL_TIMEOUT_MS, } from './run-config.ts';

//region Pass consistency carry choose
// THE BENCH'S CHOICE AMONG A RECEIVING PLACE'S CANDIDATES, and what the choice
// comes to: the carry's record and the replacement the winner makes. A place
// with no alternative to its own English is not put to the bench.

/**
 The record of a carry that ended without a choice among candidates.

 @param label - label of the receiving place

 @param decision - how it ended

 @param candidates - the texts on offer, if any

 @returns The record

 @example
 ```ts
 const carry = carryWithoutChoice({ label: 'OCCURRENCE 2', decision: { kind: 'failed', detail: 'Error', }, candidates: [], },);
 ```
 */
export function carryWithoutChoice(
  {
    label,
    decision,
    candidates,
  }: {
    readonly label: string;
    readonly decision: ArtifactConsistencyCarry['decision'];
    readonly candidates: readonly ArtifactConsistencyCandidate[];
  },
): ArtifactConsistencyCarry {
  return {
    label,
    candidates,
    ballots: [],
    usable: 0,
    quorum: 0,
    decision,
  };
}

/**
 The replacement a winning candidate makes.

 @param receiver - the receiving place

 @param block - the block of the English that holds the words

 @param winner - the candidate the choices named, as a list of zero or one

 @returns A replacement of the words for the splice, of the block for a writer's paragraph, and none when the current paragraph or nobody won

 @example
 ```ts
 const edits = editsOf({ receiver, block, winner: [], },);
 ```
 */
function editsOf(
  {
    receiver,
    block,
    winner,
  }: {
    readonly receiver: CarryReceiver;
    readonly block: CarryBlock;
    readonly winner: readonly CarryOffer[];
  },
): readonly PendingEdit[] {
  /**
   The candidate that won, if any.
   */
  const [named,] = winner;
  if ((named === undefined) || (named.kind === 'current'))
    return [];
  if ((named.kind === 'splice') && (receiver.plan
    .kind
    === 'replace')) {
    return [
      {
        placePosition: receiver.position,
        sliceIndex: receiver.place
          .slice
          .sliceIndex,
        start: receiver.plan
          .start,
        end: receiver.plan
          .end,
        text: receiver.plan
          .text,
      },
    ];
  }
  return [
    {
      placePosition: receiver.position,
      sliceIndex: receiver.place
        .slice
        .sliceIndex,
      start: block.start,
      end: block.end,
      text: named.text,
    },
  ];
}

/**
 Has the bench choose among a receiving place's candidates and turns the choice
 into the record and the replacement.

 @param context - what the carry reads

 @param repeat - the repeated wording or frame

 @param chosen - the chosen place and its located rendering

 @param receiver - the receiving place

 @param block - the block of the English that holds the words

 @param offers - the distinct candidates, the current paragraph among them

 @param findings - what the candidates' making reported

 @returns The carry's record, the replacement it makes and what it reported

 @example
 ```ts
 const carried = await choose({ context, repeat, chosen, receiver, block, offers, findings: [], },);
 ```
 */
export async function choose(
  {
    context,
    repeat,
    chosen,
    receiver,
    block,
    offers,
    findings,
  }: {
    readonly context: CarryContext;
    readonly repeat: ArtifactConsistencyRepeat;
    readonly chosen: LocatedPlace;
    readonly receiver: CarryReceiver;
    readonly block: CarryBlock;
    readonly offers: readonly CarryOffer[];
    readonly findings: readonly string[];
  },
): Promise<PlaceCarried> {
  /**
   The candidates as the artifact records them.
   */
  const candidates = offers.map(function recorded({
    label,
    kind,
    writers,
    text,
  },): ArtifactConsistencyCandidate {
    return {
      label,
      kind,
      writers,
      text,
    };
  },);
  if (offers.length < 2) {
    return {
      carry: carryWithoutChoice({
        label: receiver.label,
        decision: {
          kind: 'none',
          reason: 'no-alternative',
        },
        candidates,
      },),
      edits: [],
      findings,
    };
  }
  /**
   Labels the sheet shows.
   */
  const labels = offers.map(function labelOf({ label, },): string {
    return label;
  },);
  /**
   The judges' choices.
   */
  const asked = await askCarryChoice({
    client: context.client,
    modelIds: context.judgeModelIds,
    subject: {
      repeat,
      receiving: occurrenceViewOf({
        place: receiver.place,
        text: context.text,
      },),
      chosenWords: chosen.rendering
        .core,
      candidates: offers.map(function shown({
        label,
        kind,
        text,
      },) {
        return {
          label,
          current: kind === 'current',
          text,
        };
      },),
      ...((context.identityContext === undefined) ? {} : { identityContext: context.identityContext, }),
      ...((context.referenceContext === undefined) ? {} : { referenceContext: context.referenceContext, }),
      ...((context.lifeEnded === undefined) ? {} : { lifeEnded: context.lifeEnded, }),
      ...((context.subjectNames === undefined) ? {} : { subjectNames: context.subjectNames, }),
    },
    cache: context.cache,
    signal: context.signal,
    exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: context.l,
    stageSettings: context.stageSettings,
  },);
  /**
   What the choices decided.
   */
  const {
    usable,
    choice,
  } = carryChoiceOf({
    voices: asked.voices,
    labels,
    quorum: asked.quorum,
  },);
  return {
    carry: {
      label: receiver.label,
      candidates,
      ballots: asked.voices
        .map(function recordedBallot({
          seat,
          reason,
          choice: chose,
        },) {
          return {
            seat,
            reason,
            choice: chose,
          };
        },),
      usable,
      quorum: asked.quorum,
      decision: choice,
    },
    edits: editsOf({
      receiver,
      block,
      winner: (choice.kind === 'chosen')
        ? offers.filter(function isNamed({ label, },): boolean {
          return label === choice.label;
        },)
        : [],
    },),
    findings: [
      ...findings,
      ...asked.findings,
    ],
  };
}

//endregion Pass consistency carry choose
