/**
 * Tests for stage voice gathering: retries stop at quorum, a straggler is
 * abandoned a bounded grace after quorum rather than waited out, and roster
 * shortfalls surface as findings.
 *
 * The grace cases are the user's standing rule of 2026-08-14 made testable:
 * the failure of any one model for the day must not delay the pipeline. Both
 * directions are covered, because only the pair distinguishes a grace from a
 * cut: a voice arriving inside the window is still heard, and one that never
 * arrives costs the window rather than its whole deadline.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';
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
} from '../dist/final/node/index.mjs';

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

/**
 * Resolves when a signal aborts, and never otherwise.
 *
 * Deliberately has NO timer of its own. A stub that also gave up after some
 * duration would pass the abandonment case whether or not the cut ever reached
 * the call, which is the one thing that case exists to prove.
 *
 * @param signal - call signal the round owns
 *
 * @returns Nothing, once the call is cut
 *
 * @example
 * ```ts
 * await untilAborted({ signal, },);
 * ```
 */
async function untilAborted({ signal, }: { readonly signal: AbortSignal; },): Promise<void> {
  if (signal.aborted)
    return;

  /**
   * Capability resolved by the abort listener.
   */
  const {
    promise,
    resolve,
  } = Promise.withResolvers<undefined>();
  signal.addEventListener(
    'abort',
    function onAbort(): void {
      resolve(undefined,);
    },
    { once: true, },
  );
  await promise;
}

/**
 * Client where every model answers at once except one, which either answers
 * late or not at all.
 *
 * @param hangingModelId - model that does not answer with the others
 *
 * @param cut - flag the hung call sets when its abort arrives
 *
 * @param lateMs - delay after which it answers anyway; omitted means it never
 * answers on its own and waits to be abandoned
 *
 * @returns Client honoring that script
 *
 * @example
 * ```ts
 * const client = hangingClient({ hangingModelId, cut, },);
 * ```
 */
