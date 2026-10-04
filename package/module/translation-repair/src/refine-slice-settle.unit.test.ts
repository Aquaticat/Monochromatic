/**
 Tests that the naturalness lane's slice settler does not stop on the critics'
 non-translation votes (ledger L15).

 WHY THIS FILE WAS WRONG. It was written on 2026-08-24 to defend an early
 return that deleting left the whole suite green, on the reading that a slice
 the critics ruled non-translation "shipped deliberately untouched". That had
 stopped being true on 2026-08-16: question 3, answer B
 (`doc/decision/translation-repair-question-answers.md`) keeps critics as
 evidence "rather than deciding anything", removes every early return they
 owned, and `05ff9791e` stopped `repairChunk` returning its input unchanged
 when the votes stand. This early return was the one left: over every
 artifact, 10 of 6,150 slices had standing votes, the repair lane changed 8
 of them, and none of the 9 in runs that refine was refined.

 SO BOTH CASES REACH THE CLIENT. A client that throws on any exchange makes
 reaching a model observable; a slice standing as non-translation must reach
 it exactly as the same slice without the ruling does.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  EMPTY_INTRODUCED_DEFECT_REPORT,
  messageText,
  settleRefinedSlice,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ChunkRepairOutcome,
  type RepairModels,
  type RosterModelId,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';
import {
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from './roster-seats.test-fixture.ts';

/**
 Logger for the settler under test.
 */
const l = tagged({ tag: 'refine-slice-settle-test', },);

/**
 Repaired slice text, one long single-line paragraph so the lane finds it
 eligible and would reach a rewriter.
 */
const REPAIRED_TEXT =
  'The cat is doing the sunbathing on the windowsill in every afternoon, and when the light is moving across the floor she is following it without any hurry at all.';

/**
 Original this slice was repaired against.
 */
const SOURCE_TEXT = '猫猫每天下午都在窗台上晒太阳。';

/**
 Message the refusing client throws with, so a case can tell its own refusal
 apart from any other failure.
 */
const CLIENT_WAS_REACHED = 'the refusing client was asked for a completion';

/**
 Model this lane hands a paragraph to for rewriting, named once so the roster
 and the finding a case reads both spell the same id.
 */
const REFINER: RosterModelId = SEAT_HYPER_OPENROUTER_VISION_EDITOR;

/**
 Refiner roster, one model so a lost voice leaves no quorum and the stage's
 own account of what happened is unambiguous.
 */
const REFINERS: readonly RosterModelId[] = [REFINER,];

/**
 Roster with the lane on and refiners disjoint from checkers, as production
 runs it.
 */
const MODELS: RepairModels = {
  criticModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  panelModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  editorModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
  judgeModelIds: [
    SEAT_HYPER_OPENROUTER_VISION_EDITOR,
    SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
    SEAT_SYNTHETIC_VISION_WITHHELD,
  ],
  refinerModelIds: REFINERS,
  checkerModelIds: [
    SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
    SEAT_SYNTHETIC_VISION_WITHHELD,
  ],
};

/**
 Client that throws on any exchange, so reaching a model is observable.

 NOT A RECORDING CLIENT. A counter would say how many calls happened and
 would let a case pass while quietly buying something; throwing makes the
 first call end the settlement, which is what the assertion is about.
 */
const REFUSING_CLIENT: SyntheticClient = {
  chatText(): never {
    throw new Error(CLIENT_WAS_REACHED,);
  },
  chatJson(): never {
    throw new Error(CLIENT_WAS_REACHED,);
  },
  quotas(): never {
    throw new Error(CLIENT_WAS_REACHED,);
  },
};

/**
 Client that scripts every stage the settle asks and records the sheet of
 every call, so a case can read what the flow asked in order.
 */
function scriptedSettleClient({ asked, worseTally = false, }: {
  readonly asked: string[];
  readonly worseTally?: boolean;
},): SyntheticClient {
  return {
    chatText(): never {
      throw new Error(CLIENT_WAS_REACHED,);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       Last message, the sheet the stage composes.
       */
      const last = request.messages.at(-1,);
      asked.push((last === undefined) ? '' : messageText({ message: last, },));
      /**
       Replies this call's guard accepts, tried in the flow's order.
       */
      const candidates: readonly unknown[] = [
        {
          rewrites: [{
            paragraph: 1,
            newText: `${REPAIRED_TEXT} Rewritten for flow.`,
          },],
        },
        {
          best: 1,
          reason: 'scripted',
        },
        ...(worseTally
          ? [{
            checks: [{
              issue: 1,
              verdict: 'worse',
            },],
          },]
          : []),
        EMPTY_INTRODUCED_DEFECT_REPORT,
      ];
      for (const candidate of candidates) {
        if (request.validate(candidate,))
          return {
            kind: 'ok',
            value: candidate as ValueT,
            rawText: JSON.stringify(candidate,),
          };
      }
      return {
        kind: 'schema-mismatch',
        rawText: '',
        detail: 'no scripted reply validated',
      };
    },
    quotas(): never {
      throw new Error(CLIENT_WAS_REACHED,);
    },
  };
}

