/**
 * Unit tests for concrete judge-model fallback race orchestration.
 *
 * @module
 */

import type {
  Api,
  AssistantMessageEvent,
  Model,
} from '@earendil-works/pi-ai';
import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type { ScriptedStructuredReviewTransport, } from '@monochromatic-dev/pi-shared-model-review/ts';

import { findBudgetModel, } from './budget-model.ts';
import { createJudgeCallHistory, } from './judge-call-history.ts';
import { callJudgeWithFallback, } from './judge-fallback.ts';
import type { BudgetModel, } from './types.ts';

/** Fixture context window. */
const CONTEXT_WINDOW = 128_000;

/** Fixture maximum output token count. */
const MAX_TOKENS = 4_096;

/** Timeout budget for judge attempts. */
const JUDGE_TIMEOUT_MS = 60_000;

/** Logical no-content calls required before temporary blocklisting. */
const NO_CONTENT_CALL_COUNT = 3;

/**
 * Build selected judge fixture with complete Pi model shape.
 *
 * @param id - model id inside test provider
 *
 * @param inputCost - ranking cost used by fallback selection
 *
 * @returns judge model plus fixture auth
 *
 * @example
 * ```ts
 * judgeFixture({ id: 'first', inputCost: 1 });
 * ```
 */
function judgeFixture(
  {
    id,
    inputCost,
  }: {
    readonly id: string;
    readonly inputCost: number;
  },
): BudgetModel {
  /** Complete Pi model record used by fallback selection. */
  const model = {
    id,
    name: id,
    api: 'openai-completions',
    provider: 'test-provider',
    baseUrl: 'https://example.invalid',
    reasoning: false,
    input: ['text',],
    cost: {
      input: inputCost,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: CONTEXT_WINDOW,
    maxTokens: MAX_TOKENS,
  } satisfies Model<Api>;
  return {
    model,
    auth: { apiKey: `key-${id}`, },
  };
}

/**
 * Build fake Pi context selecting authenticated fallback models.
 *
 * @param models - scoped authenticated fallback models
 *
 * @param scopeCalls - mutable scope invocation counter
 *
 * @returns focused fake extension context
 *
 * @example
 * ```ts
 * contextFixture({ models: [judge.model], scopeCalls: { value: 0 } });
 * ```
 */
function contextFixture(
  {
    models,
    scopeCalls,
  }: {
    readonly models: readonly Model<Api>[];
    readonly scopeCalls: { value: number; };
  },
): ExtensionContext {
  return {
    model: models[0],
    modelRegistry: {
      getAll() {
        return models;
      },
      getAvailable() {
        return models;
      },
      async getApiKeyAndHeaders(model: Model<Api>,) {
        return {
          ok: true,
          apiKey: `key-${model.id}`,
        };
      },
    },
    getScopedModels() {
      scopeCalls.value += 1;
      return models;
    },
  } as unknown as ExtensionContext;
}

/**
 * Build async event stream from fixed events.
 *
 * @param entries - ordered provider events
 *
 * @returns async reviewer stream
 *
 * @example
 * ```ts
 * events([]);
 * ```
 */
async function* events(
  entries: readonly AssistantMessageEvent[],
): AsyncIterable<AssistantMessageEvent> {
  for (const entry of entries)
    yield entry;
}

/**
 * Build render-verdict stream.
 *
 * @param verdict - emitted verdict
 *
 * @returns one-event reviewer stream
 *
 * @example
 * ```ts
 * verdictStream('approve');
 * ```
 */
function verdictStream(
  verdict: 'approve' | 'deny',
): AsyncIterable<AssistantMessageEvent> {
  return events([{
    type: 'toolcall_end',
    contentIndex: 0,
    toolCall: {
      type: 'toolCall',
      id: `verdict-${verdict}`,
      name: 'render_verdict',
      arguments: {
        verdict,
        reason: `${verdict} reason`,
        guidance: '',
      },
    },
    partial: {} as never,
  },],);
}

/**
 * Build finalized text stream.
 *
 * @param content - finalized provider text
 *
 * @returns one-event reviewer stream
 *
 * @example
 * ```ts
 * textStream('');
 * ```
 */
function textStream(content: string,): AsyncIterable<AssistantMessageEvent> {
  return events([{
    type: 'text_end',
    contentIndex: 0,
    content,
    partial: {} as never,
  },],);
}

/**
 * Build one-event stream that fails expected-tool validation.
 *
 * @param id - diagnostic event id
 *
 * @returns unexpected-tool reviewer stream
 *
 * @example
 * ```ts
 * failingStream('initial');
 * ```
 */
function failingStream(id: string,): AsyncIterable<AssistantMessageEvent> {
  return events([{
    type: 'toolcall_end',
    contentIndex: 0,
    toolCall: {
      type: 'toolCall',
      id,
      name: `unexpected_${id}`,
      arguments: {},
    },
    partial: {} as never,
  },],);
}

/**
 * Build deterministic data transport.
 *
 * @param responses - ordered response streams
 *
 * @returns mutable script state
 *
 * @example
 * ```ts
 * scriptedTransport([verdictStream('approve')]);
 * ```
 */
function scriptedTransport(
  responses: readonly AsyncIterable<AssistantMessageEvent>[],
): ScriptedStructuredReviewTransport {
  return {
    nextResponseIndex: 0,
    responses,
    requests: [],
  };
}

/**
 * Build shared judge request fixture.
 *
 * @param testTransport - deterministic provider seam
 *
 * @returns complete judge request data
 *
 * @example
 * ```ts
 * judgeRequest(scriptedTransport([verdictStream('approve')]));
 * ```
 */
function judgeRequest(
  testTransport: ScriptedStructuredReviewTransport,
) {
  return {
    action: 'bash: echo hi',
    actionInput: '{"command":"echo hi"}',
    cwd: '/project',
    recentContext: '',
    trustDirectives: [],
    timeoutMs: JUDGE_TIMEOUT_MS,
    systemPrompt: 'Use render_verdict.',
    batchContext: [],
    testTransport,
  } as const;
}

/**
 * Capture async error without promise matcher indirection.
 *
 * @param action - async action expected to fail
 *
 * @returns thrown value
 *
 * @example
 * ```ts
 * await captureError(async () => { throw new Error('x'); });
 * ```
 */
async function captureError(action: () => Promise<unknown>,): Promise<unknown> {
  try {
    await action();
  }
  catch (error) {
    return error;
  }
  throw new Error('expected action to throw',);
}

await describe({
  name: callJudgeWithFallback.name,
  children: [
    it({
      name: 'returns primary verdict without resolving fallback contenders',
      fn: async () => {
        /** Initially selected judge. */
        const firstJudge = judgeFixture({ id: 'first', inputCost: 3, },);
        /** Fallback scope invocation count. */
        const scopeCalls = { value: 0, };
        /** Deterministic primary response. */
        const transport = scriptedTransport([verdictStream('approve',),],);
        /** Primary judge verdict. */
        const result = await callJudgeWithFallback({
          firstJudge,
          ctx: contextFixture({ models: [firstJudge.model,], scopeCalls, },),
          request: judgeRequest(transport,),
        },);
        expect(result.verdict,).toBe('approve',);
        expect(scopeCalls.value,).toBe(0,);
        expect(transport.requests.map(function requestModel(request,) {
          return request.model.id;
        },),).toEqual(['first',],);
      },
    },),
    it({
      name: 'starts two ranked distinct fallback attempts after initial failure',
      fn: async () => {
        /** Initially selected judge. */
        const firstJudge = judgeFixture({ id: 'first', inputCost: 3, },);
        /** Higher-ranked fallback judge. */
        const fallbackOne = judgeFixture({ id: 'fallback-one', inputCost: 1, },);
        /** Lower-ranked fallback judge. */
        const fallbackTwo = judgeFixture({ id: 'fallback-two', inputCost: 2, },);
        /** Fallback scope invocation count. */
        const scopeCalls = { value: 0, };
        /** Initial failure and concurrent fallback responses. */
        const transport = scriptedTransport([
          failingStream('initial',),
          failingStream('fallback-one',),
          verdictStream('deny',),
        ],);
        /** Winning fallback verdict. */
        const result = await callJudgeWithFallback({
          firstJudge,
          ctx: contextFixture({
            models: [fallbackOne.model, fallbackTwo.model,],
            scopeCalls,
          },),
          request: judgeRequest(transport,),
        },);
        expect(result.verdict,).toBe('deny',);
        expect(scopeCalls.value,).toBe(2,);
        expect(transport.requests.map(function requestModel(request,) {
          return request.model.id;
        },),).toEqual([
          'first',
          'fallback-one',
          'fallback-two',
        ],);
      },
    },),
    it({
      name: 'runs one available fallback and reports complete exhaustion',
      fn: async () => {
        /** Initially selected judge. */
        const firstJudge = judgeFixture({ id: 'first', inputCost: 2, },);
        /** Sole fallback judge. */
        const fallback = judgeFixture({ id: 'fallback', inputCost: 1, },);
        /** Fallback scope invocation count. */
        const scopeCalls = { value: 0, };
        /** Initial and fallback failures. */
        const transport = scriptedTransport([
          failingStream('initial',),
          failingStream('fallback',),
        ],);
        /** Exhausted review error. */
        const error = await captureError(async function exhaustReviewers() {
          return callJudgeWithFallback({
            firstJudge,
            ctx: contextFixture({ models: [fallback.model,], scopeCalls, },),
            request: judgeRequest(transport,),
          },);
        },);
        expect(error,).toBeInstanceOf(Error,);
        expect((error as Error).message,).toContain('test-provider/first',);
        expect((error as Error).message,).toContain('test-provider/fallback',);
        expect(transport.requests,).toHaveLength(2,);
      },
    },),
    it({
      name: 'blocklists model after three wholly empty logical calls and selects next judge',
      fn: async () => {
        /** Highest-ranked judge whose complete responses remain empty. */
        const firstJudge = judgeFixture({ id: 'first', inputCost: 1, },);
        /** Healthy fallback and later primary selection. */
        const fallback = judgeFixture({ id: 'fallback', inputCost: 2, },);
        /** Session-local call history shared across logical evaluations. */
        const callHistory = createJudgeCallHistory();
        /** Fallback scope invocation count. */
        const scopeCalls = { value: 0, };

        for (let callIndex = 0;
          callIndex < NO_CONTENT_CALL_COUNT;
          callIndex += 1) {
          /** Three empty responses from first judge followed by healthy fallback. */
          const transport = scriptedTransport([
            textStream('',),
            textStream('',),
            textStream('',),
            verdictStream('approve',),
          ],);
          /** Healthy fallback verdict after empty primary call. */
          const result = await callJudgeWithFallback({
            firstJudge,
            ctx: contextFixture({ models: [fallback.model,], scopeCalls, },),
            request: judgeRequest(transport,),
            callHistory,
          },);
          expect(result.verdict,).toBe('approve',);
        }

        expect(callHistory.blocklistedModelSlugs(),).toEqual([
          'test-provider/first',
        ],);
        /** Next automatic selection with temporary blocklist applied. */
        const selected = await findBudgetModel({
          ctx: contextFixture({
            models: [firstJudge.model, fallback.model,],
            scopeCalls,
          },),
          excludedModelSlugs: callHistory.blocklistedModelSlugs(),
        },);
        expect(selected.model.id,).toBe('fallback',);
      },
    },),
  ],
},);
