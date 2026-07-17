/**
 * Tests for the critic benchmark runner over a fake client:
 * every outcome kind becomes attempt data and the scorecard aggregates them.
 * Fixtures are cat-themed invention only.
 *
 * @module
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  MIN_DISPATCH_BUDGET_MS,
  runCriticBenchmark,
} from './benchmark.ts';
import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  SyntheticClient,
} from './chat-contract.ts';
import { SyntheticHttpError, } from './completion-shape.ts';
import type { SeededErrorSpec, } from './seeded-error.ts';
import { COMPLETION_TOKEN_CEILING, } from './attempt-retry.ts';
import { createSyntheticClient, } from './synthetic-client.ts';
import type {
  TransportExchange,
  TransportReply,
} from './synthetic-transport.ts';

/**
 * Delay of the deliberately slow budget-test clients;
 * one call sinks the remaining budget under the dispatch floor.
 */
const BUDGET_CALL_DELAY_MS = 60;

/**
 * Invented zh source with a butterfly sentence the seed will delete from the
 * translation.
 */
const SOURCE_TEXT =
  '---\nname: 小猫-whiskers\n---\n\n## 简介\n\n猫猫喜欢晒太阳。猫猫也喜欢追蝴蝶，追到花园的另一头也不肯停下来。\n';

/**
 * Clean invented translation the seed is planted into.
 */
const TARGET_TEXT =
  '---\nname: 小猫-whiskers\n---\n\n## Introduction\n\nThe cat loves napping in the sun. The cat also chases butterflies all the way across the garden without stopping.\n';

/**
 * Deletion seed removing the butterfly sentence from the translation.
 */
const BUTTERFLY_SEED: SeededErrorSpec = {
  id: 'seed/omission-0',
  category: 'accuracy/omission',
  kind: 'deletion',
  needle: ' The cat also chases butterflies all the way across the garden without stopping.',
  replacement: '',
};

/**
 * Wire report from the model that finds the seed,
 * plus one sloppy paraphrased issue that must fail resolution.
 */
const HIT_REPORT = JSON.stringify({
  issues: [
    {
      category: 'accuracy/omission',
      severity: 'major',
      summary: 'The butterfly sentence is untranslated.',
      sourceQuote: '猫猫也喜欢追蝴蝶，追到花园的另一头也不肯停下来。',
      targetQuote: 'The cat loves napping in the sun.',
    },
    {
      category: 'fluency/grammar',
      severity: 'minor',
      summary: 'Paraphrased evidence that must be rejected.',
      targetQuote: 'The cat adores the sunshine.',
    },
  ],
},);

/**
 * Canned behavior of each fake model.
 */
const CANNED: Readonly<Record<string, {
  readonly kind: 'ok' | 'refusal' | 'mismatch' | 'http';
  readonly json?: string;
}>> = {
  'hf:zai-org/GLM-5.2': {
    kind: 'ok',
    json: HIT_REPORT,
  },
  'hf:zai-org/GLM-4.7-Flash': { kind: 'refusal', },
  'hf:Qwen/Qwen3.6-27B': { kind: 'mismatch', },
  'hf:MiniMaxAI/MiniMax-M3': { kind: 'http', },
};

/**
 * Fake client replaying canned outcomes per model.
 */
