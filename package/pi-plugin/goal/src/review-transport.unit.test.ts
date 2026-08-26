/**
 * Built-artifact tests for goal reviewer selection and fallback transport.
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

import {
  rankPromptedReviewers,
  resolveGoalReviewerPool,
  runGoalReviewerPool,
  type GoalReviewerCandidate,
  type PromptedReviewer,
} from '../dist/final/node/index.mjs';

/**
 * Build fully shaped reviewer model.
 *
 * @param provider - provider identity
 *
 * @param id - model identity
 *
 * @param inputCost - input price score
 *
 * @param outputCost - output price score
 *
 * @returns Pi model fixture
 */
function reviewerModel(
  {
    provider,
    id,
    inputCost,
    outputCost,
  }: {
    readonly provider: string;
    readonly id: string;
    readonly inputCost: number;
    readonly outputCost: number;
  },
): Model<Api> {
  return {
    id,
    name: id,
    api: 'openai-completions',
    provider,
    baseUrl: 'https://example.invalid',
    reasoning: false,
    input: ['text',],
    cost: {
      input: inputCost,
      output: outputCost,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: 128_000,
    maxTokens: 16_384,
  };
}

/**
 * Build authenticated reviewer candidate fixture.
 *
 * @param model - reviewer model
 *
 * @returns candidate with deterministic prompt and auth
 */
function reviewerCandidate(model: Model<Api>,): GoalReviewerCandidate {
  return {
    model,
    auth: { apiKey: 'key', },
    systemPrompt: 'Review independently.',
    userContent: 'Evidence.',
    transcriptTruncated: false,
  };
}

/**
 * Build async event stream from fixed reviewer events.
 *
 * @param entries - ordered reviewer events
 *
 * @returns async event stream
 */
async function* reviewerEvents(
  entries: readonly AssistantMessageEvent[],
): AsyncIterable<AssistantMessageEvent> {
  for (const entry of entries)
    yield entry;
}

/**
 * Build private goal verdict stream.
 *
 * @param approved - strict approval value
 *
 * @param rationale - private rationale
 *
 * @param remainingWork - task-only denial guidance
 *
 * @returns one-event reviewer stream
 */
function goalVerdictStream(
  {
    approved,
    rationale,
    remainingWork,
  }: {
    readonly approved: boolean;
    readonly rationale: string;
    readonly remainingWork: string;
  },
): AsyncIterable<AssistantMessageEvent> {
  return reviewerEvents([{
    type: 'toolcall_end',
    contentIndex: 0,
    toolCall: {
      type: 'toolCall',
      id: 'goal-review',
      name: 'submit_goal_review',
      arguments: {
        approved,
        rationale,
        remaining_work: remainingWork,
      },
    },
    partial: {} as never,
  },],);
}

/**
 * Build unexpected-tool reviewer failure.
 *
 * @param id - failure identity
 *
 * @returns one-event reviewer stream
 */
function goalFailureStream(id: string,): AsyncIterable<AssistantMessageEvent> {
  return reviewerEvents([{
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
 * Build deterministic reviewer transport data.
 *
 * @param responses - ordered response streams
 *
 * @returns mutable script state
 */
function goalReviewTransport(
  responses: readonly AsyncIterable<AssistantMessageEvent>[],
): ScriptedStructuredReviewTransport {
  return {
    nextResponseIndex: 0,
    responses,
    requests: [],
  };
}

await describe({
  name: resolveGoalReviewerPool.name,
  children: [
    it({
      name: 'excludes primary and ranks authenticated expected cost',
      fn: async () => {
        const primary = reviewerModel({
          provider: 'primary',
          id: 'model',
          inputCost: 100,
          outputCost: 100,
        },);
        const lower = reviewerModel({
          provider: 'review',
          id: 'lower',
          inputCost: 1,
          outputCost: 1,
        },);
        const higher = reviewerModel({
          provider: 'review',
          id: 'higher',
          inputCost: 2,
          outputCost: 2,
        },);
        /** Effective live-scope and auth context. */
        const context = {
          cwd: process.cwd(),
          model: primary,
          getScopedModels() {
            return [{ model: primary, }, { model: lower, }, { model: higher, },];
          },
          modelRegistry: {
            getAvailable() {
              return [primary, lower, higher,];
            },
            async getApiKeyAndHeaders() {
              return { ok: true, apiKey: 'key', };
            },
          },
        } as unknown as ExtensionContext;
        /** Ranked authenticated pool. */
        const pool = await resolveGoalReviewerPool({
          context,
          evidence: {
            objective: 'Objective',
            transcriptChunks: ['Evidence',],
          },
        },);
        expect(pool.candidates.map(function identity(candidate: GoalReviewerCandidate,) {
          return `${candidate.model.provider}/${candidate.model.id}`;
        },),).toEqual(['review/higher', 'review/lower',],);
        expect(rankPromptedReviewers(pool.candidates.map(function prompted(candidate,) {
          return {
            model: candidate.model,
            canonicalSlug: `${candidate.model.provider}/${candidate.model.id}`,
            systemPrompt: candidate.systemPrompt,
            userContent: candidate.userContent,
            transcriptTruncated: candidate.transcriptTruncated,
            estimatedInputTokens: 100,
          } satisfies PromptedReviewer;
        },),)[0]?.canonicalSlug,).toBe('review/higher',);
      },
    },),
  ],
},);

await describe({
  name: runGoalReviewerPool.name,
  children: [
    it({
      name: 'uses valid denial and races distinct fallbacks after failure',
      fn: async () => {
        /** Expected-cost reviewer order. */
        const candidates = [
          reviewerCandidate(reviewerModel({
            provider: 'review',
            id: 'first',
            inputCost: 3,
            outputCost: 3,
          },),),
          reviewerCandidate(reviewerModel({
            provider: 'review',
            id: 'fallback-deny',
            inputCost: 2,
            outputCost: 2,
          },),),
          reviewerCandidate(reviewerModel({
            provider: 'other',
            id: 'fallback-fail',
            inputCost: 1,
            outputCost: 1,
          },),),
        ];
        /** Initial valid denial transport starts only first candidate. */
        const directTransport = goalReviewTransport([goalVerdictStream({
          approved: false,
          rationale: 'Evidence missing.',
          remainingWork: 'Run integration tests.',
        },),],);
        const direct = await runGoalReviewerPool({
          pool: { candidates, diagnostics: [], },
          testTransport: directTransport,
        },);
        expect(direct.verdict.remainingWork,).toBe('Run integration tests.',);
        expect(directTransport.requests,).toHaveLength(1,);
        /** Failed initial then two selected fallback transports. */
        const fallbackTransport = goalReviewTransport([
          goalFailureStream('initial',),
          goalVerdictStream({
            approved: false,
            rationale: 'Integration evidence missing.',
            remainingWork: 'Add integration evidence.',
          },),
          goalFailureStream('fallback-fail',),
        ],);
        const fallback = await runGoalReviewerPool({
          pool: { candidates, diagnostics: [], },
          testTransport: fallbackTransport,
        },);
        expect(fallback.verdict.remainingWork,).toBe('Add integration evidence.',);
        expect(fallback.reviewerIdentity,).toBe('review/fallback-deny',);
        expect(fallback.attemptedReviewerIdentities,).toEqual([
          'review/first',
          'review/fallback-deny',
          'other/fallback-fail',
        ],);
      },
    },),
  ],
},);