/**
 Builds one settled accuracy outcome, standing as a translation or not.

 @param nonTranslationStanding - whether the critics' non-translation ruling
 survived contradiction, which is the one field these cases differ on

 @returns Outcome the lane would refine

 @example
 ```ts
 const outcome = settledOutcome({ nonTranslationStanding: true, },);
 ```
 */
function settledOutcome(
  { nonTranslationStanding, }: { readonly nonTranslationStanding: boolean; },
): ChunkRepairOutcome {
  return {
    sliceIndex: 0,
    repairedText: REPAIRED_TEXT,
    changed: false,
    issues: [],
    resolvedIssueIds: [],
    candidateResolvedIssueIds: [],
    checkerReadings: {},
    recheckReadings: {},
    repairRegions: [],
    authorship: {
      perIssue: {},
      everyIssue: [],
    },
    accuracyPatchSelected: false,
    refined: false,
    rounds: [],
    droppedDeclaredNames: [],
    nonTranslationVotes: nonTranslationStanding ? 2 : 0,
    nonTranslationContradicted: false,
    nonTranslationStanding,
    heardCritics: 1,
    heardCriticIds: [],
    claimAttributions: [],
    findings: [],
  };
}

/**
 Settles one slice against the refusing client.

 @param nonTranslationStanding - whether this slice stands as non-translation

 @returns What the lane settled on

 @example
 ```ts
 const settled = await settleWith({ nonTranslationStanding: true, },);
 ```
 */
async function settleWith(
  {
    nonTranslationStanding,
    client = REFUSING_CLIENT,
    neighbouringSourceText,
    neighbouringIncumbentText,
    identityContext,
    referenceContext,
    issues,
  }: {
    readonly nonTranslationStanding: boolean;
    readonly client?: SyntheticClient;
    readonly neighbouringSourceText?: string;
    readonly neighbouringIncumbentText?: string;
    readonly identityContext?: string;
    readonly referenceContext?: string;
    readonly issues?: ChunkRepairOutcome['issues'];
  },
): Promise<Awaited<ReturnType<typeof settleRefinedSlice>>> {
  return await settleRefinedSlice({
    client,
    outcome: {
      ...settledOutcome({ nonTranslationStanding, },),
      ...(issues === undefined ? {} : { issues, }),
    },
    sourceText: SOURCE_TEXT,
    incumbentText: REPAIRED_TEXT,
    definitions: '',
    models: MODELS,
    refinerModelIds: REFINERS,
    declaredNames: [],
    ...(neighbouringSourceText === undefined ? {} : { neighbouringSourceText, }),
    ...(neighbouringIncumbentText === undefined ? {} : { neighbouringIncumbentText, }),
    ...(identityContext === undefined ? {} : { identityContext, }),
    ...(referenceContext === undefined ? {} : { referenceContext, }),
    signal: AbortSignal.timeout(30_000,),
    perCallTimeoutMs: 1_000,
    l,
  },);
}

