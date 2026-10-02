/**
 Guards the owner's answer of 2026-09-27 ("Preference + polish", fifteenth
 addendum of `doc/decision/translation-repair-ineligible-standing.md`): over
 wording that cannot ship, a slate the judges decline in both rounds ships
 one valid candidate by the tenth addendum's order (the repair lane's text,
 the translate lane's, then slate order) instead of stopping the entry, the
 reasons of the ballots that did not back it go to the polish as objections,
 and the judges are told what a decline now does. On the translate lane the
 same holds where the archive's own wording fails the deterministic floor
 (sixteenth addendum). A passage with no wording at all still raises.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ConsolidationSettlement,
  judgeSlateWithRetry,
  laneCandidate,
  type LaneText,
  messageText,
  produceTranslateSlate,
  type RosterModelId,
  runTranslateStage,
  settleConsolidation,
  type SyntheticClient,
  TranslateAbsenceError,
  type TranslateStageResult,
} from '../dist/final/node/index.mjs';
import {
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from './roster-seats.test-fixture.ts';

/**
 Logger the stages write through, whose output is not under test.
 */
const l = tagged({ tag: 'slate-decline-ships-by-preference-test', },);

/**
 Invented original: the cat dozed on the sill, tail by the radiator.
 */
const SOURCE = '猫猫在窗台上打盹，尾巴垂在暖气片旁边。';

/**
 What every judge says against every candidate.
 */
const REJECTION = 'Every candidate adds that the cat purred, which the original never states.';

/**
 Finding a slate shipped past two declines records, before its basis.
 */
const SHIPPED_PAST_DECLINE = 'translate-slate-declined-shipped-by-preference';

/**
 Translators, whose renderings come back in call order.
 */
const TRANSLATORS: readonly RosterModelId[] = [
  'hf:cat/Cat-A',
  'hf:cat/Cat-B',
].map(function toId(id,) {
  return id as unknown as RosterModelId;
},);

/**
 Judges who rendered nothing, so every ballot carries a whole weight.
 */
const JUDGES: readonly RosterModelId[] = [
  'hf:cat/Cat-C',
  'hf:cat/Cat-F',
  'hf:cat/Cat-G',
].map(function toId(id,) {
  return id as unknown as RosterModelId;
},);

/**
 What the translators render.
 */
const RENDERINGS: readonly string[] = [
  'The cat dozes on the windowsill, tail draped beside the radiator.',
  'A cat naps on the sill, its tail hanging near the heater.',
];

/**
 Repair lane text on the slate.
 */
const REPAIR_LANE: LaneText = {
  lane: 'repair',
  text: 'The cat curls up on the ledge, tail tucked by the warmth.',
};

/**
 Translate lane text on the slate.
 */
const TRANSLATE_LANE: LaneText = {
  lane: 'translate',
  text: 'The cat yawns on the sill, tail resting against the pipe.',
};

/**
 Consolidation the voices propose.
 */
const FRESH = 'The cat dozed on the windowsill, its tail hanging by the radiator.';

/**
 Client under which every judge rejects every candidate, recording what the
 judges and the refiners were shown.

 @param judgeSheets - where each slate judge sheet is recorded

 @param refinerSheets - where each refiner sheet is recorded

 @param rejection - reason every rejecting judge gives

 @returns Client over every stage these guards reach

 @example
 ```ts
 const client = rejectingClient({ judgeSheets: [], refinerSheets: [], },);
 ```
 */