const fakeClient: SyntheticClient = {
  chatText: async function unusedChatText() {
    throw new Error('chatText unused in this fixture',);
  },
  chatJson: async function fakeChatJson<ValueT,>(
    request: ForeignBorrowed<ChatJsonRequest<ValueT>>,
  ): Promise<ChatJsonOutcome<ValueT>> {
    /**
     * Canned behavior for the requested model.
     */
    const canned = nonNullishOrThrow(CANNED[request.modelId],);
    if (canned.kind === 'http') {
      throw new SyntheticHttpError({
        status: 429,
        bodyText: 'slow down',
      },);
    }
    if (canned.kind === 'refusal') {
      return {
        kind: 'refusal-shaped',
        rawText: 'declined',
        marker: 'api-refusal-field',
      };
    }
    if (canned.kind === 'mismatch') {
      return {
        kind: 'schema-mismatch',
        rawText: 'meow meow',
        detail: 'content is not valid JSON: meow',
      };
    }

    /**
     * Canned report parsed and admitted through the caller's own guard.
     */
    const value: unknown = JSON.parse(nonNullishOrThrow(canned.json,),);
    if (!request.validate(value,))
      throw new Error('fixture must satisfy the caller validator',);
    return {
      kind: 'ok',
      value,
      rawText: nonNullishOrThrow(canned.json,),
      usage: {
        prompt_tokens: 100,
        completion_tokens: 900,
      },
    };
  },
  quotas: async function unusedQuotas() {
    throw new Error('quotas unused in this fixture',);
  },
};

