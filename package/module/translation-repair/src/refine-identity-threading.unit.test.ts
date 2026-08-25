/**
 * Tests that the repair driver's refinement STEP hands the declared-name block
 * down to the sheet the rewriters actually read.
 *
 * WHY A SEPARATE FILE FROM `refine-window-threading.unit.test.ts`. That one
 * drives `runRefinePhase`, one layer below this. The link measured missing here
 * is `refineSettledSlices`, the wrapper the repair driver calls, and every case
 * in that file passes whether or not this wrapper forwards anything: it calls
 * the phase itself.
 *
 * WHAT WAS MEASURED. On 2026-08-25, inverting this wrapper's conditional spread
 * so the identity block is forwarded only when it is ABSENT failed no test in
 * this package. The rewriters would then be asked to improve how a memorial
 * page reads while being told nothing about which names and handles must
 * survive exactly, which is the protection `#137` and `#143` put there.
 *
 * THE FAILURE MODE IS INVISIBLE TO EVERY OTHER KIND OF TEST, for the reason
 * `#68` records: the block is an optional property spread into an object
 * literal, TypeScript does not excess-property-check a spread, and the sheet
 * still renders without it. A wrapper that forwarded nothing compiled, linted
 * and passed its own suite while asking the models a strictly smaller question.
 *
 * BOTH DIRECTIONS ARE PINNED. A document declaring nothing must get no block at
 * all rather than an empty heading, so the case that asserts the heading is
 * present is read against a control that asserts it is absent; without the
 * control, a wrapper that pasted the heading unconditionally would pass.
 *
 * NO NETWORK. The client scripts the rewriter, the judges and the probe, and
 * records every rewriter sheet.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
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
  type ChunkPair,
  type ChunkRepairOutcome,
  messageText,
  refineSettledSlices,
  type RepairModels,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the step under test.
 */
const l = tagged({ tag: 'refine-identity-threading-test', },);

//region Fixtures

/**
 * Heading the rewriter sheet gives the declared-name block.
 */
const IDENTITY_FENCE = 'DECLARED NAMES AND HANDLES, which must survive exactly:';

/**
 * Marker no prompt constant and no other fixture carries, so a match in a sheet
 * can only have come from the identity block.
 */
const IDENTITY_MARK = 'ZQIDENT';

/**
 * Declared names as front matter yields them, carrying the marker.
 */
const IDENTITY_CONTEXT = `- name: Mittens ${IDENTITY_MARK}\n- alias: sunbeam-cat`;

/**
 * Long single-line paragraph, which is the shape the lane finds refinable.
 */
const ARCHIVE_PARAGRAPH =
  'The cat is doing the sunbathing on the windowsill in every afternoon, and when the light is moving across the floor she is following it without any hurry at all.';

/**
 * Invented original of the same slice.
 */
const SOURCE_PARAGRAPH = '猫猫每天下午都在窗台上晒太阳。';

/**
 * Smoother rendering the scripted rewriter returns.
 */
const SMOOTH_TEXT =
  'The cat sunbathes on the windowsill every afternoon, and when the light moves across the floor she follows it without hurry.';

/**
 * Roster with the lane on, refiners disjoint from checkers as the phase
 * requires.
 */
