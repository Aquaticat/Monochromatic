/**
 * Unit tests for judge-model fallback race orchestration.
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
import { NoBudgetModelError, } from './budget-model-error.ts';
import { budgetModelSlug, } from './budget-model-identity.ts';
import { callJudgeWithFallback, } from './judge-fallback.ts';
import { callJudge, } from './judge.ts';
import type {
  BudgetModel,
  Verdict,
} from './types.ts';

/** Fixture context window. */
const CONTEXT_WINDOW = 128_000;

/** Fixture maximum output token count. */
const MAX_TOKENS = 4_096;

/** Timeout budget for real judge retry composition test. */
const JUDGE_TIMEOUT_MS = 10_000;

/** Successful fallback verdict fixture. */
const APPROVE_VERDICT = {
  verdict: 'approve',
  reason: 'Fallback judge approved.',
  guidance: '',
} satisfies Verdict;

/** Successful fallback deny fixture. */
const DENY_VERDICT = {
  verdict: 'deny',
  reason: 'Fallback judge denied.',
  guidance: 'Use a safer action.',
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
  /** Complete pi model record used by fallback identity checks. */
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
      name: 'returns primary verdict without resolving fallback contenders',
      fn: async function returnsPrimaryVerdict() {
        /** Calls made to judge attempts. */
        const attemptedSlugs: string[] = [];
        /** Initially selected judge. */
        const firstJudge = judgeFixture({ id: 'first', },);
        /** Verdict returned by the primary judge. */
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
      name: 'resolves two distinct contenders before either fallback attempt starts',
      fn: async function resolvesContendersBeforeRace() {
        /** Complete judge-attempt order. */
        const attemptedSlugs: string[] = [];
        /** Exclusions sent to the fallback selector. */
        const resolverExclusions: (readonly string[])[] = [];
        /** Initially selected judge. */
        const firstJudge = judgeFixture({ id: 'first', },);
        /** First contender in the fallback race. */
        const firstFallback = judgeFixture({ id: 'fallback-one', },);
        /** Second contender in the fallback race. */
        const secondFallback = judgeFixture({ id: 'fallback-two', },);
        /** Verdict settled by the race. */
        const result = await callJudgeWithFallback({
          firstJudge,
          async resolveFallbackJudge({ excludedModelSlugs, },) {
            resolverExclusions.push(excludedModelSlugs,);
            return excludedModelSlugs.length === 1
              ? firstFallback
              : secondFallback;
          },
          async callJudgeAttempt({ judge, },) {
            /** Identity recorded before this attempt yields. */
            const slug = budgetModelSlug(judge.model,);
            attemptedSlugs.push(slug,);
            if (slug === budgetModelSlug(firstJudge.model,))
              throw new Error('primary exhausted retries',);
            if (slug === budgetModelSlug(firstFallback.model,)) {
              await Promise.resolve();
              expect(attemptedSlugs,).toEqual([
                'test-provider/first',
                'test-provider/fallback-one',
                'test-provider/fallback-two',
              ],);
            }
            return APPROVE_VERDICT;
          },
        },);

        expect(result,).toEqual(APPROVE_VERDICT,);
        expect(resolverExclusions,).toEqual([
          ['test-provider/first',],
          [
            'test-provider/first',
            'test-provider/fallback-one',
          ],
        ],);
      },
    },),
    it({
      name: 'ignores a rejected contender until another contender returns a verdict',
      fn: async function ignoresRejectedContender() {
        /** Initially selected judge. */
        const firstJudge = judgeFixture({ id: 'first', },);
        /** Contender that rejects before the winner answers. */
        const rejectedFallback = judgeFixture({ id: 'fallback-one', },);
        /** Contender that returns after the other contender rejects. */
        const winningFallback = judgeFixture({ id: 'fallback-two', },);
        /** Race result, which must come from the later successful contender. */
        const result = await callJudgeWithFallback({
          firstJudge,
          async resolveFallbackJudge({ excludedModelSlugs, },) {
            return excludedModelSlugs.length === 1
              ? rejectedFallback
              : winningFallback;
          },
          async callJudgeAttempt({ judge, },) {
            const slug = budgetModelSlug(judge.model,);
            if (slug === budgetModelSlug(firstJudge.model,))
              throw new Error('primary exhausted retries',);
            if (slug === budgetModelSlug(rejectedFallback.model,))
              throw new Error('first contender unavailable',);
            await Promise.resolve();
            return DENY_VERDICT;
          },
        },);

        expect(result,).toEqual(DENY_VERDICT,);
      },
    },),
    it({
      name: 'returns the earliest successful contender verdict regardless of verdict kind',
      fn: async function returnsEarliestSuccessfulVerdict() {
        /** Initially selected judge. */
        const firstJudge = judgeFixture({ id: 'first', },);
        /** Contender that returns deny after a later contender approves. */
        const delayedDenyFallback = judgeFixture({ id: 'fallback-one', },);
        /** Contender that returns approve before the first contender resumes. */
        const earlyApproveFallback = judgeFixture({ id: 'fallback-two', },);
        /** Verdict selected by settlement order rather than verdict kind. */
        const result = await callJudgeWithFallback({
          firstJudge,
          async resolveFallbackJudge({ excludedModelSlugs, },) {
            return excludedModelSlugs.length === 1
              ? delayedDenyFallback
              : earlyApproveFallback;
          },
          async callJudgeAttempt({ judge, },) {
            const slug = budgetModelSlug(judge.model,);
            if (slug === budgetModelSlug(firstJudge.model,))
              throw new Error('primary exhausted retries',);
            if (slug === budgetModelSlug(delayedDenyFallback.model,)) {
              await Promise.resolve();
              await Promise.resolve();
              return DENY_VERDICT;
            }
            return APPROVE_VERDICT;
          },
        },);

        expect(result,).toEqual(APPROVE_VERDICT,);
      },
    },),
    it({
      name: 'waits for every primary retry before resolving fallback contenders',
      fn: async function waitsForPrimaryRetries() {
        /** Initially selected judge whose streams never produce a verdict. */
        const firstJudge = judgeFixture({ id: 'first', },);
        /** First contender, which returns a forced tool verdict. */
        const firstFallback = judgeFixture({ id: 'fallback-one', },);
        /** Second contender, which returns the same forced tool verdict. */
        const secondFallback = judgeFixture({ id: 'fallback-two', },);
        /** Model slugs observed by the real `callJudge` stream seam. */
        const streamedSlugs: string[] = [];
        /** Verdict returned only after primary retry sequence and fallback race start. */
        const result = await callJudgeWithFallback({
          firstJudge,
          async resolveFallbackJudge({ excludedModelSlugs, },) {
            expect(streamedSlugs,).toEqual([
              'test-provider/first',
              'test-provider/first',
              'test-provider/first',
            ],);
            return excludedModelSlugs.length === 1
              ? firstFallback
              : secondFallback;
          },
          callJudgeAttempt({ judge, },) {
            return callJudge({
              model: judge.model,
              auth: judge.auth,
              action: 'bash: echo hi',
              actionInput: '{"command":"echo hi"}',
              cwd: '/project',
              recentContext: '',
              trustDirectives: [],
              timeoutMs: JUDGE_TIMEOUT_MS,
              systemPrompt:
                'You MUST call the render_verdict tool to submit your evaluation. Do not respond with text; use the tool.',
              batchContext: [],
              streamSimpleFn: function streamSimpleFn(
                model: Model<Api>,
              ) {
                /** Canonical model identity for this transport attempt. */
                const slug = budgetModelSlug(model,);
                streamedSlugs.push(slug,);
                if (slug !== budgetModelSlug(firstJudge.model,)) {
                  return (async function* fallbackToolStream() {
                    yield {
                      type: 'toolcall_end',
                      contentIndex: 0,
                      toolCall: {
                        id: `verdict-${slug}`,
                        name: 'render_verdict',
                        arguments: APPROVE_VERDICT,
                      },
                      partial: {},
                    };
                  })() as never;
                }
                return (async function* emptyPrimaryStream() {
                  yield {
                    type: 'text_end',
                    contentIndex: 0,
                    content: '',
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
          'test-provider/fallback-one',
          'test-provider/fallback-two',
        ],);
      },
    },),
    it({
      name: 'runs one contender when no second fallback model can be selected',
      fn: async function runsSingleFallbackContender() {
        /** Models that reached a judge attempt. */
        const attemptedSlugs: string[] = [];
        /** Initially selected judge. */
        const firstJudge = judgeFixture({ id: 'first', },);
        /** Only resolvable fallback model. */
        const firstFallback = judgeFixture({ id: 'fallback-one', },);
        /** Verdict returned by the sole fallback contender. */
        const result = await callJudgeWithFallback({
          firstJudge,
          async resolveFallbackJudge({ excludedModelSlugs, },) {
            if (excludedModelSlugs.length === 1)
              return firstFallback;
            throw new NoBudgetModelError('no second authenticated fallback model',);
          },
          async callJudgeAttempt({ judge, },) {
            const slug = budgetModelSlug(judge.model,);
            attemptedSlugs.push(slug,);
            if (slug === budgetModelSlug(firstJudge.model,))
              throw new Error('primary exhausted retries',);
            return APPROVE_VERDICT;
          },
        },);

        expect(result,).toEqual(APPROVE_VERDICT,);
        expect(attemptedSlugs,).toEqual([
          'test-provider/first',
          'test-provider/fallback-one',
        ],);
      },
    },),
    it({
      name: 'reports no available fallback judge without starting a race',
      fn: async function reportsNoFallbackModel() {
        /** Models that reached a judge attempt. */
        const attemptedSlugs: string[] = [];
        /** Initially selected judge. */
        const firstJudge = judgeFixture({ id: 'first', },);
        /** Error returned when no fallback model is eligible. */
        const caught = await captureError(async function runWithoutFallbackModel() {
          return await callJudgeWithFallback({
            firstJudge,
            async resolveFallbackJudge() {
              throw new NoBudgetModelError('no fallback models available',);
            },
            async callJudgeAttempt({ judge, },) {
              attemptedSlugs.push(budgetModelSlug(judge.model,),);
              throw new Error('primary exhausted retries',);
            },
          },);
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'no distinct fallback reviewer is available',
        );
        expect(attemptedSlugs,).toEqual(['test-provider/first',],);
      },
    },),
    it({
      name: 'rejects a resolver that returns an excluded model',
      fn: async function rejectsDuplicateFallback() {
        /** Initially selected judge returned again by the broken resolver. */
        const firstJudge = judgeFixture({ id: 'first', },);
        /** Terminal error proving duplicate identity was rejected. */
        const caught = await captureError(async function runDuplicateResolver() {
          return await callJudgeWithFallback({
            firstJudge,
            async resolveFallbackJudge() {
              return firstJudge;
            },
            async callJudgeAttempt() {
              throw new Error('primary exhausted retries',);
            },
          },);
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'Fallback reviewer resolver selected excluded candidate: test-provider/first',
        );
        expect((caught as Error).cause,).toBeInstanceOf(Error,);
      },
    },),
    it({
      name: 'reports primary and both contender failures when the race cannot return a verdict',
      fn: async function reportsAllRaceFailures() {
        /** Initially selected judge. */
        const firstJudge = judgeFixture({ id: 'first', },);
        /** First fallback contender. */
        const firstFallback = judgeFixture({ id: 'fallback-one', },);
        /** Second fallback contender. */
        const secondFallback = judgeFixture({ id: 'fallback-two', },);
        /** Terminal race error. */
        const caught = await captureError(async function exhaustEveryJudge() {
          return await callJudgeWithFallback({
            firstJudge,
            async resolveFallbackJudge({ excludedModelSlugs, },) {
              return excludedModelSlugs.length === 1
                ? firstFallback
                : secondFallback;
            },
            async callJudgeAttempt({ judge, },) {
              throw new Error(`${budgetModelSlug(judge.model,)} exhausted retries`,);
            },
          },);
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'test-provider/first: test-provider/first exhausted retries',
        );
        expect((caught as Error).message,).toContain(
          'test-provider/fallback-one: test-provider/fallback-one exhausted retries',
        );
        expect((caught as Error).message,).toContain(
          'test-provider/fallback-two: test-provider/fallback-two exhausted retries',
        );
        expect((caught as Error).cause,).toBeInstanceOf(AggregateError,);
      },
    },),
  ],
},);
