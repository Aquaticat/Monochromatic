import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { CarryChoiceSubject, } from '../consistency-carry-choice-sheet.ts';
import {
  carryChoiceOf,
  type CarryOffer,
  carryRunOffFinalistsOf,
} from '../consistency-carry.ts';
import { ConsistencyInvariantError, } from '../consistency-invariant-error.ts';
import type {
  ArtifactConsistencyCandidate,
  ArtifactConsistencyCarry,
  ArtifactConsistencyRepeat,
} from './artifact-two-lane-consistency.ts';
import { askCarryChoice, } from './pass-consistency-carry-ask.ts';
import { shownOf, } from './pass-consistency-carry-offers.ts';
import {
  sliceOfUnit,
  unitLabelsOf,
} from './pass-consistency-carry-units.ts';
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
// the bench. A splice wins for a block that is carried in part: it replaces the
// words of the receiving places code can move the chosen words into, and the places
// it cannot keep their words, which `settleCarried` leaves `kept-current` because no
// replacement names them. The bench's record is the block's, one under each place,
// so the splice stands among the candidates of every place of the block, and a
// finding says which places were carried and which kept their words.

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

 @returns A replacement of the words of each receiving place that has one for the splice, a replacement of the block for a writer's block carrying every receiving place, and none when the current block or nobody won

 @throws {@link ConsistencyInvariantError} when the splice won in a unit none of whose receiving places has words that code can move, since no splice is offered then

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
    /**
     The replacement of each receiving place that has one; a place without one keeps its words.
     */
    const edits = unit.receivers
      .flatMap(function editOf(receiver,): readonly PendingEdit[] {
        /**
         How the chosen words are moved into this place.
         */
        const { plan, } = receiver;
        return (plan.kind === 'replace')
          ? [
            {
              kind: 'splice',
              placePositions: [receiver.position,],
              sliceIndex,
              start: plan.start,
              end: plan.end,
              text: plan.text,
            },
          ]
          : [];
      },);
    if (edits.length === 0) {
      throw new ConsistencyInvariantError({ invariant:
        `the splice won for ${unitLabelsOf({ unit, },)}, none of whose receiving places has words that code can move, and a splice is offered only when some receiving place of the block can be spliced`, },);
    }
    return edits;
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
 The finding for a block the splice carried in part, in the words of the other findings of the carry.

 @param unit - the unit

 @param winner - the candidate the choices named, as a list of zero or one

 @returns A finding, as a list of zero or one, naming the places the chosen words were moved into and the places that kept their words because code cannot move the chosen words into them; none unless the splice won and some receiving place of the block has no replacement

 @example
 ```ts
 const findings = partlyCarriedFindingOf({ unit, winner: [], },);
 ```
 */
