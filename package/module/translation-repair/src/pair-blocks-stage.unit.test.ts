/**
 * Tests for the pairing stage: what the roster has to agree on before a
 * correspondence is kept, and what happens when it agrees on nothing.
 *
 * WHY AGREEMENT IS PER PAIR. Two models can agree on nine correspondences and
 * differ on the tenth, and discarding both replies over the tenth throws away
 * the nine. The stage counts each `source,target` on its own.
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
  pairBlocksWithRoster,
} from '../dist/final/node/index.mjs';

/**
 * Two blocks standing in for an original side.
 */
const SOURCE = [
  {
    index: 0,
    text: '猫睡了。',
  },
  {
    index: 1,
    text: '它喜欢盒子。',
  },
];

/**
 * Two blocks standing in for a translation.
 */
const TARGET = [
  {
    index: 0,
    text: 'The cat slept.',
  },
  {
    index: 1,
    text: 'She loves boxes.',
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
const l = tagged({ tag: 'pair-blocks-stage-test', },);

/**
 * Per-call bound, generous because the transport answers instantly.
 */
const EXCHANGE_TIMEOUT_MS = 5_000;

/**
 * Builds a client whose every model replies with the given pairing JSON.
 *
 * @param replyByModel - reply body per model id, in roster order
 *
 * @returns Client over a canned transport
 *
 * @example
 * ```ts
 * const client = cannedClient({ replyByModel: ['{"pairs":[]}', '{"pairs":[]}'], },);
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

await describe({
  name: pairBlocksWithRoster.name,
  children: [
    it({
      name: 'KEEPS a correspondence both voices named',
      fn: async () => {
        const outcome = await pairBlocksWithRoster({
          client: cannedClient({
            replyByModel: [
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
            ],
          },),
          modelIds: ROSTER,
          sourceBlocks: SOURCE,
          targetBlocks: TARGET,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
        },);
        expect(outcome.pairs.length,).toBe(2,);
        expect(outcome.usable,).toBe(2,);
      },
    },),
    it({
      name: 'DROPS a correspondence only one voice named',
      fn: async () => {
        const outcome = await pairBlocksWithRoster({
          client: cannedClient({
            replyByModel: [
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
              '{"pairs":[{"source":0,"target":0}]}',
            ],
          },),
          modelIds: ROSTER,
          sourceBlocks: SOURCE,
          targetBlocks: TARGET,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
        },);
        expect(outcome.pairs.length,).toBe(1,);
        expect(outcome.pairs[0]?.source,).toBe(0,);
      },
    },),
    it({
      name: 'RETURNS no pairs and says so when every reply is unusable',
      fn: async () => {
        const outcome = await pairBlocksWithRoster({
          client: cannedClient({
            replyByModel: [
              '{"pairs":[{"source":9,"target":0}]}',
              '{"pairs":[{"source":9,"target":0}]}',
            ],
          },),
          modelIds: ROSTER,
          sourceBlocks: SOURCE,
          targetBlocks: TARGET,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
        },);
        expect(outcome.pairs.length,).toBe(0,);
        expect(outcome.usable,).toBe(0,);
        expect(outcome.findings.join(' ',),).toContain('no-usable-voice',);
      },
    },),
  ],
},);
