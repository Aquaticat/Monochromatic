/**
 * Built-artifact tests for completion preflight, review context, selection, and outcomes.
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import type {
  ExtensionAPI,
  ExtensionContext,
  SessionEntry,
  SessionMessageEntry,
  ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildBudgetedGoalReviewPrompt,
  buildGoalReviewEvidence,
  createGoalController,
  executeGoalCompletion,
  goalCompletionFinalityFromMessage,
  parseGoalReviewVerdict,
  preflightGoalCompletion,
  rankPromptedReviewers,
  reduceGoalEvents,
  registerGoalCompletion,
  resolveGoalReviewerPool,
  ReviewerContextTooLargeError,
  summaryContradictsCompletion,
  truncateTranscript,
  type ActiveGoalState,
  type GoalControllerState,
  type GoalLifecycleHandle,
  type GoalReviewerCandidate,
  type PromptedReviewer,
  type ValidGoalCompletionRequest,
} from '../dist/final/node/index.mjs';

/**
 * Captured message-end callback shape for registration test.
 */
type CapturedMessageEndHandler = (
  event: { readonly message: SessionMessageEntry['message']; },
  context: ExtensionContext,
) => unknown;

/** Stable start timestamp. */
const STARTED_AT = '2026-07-16T00:00:00.000Z';

/** Stable completion timestamp. */
const COMPLETED_AT = '2026-07-16T00:01:00.000Z';

/**
 * Build active completion-test goal.
 *
 * @returns active goal state
 */
function completionGoal(): ActiveGoalState {
  /** Reduced active fixture. */
  const goal = reduceGoalEvents([{
    kind: 'run_started',
    runId: 'run-1',
    generationId: 'generation-1',
    objective: 'Ship reviewed feature',
    startedAt: STARTED_AT,
    startBoundary: 'leaf-before-start',
    continuationSequence: 0,
    transitionedAt: STARTED_AT,
  },],);
  if (goal.phase !== 'active')
    throw new Error('expected active completion fixture',);
  return goal;
}

/**
 * Build active controller fixture.
 *
 * @returns active controller
 */
function completionController(): GoalControllerState {
  return {
    goal: completionGoal(),
    runtimeEpoch: 'runtime-1',
    settlementSequence: 0,
    shutdown: false,
  };
}

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
 * Build assistant message fixture with ordered tool calls.
 *
 * @param calls - ordered id and tool-name pairs
 *
 * @returns finalized assistant message
 */
function assistantMessage(
  calls: readonly { readonly id: string; readonly name: string; }[],
): SessionMessageEntry['message'] {
  return {
    role: 'assistant',
    content: calls.map(function toolCall(call,) {
      return {
        type: 'toolCall' as const,
        id: call.id,
        name: call.name,
        arguments: {},
      };
    },),
    api: 'openai-completions',
    provider: 'primary',
    model: 'primary-model',
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
    },
    stopReason: 'toolUse',
    timestamp: 1,
  };
}

/**
 * Build locally validated request fixture.
 *
 * @returns request bound to active controller identities
 */
function completionRequest(): ValidGoalCompletionRequest {
  return {
    goal: completionGoal(),
    goalId: 'generation-1',
    summary: 'Implemented feature and all tests pass.',
    runtimeEpoch: 'runtime-1',
    branchLeafId: 'leaf-current',
    toolCallId: 'completion-call',
  };
}

