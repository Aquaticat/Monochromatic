/**
 * Tests for the shell that buys a pairing and hands it to preparation.
 *
 * WHAT THESE PIN is the two things a settled entry now keeps about its pairing:
 * the correspondences themselves, echoed back out of the map preparation
 * consumed, and how many voices stood behind them, which was logged and never
 * recorded. A section two voices paired and one six voices paired are different
 * evidence about the same slicing.
 *
 * THE VOICE COUNT CARRIES ITS SECTION. The stage is asked one section at a time
 * and cannot say which, so counts filed from there would arrive as a run of
 * identical-shaped lines naming no section at all.
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
  prepareDocumentPairWithRoster,
} from '../dist/final/node/index.mjs';

/**
 * Original side, two blocks so the section is worth a question.
 */
const SOURCE_TEXT = '猫睡在盒子里。\n\n它整个下午都没有动。';

/**
 * Translation side, two blocks against the two originals.
 */
const TARGET_TEXT = 'The cat slept in the box.\n\nShe did not move all afternoon.';

/**
 * Roster of two, which is the smallest that can agree.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.8-27B',
] as const;

/**
 * Logger for the shell under test.
 */
const l = tagged({ tag: 'prepare-with-pairing-test', },);

/**
 * Per-call bound, generous because the transport answers instantly.
 */
const EXCHANGE_TIMEOUT_MS = 5_000;

/**
 * Builds a client whose models reply in turn with the given bodies.
 *
 * @param replyByModel - reply body per call, in the order calls are made
 *
 * @returns Client over a canned transport
 *
 * @example
 * ```ts
 * const client = cannedClient({ replyByModel: ['{"pairs":[]}',], },);
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
  name: prepareDocumentPairWithRoster.name,
  children: [
    it({
      name:
        'ECHOES THE AGREED PAIRING back on the preparation, so the record a settled entry keeps is the '
        + 'object slicing consumed rather than a second copy assembled beside it',
      fn: async () => {
        const { prepared, } = await prepareDocumentPairWithRoster({
          client: cannedClient({
            replyByModel: [
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
            ],
          },),
          modelIds: ROSTER,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
        },);
        expect(prepared.blockPairing,).toEqual([{
          sectionIndex: 0,
          pairs: [
            {
              source: 0,
              target: 0,
            },
            {
              source: 1,
              target: 1,
            },
          ],
        },],);
      },
    },),
    it({
      name:
        'RECORDS HOW MANY VOICES AGREED, naming the section, and files it on the channel that reaches the '
        + 'artifact rather than only on the log nobody keeps',
      fn: async () => {
        const {
          prepared,
          findings,
        } = await prepareDocumentPairWithRoster({
          client: cannedClient({
            replyByModel: [
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
              '{"pairs":[{"source":0,"target":0},{"source":1,"target":1}]}',
            ],
          },),
          modelIds: ROSTER,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
        },);

        /**
         * What the counts have to say, section and all.
         */
        const expected = 'block-pairing section 0 paired 2 of 2 original and 2 translation blocks, '
          + 'from 2 usable voices of 2 heard';
        expect(findings,).toContain(expected,);

        // THE ARTIFACT READS THE PREPARATION, not this return value, and
        // `assertFindingsDescribePreparation` refuses a build where the two
        // disagree. So the finding is worth nothing unless it is on both.
        expect(prepared.alignmentFindings,).toContain(expected,);
      },
    },),
    it({
      name:
        'RECORDS AN EMPTY PAIRING when the roster was asked and agreed nothing, which is a different fact '
        + 'from no roster having been asked and must not read as the same absence',
      fn: async () => {
        const {
          prepared,
          findings,
        } = await prepareDocumentPairWithRoster({
          client: cannedClient({ replyByModel: ['{"pairs":[]}',], },),
          modelIds: ROSTER,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          signal: new AbortController().signal,
          exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
          l,
        },);
        expect(prepared.blockPairing,).toEqual([],);
        expect(findings,).toContain('block-pairing section 0 fell back to scoring',);

        // NO COUNT LINE WHERE NOTHING WAS AGREED would be the wrong reading:
        // the voices were heard and usable, they simply named nothing, and that
        // is exactly the case the counts are worth recording for.
        expect(findings,).toContain(
          'block-pairing section 0 paired 0 of 2 original and 2 translation blocks, from 2 usable voices of 2 heard',
        );
      },
    },),
  ],
},);