function rejectingClient(
  {
    judgeSheets,
    refinerSheets,
    rejection = REJECTION,
  }: {
    readonly judgeSheets: string[];
    readonly refinerSheets: string[];
    readonly rejection?: string;
  },
): SyntheticClient {
  /**
   Translator calls served so far.
   */
  const served = { count: 0, };
  return {
    chatText: async () => {
      throw new Error('chatText unused by these stages',);
    },
    quotas: async () => {
      throw new Error('quotas unused by these stages',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       Stage the request belongs to, by its reply schema.
       */
      const schema = request.responseFormat?.json_schema.name ?? '';
      /**
       Sheet as the voice reads it.
       */
      const sheet = request.messages
        .map(function textOf(message,): string {
          return messageText({ message, },);
        },)
        .join('\n',);
      if (schema === 'candidate_ballot')
        judgeSheets.push(sheet,);
      if (schema === 'refine_report')
        refinerSheets.push(sheet,);
      /**
       Rendering a translator call gets.
       */
      const rendering = RENDERINGS[served.count % RENDERINGS.length] ?? '';
      if (schema === 'translation_report')
        served.count += 1;
      /**
       Reply for the stage.
       */
      const value: unknown = (schema === 'translation_report')
        ? { translation: rendering, }
        : (schema === 'candidate_ballot')
        ? {
          best: 0,
          reason: rejection,
        }
        : (schema === 'consolidate_gate')
        ? {
          choice: 'consolidated',
          unsupported: [],
          dropped: [],
          reason: 'faithful',
        }
        : (schema === 'refine_report')
        ? { rewrites: [], }
        : (schema === 'absolute_naturalness_review')
        ? {
          acceptable: true,
          findings: [],
          reason: 'publication-ready',
        }
        : undefined;
      if (value === undefined)
        throw new Error(`no fixture reply for ${schema}`,);
      if (!request.validate(value,))
        throw new Error(`fixture ${schema} reply failed validation`,);
      return {
        kind: 'ok',
        value: value as ValueT,
        rawText: JSON.stringify(value,),
      };
    },
  };
}

/**
 Judges a produced slate with both lane texts on it, every judge rejecting.

 @param withheldStanding - whether the passage has wording that cannot ship,
 or none is passed at all

 @param judgeSheets - where each judge sheet is recorded

 @param judgeModelIds - judges the slate seats, the roster's by default

 @param rejection - reason every judge gives, the fixture's rejection when
 left out

 @returns What the retry settled on

 @example
 ```ts
 const result = await judgedRejecting({ withheldStanding: true, judgeSheets: [], },);
 ```
 */
async function judgedRejecting(
  {
    withheldStanding,
    judgeSheets,
    judgeModelIds = JUDGES,
    rejection,
  }: {
    readonly withheldStanding?: boolean;
    readonly judgeSheets: string[];
    readonly judgeModelIds?: readonly RosterModelId[];
    readonly rejection?: string;
  },
): Promise<TranslateStageResult> {
  /**
   Client every judge rejects under.
   */
  const client = rejectingClient({
    judgeSheets,
    refinerSheets: [],
    ...((rejection === undefined) ? {} : { rejection, }),
  },);
  /**
   Slate the translators produced.
   */
  const produced = await produceTranslateSlate({
    client,
    translatorModelIds: TRANSLATORS,
    sourceText: SOURCE,
    incumbentText: '',
    lineStructured: false,
    signal: AbortSignal.timeout(30_000,),
    perCallTimeoutMs: 5_000,
    l,
  },);
  /**
   Slate with both lane texts after the proposals, as the consolidation
   offers them.
   */
  const withLanes = {
    ...produced,
    candidates: [
      ...produced.candidates,
      ...[
        REPAIR_LANE,
        TRANSLATE_LANE,
      ].map(function asLaneCandidate(laneText,) {
        return laneCandidate(laneText,);
      },),
    ],
  };
  return await judgeSlateWithRetry({
    judging: {
      client,
      produced: withLanes,
      judgeModelIds,
      sourceText: SOURCE,
      incumbentText: '',
      incumbentKind: 'absent',
      lineStructured: false,
      ...((withheldStanding === undefined) ? {} : { withheldStanding, }),
      signal: AbortSignal.timeout(30_000,),
      perCallTimeoutMs: 5_000,
      l,
    },
  },);
}

/**
 Roster of three seated voices for the consolidation.
 */
const ROSTER = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
] as const;

/**
 Settles a slice over an ineligible standing with every slate judge
 rejecting.

 @param refinerSheets - where each refiner sheet is recorded

 @returns Settlement

 @example
 ```ts
 const settled = await settleRejected({ refinerSheets: [], },);
 ```
 */
async function settleRejected(
  { refinerSheets, }: { readonly refinerSheets: string[]; },
): Promise<ConsolidationSettlement> {
  return await settleConsolidation({
    client: rejectingClient({
      judgeSheets: [],
      refinerSheets,
    },),
    roster: ROSTER,
    subject: {
      sourceText: SOURCE,
      incumbentText: 'The cat dozed on the windowsill and purred for you.',
    },
    voices: [{
      modelId: ROSTER[0],
      value: { translation: FRESH, },
    },],
    validity: [{
      modelId: ROSTER[0],
      validation: {
        kind: 'valid',
        pageGrammar: 'strict',
      },
    },],
    producedFindings: [],
    standingText: 'The cat dozed on the windowsill and purred for you.',
    lineStructured: false,
    sliceIndex: 4,
    polishConfig: {
      refinerModelIds: [ROSTER[0],],
      judgeModelIds: ROSTER,
      gateModelIds: ROSTER,
      declaredNames: [],
      definitions: '',
    },
    standingMayShip: false,
    standingEligible: false,
    standingRefusal: 'the pronoun is left untranslated',
    signal: AbortSignal.timeout(40_000,),
    perCallTimeoutMs: 5_000,
    l,
  },);
}