await describe({
  name: runCriticBenchmark.name,
  children: [
    it({
      name: 'grades every outcome kind and aggregates the scorecard',
      fn: async () => {
        /** Whole benchmark result over one entry and four canned models. */
        const result = await runCriticBenchmark({
          client: fakeClient,
          entries: [{
            entryId: 'whiskers',
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            seeds: [BUTTERFLY_SEED,],
          },],
          modelIds: [
            'hf:zai-org/GLM-5.2',
            'hf:zai-org/GLM-4.7-Flash',
            'hf:Qwen/Qwen3.6-27B',
            'hf:MiniMaxAI/MiniMax-M3',
          ],
          signal: new AbortController().signal,
        },);

        expect(result.attempts,).toHaveLength(4,);

        /** Record of the model that found the seed. */
        const hit = nonNullishOrThrow(result.attempts.find(function byModel(attempt,) {
          return attempt.modelId === 'hf:zai-org/GLM-5.2';
        },),);
        expect(hit.outcomeKind,).toBe('ok',);
        expect(hit.resolvedClaimCount,).toBe(1,);
        expect(hit.unresolvedReasons,).toEqual(['quote-not-found (target)',],);
        expect(hit.seededHitIds,).toEqual(['seed/omission-0',],);
        expect(hit.completionTokens,).toBe(900,);

        /** Records of the three failing models keyed by outcome. */
        const kinds = result.attempts.map(function toKind(attempt,) {
          return attempt.outcomeKind;
        },);
        expect(kinds,).toContain('refusal-shaped',);
        expect(kinds,).toContain('schema-mismatch',);
        expect(kinds,).toContain('http-error',);

        /** Record of the model whose 429s exhausted both attempts. */
        const throttled = nonNullishOrThrow(result.attempts.find(function byModel(attempt,) {
          return attempt.modelId === 'hf:MiniMaxAI/MiniMax-M3';
        },),);
        // HTTP failures earn the single second attempt too.
        expect(throttled.retriedFirstAttemptDetail,).toBe('HTTP 429',);

        /** Scorecard row of the hitting model. */
        const hitRow = nonNullishOrThrow(result.scorecard.rows.find(function byModel(row,) {
          return row.modelId === 'hf:zai-org/GLM-5.2';
        },),);
        expect(hitRow.seededRecall,).toBe(1,);
        expect(hitRow.schemaOkRate,).toBe(1,);

        /** Scorecard row of the refusing model. */
        const refusalRow = nonNullishOrThrow(result.scorecard.rows.find(function byModel(row,) {
          return row.modelId === 'hf:zai-org/GLM-4.7-Flash';
        },),);
        expect(refusalRow.refusalRate,).toBe(1,);
        expect(refusalRow.seededRecall,).toBe(0,);

        expect(result.scorecard.seedUniverse,).toBe(1,);
        expect(result.scorecard.ensembleRecall,).toBe(1,);
      },
    },),

    it({
      name: 'records non-abort transport failures and rethrows after abort',
      fn: async () => {
        /**
         * Fake client whose only behavior is throwing a transport failure.
         */
        const failingClient: SyntheticClient = {
          ...fakeClient,
          chatJson: async function throwingChatJson() {
            throw new TypeError('fetch failed',);
          },
        };
        /** Result with a live signal: failure becomes attempt data. */
        const survived = await runCriticBenchmark({
          client: failingClient,
          entries: [{
            entryId: 'whiskers',
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            seeds: [BUTTERFLY_SEED,],
          },],
          modelIds: ['hf:zai-org/GLM-5.2',],
          signal: new AbortController().signal,
        },);
        expect(survived.attempts[0]?.outcomeKind,).toBe('http-error',);
        expect(survived.attempts[0]?.detail,).toContain('transport:',);

        /** Aborted controller: the same failure must propagate. */
        const aborted = new AbortController();
        aborted.abort();
        /** Value caught from the aborted run. */
        let caught: unknown;
        try {
          await runCriticBenchmark({
            client: failingClient,
            entries: [{
              entryId: 'whiskers',
              sourceText: SOURCE_TEXT,
              targetText: TARGET_TEXT,
              seeds: [BUTTERFLY_SEED,],
            },],
            modelIds: ['hf:zai-org/GLM-5.2',],
            signal: aborted.signal,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof TypeError,).toBe(true,);
      },
    },),

    it({
      name: 'retries a truncated attempt once and keeps the recovery',
      fn: async () => {
        /** Outcome log, one entry per exchange the fake client served. */
        const served: string[] = [];
        /**
         * Fake client that truncates on the first exchange and answers
         * cleanly on the second, like a ceiling blowout that recovers.
         */
        const flippingClient: SyntheticClient = {
          ...fakeClient,
          chatJson: async function flippingChatJson<ValueT,>(
            request: ForeignBorrowed<ChatJsonRequest<ValueT>>,
          ): Promise<ChatJsonOutcome<ValueT>> {
            if (served.length === 0) {
              served.push('truncated',);
              return {
                kind: 'schema-mismatch',
                rawText: '<think>still thinking about cats',
                detail: 'output was truncated inside its thinking block;'
                  + ' raise or omit maxTokens (thinking tokens count against it)',
                usage: {
                  prompt_tokens: 100,
                  completion_tokens: COMPLETION_TOKEN_CEILING,
                },
              };
            }
            served.push('ok',);
            return await fakeClient.chatJson(request,);
          },
        };
        /** Result whose single attempt recovered on the retry. */
        const result = await runCriticBenchmark({
          client: flippingClient,
          entries: [{
            entryId: 'whiskers',
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            seeds: [BUTTERFLY_SEED,],
          },],
          modelIds: ['hf:zai-org/GLM-5.2',],
          signal: new AbortController().signal,
        },);

        expect(served,).toEqual(['truncated', 'ok',],);
        expect(result.attempts,).toHaveLength(1,);
        expect(result.attempts[0]?.outcomeKind,).toBe('ok',);
        expect(result.attempts[0]?.seededHitIds,).toEqual(['seed/omission-0',],);
        expect(result.attempts[0]?.retriedFirstAttemptDetail,)
          .toContain('truncated inside its thinking block',);
      },
    },),

    it({
      name: 'retries an http-error attempt once and keeps the recovery',
      fn: async () => {
        /** Outcome log, one entry per exchange the fake client served. */
        const served: string[] = [];
        /**
         * Fake client that sheds the first exchange as a gateway failure
         * and answers cleanly on the second, like a burst-gate 502 that
         * outlived the transport-level retries.
         */
        const sheddingClient: SyntheticClient = {
          ...fakeClient,
          chatJson: async function sheddingChatJson<ValueT,>(
            request: ForeignBorrowed<ChatJsonRequest<ValueT>>,
          ): Promise<ChatJsonOutcome<ValueT>> {
            if (served.length === 0) {
              served.push('shed',);
              throw new SyntheticHttpError({
                status: 502,
                bodyText: 'bad gateway',
              },);
            }
            served.push('ok',);
            return await fakeClient.chatJson(request,);
          },
        };
        /** Result whose single attempt recovered on the retry. */
        const result = await runCriticBenchmark({
          client: sheddingClient,
          entries: [{
            entryId: 'whiskers',
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            seeds: [BUTTERFLY_SEED,],
          },],
          modelIds: ['hf:zai-org/GLM-5.2',],
          signal: new AbortController().signal,
        },);

        expect(served,).toEqual(['shed', 'ok',],);
        expect(result.attempts,).toHaveLength(1,);
        expect(result.attempts[0]?.outcomeKind,).toBe('ok',);
        expect(result.attempts[0]?.seededHitIds,).toEqual(['seed/omission-0',],);
        expect(result.attempts[0]?.retriedFirstAttemptDetail,).toBe('HTTP 502',);
      },
    },),

    it({
      name: 'caps truncation retries at exactly one',
      fn: async () => {
        /** Outcome log, one entry per exchange the fake client served. */
        const served: string[] = [];
        /**
         * Fake client that truncates every exchange, like a pair spiraling
         * a model's thinking on every pass.
         */
        const spiralingClient: SyntheticClient = {
          ...fakeClient,
          chatJson: async function spiralingChatJson() {
            served.push('truncated',);
            return {
              kind: 'schema-mismatch',
              rawText: '{"issues":[{"category":"accu',
              detail: 'content is not valid JSON: Unexpected end of JSON input',
            };
          },
        };
        /** Result whose single attempt stayed truncated after the retry. */
        const result = await runCriticBenchmark({
          client: spiralingClient,
          entries: [{
            entryId: 'whiskers',
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            seeds: [BUTTERFLY_SEED,],
          },],
          modelIds: ['hf:zai-org/GLM-5.2',],
          signal: new AbortController().signal,
        },);

        expect(served,).toEqual(['truncated', 'truncated',],);
        expect(result.attempts,).toHaveLength(1,);
        expect(result.attempts[0]?.outcomeKind,).toBe('schema-mismatch',);
        expect(result.attempts[0]?.retriedFirstAttemptDetail,)
          .toContain('Unexpected end of JSON input',);
      },
    },),

    it({
      name: 'skips what the run budget cannot fit and reports coverage',
      fn: async () => {
        /**
         * Fake client whose calls take one measurable delay each.
         */
        const slowClient: SyntheticClient = {
          ...fakeClient,
          chatJson: async function slowChatJson<ValueT,>(
            request: ForeignBorrowed<ChatJsonRequest<ValueT>>,
          ): Promise<ChatJsonOutcome<ValueT>> {
            await wait(BUDGET_CALL_DELAY_MS,);
            return await fakeClient.chatJson(request,);
          },
        };
        /**
         * Three entries against a budget that fits exactly one call:
         * after the first call the remaining budget sinks under the
         * dispatch floor and the rest must record as skipped.
         */
        const result = await runCriticBenchmark({
          client: slowClient,
          entries: ['one', 'two', 'three',].map(function toEntry(suffix,) {
            return {
              entryId: `whiskers-${suffix}`,
              sourceText: SOURCE_TEXT,
              targetText: TARGET_TEXT,
              seeds: [BUTTERFLY_SEED,],
            };
          },),
          modelIds: ['hf:zai-org/GLM-5.2',],
          signal: new AbortController().signal,
          runBudgetMs: MIN_DISPATCH_BUDGET_MS + (BUDGET_CALL_DELAY_MS / 2),
        },);

        expect(result.attempts.map(function toKind(attempt,) {
          return attempt.outcomeKind;
        },),).toEqual(['ok', 'skipped', 'skipped',],);
        expect(result.attempts[1]?.detail,).toBe('run-budget-exhausted',);

        /** Row of the only model; rates cover dispatched attempts only. */
        const row = nonNullishOrThrow(result.scorecard.rows[0],);
        expect(row.attempts,).toBe(1,);
        expect(row.skipped,).toBe(2,);
        expect(row.schemaOkRate,).toBe(1,);
        expect(row.seededRecall,).toBe(1,);
        // Only the dispatched entry's seed enters the recall universe.
        expect(result.scorecard.seedUniverse,).toBe(1,);
        expect(result.scorecard.ensembleRecall,).toBe(1,);
        expect(result.scorecard.coverage,).toBeCloseTo(1 / 3,);
      },
    },),

    it({
      name: 'keeps a dispatched failure when the budget kills its retry',
      fn: async () => {
        /**
         * Fake client that burns delay and returns a truncated mismatch,
         * so the single retry is earned but the budget cannot fit it.
         */
        const truncatingSlowClient: SyntheticClient = {
          ...fakeClient,
          chatJson: async function truncatingSlowChatJson<ValueT,>(): Promise<
            ChatJsonOutcome<ValueT>
          > {
            await wait(BUDGET_CALL_DELAY_MS,);
            return {
              kind: 'schema-mismatch',
              rawText: '<think>still thinking about cats',
              detail: 'output was truncated inside its thinking block;'
                + ' raise or omit maxTokens (thinking tokens count against it)',
            };
          },
        };
        /** Result whose first attempt stands because the retry was cut. */
        const result = await runCriticBenchmark({
          client: truncatingSlowClient,
          entries: [{
            entryId: 'whiskers',
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            seeds: [BUTTERFLY_SEED,],
          },],
          modelIds: ['hf:zai-org/GLM-5.2',],
          signal: new AbortController().signal,
          runBudgetMs: MIN_DISPATCH_BUDGET_MS + (BUDGET_CALL_DELAY_MS / 2),
        },);

        expect(result.attempts,).toHaveLength(1,);
        // The dispatched mismatch stands; skipping would erase real data.
        expect(result.attempts[0]?.outcomeKind,).toBe('schema-mismatch',);
        expect(result.attempts[0]?.retriedFirstAttemptDetail,).toBe(undefined,);
      },
    },),

    it({
      name: 'forfeits a hung call to its per-call deadline as attempt data',
      fn: async () => {
        /**
         * Transport that never answers, rejecting only when its exchange
         * signal aborts, like a stuck streamed exchange.
         * Exercises the real client so the deadline the client arms
         * inside its per-model slot is the thing under test.
         *
         * @param exchange - request left hanging
         *
         * @returns Never resolves; rejects with the abort reason
         *
         * @example
         * ```ts
         * await hangingTransport(exchange,);
         * ```
         */
        async function hangingTransport(
          exchange: ForeignBorrowed<TransportExchange>,
        ): Promise<TransportReply> {
          /** Gate rejected by the exchange signal's abort reason. */
          const gate = Promise.withResolvers<TransportReply>();
          exchange.signal.addEventListener(
            'abort',
            function onAbort() {
              gate.reject(exchange.signal.reason,);
            },
          );
          return gate.promise;
        }

        /** Real client over the hanging transport. */
        const hangingClient = createSyntheticClient({
          apiKey: 'test-key',
          transport: hangingTransport,
        },);
        /** Result with a short per-call deadline and a live caller signal. */
        const result = await runCriticBenchmark({
          client: hangingClient,
          entries: [{
            entryId: 'whiskers',
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            seeds: [BUTTERFLY_SEED,],
          },],
          modelIds: ['hf:zai-org/GLM-5.2',],
          signal: new AbortController().signal,
          perCallTimeoutMs: 50,
        },);
        expect(result.attempts[0]?.outcomeKind,).toBe('http-error',);
        expect(result.attempts[0]?.detail,).toContain('Timeout',);
        // The hung first attempt earned the single second attempt.
        expect(result.attempts[0]?.retriedFirstAttemptDetail,)
          .toContain('Timeout',);
      },
    },),
  ],
},);