function partlyCarriedFindingOf(
  {
    unit,
    winner,
  }: {
    readonly unit: CarryUnit;
    readonly winner: readonly CarryOffer[];
  },
): readonly string[] {
  /**
   The candidate that won, if any.
   */
  const [named,] = winner;
  if (named?.kind !== 'splice')
    return [];
  /**
   Labels of the receiving places the splice moved the chosen words into.
   */
  const carried = unit.receivers
    .filter(function isCarried({ plan, },): boolean {
      return plan.kind === 'replace';
    },)
    .map(function labelOf({ label, },): string {
      return label;
    },);
  /**
   Labels of the receiving places that kept their words.
   */
  const kept = unit.receivers
    .filter(function isKept({ plan, },): boolean {
      return plan.kind !== 'replace';
    },)
    .map(function labelOf({ label, },): string {
      return label;
    },);
  if (kept.length === 0)
    return [];
  return [
    `consistency-partly-carried (${unitLabelsOf({ unit, },)}): the splice won, so code moved the chosen words into `
    + `${carried.join(' and ',)} and left ${kept.join(' and ',)} as it was, since code cannot move them there`,
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
   Logger pre-tagged with this function's name.
   */
  const cl = tagged({
    tag: choose.name,
    l: context.l,
  },);
  /**
   The sheet's subject: what both sheets show of the places and every candidate on offer.
   */
  const subject: CarryChoiceSubject = {
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
  };
  /**
   The judges' choices.
   */
  const asked = await askCarryChoice({
    client: context.client,
    modelIds: context.judgeModelIds,
    subject,
    cache: context.cache,
    signal: context.signal,
    exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: cl,
    stageSettings: context.stageSettings,
  },);
  /**
   What the choices decided.
   */
  const {
    usable: firstUsable,
    choice: firstChoice,
  } = carryChoiceOf({
    voices: asked.voices,
    labels,
    quorum: asked.quorum,
  },);
  /**
   The candidates tied for first when the choices reached the quorum and none has a strict majority, whose run-off the owner's
   rule of 2026-10-11 asks for among contests (the lead's adoption of 2026-10-15 for this ask, open to the owner's veto).
   */
  const finalists = carryRunOffFinalistsOf({
    voices: asked.voices,
    labels,
    quorum: asked.quorum,
  },);
  if (finalists.length > 0) {
    cl.info(
      `the choice among the candidates had no strict majority (${String(firstUsable,)} usable); asking the bench once more among the tied ${
        finalists.join(' and ',)
      }`,
    );
  }
  /**
   The bench asked once more among the candidates that tied, absent when none tied. Its sheet shows those candidates only,
   under the labels they had, and its answer is kept under a key of its own.
   */
  const runOffAsked = (finalists.length === 0)
    ? undefined
    : await askCarryChoice({
      client: context.client,
      modelIds: context.judgeModelIds,
      subject: {
        ...subject,
        candidates: subject.candidates
          .filter(function isFinalist({ label, },): boolean {
            return finalists.includes(label,);
          },),
      },
      cache: context.cache,
      signal: context.signal,
      exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
      l: cl,
      stageSettings: context.stageSettings,
      runOff: true,
    },);
  /**
   What the run-off's choices decided, counted against the finalists only with the run-off's own quorum; a second split keeps
   the page as it stands.
   */
  const runOffCounted = (runOffAsked === undefined)
    ? undefined
    : carryChoiceOf({
      voices: runOffAsked.voices,
      labels: finalists,
      quorum: runOffAsked.quorum,
    },);
  /**
   What the carry came to: the run-off's count when there was a run-off, the first count otherwise.
   */
  const choice = runOffCounted?.choice ?? firstChoice;
  if ((runOffAsked !== undefined) && (runOffCounted !== undefined)) {
    cl.info(
      `the run-off among the candidates counted ${String(runOffCounted.usable,)} usable of ${
        String(runOffAsked.voices
          .length,)
      } heard (quorum ${String(runOffAsked.quorum,)}): ${
        (runOffCounted.choice
          .kind
          === 'chosen') ? `${runOffCounted.choice.label} won` : `no winner (${runOffCounted.choice.reason})`
      }`,
    );
  }
  /**
   The candidate the choices named, as a list of zero or one.
   */
  const winner = (choice.kind === 'chosen')
    ? offers.filter(function isNamed({ label, },): boolean {
      return label === choice.label;
    },)
    : [];
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
        usable: firstUsable,
        quorum: asked.quorum,
        ...((runOffAsked === undefined) ? {} : {
          runOff: {
            finalists,
            ballots: runOffAsked.voices
              .map(function recordedRunOffBallot({
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
            usable: runOffCounted?.usable ?? 0,
            quorum: runOffAsked.quorum,
          },
        }),
        decision: choice,
      };
    },),
    edits: editsOf({
      unit,
      winner,
    },),
    findings: [
      ...findings,
      ...asked.findings,
      ...(runOffAsked?.findings ?? []),
      ...partlyCarriedFindingOf({
        unit,
        winner,
      },),
    ],
  };
}

//endregion Pass consistency carry choose
