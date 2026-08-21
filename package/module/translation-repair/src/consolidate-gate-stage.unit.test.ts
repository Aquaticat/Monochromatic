/**
 * Tests for the gate deciding whether the rendering this run wrote replaces the
 * one that would otherwise ship.
 *
 * WHAT THIS FILE EXISTS TO STOP. A consolidation is a third candidate from the
 * same kind of instrument that produced the first two, so it can be worse. It
 * replaces nothing on a tie, on a refusal, or on a roster too thin to settle.
 * Changing what a reader sees on a memorial page needs more evidence than
 * leaving it, and the churn reason is already recorded in the translate wire.
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
  gateConsolidatedSlice,
  settleGateBallots,
} from '../dist/final/node/index.mjs';

/**
 * One gated slice, standing in for a corpus passage.
 */
const SUBJECT = {
  sourceText: '猫睡了一下午。',
  incumbentText: 'The cat slept all afternoon in the sun.',
  consolidatedText: 'The cat slept all afternoon.',
  standingText: 'The cat slept.',
};

/**
 * Roster of three, the smallest that can produce a two-to-one split.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
] as const;

/**
 * Logger for the stage under test.
 */
const l = tagged({ tag: 'consolidate-gate-stage-test', },);

/**
 * Per-call bound, generous because the transport answers instantly.
 */
const EXCHANGE_TIMEOUT_MS = 5_000;

/**
 * Builds one ballot body.
 *
 * @param choice - rendering this judge names
 *
 * @returns Reply body a judge would return
 *
 * @example
 * ```ts
 * const body = ballot({ choice: 'consolidated', },);
 * ```
 */
function ballot({ choice, }: { readonly choice: string; },): string {
  return JSON.stringify({
    choice,
    unsupported: [],
    dropped: [],
    reason: 'the original supports it',
  },);
}

/**
 * Builds a client whose models reply in roster order.
 *
 * @param replyByModel - reply body per model
 *
 * @returns Client over a canned transport
 *
 * @example
 * ```ts
 * const client = cannedClient({ replyByModel: [ ballot({ choice: 'standing', },), ], },);
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

/**
 * Runs one gate over a canned roster.
 *
 * @param replyByModel - reply body per model
 *
 * @returns What the roster settled and what ships
 *
 * @example
 * ```ts
 * const outcome = await gate({ replyByModel: [], },);
 * ```
 */
async function gate(
  { replyByModel, }: { readonly replyByModel: readonly string[]; },
) {
  return await gateConsolidatedSlice({
    client: cannedClient({ replyByModel, },),
    modelIds: ROSTER,
    subject: SUBJECT,
    signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS,),
    exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS,
    l,
  },);
}

await describe({
  name: settleGateBallots.name,
  children: [
    it({
      name: 'ACCEPTS a clear win for the rendering this run wrote',
      fn: async () => {
        expect(settleGateBallots({
          ballots: [
            { choice: 'consolidated', unsupported: [], unsupportedRaw: [], dropped: [], droppedRaw: [], reason: '', },
            { choice: 'consolidated', unsupported: [], unsupportedRaw: [], dropped: [], droppedRaw: [], reason: '', },
            { choice: 'standing', unsupported: [], unsupportedRaw: [], dropped: [], droppedRaw: [], reason: '', },
          ],
        },),).toBe('consolidated',);
      },
    },),
    it({
      name: 'REFUSES a one-voice majority, since one judge is an opinion',
      fn: async () => {
        expect(settleGateBallots({
          ballots: [
            { choice: 'consolidated', unsupported: [], unsupportedRaw: [], dropped: [], droppedRaw: [], reason: '', },
          ],
        },),).toBe('neither',);
      },
    },),
    it({
      name: 'REFUSES a tie rather than picking by list order',
      fn: async () => {
        expect(settleGateBallots({
          ballots: [
            { choice: 'consolidated', unsupported: [], unsupportedRaw: [], dropped: [], droppedRaw: [], reason: '', },
            { choice: 'consolidated', unsupported: [], unsupportedRaw: [], dropped: [], droppedRaw: [], reason: '', },
            { choice: 'standing', unsupported: [], unsupportedRaw: [], dropped: [], droppedRaw: [], reason: '', },
            { choice: 'standing', unsupported: [], unsupportedRaw: [], dropped: [], droppedRaw: [], reason: '', },
          ],
        },),).toBe('neither',);
      },
    },),
  ],
},);

await describe({
  name: gateConsolidatedSlice.name,
  children: [
    it({
      name: 'ACCEPTS a consolidation two voices back over one',
      fn: async () => {
        const outcome = await gate({
          replyByModel: [
            ballot({ choice: 'consolidated', },),
            ballot({ choice: 'consolidated', },),
            ballot({ choice: 'standing', },),
          ],
        },);
        expect(outcome.choice,).toBe('consolidated',);
        expect(outcome.ships,).toBe('consolidated',);
        expect(outcome.usable,).toBe(3,);
      },
    },),
    it({
      name: 'KEEPS the standing text when the roster refuses',
      fn: async () => {
        const outcome = await gate({
          replyByModel: [
            ballot({ choice: 'neither', },),
            ballot({ choice: 'neither', },),
            ballot({ choice: 'neither', },),
          ],
        },);
        expect(outcome.choice,).toBe('neither',);
        expect(outcome.ships,).toBe('standing',);
      },
    },),
    it({
      name: 'KEEPS the standing text on a tie, rather than churning the page',
      fn: async () => {
        const outcome = await gate({
          replyByModel: [
            ballot({ choice: 'consolidated', },),
            ballot({ choice: 'standing', },),
            ballot({ choice: 'neither', },),
          ],
        },);
        expect(outcome.ships,).toBe('standing',);
      },
    },),
    it({
      name: 'KEEPS the standing text when too few voices arrived to settle',
      fn: async () => {
        const outcome = await gate({
          replyByModel: [
            ballot({ choice: 'consolidated', },),
            'not json at all',
            'also not json',
          ],
        },);
        expect(outcome.usable,).toBe(1,);
        expect(outcome.ships,).toBe('standing',);
        expect(outcome.findings.length,).toBe(1,);
      },
    },),
    it({
      name: 'KEEPS every usable ballot, including the ones that ship nothing',
      fn: async () => {
        const outcome = await gate({
          replyByModel: [
            ballot({ choice: 'neither', },),
            ballot({ choice: 'neither', },),
            ballot({ choice: 'standing', },),
          ],
        },);
        // A READER ASKING WHY A SLICE KEPT ITS TEXT looks exactly where a
        // record without ballots would be silent.
        expect(outcome.ballots.length,).toBe(3,);
      },
    },),
  ],
},);