function hangingClient(
  {
    hangingModelId,
    cut,
    lateMs,
  }: {
    readonly hangingModelId: SyntheticModelId;
    readonly cut: { aborted: boolean; };
    readonly lateMs?: number;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Scripted payload every answering model returns.
       */
      const scripted: unknown = { meow: request.modelId, };
      if (!request.validate(scripted,))
        throw new Error('scripted payload failed the guard',);

      /**
       * Answer shared by every model that speaks.
       */
      const answer: ChatJsonOutcome<ValueT> = {
        kind: 'ok',
        value: scripted,
        rawText: JSON.stringify(scripted,),
      };
      if (request.modelId !== hangingModelId)
        return answer;
      if (lateMs !== undefined) {
        await wait(lateMs,);
        return answer;
      }
      await untilAborted({ signal: request.signal, },);
      cut.aborted = true;
      return {
        kind: 'schema-mismatch',
        rawText: '',
        detail: 'abandoned before answering',
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
          modelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.8-27B', 'hf:moonshotai/Kimi-K3',],
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
          modelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.8-27B', 'hf:moonshotai/Kimi-K3',],
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
      name: 'counts exactly half of an even roster as quorum',
      fn: async () => {
        /** Call log shared with the scripted client. */
        const calls: Record<string, number> = {};
        /** Four-model roster where exactly two never answer. */
        const gather = await gatherStageVoices({
          client: flakyClient({
            failuresByModel: {
              'hf:moonshotai/Kimi-K3': 99,
              'hf:openai/gpt-oss-120b': 99,
            },
            calls,
          },),
          modelIds: [
            'hf:zai-org/GLM-5.2',
            'hf:Qwen/Qwen3.8-27B',
            'hf:moonshotai/Kimi-K3',
            'hf:openai/gpt-oss-120b',
          ],
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 1_000,
          responseFormat: MEOW_FORMAT,
          validate: isMeowReply,
          stage: 'panel',
          l,
        },);
        // 2 of 4 is exactly half. The superseded "strictly more than half"
        // rule would have called this short and burned every retry round;
        // ceil(4 / 2) = 2 makes it a quorum.
        expect(gather.voices,).toHaveLength(2,);
        expect(gather.quorumMet,).toBe(true,);
        // Quorum held, and two models still never answered. This assertion
        // read `toHaveLength(0)` until 2026-08-13, which is precisely the case
        // the findings dropped: a healthy-looking stage silently short two
        // voices, recorded nowhere the artifact could carry.
        expect(gather.findings,).toContain('stage-voice-lost (panel hf:moonshotai/Kimi-K3)',);
        expect(gather.findings,).toContain('stage-voice-lost (panel hf:openai/gpt-oss-120b)',);
        // TWO findings, not one naming two models, so counting them counts
        // voices lost rather than gathers that lost at least one.
        expect(
          gather.findings.filter(function isLoss(finding,) {
            return finding.startsWith('stage-voice-lost',);
          },),
        ).toHaveLength(2,);
      },
    },),

    it({
      name: 'NAMES the models that went quiet even when quorum was met, since '
        + 'voice loss reached only a log line before this and every question '
        + 'about it, which model and which stage, was answerable solely from a '
        + 'captured run log. On 2026-08-13 a run wrote its log into a pipe '
        + 'whose reader had exited, so the losses happened and nothing kept '
        + 'them; findings travel into the durable per-entry artifact instead',
      fn: async () => {
        /** Call log shared with the scripted client. */
        const calls: Record<string, number> = {};
        /** Gather where one model of three never answers. */
        const gather = await gatherStageVoices({
          client: flakyClient({
            failuresByModel: { 'hf:moonshotai/Kimi-K3': 99, },
            calls,
          },),
          modelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.8-27B', 'hf:moonshotai/Kimi-K3',],
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 1_000,
          responseFormat: MEOW_FORMAT,
          validate: isMeowReply,
          stage: 'critic',
          l,
        },);
        expect(gather.quorumMet,).toBe(true,);
        expect(gather.findings,).toContain('stage-voice-lost (critic hf:moonshotai/Kimi-K3)',);
      },
    },),

    it({
      name: 'records NOTHING when the whole roster answered, so a clean stage '
        + 'stays distinguishable from a degraded one rather than every entry '
        + 'carrying a finding nobody can act on',
      fn: async () => {
        /** Call log shared with the scripted client. */
        const calls: Record<string, number> = {};
        /** Gather over a fully healthy roster. */
        const gather = await gatherStageVoices({
          client: flakyClient({ failuresByModel: {}, calls, },),
          modelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.8-27B', 'hf:moonshotai/Kimi-K3',],
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 1_000,
          responseFormat: MEOW_FORMAT,
          validate: isMeowReply,
          stage: 'critic',
          l,
        },);
        expect(gather.findings,).toHaveLength(0,);
      },
    },),

    it({
      name: 'still refuses quorum one voice below half an even roster',
      fn: async () => {
        /** Call log shared with the scripted client. */
        const calls: Record<string, number> = {};
        /** Four-model roster where only one ever answers. */
        const gather = await gatherStageVoices({
          client: flakyClient({
            failuresByModel: {
              'hf:Qwen/Qwen3.8-27B': 99,
              'hf:moonshotai/Kimi-K3': 99,
              'hf:openai/gpt-oss-120b': 99,
            },
            calls,
          },),
          modelIds: [
            'hf:zai-org/GLM-5.2',
            'hf:Qwen/Qwen3.8-27B',
            'hf:moonshotai/Kimi-K3',
            'hf:openai/gpt-oss-120b',
          ],
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 1_000,
          responseFormat: MEOW_FORMAT,
          validate: isMeowReply,
          stage: 'panel',
          l,
        },);
        expect(gather.voices,).toHaveLength(1,);
        expect(gather.quorumMet,).toBe(false,);
        expect(gather.findings,).not.toHaveLength(0,);
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
          'hf:Qwen/Qwen3.8-27B',
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
              'hf:Qwen/Qwen3.8-27B': 99,
              'hf:moonshotai/Kimi-K3': 99,
            },
            calls,
          },),
          modelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.8-27B', 'hf:moonshotai/Kimi-K3',],
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
        expect(calls['hf:Qwen/Qwen3.8-27B'],).toBe(4,);
      },
    },),

    it({
      name: 'STOPS at quorum instead of chasing a voice that will not come, and '
        + 'still records the shortfall: waiting for the whole roster let one '
        + 'model degraded for a day stall every gather that seated it, which '
        + 'is why the user removed that target on 2026-08-14',
      fn: async () => {
        /** Call log shared with the scripted client. */
        const calls: Record<string, number> = {};
        /** Gather where one voice never answers at all. */
        const gather = await gatherStageVoices({
          client: flakyClient({
            failuresByModel: { 'hf:moonshotai/Kimi-K3': 99, },
            calls,
          },),
          modelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.8-27B', 'hf:moonshotai/Kimi-K3',],
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 1_000,
          responseFormat: MEOW_FORMAT,
          validate: isMeowReply,
          stage: 'critic',
          l,
        },);
        expect(gather.voices,).toHaveLength(2,);
        expect(gather.quorumMet,).toBe(true,);
        // The whole point: asked once, never re-asked, so a degraded model
        // costs one deadline per gather rather than four.
        expect(calls['hf:moonshotai/Kimi-K3'],).toBe(1,);
        // Met quorum reads as healthy everywhere else, so the shortfall is
        // recorded anyway, both as a ratio and by name.
        expect(gather.findings,).toContain('stage-roster-incomplete (critic 2/3)',);
        expect(gather.findings,).toContain('stage-voice-lost (critic hf:moonshotai/Kimi-K3)',);
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

    it({
      name: 'ABANDONS a voice that has not answered a grace period after '
        + 'quorum, so one model degraded for the day costs a stage that '
        + 'window rather than its whole per-call deadline. The stub answers '
        + 'only when aborted, so this passes only if the cut actually reached '
        + 'the call',
      fn: async () => {
        /** Whether the hung call saw its abort. */
        const cut = { aborted: false, };

        /** When the gather returned, for the delay this rule is about. */
        const started = performance.now();

        /** Gather where one model never answers on its own. */
        const gather = await gatherStageVoices({
          client: hangingClient({
            hangingModelId: 'hf:moonshotai/Kimi-K3',
            cut,
          },),
          modelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.8-27B', 'hf:moonshotai/Kimi-K3',],
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
          // Far longer than the grace, so a gather that waited for the call
          // rather than for the window would be visible in the elapsed time.
          exchangeTimeoutMs: 60_000,
          responseFormat: MEOW_FORMAT,
          validate: isMeowReply,
          stage: 'critic',
          l,
          graceMs: 50,
        },);

        /** Wall time the gather took. */
        const elapsed = performance.now() - started;
        expect(gather.voices,).toHaveLength(2,);
        expect(gather.quorumMet,).toBe(true,);
        expect(cut.aborted,).toBe(true,);
        expect(elapsed < 5_000,).toBe(true,);
        expect(gather.findings,).toContain('stage-voice-lost (critic hf:moonshotai/Kimi-K3)',);
      },
    },),

    it({
      name: 'still hears a voice that arrives INSIDE the grace, which is what '
        + 'makes this a grace rather than a cut: quorum on a roster of three '
        + 'is two, so cutting there would discard a healthy third voice on '
        + 'nearly every gather',
      fn: async () => {
        /** Unused here; the late model answers on its own. */
        const cut = { aborted: false, };

        /** Gather where the third voice is late but well inside the window. */
        const gather = await gatherStageVoices({
          client: hangingClient({
            hangingModelId: 'hf:moonshotai/Kimi-K3',
            cut,
            lateMs: 20,
          },),
          modelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.8-27B', 'hf:moonshotai/Kimi-K3',],
          messages: [{ role: 'user', content: 'meow', },],
          signal: new AbortController().signal,
          exchangeTimeoutMs: 60_000,
          responseFormat: MEOW_FORMAT,
          validate: isMeowReply,
          stage: 'critic',
          l,
          graceMs: 2_000,
        },);
        expect(gather.voices,).toHaveLength(3,);
        expect(gather.findings,).toHaveLength(0,);
        expect(cut.aborted,).toBe(false,);
      },
    },),
  ],
},);
