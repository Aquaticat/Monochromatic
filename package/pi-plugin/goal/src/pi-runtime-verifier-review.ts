/**
 * Built-artifact completion review checks with deterministic fake reviewer transport.
 *
 * @module
 */

import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';

import {
  createGoalController,
  executeGoalCompletion,
  startGoal,
  type GoalControllerState,
  type GoalLifecycleHandle,
} from '../dist/final/node/index.mjs';

/**
 * Deterministic timestamp for built completion verification.
 */
const REVIEW_TIMESTAMP = '2026-07-16T00:00:00.000Z';

/**
 * Review outcome fixture returned by deterministic fake transport.
 */
type ReviewFixture = {
  readonly approved: boolean;
  readonly expectedOutcome: 'approved' | 'denied';
  readonly feedback: string;
};

/**
 * Build active controller and exact branch start event for reviewer evidence.
 *
 * @returns controller cell, lifecycle adapter, and context
 *
 * @example
 * ```ts
 * const fixture = createReviewFixture();
 * ```
 */
function createReviewFixture(): {
  readonly state: { value: GoalControllerState; };
  readonly lifecycle: GoalLifecycleHandle;
  readonly context: ExtensionContext;
} {
  /**
   * Pure start transition supplying active state and persisted run event.
   */
  const started = startGoal({
    controller: createGoalController('runtime-review',),
    objective: 'Verify fake reviewer transport',
    runId: 'run-review',
    generationId: 'generation-review',
    startBoundary: 'leaf-before-review',
    marker: 'marker-review',
    timestamp: REVIEW_TIMESTAMP,
    isIdle: true,
    hasPendingMessages: false,
  },);
  /**
   * Runtime-owned controller cell updated by completion transitions.
   */
  const state = { value: started.controller, };
  /**
   * Persist effect carrying exact run-start event for evidence boundary.
   */
  const persisted = started.effects
    .find(function isPersist(effect,) {
    return effect.type === 'persist';
  },);
  if ((persisted === undefined) || (persisted.type !== 'persist'))
    throw new Error('review fixture start transition omitted persisted event',);
  /**
   * Minimal selected branch containing active run start.
   */
  const branch = [{
    type: 'custom',
    customType: 'goal:state',
    data: persisted.event,
  },];
  /**
   * Lifecycle capability consumed by completion implementation.
   */
  const lifecycle: GoalLifecycleHandle = {
    currentController() {
      return state.value;
    },
    applyTransition({ transition, },) {
      state.value = transition.controller;
    },
  };
  /**
   * Focused context for branch evidence and stale-result leaf validation.
   */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Review verifier implements exact branch and leaf context members consumed by completion.
  const context = {
    mode: 'rpc',
    hasUI: false,
    sessionManager: {
      getLeafId() {
        return 'leaf-current-review';
      },
      getBranch() {
        return branch;
      },
    },
  } as unknown as ExtensionContext;
  return {
    state,
    lifecycle,
    context,
  };
}

/**
 * Execute one built completion path through fake independent reviewer.
 *
 * @param approved - fake structured reviewer decision
 *
 * @param expectedOutcome - expected tool result detail
 *
 * @param feedback - exact reviewer feedback
 *
 * @returns verified terminal or active phase
 *
 * @throws when result, identity audit, or state transition differs
 *
 * @example
 * ```ts
 * await verifyReviewOutcome({ approved: true, expectedOutcome: 'approved', feedback: 'complete' });
 * ```
 */
async function verifyReviewOutcome(
  {
    approved,
    expectedOutcome,
    feedback,
  }: ReviewFixture,
): Promise<string> {
  /**
   * Active completion fixture isolated from sibling outcome.
   */
  const {
    state,
    lifecycle,
    context,
  } = createReviewFixture();
  /**
   * Built completion result after deterministic fake transport.
   */
  const result = await executeGoalCompletion({
    toolCallId: 'completion-review-call',
    params: {
      goal_id: 'generation-review',
      summary: 'Requirement and verification evidence are complete.',
    },
    context,
    finality: new Map([[
      'completion-review-call',
      true,
    ],]),
    lifecycle,
    // oxlint-disable-next-line typescript/require-await -- Reviewer contract is asynchronous while deterministic transport fixture is immediate.
    async reviewer() {
      return {
        verdict: {
          approved,
          feedback,
        },
        reviewerIdentity: 'fake-reviewer/distinct-model',
        attemptedReviewerIdentities: ['fake-reviewer/distinct-model',],
        transcriptTruncated: false,
      };
    },
    // oxlint-disable-next-line typescript/require-await, eslint/require-await -- Completion fallback contract is asynchronous; fixture always fails immediately.
    async handleReviewerUnavailable() {
      throw new Error('fake reviewer unexpectedly became unavailable',);
    },
    now() {
      return REVIEW_TIMESTAMP;
    },
  },);
  if (result.details
    .outcome
    !== expectedOutcome)
    throw new Error(`expected ${expectedOutcome} completion, received ${result.details
      .outcome}`,);
  if (result.details
    .reviewerIdentity
    !== 'fake-reviewer/distinct-model')
    throw new Error('completion omitted fake reviewer identity audit',);
  /**
   * Expected state phase after reviewer decision.
   */
  const expectedPhase = approved ? 'completed' : 'active';
  if (state.value
    .goal
    .phase
    !== expectedPhase)
    throw new Error(`expected goal phase ${expectedPhase}, received ${state.value
      .goal
      .phase}`,);
  if (approved && (result.terminate !== true))
    throw new Error('approved completion did not terminate agent run',);
  if ((!approved) && (result.terminate === true))
    throw new Error('review denial incorrectly terminated agent run',);
  return expectedOutcome;
}

/**
 * Verify reviewer denial feedback and approval termination through built artifact.
 *
 * @returns review scenario summary
 *
 * @example
 * ```ts
 * await verifyInjectedReviewerOutcomes();
 * ```
 */
async function verifyInjectedReviewerOutcomes(): Promise<string> {
  /**
   * Parallel independent denial and approval outcomes.
   */
  const outcomes = await Promise.all([
    verifyReviewOutcome({
      approved: false,
      expectedOutcome: 'denied',
      feedback: 'Add missing verification evidence.',
    },),
    verifyReviewOutcome({
      approved: true,
      expectedOutcome: 'approved',
      feedback: 'Objective independently verified.',
    },),
  ],);
  return `fake reviewer ${outcomes.join(' and ')}`;
}

export { verifyInjectedReviewerOutcomes, };
