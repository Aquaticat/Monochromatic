/**
 * Tests for the naturalness refinement stage over a scripted client.
 * Fixtures are cat-themed invention mirroring corpus structure only.
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
  deriveRefinableEnvelopes,
  EditorRosterError,
  parseDocument,
  runRefineStage,
  type SyntheticClient,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the stage under test.
 */
const l = tagged({ tag: 'refine-stage-test', },);

/**
 * Original the refinement is checked against.
 */
const SOURCE_TEXT = '猫猫每天下午都在窗台上晒太阳，光移动的时候她也跟着移动。';

/**
 * Repaired slice, one long single-line paragraph so it clears eligibility.
 */
const REPAIRED_TEXT =
  'The cat is doing the sunbathing on the windowsill in every afternoon, and when the light is moving across the floor she is following it without any hurry at all.';

/**
 * A more natural rendering carrying the same content.
 */
const SMOOTH_TEXT =
  'The cat sunbathes on the windowsill every afternoon, and when the light moves across the floor she follows it without hurry.';

/**
 * Roster judges are drawn from.
 */
const JUDGES: readonly SyntheticModelId[] = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.6-27B',
  'hf:moonshotai/Kimi-K3',
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
];

/**
 * Refiners proposing rewrites.
 */
const REFINERS: readonly SyntheticModelId[] = ['hf:zai-org/GLM-5.2',];

/**
 * Envelopes and definitions of the repaired fixture slice.
 *
 * @returns Refinable slice derived from the fixture
 *
 * @example
 * ```ts
 * const slice = fixtureSlice();
 * ```
 */
function fixtureSlice() {
  return deriveRefinableEnvelopes({ document: parseDocument({ text: REPAIRED_TEXT, },), },);
}

/**
 * Client scripting one rewriter reply and one ballot per judge.
 *
 * @param newText - replacement the rewriter proposes, absent to propose none
 *
 * @param ballot - one-based candidate index every judge names, zero to decline
 *
 * @returns Client usable by the refinement stage
 *
 * @example
 * ```ts
 * const client = scriptedRefiner({ newText: SMOOTH_TEXT, ballot: 1, },);
 * ```
 */
function scriptedRefiner(
  {
    newText,
    ballot,
  }: {
    readonly newText?: string;
    readonly ballot: number;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by refinement',);
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
       * Scripted reply for the stage.
       */
      const scripted: unknown = stage === 'refine_report'
        ? {
          rewrites: newText === undefined ? [] : [
            {
              paragraph: 1,
              newText,
            },
          ],
        }
        : {
          best: ballot,
          reason: 'scripted',
        };
      if (!request.validate(scripted,))
        throw new Error(`stub script failed the ${stage} guard`,);
      return {
        kind: 'ok',
        value: scripted,
        rawText: JSON.stringify(scripted,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by refinement',);
    },
  };
}

/**
 * Runs the stage over the fixture slice.
 *
 * @param client - scripted client
 *
 * @returns Stage result
 *
 * @example
 * ```ts
 * const result = await runFixture(scriptedRefiner({ ballot: 1, },),);
 * ```
 */
async function runFixture(client: SyntheticClient,) {
  /** Envelopes and definitions of the fixture. */
  const slice = fixtureSlice();
  return runRefineStage({
    client,
    refinerModelIds: REFINERS,
    judgeModelIds: JUDGES,
    sourceText: SOURCE_TEXT,
    repairedText: REPAIRED_TEXT,
    envelopes: slice.envelopes,
    definitions: slice.definitions,
    signal: new AbortController().signal,
    perCallTimeoutMs: 1_000,
    l,
  },);
}

await describe({
  name: deriveRefinableEnvelopes.name,
  children: [
    it({
      name: 'derives one envelope for the eligible paragraph and hashes its base',
      fn: async () => {
        /** Refinable slice of the fixture. */
        const slice = fixtureSlice();
        expect(slice.envelopes.length,).toBe(1,);
        expect(slice.envelopes[0]?.baseText,).toBe(REPAIRED_TEXT,);
        expect((slice.envelopes[0]?.baseHash ?? '').length,).toBeGreaterThan(0,);
      },
    },),
  ],
},);

await describe({
  name: runRefineStage.name,
  children: [
    it({
      name: 'ships a refinement the judges chose',
      fn: async () => {
        /** Run where the rewriter proposes and judges agree. */
        const result = await runFixture(scriptedRefiner({
          newText: SMOOTH_TEXT,
          ballot: 1,
        },),);
        expect(result.changed,).toBe(true,);
        expect(result.refinedText,).toBe(SMOOTH_TEXT,);
        expect([...result.contributors,],).toEqual(['hf:zai-org/GLM-5.2',],);
      },
    },),

    it({
      name: 'keeps the repaired text when judges decline, since nothing ever '
        + 'claimed that text was wrong',
      fn: async () => {
        /** Run where every judge declines. */
        const result = await runFixture(scriptedRefiner({
          newText: SMOOTH_TEXT,
          ballot: 0,
        },),);
        expect(result.changed,).toBe(false,);
        expect(result.refinedText,).toBe(REPAIRED_TEXT,);
        expect(result.contributors.length,).toBe(0,);
      },
    },),

    it({
      name: 'keeps the repaired text when the rewriter proposes nothing, which '
        + 'is the expected answer rather than a degraded one',
      fn: async () => {
        /** Run where the rewriter returns an empty list. */
        const result = await runFixture(scriptedRefiner({ ballot: 1, },),);
        expect(result.changed,).toBe(false,);
        expect(result.refinedText,).toBe(REPAIRED_TEXT,);
        expect(
          result.findings
            .some(function mentionsCandidates(finding,) {
              return finding.includes('refine-candidates',);
            },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'refuses a rewrite that dropped a protected atom, even when the '
        + 'judges would have taken it',
      fn: async () => {
        /**
         * Repaired text carrying a number, and a rewrite that loses it.
         */
        const withNumber = `${REPAIRED_TEXT} She was 17 that year.`;

        /** Refinable slice of the numbered fixture. */
        const slice = deriveRefinableEnvelopes({
          document: parseDocument({ text: withNumber, },),
        },);

        /** Run whose rewrite silently drops the age. */
        const result = await runRefineStage({
          client: scriptedRefiner({
            newText: `${SMOOTH_TEXT} She was young that year.`,
            ballot: 1,
          },),
          refinerModelIds: REFINERS,
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          repairedText: withNumber,
          envelopes: slice.envelopes,
          definitions: slice.definitions,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect(result.changed,).toBe(false,);
        expect(result.refinedText,).toBe(withNumber,);
      },
    },),

    it({
      name: 'refuses a roster that could never reach the minimum weight, '
        + 'since two refiners grading only each other can award one vote '
        + 'between them and every round would decline in silence',
      fn: async () => {
        /** Refinable slice of the fixture. */
        const slice = fixtureSlice();
        await expect(
          runRefineStage({
            client: scriptedRefiner({ ballot: 1, },),
            refinerModelIds: [
              'hf:zai-org/GLM-5.2',
              'hf:Qwen/Qwen3.6-27B',
            ],
            judgeModelIds: [
              'hf:zai-org/GLM-5.2',
              'hf:Qwen/Qwen3.6-27B',
            ],
            sourceText: SOURCE_TEXT,
            repairedText: REPAIRED_TEXT,
            envelopes: slice.envelopes,
            definitions: slice.definitions,
            signal: new AbortController().signal,
            perCallTimeoutMs: 1_000,
            l,
          },),
        ).rejects.toThrow(EditorRosterError,);
      },
    },),
  ],
},);
