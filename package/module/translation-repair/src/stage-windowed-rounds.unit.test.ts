/**
 * Tests for the windowed rounds the six self-reading stages ask through.
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
  firstRoundWindow,
  type JsonSchemaResponseFormat,
  type RosterModelId,
  runWindowedRounds,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Six-seat bench in roster order.
 */
const BENCH: readonly RosterModelId[] = [
  'hf:zai-org/GLM-5.3-Flash',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
  'hf:openai/gpt-oss-120b',
  'minimax-m3',
  'deepseek-v4-pro-0813',
];

/**
 * Quorum over the whole bench.
 */
const QUORUM = Math.ceil(BENCH.length / 2,);

/**
 * Trivial reply payload the scripted client emits.
 */
type MeowReply = {
  readonly meow: string;
};

/**
 * Guards the trivial payload.
 */
function isMeowReply(value: unknown,): value is MeowReply {
  return ((typeof value) === 'object') && (value !== null)
    && ((typeof (value as MeowReply).meow) === 'string');
}

/**
 * Response format naming the test stage.
 */
const MEOW_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'meow_reply',
    schema: { type: 'object', },
  },
};

/**
 * Test logger.
 */
const l = tagged({ tag: 'stage-windowed-rounds-test', },);

/**
 * Client answering every seat, except those scripted to fail the first time
 * they are asked or every time.
 *
 * @param failsOnce - seats whose first ask throws and whose second answers
 *
 * @param failsAlways - seats whose every ask throws
 *
 * @param unreadable - seats that answer a shape the guard refuses
 *
 * @returns Client plus the seats asked, in call order
 *
 * @example
 * ```ts
 * const { client, asked, } = scriptedClient({ failsOnce: [], failsAlways: [], unreadable: [], },);
 * ```
 */
function scriptedClient(
  {
    failsOnce,
    failsAlways,
    unreadable,
  }: {
    readonly failsOnce: readonly RosterModelId[];
    readonly failsAlways: readonly RosterModelId[];
    readonly unreadable: readonly RosterModelId[];
  },
): { readonly client: SyntheticClient; readonly asked: RosterModelId[]; } {
  /**
   * Seats asked, in call order.
   */
  const asked: RosterModelId[] = [];
  /**
   * Seats that have already thrown once.
   */
  const thrown = new Set<RosterModelId>();
  return {
    asked,
    client: {
      chatText: async () => {
        throw new Error('chatText unused',);
      },
      chatJson: async <ValueT,>(
        request: ChatJsonRequest<ValueT>,
      ): Promise<ChatJsonOutcome<ValueT>> => {
        asked.push(request.modelId,);
        if (failsAlways.includes(request.modelId,))
          throw new Error('scripted loss',);
        if (failsOnce.includes(request.modelId,) && (!thrown.has(request.modelId,))) {
          thrown.add(request.modelId,);
          throw new Error('scripted first loss',);
        }
        if (unreadable.includes(request.modelId,)) {
          return {
            kind: 'schema-mismatch',
            rawText: 'purr',
            detail: 'scripted unreadable reply',
          };
        }
        /**
         * Scripted payload for the answering call.
         */
        const scripted: unknown = { meow: request.modelId, };
        if (!request.validate(scripted,))
          throw new Error('scripted payload failed the guard',);
        return {
          kind: 'ok',
          value: scripted,
          rawText: JSON.stringify(scripted,),
        };
      },
      quotas: async () => {
        throw new Error('quotas unused',);
      },
    },
  };
}

/**
 * Runs the windowed rounds over the bench with one scripted client.
 *
 * @param script - which seats fail or answer unreadably
 *
 * @param fanOut - window or whole bench, absent for the production default
 *
 * @returns Outcomes plus the seats asked in call order
 *
 * @example
 * ```ts
 * const { outcomes, asked, } = await runBench({ script: { failsOnce: [], failsAlways: [], unreadable: [], }, },);
 * ```
 */