const MODELS: RepairModels = {
  criticModelIds: ['hf:zai-org/GLM-5.2',],
  panelModelIds: ['hf:zai-org/GLM-5.2',],
  editorModelIds: ['hf:zai-org/GLM-5.2',],
  judgeModelIds: [
    'hf:zai-org/GLM-5.2',
    'hf:Qwen/Qwen3.8-27B',
    'hf:moonshotai/Kimi-K3',
    'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  ],
  refinerModelIds: ['hf:zai-org/GLM-5.2',],
  checkerModelIds: [
    'hf:Qwen/Qwen3.8-27B',
    'hf:moonshotai/Kimi-K3',
    'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  ],
};

/**
 * The one slice every case here refines.
 */
const SLICES: readonly ChunkPair[] = [
  {
    source: {
      sliceIndex: 0,
      text: SOURCE_PARAGRAPH,
      startOffset: 0,
      endOffset: SOURCE_PARAGRAPH.length,
      nodes: [],
    },
    target: {
      sliceIndex: 0,
      text: ARCHIVE_PARAGRAPH,
      startOffset: 0,
      endOffset: ARCHIVE_PARAGRAPH.length,
      nodes: [],
    },
  },
];

/**
 * Settled accuracy outcome the step refines.
 */
const OUTCOMES: readonly ChunkRepairOutcome[] = [
  {
    sliceIndex: 0,
    repairedText: ARCHIVE_PARAGRAPH,
    changed: false,
    issues: [],
    resolvedIssueIds: [],
    candidateResolvedIssueIds: [],
    // No checker round in this fixture, so nothing was said about any issue.
    checkerReadings: {},
    recheckReadings: {},
    repairRegions: [],
    accuracyPatchSelected: false,
    refined: false,
    rounds: [],
    droppedDeclaredNames: [],
    // Hand-written fixture text, so nothing here has a model author.
    authorship: {
      perIssue: {},
      everyIssue: [],
    },
    nonTranslationVotes: 0,
    nonTranslationContradicted: false,
    nonTranslationStanding: false,
    heardCritics: 1,
    heardCriticIds: [],
    claimAttributions: [],
    findings: [],
  },
];

/**
 * Runs the step and returns every sheet its rewriters were asked.
 *
 * @param identityContext - declared names to thread, absent for the control
 *
 * @returns User sheets of the rewriter exchanges, in order
 *
 * @example
 * ```ts
 * const sheets = await rewriterSheets({ identityContext: IDENTITY_CONTEXT, },);
 * ```
 */
async function rewriterSheets(
  { identityContext, }: { readonly identityContext?: string; },
): Promise<readonly string[]> {
  /**
   * User sheet of every rewriter exchange, in order.
   */
  const asked: string[] = [];

  /**
   * Client scripting each stage by the schema it asks for.
   */
  const client: SyntheticClient = {
    chatText: async () => {
      throw new Error('chatText unused by the step',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Stage name from the structured-output constraint.
       */
      const stage = request.responseFormat
        ?.json_schema
        .name
        ?? '';

      /**
       * User prompt of this exchange.
       */
      const last = request.messages.at(-1,);
      const content = (last === undefined) ? '' : messageText({ message: last, },);
      if (stage === 'refine_report')
        asked.push(content,);

      /**
       * Scripted reply for the stage.
       */
      const scripted: unknown = stage === 'refine_report'
        ? {
          rewrites: [
            {
              paragraph: 1,
              newText: SMOOTH_TEXT,
            },
          ],
        }
        : stage === 'candidate_ballot'
        ? {
          best: 1,
          reason: 'scripted',
        }
        : stage === 'introduced_defect_report'
        ? {
          checks: [
            {
              region: 1,
              verdict: 'no-introduced-defect-found',
              category: '',
              severity: '',
              evidence: '',
              omittedText: '',
              reason: '',
            },
          ],
        }
        : { checks: [], };
      if (!request.validate(scripted,))
        throw new Error(`stub script failed the ${stage} guard`,);
      return {
        kind: 'ok',
        value: scripted,
        rawText: JSON.stringify(scripted,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by the step',);
    },
  };

  await refineSettledSlices({
    client,
    targetText: ARCHIVE_PARAGRAPH,
    slices: SLICES,
    outcomes: OUTCOMES,
    models: MODELS,
    ...(identityContext === undefined ? {} : { identityContext, }),
    declaredNames: [],
    signal: AbortSignal.timeout(120_000,),
    perCallTimeoutMs: 30_000,
    l,
  },);

  return asked;
}

//endregion Fixtures

await describe({
  name: refineSettledSlices.name,
  children: [
    it({
      name: 'HANDS THE DECLARED NAMES DOWN to the rewriter sheet, so a lane asked to improve how a '
        + 'memorial page reads is told which names and handles must survive it exactly',
      fn: async () => {
        /**
         * Sheets the rewriters were asked with the block threaded.
         */
        const sheets = await rewriterSheets({ identityContext: IDENTITY_CONTEXT, },);

        expect(sheets.length,).toBeGreaterThan(0,);
        for (const sheet of sheets) {
          expect(sheet.includes(IDENTITY_FENCE,),).toBe(true,);
          expect(sheet.includes(IDENTITY_MARK,),).toBe(true,);
        }
      },
    },),
    it({
      name: 'SENDS NO BLOCK AT ALL when the document declares nothing, which is the control that '
        + 'makes the case above legible: a step pasting the heading unconditionally would satisfy it',
      fn: async () => {
        /**
         * Sheets the rewriters were asked with nothing declared.
         */
        const sheets = await rewriterSheets({},);

        expect(sheets.length,).toBeGreaterThan(0,);
        for (const sheet of sheets) {
          expect(sheet.includes(IDENTITY_FENCE,),).toBe(false,);
          expect(sheet.includes(IDENTITY_MARK,),).toBe(false,);
        }
      },
    },),
  ],
},);
