/**
 * Tests for the section-pairing round: what the roster has to agree on before a
 * correspondence is kept, and what happens when it agrees on nothing.
 *
 * WHY AGREEMENT IS PER PAIR, as at block scale: two models can agree on seven
 * correspondences and differ on the eighth, and discarding both replies over
 * the eighth throws away the seven.
 *
 * WHY THE FILTER CANNOT BREAK THE STEP BUILDER. Every pairing the reader passed
 * is strictly increasing on both sides, and a subsequence of a strictly
 * increasing sequence is strictly increasing, so no vote count can produce a
 * pairing `sectionPairingToSteps` would refuse. One case here reads that off a
 * disagreement rather than trusting the argument.
 *
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
  createSyntheticClient,
  pairSectionsWithRoster,
} from '../dist/final/node/index.mjs';

/**
 * Three original sections standing in for a Chinese page.
 */
const SOURCE = [
  {
    index: 0,
    text: '## 第一节\n\n猫猫在窗台上打盹。',
  },
  {
    index: 1,
    text: '## 第二节\n\n窗台上有一只鸟。',
  },
  {
    index: 2,
    text: '## 第三节\n\n猫猫也喜欢晒太阳。',
  },
];

/**
 * Three translation sections sharing no token with any of them, which is the
 * corpus condition the round exists for.
 */
const TARGET = [
  {
    index: 0,
    text: '## Naps\n\nThe cat naps on the windowsill.',
  },
  {
    index: 1,
    text: '## Birds\n\nA bird sits on the windowsill.',
  },
  {
    index: 2,
    text: '## Sunbeams\n\nThe cat likes the sun too.',
  },
];

/**
 * Roster of two, which is the smallest that can agree or disagree.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.8-27B',
] as const;

/**
 * Logger for the stage under test.
 */
const l = tagged({ tag: 'pair-sections-stage-test', },);

/**
 * Per-call bound, generous because the transport answers instantly.
 */
const EXCHANGE_TIMEOUT_MS = 5_000;

/**
 * Builds a client whose models reply with the given pairings, in roster order.
 *
 * @param replyByModel - reply body per model id
 *
 * @returns Client over a canned transport
 *
 * @example
 * ```ts
 * const client = cannedClient({ replyByModel: ['{"pairs":[]}'], },);
 * ```
 */
function cannedClient(
  { replyByModel, }: { readonly replyByModel: readonly string[]; },
) {
  /**
   * Calls served so far, so each model gets its own reply.
   */
  const served: string[] = [];
  return createSyntheticClient({
    apiKey: 'test-key',
    transport: async function cannedTransport(exchange,) {
      /**
       * Which reply this call receives.
       */
      const at = served.length;
      served.push(exchange.label,);

      /**
       * This model's reply text.
       */
      const content = replyByModel[at] ?? replyByModel[0] ?? '';

      // THE CLIENT READS A STREAM, not a completion body: one delta frame and
      // the terminator, which is the smallest well-formed reply.
      return {
        status: 200,
        bodyText: `data: ${
          JSON.stringify({
            choices: [
              {
                index: 0,
                delta: { content, },
              },
            ],
          },)
        }\n\ndata: [DONE]\n\n`,
      };
    },
  },);
}

/**
 * Runs one round over the three-by-three fixture.
 *
 * @param replyByModel - reply body per model id
 *
 * @returns What the roster settled on
 *
 * @example
 * ```ts
 * const outcome = await roundOf(['{"pairs":[]}',],);
 * ```
 */
async function roundOf(replyByModel: readonly string[],) {
  return await pairSectionsWithRoster({
    client: cannedClient({ replyByModel, },),
    modelIds: ROSTER,
    sourceSections: SOURCE,
    targetSections: TARGET,
    signal: new AbortController().signal,
    exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
    l,
  },);
}