async function runBench(
  {
    script,
    fanOut,
  }: {
    readonly script: Parameters<typeof scriptedClient>[0];
    readonly fanOut?: 'window' | 'whole-bench';
  },
) {
  const { client, asked, } = scriptedClient(script,);
  const outcomes = await runWindowedRounds({
    client,
    modelIds: BENCH,
    messages: [{ role: 'user', content: 'meow?', },],
    signal: new AbortController().signal,
    exchangeTimeoutMs: 1_000,
    responseFormat: MEOW_FORMAT,
    validate: isMeowReply,
    stage: 'meow',
    l,
    heardNeeded: QUORUM,
    graceMs: 50,
    ...((fanOut === undefined) ? {} : { fanOut, }),
  },);
  return {
    outcomes,
    asked,
  };
}

await describe({
  name: runWindowedRounds.name,
  children: [
    it({
      name: 'ASKS quorum plus one seat of a healthy bench and returns exactly those, in roster order, '
        + 'so the seats the window spared are neither heard nor lost',
      fn: async () => {
        const { outcomes, asked, } = await runBench({
          script: { failsOnce: [], failsAlways: [], unreadable: [], },
        },);
        expect(asked,).toHaveLength(firstRoundWindow({ benchSize: BENCH.length, },),);
        expect(outcomes.map(function idOf(outcome,): RosterModelId {
          return outcome.modelId;
        },),).toEqual(BENCH.filter(function wasAsked(modelId,): boolean {
          return asked.includes(modelId,);
        },),);
        expect(outcomes.every(function heard(outcome,): boolean {
          return outcome.voice.heard;
        },),).toBe(true,);
      },
    },),
    it({
      name: 'RE-ASKS lost seats after the unasked ones, reaching quorum on their second answers, and '
        + 'reports every seat once, heard where a later ask heard it',
      fn: async () => {
        /**
         * Every seat lost on its first ask, so no fresh seat can fill quorum
         * and the retry rounds must come back to the lost ones.
         */
        const { outcomes, asked, } = await runBench({
          script: { failsOnce: BENCH, failsAlways: [], unreadable: [], },
        },);
        /**
         * Seats reported, each once.
         */
        const reported = outcomes.map(function idOf(outcome,): RosterModelId {
          return outcome.modelId;
        },);
        expect(new Set(reported,).size,).toBe(reported.length,);
        expect(asked.length,).toBeGreaterThan(BENCH.length,);
        /**
         * Voices heard, which reach quorum only through second asks.
         */
        const heard = outcomes.filter(function isHeard(outcome,): boolean {
          return outcome.voice.heard;
        },);
        expect(heard.length,).toBeGreaterThanOrEqual(QUORUM,);
      },
    },),
    it({
      name: 'REPORTS a bench lost every time once per seat, lost, after the retry rounds run out',
      fn: async () => {
        const { outcomes, asked, } = await runBench({
          script: { failsOnce: [], failsAlways: BENCH, unreadable: [], },
        },);
        expect(outcomes.map(function idOf(outcome,): RosterModelId {
          return outcome.modelId;
        },),).toEqual(BENCH,);
        expect(outcomes.every(function isLost(outcome,): boolean {
          return !outcome.voice.heard;
        },),).toBe(true,);
        expect(asked.length,).toBeGreaterThan(BENCH.length,);
      },
    },),
    it({
      name: 'NEVER re-asks a seat that answered unreadably, since it had its chance, and asks the whole '
        + 'bench once on request, as these stages always did',
      fn: async () => {
        const unreadableRun = await runBench({
          script: { failsOnce: [], failsAlways: [], unreadable: ['hf:zai-org/GLM-5.3-Flash', 'hf:Qwen/Qwen3.8-27B', 'hf:moonshotai/Kimi-K3', 'hf:openai/gpt-oss-120b', 'minimax-m3', 'deepseek-v4-pro-0813',], },
        },);
        expect(new Set(unreadableRun.asked,).size,).toBe(unreadableRun.asked.length,);
        const wholeRun = await runBench({
          script: { failsOnce: [], failsAlways: [], unreadable: [], },
          fanOut: 'whole-bench',
        },);
        expect(wholeRun.asked.toSorted(),).toEqual([...BENCH,].toSorted(),);
        expect(wholeRun.outcomes,).toHaveLength(BENCH.length,);
      },
    },),
  ],
},);
