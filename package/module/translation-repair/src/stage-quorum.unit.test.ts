/**
 * Tests for stage voice gathering under both retry targets:
 * voting stages stop at quorum, union stages retry to the full roster,
 * and roster shortfalls surface as distinct findings.
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
  gatherStageVoices,
  type JsonSchemaResponseFormat,
  type SyntheticClient,
  type SyntheticModelId,
} from '../dist/final/neutral/index.mjs';

/**
 * Logger for the gathers under test.
 */
const l = tagged({ tag: 'stage-quorum-test', },);

/**
 * Trivial reply payload the scripted clients emit.
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
 * Client scripted per model: fails until the model's remaining failure
 * budget is spent, then answers; records every call.
 *
 * @param failuresByModel - failures each model serves before answering
 *
 * @param calls - shared call log the test asserts on
 */
function flakyClient(
  {
    failuresByModel,
    calls,
  }: {
    readonly failuresByModel: Readonly<Record<string, number>>;
    readonly calls: Record<string, number>;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      calls[request.modelId] = (calls[request.modelId] ?? 0) + 1;

      /**
       * Failures this model still owes.
       */
      const owed = failuresByModel[request.modelId] ?? 0;
      if ((calls[request.modelId] ?? 0) <= owed) {
        return {
          kind: 'schema-mismatch',
          rawText: '',
          detail: 'scripted flake',
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
  };
}

await describe({
  name: gatherStageVoices.name,
  children: [
    it({
      name: 'asks everyone once when the first round meets quorum',
      fn: async () => {
        /** Call log shared with the scripted client. */
        const calls: Record<string, number> = {};
        /** Gather over a fully healthy roster. */
        const gather = await gatherStageVoices({
          client: flakyClient({ failuresByModel: {}, calls, },),
          modelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.6-27B', 'hf:moonshotai/Kimi-K3',],
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 1_000,
          responseFormat: MEOW_FORMAT,
          validate: isMeowReply,
          stage: 'critic',
          l,
        },);
        expect(gather.voices,).toHaveLength(3,);
        expect(gather.quorumMet,).toBe(true,);
        expect(gather.findings,).toHaveLength(0,);
        expect(calls['hf:zai-org/GLM-5.2'],).toBe(1,);
      },
    },),

    it({
      name: 'stops retrying once quorum is met even with voices still lost',
      fn: async () => {
        /** Call log shared with the scripted client. */
        const calls: Record<string, number> = {};
        /** Gather where two of three answer immediately and one never does. */
        const gather = await gatherStageVoices({
          client: flakyClient({
            failuresByModel: { 'hf:moonshotai/Kimi-K3': 99, },
            calls,
          },),
          modelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.6-27B', 'hf:moonshotai/Kimi-K3',],
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 1_000,
          responseFormat: MEOW_FORMAT,
          validate: isMeowReply,
          stage: 'panel',
          l,
        },);
        expect(gather.voices,).toHaveLength(2,);
        expect(gather.quorumMet,).toBe(true,);
        // Quorum (2 of 3) was met after the first round, so the lost
        // voice is never re-asked.
        expect(calls['hf:moonshotai/Kimi-K3'],).toBe(1,);
      },
    },),

    it({
      name: 'retries lost voices to quorum and recovers a 1-of-6 round',
      fn: async () => {
        /** Call log shared with the scripted client. */
        const calls: Record<string, number> = {};
        /** Full six-model roster where five fail once then answer. */
        const roster: readonly SyntheticModelId[] = [
          'hf:zai-org/GLM-5.2',
          'hf:zai-org/GLM-4.7-Flash',
          'hf:Qwen/Qwen3.6-27B',
          'hf:moonshotai/Kimi-K3',
          'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
          'hf:openai/gpt-oss-120b',
        ];
        /** Gather recovering the milestone-two weather pattern. */
        const gather = await gatherStageVoices({
          client: flakyClient({
            failuresByModel: Object.fromEntries(
              roster.slice(1,).map(function toFailure(modelId,) {
                return [modelId, 1,];
              },),
            ),
            calls,
          },),
          modelIds: roster,
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 1_000,
          responseFormat: MEOW_FORMAT,
          validate: isMeowReply,
          stage: 'critic',
          l,
        },);
        expect(gather.voices,).toHaveLength(6,);
        expect(gather.quorumMet,).toBe(true,);
        expect(calls['hf:zai-org/GLM-5.2'],).toBe(1,);
        expect(calls['hf:openai/gpt-oss-120b'],).toBe(2,);
      },
    },),

    it({
      name: 'records a finding and proceeds when the rounds cannot reach quorum',
      fn: async () => {
        /** Call log shared with the scripted client. */
        const calls: Record<string, number> = {};
        /** Roster where only one of three ever answers. */
        const gather = await gatherStageVoices({
          client: flakyClient({
            failuresByModel: {
              'hf:Qwen/Qwen3.6-27B': 99,
              'hf:moonshotai/Kimi-K3': 99,
            },
            calls,
          },),
          modelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.6-27B', 'hf:moonshotai/Kimi-K3',],
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 1_000,
          responseFormat: MEOW_FORMAT,
          validate: isMeowReply,
          stage: 'checker',
          l,
        },);
        expect(gather.voices,).toHaveLength(1,);
        expect(gather.quorumMet,).toBe(false,);
        expect(gather.findings,).toContain('stage-quorum-unmet (checker 1/3)',);
        // Initial ask plus every retry round.
        expect(calls['hf:Qwen/Qwen3.6-27B'],).toBe(4,);
      },
    },),

    it({
      name: 'keeps retrying past quorum under a full-roster target',
      fn: async () => {
        /** Call log shared with the scripted client. */
        const calls: Record<string, number> = {};
        /** Gather where two answer at once and one answers on retry. */
        const gather = await gatherStageVoices({
          client: flakyClient({
            failuresByModel: { 'hf:moonshotai/Kimi-K3': 1, },
            calls,
          },),
          modelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.6-27B', 'hf:moonshotai/Kimi-K3',],
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 1_000,
          responseFormat: MEOW_FORMAT,
          validate: isMeowReply,
          stage: 'critic',
          l,
          retryTarget: 'full-roster',
        },);
        expect(gather.voices,).toHaveLength(3,);
        expect(gather.quorumMet,).toBe(true,);
        expect(gather.findings,).toHaveLength(0,);
        // Quorum stood after round zero, yet the lost voice was re-asked.
        expect(calls['hf:moonshotai/Kimi-K3'],).toBe(2,);
      },
    },),

    it({
      name: 'records roster-incomplete when full-roster rounds end short of everyone',
      fn: async () => {
        /** Call log shared with the scripted client. */
        const calls: Record<string, number> = {};
        /** Gather where one voice never answers despite every round. */
        const gather = await gatherStageVoices({
          client: flakyClient({
            failuresByModel: { 'hf:moonshotai/Kimi-K3': 99, },
            calls,
          },),
          modelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.6-27B', 'hf:moonshotai/Kimi-K3',],
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 1_000,
          responseFormat: MEOW_FORMAT,
          validate: isMeowReply,
          stage: 'critic',
          l,
          retryTarget: 'full-roster',
        },);
        expect(gather.voices,).toHaveLength(2,);
        expect(gather.quorumMet,).toBe(true,);
        expect(gather.findings,).toContain('stage-roster-incomplete (critic 2/3)',);
        // Initial ask plus every retry round.
        expect(calls['hf:moonshotai/Kimi-K3'],).toBe(4,);
      },
    },),

    it({
      name: 'retries a one-model roster until its voice is heard',
      fn: async () => {
        /** Call log shared with the scripted client. */
        const calls: Record<string, number> = {};
        /** Editor-style gather over a roster of one. */
        const gather = await gatherStageVoices({
          client: flakyClient({
            failuresByModel: { 'hf:zai-org/GLM-5.2': 2, },
            calls,
          },),
          modelIds: ['hf:zai-org/GLM-5.2',],
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 1_000,
          responseFormat: MEOW_FORMAT,
          validate: isMeowReply,
          stage: 'editor',
          l,
        },);
        expect(gather.voices,).toHaveLength(1,);
        expect(gather.quorumMet,).toBe(true,);
        expect(calls['hf:zai-org/GLM-5.2'],).toBe(3,);
      },
    },),
  ],
},);