await describe({
  name: 'a slate declined twice over wording that cannot ship ships by preference (owner, 2026-09-27)',
  children: [
    it({
      name: 'SHIPS the repair lane text past two rejections, carrying the rejecting reasons as objections, and '
        + 'tells the judges what a decline does',
      fn: async () => {
        /**
         Every judge sheet the judging sent.
         */
        const judgeSheets: string[] = [];
        const result = await judgedRejecting({
          withheldStanding: true,
          judgeSheets,
        },);
        expect(result.text,).toBe(REPAIR_LANE.text,);
        expect(result.findings.includes(`${SHIPPED_PAST_DECLINE} (repair lane)`,),).toBe(true,);
        expect(result.shippedPastDecline?.objections.includes(REJECTION,),).toBe(true,);
        expect(judgeSheets.length,).toBeGreaterThan(0,);
        expect(judgeSheets.every(function toldPreference(sheet,): boolean {
          return (sheet.includes('the wording in place cannot ship',))
            && (!sheet.includes('there is no existing translation of this passage',));
        },),).toBe(true,);
      },
    },),
    it({
      name: 'SHIPS THE REPAIR LANE TEXT WITH NO WEIGHT AND NO OBJECTIONS where no judge sat: the round declined '
        + 'before counting any candidate',
      fn: async () => {
        /**
         Every judge sheet the judging sent, which stays empty.
         */
        const judgeSheets: string[] = [];
        const result = await judgedRejecting({
          withheldStanding: true,
          judgeSheets,
          judgeModelIds: [],
        },);
        expect({
          text: result.text,
          voteWeight: result.voteWeight,
          shippedPastDecline: result.shippedPastDecline,
          judgeSheets,
        },).toEqual({
          text: REPAIR_LANE.text,
          voteWeight: 0,
          shippedPastDecline: {
            basis: 'repair lane',
            objections: [],
          },
          judgeSheets: [],
        },);
      },
    },),
    it({
      name: 'RECORDS NO OBJECTION from a rejection whose reason is invisible characters alone, which trim() keeps '
        + 'and no refiner could read (ledger B40)',
      fn: async () => {
        const result = await judgedRejecting({
          withheldStanding: true,
          judgeSheets: [],
          rejection: '\u{200B}\u{3164}',
        },);
        expect(result.shippedPastDecline,).toEqual({
          basis: 'repair lane',
          objections: [],
        },);
      },
    },),
    it({
      name: 'STILL RAISES where the passage has no wording at all',
      fn: async () => {
        /**
         What the judging raised, if anything.
         */
        const raised = await (async function attempt(): Promise<unknown> {
          try {
            await judgedRejecting({ judgeSheets: [], },);
            return 'settled';
          }
          catch (error) {
            return error;
          }
        })();
        expect(raised instanceof TranslateAbsenceError,).toBe(true,);
      },
    },),
    it({
      name: 'SHIPS a rendering on the translate lane past two rejections where the archive wording fails the '
        + 'deterministic floor',
      fn: async () => {
        const result = await runTranslateStage({
          client: rejectingClient({
            judgeSheets: [],
            refinerSheets: [],
          },),
          translatorModelIds: TRANSLATORS,
          judgeModelIds: JUDGES,
          sourceText: SOURCE,
          // The original left in Han, which the untranslated floor refuses.
          incumbentText: SOURCE,
          incumbentKind: 'present',
          lineStructured: false,
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);
        expect(RENDERINGS.includes(result.text,),).toBe(true,);
        expect(result.findings.includes(`${SHIPPED_PAST_DECLINE} (slate order)`,),).toBe(true,);
      },
    },),
    it({
      name: 'SHIPS the consolidation past two rejections over an ineligible standing and sends the slate\'s '
        + 'reasons to the polish',
      fn: async () => {
        /**
         Every refiner sheet the settlement sent.
         */
        const refinerSheets: string[] = [];
        const settled = await settleRejected({ refinerSheets, },);
        expect(settled.terminal,).toBe('consolidated',);
        expect(refinerSheets.length,).toBeGreaterThan(0,);
        expect(refinerSheets.every(function carriesSlateObjection(sheet,): boolean {
          return sheet.includes('OBJECTIONS FROM THE CONSOLIDATION SLATE',) && sheet.includes(REJECTION,);
        },),).toBe(true,);
        expect(settled.findings.some(function namesSlateObjections(finding,): boolean {
          return finding.startsWith('polish-objection-correction',) && finding.includes('consolidation slate',);
        },),).toBe(true,);
      },
    },),
  ],
},);