await describe({
  name: settleRefinedSlice.name,
  children: [
    it({
      name: 'REACHES THE CLIENT for a slice standing as non-translation: the votes are evidence for the judges, '
        + 'not a stop (question 3, answer B), so the lane asks its rewriter as it would for any slice',
      fn: async () => {
        /**
         Settlement of a slice the critics ruled non-translation.
         */
        const settled = await settleWith({ nonTranslationStanding: true, },);

        expect(settled.asked,).toBe(true,);
        expect(settled.findings,)
          .toContain(`stage-voice-lost (refiner ${REFINER})`,);
        expect(settled.refinedBy,).toEqual([],);
        expect(settled.refinersHeard,).toEqual([],);
      },
    },),

    it({
      name: 'REACHES THE CLIENT for the same slice without the ruling, the same way. The refiner stage '
        + 'catches the refusal and records it as a lost voice, so what the client saw is legible in the '
        + 'findings rather than in an exception',
      fn: async () => {
        /**
         Settlement of the same slice with the ruling lifted.
         */
        const settled = await settleWith({ nonTranslationStanding: false, },);

        expect(settled.asked,).toBe(true,);
        expect(settled.findings,)
          .toContain(`stage-voice-lost (refiner ${REFINER})`,);
        expect(settled.refinedBy,).toEqual([],);
        // The one refiner's voice was lost, so nobody was heard either.
        expect(settled.refinersHeard,).toEqual([],);
      },
    },),

    it({
      name: 'CARRIES the neighbouring slice\'s source and incumbent onto the sheet it asks, so a rewrite '
        + 'dropping repetition reads against its neighbour',
      fn: async () => {
        /**
         Sheets the flow asked, in order.
         */
        const asked: string[] = [];
        await settleWith({
          nonTranslationStanding: true,
          client: scriptedSettleClient({ asked, },),
          neighbouringSourceText: '邻猫每天下午都在窗台上晒太阳。',
          neighbouringIncumbentText: 'The neighbouring cat naps there too.',
        },);
        expect(asked.some(function carriesNeighbour(sheet,) {
          return sheet.includes('邻猫每天下午都在窗台上晒太阳。',)
            && sheet.includes('The neighbouring cat naps there too.',);
        },),).toBe(true,);
      },
    },),

    it({
      name: 'CARRIES no neighbour onto the sheet when the slice stands alone, the spreads staying absent',
      fn: async () => {
        /**
         Sheets the flow asked with no neighbour handed in.
         */
        const asked: string[] = [];
        await settleWith({
          nonTranslationStanding: true,
          client: scriptedSettleClient({ asked, },),
        },);
        expect(asked.length,).toBeGreaterThan(0,);
        expect(asked.some(function carriesNeighbour(sheet,) {
          return sheet.includes('邻猫每天下午都在窗台上晒太阳。',);
        },),).toBe(false,);
      },
    },),

    it({
      name: 'CARRIES the identity and reference contexts onto the sheets it asks, and none where none '
        + 'was handed in',
      fn: async () => {
        /**
         Sheets the flow asked with both contexts in.
         */
        const asked: string[] = [];
        await settleWith({
          nonTranslationStanding: true,
          client: scriptedSettleClient({ asked, },),
          identityContext: 'The translator signs as 喵工作室.',
          referenceContext: 'Cat naps are documented in the glossary.',
        },);
        expect(asked.some(function carriesBoth(sheet,) {
          return sheet.includes('喵工作室',)
            && sheet.includes('Cat naps are documented in the glossary.',);
        },),).toBe(true,);
        /**
         Sheets the same flow collects with no context in.
         */
        const plain: string[] = [];
        await settleWith({
          nonTranslationStanding: true,
          client: scriptedSettleClient({ asked: plain, },),
        },);
        expect(plain.some(function carriesEither(sheet,) {
          return sheet.includes('喵工作室',)
            || sheet.includes('Cat naps are documented in the glossary.',);
        },),).toBe(false,);
      },
    },),

    it({
      name: 'COUNTS an open issue no checker tally names as not worsened, and rolls back only where a '
        + 'tally says a checker found it worse',
      fn: async () => {
        /**
         Accepted issue the rewrite left open.
         */
        const issues = [{
          issueId: 'issue/1',
          status: 'accepted',
          severity: 'minor',
          claims: [],
          tallies: {},
        },] as unknown as ChunkRepairOutcome['issues'];
        /**
         Recheck whose checkers named nothing: the tally reads zero worse.
         */
        const quiet = await settleWith({
          nonTranslationStanding: false,
          client: scriptedSettleClient({ asked: [], },),
          issues,
          identityContext: 'The translator signs as 喵工作室.',
          referenceContext: 'Cat naps are documented in the glossary.',
        },);
        expect(quiet.findings
          .some(function passed(finding,) {
            return finding.startsWith('refine-recheck-passed',);
          },),).toBe(true,);
        /**
         Recheck whose checkers named the issue worse.
         */
        const loud = await settleWith({
          nonTranslationStanding: false,
          client: scriptedSettleClient({
            asked: [],
            worseTally: true,
          },),
          issues,
          identityContext: 'The translator signs as 喵工作室.',
          referenceContext: 'Cat naps are documented in the glossary.',
        },);
        expect(loud.findings
          .some(function rolledBack(finding,) {
            return finding.startsWith('refine-rolled-back',)
              && finding.includes('issue/1',);
          },),).toBe(true,);
      },
    },),
  ],
},);