await describe({
  name: preflightGoalCompletion.name,
  children: [
    it({
      name: 'accepts normalized matching final completion claim',
      fn: async () => {
        /** Accepted normalized request. */
        const result = preflightGoalCompletion({
          controller: completionController(),
          runtimeEpoch: 'runtime-1',
          branchLeafId: 'leaf-current',
          toolCallId: 'completion-call',
          goalId: ' generation-1 ',
          summary: ' Implemented and verified. ',
          isFinalToolCall: true,
        },);
        expect(result.accepted,).toBe(true,);
        if (!result.accepted)
          throw new Error('expected accepted completion preflight',);
        expect(result.request.goalId,).toBe('generation-1',);
        expect(result.request.summary,).toBe('Implemented and verified.',);
      },
    },),
    it({
      name: 'rejects absent, empty, stale, non-final, and contradictory claims locally',
      fn: async () => {
        /** Shared valid preflight input. */
        const valid = {
          controller: completionController(),
          runtimeEpoch: 'runtime-1',
          branchLeafId: 'leaf-current',
          toolCallId: 'completion-call',
          goalId: 'generation-1',
          summary: 'Done and verified.',
          isFinalToolCall: true,
        } as const;
        expect(preflightGoalCompletion({
          ...valid,
          controller: createGoalController('runtime-1',),
        },).accepted,).toBe(false,);
        expect(preflightGoalCompletion({ ...valid, goalId: ' ', },).accepted,).toBe(false,);
        expect(preflightGoalCompletion({ ...valid, summary: ' ', },).accepted,).toBe(false,);
        expect(preflightGoalCompletion({ ...valid, goalId: 'stale', },).accepted,).toBe(false,);
        expect(preflightGoalCompletion({ ...valid, isFinalToolCall: false, },).accepted,).toBe(false,);
        expect(preflightGoalCompletion({ ...valid, summary: 'Tests still fail.', },).accepted,).toBe(false,);
        expect(summaryContradictsCompletion('Everything is complete.',),).toBe(false,);
        expect(summaryContradictsCompletion('Work is NOT FINISHED.',),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: goalCompletionFinalityFromMessage.name,
  children: [
    it({
      name: 'marks completion final only when no later sibling tool call exists',
      fn: async () => {
        /** Assistant message with completion calls around sibling tool. */
        const message = assistantMessage([
          { id: 'completion-first', name: 'goal_complete', },
          { id: 'read-later', name: 'read', },
          { id: 'completion-final', name: 'goal_complete', },
        ],);
        expect(goalCompletionFinalityFromMessage(message,),).toEqual([
          { toolCallId: 'completion-first', isFinalToolCall: false, },
          { toolCallId: 'completion-final', isFinalToolCall: true, },
        ],);
      },
    },),
  ],
},);

await describe({
  name: buildGoalReviewEvidence.name,
  children: [
    it({
      name: 'uses only post-start active branch evidence and excludes pending completion message',
      fn: async () => {
        /** Selected active branch with pre-goal, state, evidence, and pending completion entries. */
        const branch: SessionEntry[] = [
          {
            type: 'message',
            id: 'pre-goal',
            parentId: null,
            timestamp: STARTED_AT,
            message: {
              role: 'user',
              content: 'secret pre-goal history',
              timestamp: 0,
            },
          },
          {
            type: 'custom',
            customType: 'goal:state',
            id: 'start',
            parentId: 'pre-goal',
            timestamp: STARTED_AT,
            data: {
              kind: 'run_started',
              runId: 'run-1',
              generationId: 'generation-1',
              objective: 'Ship reviewed feature',
              startedAt: STARTED_AT,
              startBoundary: 'leaf-before-start',
              continuationSequence: 0,
              transitionedAt: STARTED_AT,
            },
          },
          {
            type: 'custom_message',
            customType: 'goal',
            id: 'visible-goal-message',
            parentId: 'start',
            timestamp: COMPLETED_AT,
            content: 'visible goal continuation',
            display: true,
            details: {
              runId: 'run-1',
              generationId: 'generation-1',
              continuationSequence: 1,
              marker: 'marker-visible',
              kind: 'continuation',
            },
          },
          {
            type: 'custom_message',
            customType: 'goal',
            id: 'hidden-goal-message',
            parentId: 'visible-goal-message',
            timestamp: COMPLETED_AT,
            content: 'hidden goal message',
            display: false,
            details: {
              runId: 'run-1',
              generationId: 'generation-1',
              continuationSequence: 2,
              marker: 'marker-hidden',
              kind: 'continuation',
            },
          },
          {
            type: 'message',
            id: 'evidence',
            parentId: 'hidden-goal-message',
            timestamp: COMPLETED_AT,
            message: {
              role: 'user',
              content: 'post-start requirement evidence',
              timestamp: 1,
            },
          },
          {
            type: 'custom',
            customType: 'goal:state',
            id: 'rotation',
            parentId: 'evidence',
            timestamp: COMPLETED_AT,
            data: {
              kind: 'generation_rotated',
              runId: 'run-1',
              previousGenerationId: 'generation-old',
              generationId: 'generation-1',
              continuationSequence: 0,
              transitionedAt: COMPLETED_AT,
              cause: 'runtime_restore',
            },
          },
          {
            type: 'message',
            id: 'pending',
            parentId: 'rotation',
            timestamp: COMPLETED_AT,
            message: assistantMessage([{ id: 'completion-call', name: 'goal_complete', },]),
          },
        ];
        /** Serialized review evidence. */
        const evidence = buildGoalReviewEvidence({
          branch,
          request: completionRequest(),
        },);
        expect(evidence.transcriptChunks.join('\n',),).toContain('post-start requirement evidence',);
        expect(evidence.transcriptChunks.join('\n',),).toContain('visible goal continuation',);
        expect(evidence.transcriptChunks.join('\n',),).not.toContain('hidden goal message',);
        expect(evidence.transcriptChunks.join('\n',),).not.toContain('secret pre-goal history',);
        expect(evidence.transcriptChunks.join('\n',),).not.toContain('goal_complete',);
        expect(evidence.transcriptChunks.join('\n',),).not.toContain('generation_rotated',);
      },
    },),
  ],
},);

await describe({
  name: truncateTranscript.name,
  children: [
    it({
      name: 'retains full transcript when it fits and newest evidence when truncated',
      fn: async () => {
        expect(truncateTranscript({
          chunks: ['old', 'new',],
          maximumCharacters: 100,
        },),).toEqual({
          transcript: 'old\n\n---\n\nnew',
          truncated: false,
        },);
        /** Truncated transcript retaining newest evidence. */
        const truncated = truncateTranscript({
          chunks: ['old evidence that should disappear '.repeat(4,), 'new evidence',],
          maximumCharacters: 80,
        },);
        expect(truncated.truncated,).toBe(true,);
        expect(truncated.transcript,).toContain('Older post-start evidence omitted',);
        expect(truncated.transcript,).toContain('new evidence',);
        expect(truncated.transcript.length,).toBeLessThanOrEqual(80,);
        expect(truncated.transcript,).not.toContain('old evidence that should disappear',);
      },
    },),
    it({
      name: 'keeps objective and summary outside truncatable transcript and rejects undersized model',
      fn: async () => {
        /** Candidate-specific bounded prompt. */
        const prompt = buildBudgetedGoalReviewPrompt({
          evidence: {
            objective: 'Exact objective',
            summary: 'Exact summary',
            transcriptChunks: ['x'.repeat(20_000,),],
          },
          contextWindow: 20_000,
        },);
        expect(prompt.userContent,).toContain('Exact objective',);
        expect(prompt.userContent,).toContain('Exact summary',);
        expect(prompt.transcriptTruncated,).toBe(true,);
        expect(() => buildBudgetedGoalReviewPrompt({
          evidence: {
            objective: 'Objective',
            summary: 'Summary',
            transcriptChunks: [],
          },
          contextWindow: 100,
        },),).toThrow(ReviewerContextTooLargeError,);
      },
    },),
  ],
},);

await describe({
  name: parseGoalReviewVerdict.name,
  children: [
    it({
      name: 'accepts exact verdict and rejects malformed or extra fields',
      fn: async () => {
        expect(parseGoalReviewVerdict({
          approved: false,
          feedback: ' Fix tests. ',
        },),).toEqual({
          approved: false,
          feedback: 'Fix tests.',
        },);
        expect(() => parseGoalReviewVerdict({ approved: true, },),).toThrow();
        expect(() => parseGoalReviewVerdict({ approved: 'true', feedback: 'ok', },),).toThrow();
        expect(() => parseGoalReviewVerdict({ approved: true, feedback: 'ok', extra: true, },),).toThrow();
      },
    },),
  ],
},);

await describe({
  name: resolveGoalReviewerPool.name,
  children: [
    it({
      name: 'excludes primary, authenticates scope, and ranks highest expected cost first',
      fn: async () => {
        /** Active primary excluded exactly. */
        const primary = reviewerModel({
          provider: 'primary',
          id: 'model',
          inputCost: 100,
          outputCost: 100,
        },);
        /** Lower-cost eligible reviewer. */
        const lower = reviewerModel({
          provider: 'review',
          id: 'lower',
          inputCost: 1,
          outputCost: 1,
        },);
        /** Higher-cost eligible reviewer. */
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
            return [
              { model: primary, },
              { model: lower, },
              { model: higher, },
            ];
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
            summary: 'Summary',
            transcriptChunks: ['Evidence',],
          },
        },);
        expect(pool.candidates.map(function identity(candidate: GoalReviewerCandidate,) {
          return `${candidate.model.provider}/${candidate.model.id}`;
        },),).toEqual([
          'review/higher',
          'review/lower',
        ],);
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
  name: registerGoalCompletion.name,
  children: [
    it({
      name: 'registers sequential tool and enforces message-end sibling finality in real handler path',
      fn: async () => {
        /** Captured registration outputs. */
        const captured: {
          handler?: CapturedMessageEndHandler;
          tool?: ToolDefinition;
        } = {};
        /** Focused fake Pi registration API. */
        const pi = {
          on(_eventName: string, handler: CapturedMessageEndHandler,) {
            captured.handler = handler;
          },
          registerTool(tool: ToolDefinition,) {
            captured.tool = tool;
          },
        } as unknown as ExtensionAPI;
        /** Runtime state cell owned by fake lifecycle. */
        const state = { value: completionController(), };
        /** Fake lifecycle boundary. */
        const lifecycle: GoalLifecycleHandle = {
          currentController() {
            return state.value;
          },
          applyTransition({ transition, },) {
            state.value = transition.controller;
          },
        };
        /** Reviewer invocation count. */
        const reviewerCalls = { value: 0, };
        registerGoalCompletion({
          pi,
          lifecycle,
          async reviewer() {
            reviewerCalls.value += 1;
            return {
              verdict: { approved: true, feedback: 'Approved.', },
              reviewerIdentity: 'review/model',
              attemptedReviewerIdentities: ['review/model',],
              transcriptTruncated: false,
            };
          },
          async handleReviewerUnavailable() {
            throw new Error('unexpected unavailable fallback',);
          },
          now() {
            return COMPLETED_AT;
          },
        },);
        /** Required captured message handler. */
        const { handler, tool, } = captured;
        if ((handler === undefined) || (tool === undefined))
          throw new Error('completion registration did not capture handler and tool',);
        expect(tool.executionMode,).toBe('sequential',);
        /** Focused current branch context passed through Pi tool API fifth argument. */
        const context = {
          sessionManager: {
            getLeafId() {
              return 'leaf-current';
            },
          },
        } as unknown as ExtensionContext;
        await handler({
          message: assistantMessage([
            { id: 'completion-nonfinal', name: 'goal_complete', },
            { id: 'later-read', name: 'read', },
          ],),
        }, context,);
        /** Non-final registered tool result. */
        const rejected = await tool.execute(
          'completion-nonfinal',
          {
            goal_id: 'generation-1',
            summary: 'Implemented and verified.',
          },
          undefined,
          undefined,
          context,
        );
        expect(JSON.stringify(rejected.details,),).toContain('rejected',);
        expect(reviewerCalls.value,).toBe(0,);
        await handler({
          message: assistantMessage([
            { id: 'completion-final', name: 'goal_complete', },
          ],),
        }, context,);
        /** Final registered tool result. */
        const approved = await tool.execute(
          'completion-final',
          {
            goal_id: 'generation-1',
            summary: 'Implemented and verified.',
          },
          undefined,
          undefined,
          context,
        );
        expect(JSON.stringify(approved.details,),).toContain('approved',);
        expect(approved.terminate,).toBe(true,);
        expect(reviewerCalls.value,).toBe(1,);
      },
    },),
  ],
},);

await describe({
  name: executeGoalCompletion.name,
  children: [
    it({
      name: 'persists denial feedback without termination',
      fn: async () => {
        /** Runtime state cell owned by test lifecycle. */
        const state = { value: completionController(), };
        /** Applied transitions captured in order. */
        const transitions: GoalControllerState[] = [];
        /** Persisted event kinds captured from semantic effects. */
        const persistedKinds: string[] = [];
        /** Fake lifecycle boundary. */
        const lifecycle: GoalLifecycleHandle = {
          currentController() {
            return state.value;
          },
          applyTransition({ transition, },) {
            state.value = transition.controller;
            transitions.push(transition.controller,);
            persistedKinds.push(...transition.effects.flatMap(function persistedKind(effect,) {
              return effect.type === 'persist' ? [effect.event.kind,] : [];
            },),);
          },
        };
        /** Focused current branch context. */
        const context = {
          sessionManager: {
            getLeafId() {
              return 'leaf-current';
            },
          },
        } as unknown as ExtensionContext;
        /** Reviewer denial tool result. */
        const result = await executeGoalCompletion({
          toolCallId: 'completion-call',
          params: {
            goal_id: 'generation-1',
            summary: 'Implemented and verified.',
          },
          context,
          finality: new Map([['completion-call', true,],]),
          lifecycle,
          async reviewer() {
            return {
              verdict: { approved: false, feedback: 'Add integration evidence.', },
              reviewerIdentity: 'review/model',
              attemptedReviewerIdentities: ['review/model',],
              transcriptTruncated: false,
            };
          },
          async handleReviewerUnavailable() {
            throw new Error('unexpected unavailable fallback',);
          },
          now() {
            return COMPLETED_AT;
          },
        },);
        expect(result.details.outcome,).toBe('denied',);
        expect(result.terminate,).toBeUndefined();
        expect(transitions,).toHaveLength(1,);
        expect(persistedKinds,).toEqual(['review_denied',],);
        expect(state.value.goal,).toMatchObject({
          phase: 'active',
          reviewerFeedback: 'Add integration evidence.',
        },);
      },
    },),
    it({
      name: 'persists approval, clears active state, and terminates',
      fn: async () => {
        /** Runtime state cell owned by test lifecycle. */
        const state = { value: completionController(), };
        /** Applied semantic effect types. */
        const effectTypes: string[] = [];
        /** Persisted event kinds captured from semantic effects. */
        const persistedKinds: string[] = [];
        /** Fake lifecycle boundary. */
        const lifecycle: GoalLifecycleHandle = {
          currentController() {
            return state.value;
          },
          applyTransition({ transition, },) {
            state.value = transition.controller;
            effectTypes.push(...transition.effects.map(function effectType(effect,) {
              return effect.type;
            },),);
            persistedKinds.push(...transition.effects.flatMap(function persistedKind(effect,) {
              return effect.type === 'persist' ? [effect.event.kind,] : [];
            },),);
          },
        };
        /** Focused current branch context. */
        const context = {
          sessionManager: {
            getLeafId() {
              return 'leaf-current';
            },
          },
        } as unknown as ExtensionContext;
        /** Reviewer approval tool result. */
        const result = await executeGoalCompletion({
          toolCallId: 'completion-call',
          params: {
            goal_id: 'generation-1',
            summary: 'Implemented and verified.',
          },
          context,
          finality: new Map([['completion-call', true,],]),
          lifecycle,
          async reviewer() {
            return {
              verdict: { approved: true, feedback: 'Evidence is complete.', },
              reviewerIdentity: 'review/model',
              attemptedReviewerIdentities: ['review/model',],
              transcriptTruncated: false,
            };
          },
          async handleReviewerUnavailable() {
            throw new Error('unexpected unavailable fallback',);
          },
          now() {
            return COMPLETED_AT;
          },
        },);
        expect(result.details.outcome,).toBe('approved',);
        expect(result.terminate,).toBe(true,);
        expect(persistedKinds,).toEqual(['run_completed_model',],);
        expect(effectTypes,).toContain('clear_footer',);
        expect(state.value.goal,).toMatchObject({
          phase: 'completed',
          approvalSource: 'model',
          reviewerIdentity: 'review/model',
        },);
      },
    },),
    it({
      name: 'skips reviewer for non-final call and ignores stale async approval',
      fn: async () => {
        /** Runtime state cell observed by delayed reviewer. */
        const state = { value: completionController(), };
        /** Selected branch leaf changed by delayed reviewer. */
        const leaf = { value: 'leaf-current', };
        /** Reviewer invocation count. */
        const calls = { value: 0, };
        /** Fake lifecycle boundary. */
        const lifecycle: GoalLifecycleHandle = {
          currentController() {
            return state.value;
          },
          applyTransition({ transition, },) {
            state.value = transition.controller;
          },
        };
        /** Focused current branch context. */
        const context = {
          sessionManager: {
            getLeafId() {
              return leaf.value;
            },
          },
        } as unknown as ExtensionContext;
        /** Shared reviewer changing selected branch during await. */
        async function staleReviewer() {
          calls.value += 1;
          leaf.value = 'leaf-other';
          return {
            verdict: { approved: true, feedback: 'Old approval.', },
            reviewerIdentity: 'review/model',
            attemptedReviewerIdentities: ['review/model',],
            transcriptTruncated: false,
          };
        }
        /** Non-final local rejection. */
        const nonFinal = await executeGoalCompletion({
          toolCallId: 'completion-call',
          params: {
            goal_id: 'generation-1',
            summary: 'Implemented and verified.',
          },
          context,
          finality: new Map([['completion-call', false,],]),
          lifecycle,
          reviewer: staleReviewer,
          async handleReviewerUnavailable() {
            throw new Error('unexpected unavailable fallback',);
          },
          now() {
            return COMPLETED_AT;
          },
        },);
        expect(nonFinal.details.outcome,).toBe('rejected',);
        expect(calls.value,).toBe(0,);
        /** Matching call whose approval becomes stale during review. */
        const stale = await executeGoalCompletion({
          toolCallId: 'completion-call',
          params: {
            goal_id: 'generation-1',
            summary: 'Implemented and verified.',
          },
          context,
          finality: new Map([['completion-call', true,],]),
          lifecycle,
          reviewer: staleReviewer,
          async handleReviewerUnavailable() {
            throw new Error('unexpected unavailable fallback',);
          },
          now() {
            return COMPLETED_AT;
          },
        },);
        expect(stale.details.outcome,).toBe('stale',);
        expect(calls.value,).toBe(1,);
      },
    },),
  ],
},);
