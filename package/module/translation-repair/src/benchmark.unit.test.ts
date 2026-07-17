/**
 * Tests for the critic benchmark runner over a fake client:
 * every outcome kind becomes attempt data and the scorecard aggregates them.
 * Fixtures are cat-themed invention only.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { runCriticBenchmark, } from './benchmark.ts';
import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  SyntheticClient,
} from './chat-contract.ts';
import { SyntheticHttpError, } from './completion-shape.ts';
import type { SeededErrorSpec, } from './seeded-error.ts';

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
  ],
},);
