/**
 * Unit tests for judge-model fallback orchestration.
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { budgetModelSlug, } from '@monochromatic-dev/pi-shared-model-selection/ts';

import { callJudgeWithFallback, } from './judge-fallback.ts';
import { callJudge, } from './judge.ts';
import type {
  BudgetModel,
  Verdict,
} from './types.ts';

/**
 * Fixture context window.
 */
const CONTEXT_WINDOW = 128_000;

/**
 * Fixture maximum output token count.
 */
const MAX_TOKENS = 4_096;

/**
 * Timeout budget for real judge retry composition test.
 */
const JUDGE_TIMEOUT_MS = 10_000;

/**
 * Successful fallback verdict fixture.
 */
const APPROVE_VERDICT = {
  verdict: 'approve',
  reason: 'Fallback judge approved.',
  guidance: '',
} satisfies Verdict;

/**
 * Build selected judge fixture with complete pi model shape.
 *
 * @param id - model id inside test provider
 *
 * @returns judge model plus fixture auth
 *
 * @example
 * ```typescript
 * judgeFixture({ id: 'first' });
 * ```
 */
function judgeFixture(
  {
    id,
  }: {
    readonly id: string;
  },
): BudgetModel {
  /**
   * Complete pi model record used by fallback identity checks.
   */
  const model = {
    id,
    name: id,
    api: 'openai-completions',
    provider: 'test-provider',
    baseUrl: 'https://example.invalid',
    reasoning: false,
    input: ['text',],
    cost: {
      input: 1,
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
 * Capture an async error without promise matcher indirection.
 *
 * @param action - async action expected to fail
 *
 * @returns thrown value
 *
 * @example
 * ```typescript
 * const error = await captureError(async function fail() { throw new Error('x'); });
 * ```
 */
async function captureError(
  action: () => Promise<unknown>,
): Promise<unknown> {
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
      name: 'returns first verdict without resolving fallback',
      fn: async function returnsFirstVerdict() {
        /**
         * Calls made to first judge attempt.
         */
        const attemptedSlugs: string[] = [];
        /**
         * Initially selected judge.
         */
        const firstJudge = judgeFixture({ id: 'first', },);
        /**
         * Verdict returned by successful first judge.
         */
        const result = await callJudgeWithFallback({
          firstJudge,
          async resolveFallbackJudge() {
            throw new Error('fallback resolver should not run',);
          },
          async callJudgeAttempt({ judge, },) {
            attemptedSlugs.push(budgetModelSlug(judge.model,),);
            return APPROVE_VERDICT;
          },
        },);

        expect(result,).toBe(APPROVE_VERDICT,);
        expect(attemptedSlugs,).toEqual(['test-provider/first',],);
      },
    },),
    it({
      name: 'uses distinct fallback after first model fails all retries',
      fn: async function usesDistinctFallback() {
        /**
         * Models called in attempt order.
         */
        const attemptedSlugs: string[] = [];
        /**
         * Failed slugs handed to fallback resolver.
         */
        const failedSlugs: string[] = [];
        /**
         * Initially selected judge.
         */
        const firstJudge = judgeFixture({ id: 'first', },);
        /**
         * Judge returned after first failure.
         */
        const fallbackJudge = judgeFixture({ id: 'fallback', },);
        /**
         * Verdict returned by fallback judge.
         */
        const result = await callJudgeWithFallback({
          firstJudge,
          async resolveFallbackJudge({ failedModelSlug, },) {
            failedSlugs.push(failedModelSlug,);
            return fallbackJudge;
          },
          async callJudgeAttempt({ judge, },) {
            /**
             * Current attempt slug used to make first model fail deterministically.
             */
            const slug = budgetModelSlug(judge.model,);
            attemptedSlugs.push(slug,);
            if (slug === budgetModelSlug(firstJudge.model,))
              throw new Error('first model exhausted retries',);
            return APPROVE_VERDICT;
          },
        },);

        expect(result,).toBe(APPROVE_VERDICT,);
        expect(failedSlugs,).toEqual(['test-provider/first',],);
        expect(attemptedSlugs,).toEqual([
          'test-provider/first',
          'test-provider/fallback',
        ],);
      },
    },),
    it({
      name: 'waits for every callJudge retry before selecting fallback model',
      fn: async function waitsForCallJudgeRetries() {
        /**
         * Initially selected judge whose streams never produce a verdict.
         */
        const firstJudge = judgeFixture({ id: 'first', },);
        /**
         * Distinct judge that succeeds through forced tool call.
         */
        const fallbackJudge = judgeFixture({ id: 'fallback', },);
        /**
         * Model slugs observed by real callJudge stream seam.
         */
        const streamedSlugs: string[] = [];
        /**
         * Verdict returned only after first model's complete retry sequence.
         */
        const result = await callJudgeWithFallback({
          firstJudge,
          async resolveFallbackJudge() {
            expect(streamedSlugs,).toEqual([
              'test-provider/first',
              'test-provider/first',
              'test-provider/first',
            ],);
            return fallbackJudge;
          },
          callJudgeAttempt({ judge, },) {
            return callJudge({
              model: judge.model,
              auth: judge.auth,
              action: 'bash: echo hi',
              cwd: '/project',
              recentContext: '',
              trustDirectives: [],
              timeoutMs: JUDGE_TIMEOUT_MS,
              systemPrompt:
                'You MUST call the render_verdict tool to submit your evaluation. Do not respond with text; use the tool.',
              batchContext: [],
              streamSimpleFn: function streamSimpleFn(
                model,
              ) {
                /**
                 * Canonical model slug for current transport attempt.
                 */
                const slug = budgetModelSlug(model,);
                streamedSlugs.push(slug,);
                if (slug === budgetModelSlug(fallbackJudge.model,)) {
                  return (async function* fallbackToolStream() {
                    yield {
                      type: 'toolcall_end',
                      contentIndex: 0,
                      toolCall: {
                        id: 'fallback-verdict',
                        name: 'render_verdict',
                        arguments: APPROVE_VERDICT,
                      },
                      partial: {},
                    };
                  })() as never;
                }
                /**
                 * Number of streams started for failed first model.
                 */
                const firstModelStreamCount = streamedSlugs.filter(
                  function isFirstModel(streamedSlug,) {
                    return streamedSlug === budgetModelSlug(firstJudge.model,);
                  },
                )
                  .length;
                return (async function* failedFirstModelStream() {
                  yield {
                    type: 'text_end',
                    contentIndex: 0,
                    content: firstModelStreamCount === 1
                      ? 'First response omitted render_verdict.'
                      : '',
                    partial: {},
                  };
                })() as never;
              } as never,
            },);
          },
        },);

        expect(result,).toEqual(APPROVE_VERDICT,);
        expect(streamedSlugs,).toEqual([
          'test-provider/first',
          'test-provider/first',
          'test-provider/first',
          'test-provider/fallback',
        ],);
      },
    },),
    it({
      name: 'reports fallback selection failure with first error',
      fn: async function reportsFallbackSelectionFailure() {
        /**
         * Initially selected judge.
         */
        const firstJudge = judgeFixture({ id: 'first', },);
        /**
         * Chained error after first attempt and fallback resolution fail.
         */
        const caught = await captureError(async function runFailingSelection() {
          return await callJudgeWithFallback({
            firstJudge,
            async resolveFallbackJudge() {
              throw new Error('no alternative authenticated model',);
            },
            async callJudgeAttempt() {
              throw new Error('first model exhausted retries',);
            },
          },);
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'Judge model test-provider/first failed all retries; selecting another judge model failed',
        );
        expect((caught as Error).message,).toContain('no alternative authenticated model',);
        expect((caught as Error).cause,).toBeInstanceOf(Error,);
      },
    },),
    it({
      name: 'rejects resolver returning failed model again',
      fn: async function rejectsRepeatedModel() {
        /**
         * Initially selected judge returned again by broken fallback resolver.
         */
        const firstJudge = judgeFixture({ id: 'first', },);
        /**
         * Chained error proving model identity check rejected duplicate.
         */
        const caught = await captureError(async function runRepeatedSelection() {
          return await callJudgeWithFallback({
            firstJudge,
            async resolveFallbackJudge() {
              return firstJudge;
            },
            async callJudgeAttempt() {
              throw new Error('first model exhausted retries',);
            },
          },);
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'Fallback judge resolver selected failed model again: test-provider/first',
        );
        expect((caught as Error).cause,).toBeInstanceOf(Error,);
      },
    },),
    it({
      name: 'reports when fallback model also fails all retries',
      fn: async function reportsFallbackAttemptFailure() {
        /**
         * Initially selected judge.
         */
        const firstJudge = judgeFixture({ id: 'first', },);
        /**
         * Distinct fallback judge.
         */
        const fallbackJudge = judgeFixture({ id: 'fallback', },);
        /**
         * Models called before terminal fallback failure.
         */
        const attemptedSlugs: string[] = [];
        /**
         * Chained error after both model attempts fail.
         */
        const caught = await captureError(async function runFailingAttempts() {
          return await callJudgeWithFallback({
            firstJudge,
            async resolveFallbackJudge() {
              return fallbackJudge;
            },
            async callJudgeAttempt({ judge, },) {
              /**
               * Attempt slug captured before deterministic failure.
               */
              const slug = budgetModelSlug(judge.model,);
              attemptedSlugs.push(slug,);
              throw new Error(`${slug} exhausted retries`,);
            },
          },);
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'fallback judge model test-provider/fallback also failed all retries',
        );
        expect((caught as Error).cause,).toBeInstanceOf(Error,);
        expect(attemptedSlugs,).toEqual([
          'test-provider/first',
          'test-provider/fallback',
        ],);
      },
    },),
  ],
},);
