import {
  carryChoiceOf,
  type CarryOffer,
} from '../consistency-carry.ts';
import { ConsistencyInvariantError, } from '../consistency-invariant-error.ts';
import type {
  ArtifactConsistencyCandidate,
  ArtifactConsistencyCarry,
  ArtifactConsistencyRepeat,
} from './artifact-two-lane-consistency.ts';
import { askCarryChoice, } from './pass-consistency-carry-ask.ts';
import { shownOf, } from './pass-consistency-carry-offers.ts';
import { sliceOfUnit, } from './pass-consistency-carry-units.ts';
import type {
  CarryContext,
  CarryUnit,
  LocatedPlace,
  PendingEdit,
  UnitCarried,
} from './pass-consistency-types.ts';
import { RUN_PER_CALL_TIMEOUT_MS, } from './run-config.ts';

//region Pass consistency carry choose
// THE BENCH'S CHOICE AMONG A BLOCK'S CANDIDATES, and what the choice comes to:
// the carry's record for each receiving place of the block and the replacements
// the winner makes. A block with no alternative to its own English is not put to
// the bench.

/**
 The record of a carry that ended without a choice among candidates, once for
 each receiving place of its unit.

 @param labels - labels of the receiving places

 @param decision - how it ended

 @param candidates - the texts on offer, if any

 @returns The record under each label

 @example
 ```ts
 const carries = carryWithoutChoice({ labels: ['OCCURRENCE 2',], decision: { kind: 'failed', detail: 'Error', }, candidates: [], },);
 ```
 */
export function carryWithoutChoice(
  {
    labels,
    decision,
    candidates,
  }: {
    readonly labels: readonly string[];
    readonly decision: ArtifactConsistencyCarry['decision'];
    readonly candidates: readonly ArtifactConsistencyCandidate[];
  },
): readonly ArtifactConsistencyCarry[] {
  return labels.map(function carryOf(label,): ArtifactConsistencyCarry {
    return {
      label,
      candidates,
      ballots: [],
      usable: 0,
      quorum: 0,
      decision,
    };
  },);
}

/**
 The replacements a winning candidate makes.

 @param unit - the unit

 @param winner - the candidate the choices named, as a list of zero or one

 @returns A replacement of the words of each receiving place for the splice, a replacement of the block for a writer's block carrying every receiving place, and none when the current block or nobody won

 @throws {@link ConsistencyInvariantError} when the splice won in a unit with a receiving place whose words cannot be moved by code, since no splice is offered then

 @example
 ```ts
 const edits = editsOf({ unit, winner: [], },);
 ```
 */
function editsOf(
  {
    unit,
    winner,
  }: {
    readonly unit: CarryUnit;
    readonly winner: readonly CarryOffer[];
  },
): readonly PendingEdit[] {
  /**
   The candidate that won, if any.
   */
  const [named,] = winner;
  if ((named === undefined) || (named.kind === 'current'))
    return [];
  /**
   The slice the block stands in.
   */
  const { sliceIndex, } = sliceOfUnit({ unit, },);
  if (named.kind === 'splice') {
    return unit.receivers
      .map(function editOf(receiver,): PendingEdit {
        /**
         How the chosen words are moved into this place.
         */
        const { plan, } = receiver;
        if (plan.kind !== 'replace') {
          throw new ConsistencyInvariantError({ invariant:
            `the splice won for ${receiver.label}, whose words cannot be moved by code, and a splice is offered only when every receiving place of the block can be spliced`, },);
        }
        return {
          kind: 'splice',
          placePositions: [receiver.position,],
          sliceIndex,
          start: plan.start,
          end: plan.end,
          text: plan.text,
        };
      },);
  }
  return [
    {
      kind: 'block',
      placePositions: unit.receivers
        .map(function positionOf({ position, },): number {
          return position;
        },),
      sliceIndex,
      start: unit.block
        .start,
      end: unit.block
        .end,
      text: named.text,
    },
  ];
}

/**
 Has the bench choose among a block's candidates and turns the choice into the
 records and the replacements.

 @param context - what the carry reads

 @param repeat - the repeated wording or frame

 @param chosen - the chosen place and its located rendering

 @param unit - the unit

 @param offers - the distinct candidates, the current block among them

 @param findings - what the candidates' making reported

 @returns The carry's record for each receiving place, the replacements it makes and what it reported

 @example
 ```ts
 const carried = await choose({ context, repeat, chosen, unit, offers, findings: [], },);
 ```
 */
export async function choose(
  {
    context,
    repeat,
    chosen,
    unit,
    offers,
    findings,
  }: {
    readonly context: CarryContext;
    readonly repeat: ArtifactConsistencyRepeat;
    readonly chosen: LocatedPlace;
    readonly unit: CarryUnit;
    readonly offers: readonly CarryOffer[];
    readonly findings: readonly string[];
  },
): Promise<UnitCarried> {
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
  /**
   Labels of the receiving places, whose records are one.
   */
  const placeLabels = unit.receivers
    .map(function labelOf({ label, },): string {
      return label;
    },);
  if (offers.length < 2) {
    return {
      carries: carryWithoutChoice({
        labels: placeLabels,
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
   What both sheets of the carry show of the places.
   */
  const shown = shownOf({
    context,
    repeat,
    chosen,
    unit,
  },);
  /**
   The judges' choices.
   */
  const asked = await askCarryChoice({
    client: context.client,
    modelIds: context.judgeModelIds,
    subject: {
      repeat,
      receiving: shown.receiving,
      chosen: shown.chosen,
      keeping: shown.keeping,
      ...((shown.before === undefined) ? {} : { before: shown.before, }),
      ...((shown.after === undefined) ? {} : { after: shown.after, }),
      candidates: offers.map(function shownCandidate({
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
    carries: placeLabels.map(function carryOf(label,): ArtifactConsistencyCarry {
      return {
        label,
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
      };
    },),
    edits: editsOf({
      unit,
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