await describe({
  name: pairSectionsWithRoster.name,
  children: [
    it({
      name: 'KEEPS a correspondence both voices named',
      fn: async () => {
        const outcome = await roundOf([
          '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
          '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
        ],);
        expect(outcome.pairs.length,).toBe(2,);
        expect(outcome.usable,).toBe(2,);
        expect(outcome.heard,).toBe(2,);
      },
    },),

    it({
      name: 'KEEPS a correspondence two later voices named though the first voice omitted it, since '
        + 'agreement is per pair and not per reply (`#245`)',
      fn: async () => {
        const outcome = await pairSectionsWithRoster({
          client: cannedClient({
            replyByModel: [
              '{"pairs":[{"source":0,"target":0}]}',
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
            ],
          },),
          modelIds: [...ROSTER, 'hf:openai/gpt-oss-120b',],
          sourceSections: SOURCE,
          targetSections: TARGET,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
        },);
        expect(outcome.usable,).toBe(3,);
        expect(outcome.pairs,).toEqual([
          {
            source: 0,
            target: 0,
          },
          {
            source: 1,
            target: 1,
          },
        ],);
      },
    },),
    it({
      name: 'DROPS a correspondence only one voice named, and keeps the ones they agreed on, since '
        + 'discarding both replies over one disagreement throws away the rest',
      fn: async () => {
        const outcome = await roundOf([
          '{"pairs":[{"source":0,"target":0},{"source":2,"target":2}]}',
          '{"pairs":[{"source":0,"target":0},{"source":1,"target":2}]}',
        ],);
        expect(outcome.pairs,).toEqual([{
          source: 0,
          target: 0,
        },],);
      },
    },),

    it({
      name: 'LEAVES the surviving pairs strictly increasing on both sides even where the two voices '
        + 'disagreed in the middle, so no vote count can produce a pairing the step builder would '
        + 'refuse',
      fn: async () => {
        const outcome = await roundOf([
          '{"pairs":[{"source":0,"target":0},{"source":1,"target":1},{"source":2,"target":2}]}',
          '{"pairs":[{"source":0,"target":0},{"source":2,"target":2}]}',
        ],);
        expect(outcome.pairs,).toEqual([
          {
            source: 0,
            target: 0,
          },
          {
            source: 2,
            target: 2,
          },
        ],);
      },
    },),

    it({
      name: 'TREATS an unusable reply as a lost voice rather than a stage failure, so the rest of '
        + 'the roster can still settle the document, and NAMES the voice that failed',
      fn: async () => {
        const outcome = await roundOf([
          '{"pairs":[{"source":9,"target":0}]}',
          '{"pairs":[{"source":0,"target":0}]}',
        ],);
        expect(outcome.usable,).toBe(1,);
        expect(outcome.findings
          .some(function namesTheVoice(finding,): boolean {
            return finding.startsWith(`section-pairing unusable (${ROSTER[0]}`,);
          },),).toBe(true,);
      },
    },),

    it({
      name: 'AGREES ON NOTHING when only one voice was usable, because a pairing one model invented '
        + 'is exactly the risk two-voice agreement exists to refuse',
      fn: async () => {
        const outcome = await roundOf([
          'not a pairing at all',
          '{"pairs":[{"source":0,"target":0}]}',
        ],);
        expect(outcome.usable,).toBe(1,);
        expect(outcome.pairs.length,).toBe(0,);
      },
    },),

    it({
      name: 'REPORTS no-usable-voice with both counts when every voice ANSWERED and none survived '
        + 'the reader, which is a roster that was reachable and wrong rather than absent',
      fn: async () => {
        const outcome = await roundOf(['{"pairs":[{"source":9,"target":0}]}',],);
        expect(outcome.heard,).toBe(ROSTER.length,);
        expect(outcome.usable,).toBe(0,);
        expect(outcome.pairs.length,).toBe(0,);
        expect(outcome.findings,).toContain(
          `section-pairing no-usable-voice (${String(ROSTER.length,)} heard of ${
            String(ROSTER.length,)
          })`,
        );
      },
    },),

    it({
      name: 'SEPARATES a roster nothing was heard from, whose reply never reached the reader at '
        + 'all, so the count an operator reads names the right failure',
      fn: async () => {
        const outcome = await roundOf(['not a pairing at all',],);
        expect(outcome.heard,).toBe(0,);
        expect(outcome.findings,).toContain(
          `section-pairing no-usable-voice (0 heard of ${String(ROSTER.length,)})`,
        );
      },
    },),

    it({
      name: 'ACCEPTS a roster that answered and committed to nothing, which is a real answer about '
        + 'these two documents rather than a failure',
      fn: async () => {
        const outcome = await roundOf(['{"pairs":[]}',],);
        expect(outcome.usable,).toBe(2,);
        expect(outcome.pairs.length,).toBe(0,);
        expect(outcome.findings.length,).toBe(0,);
      },
    },),
  ],
},);
