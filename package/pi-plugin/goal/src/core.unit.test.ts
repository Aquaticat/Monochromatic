/**
 * Built-artifact tests for goal command, state, controller, footer, and prompt core.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ABSENT_GOAL_STATE,
  buildActiveGoalPrompt,
  buildGoalMessage,
  clearGoal,
  createGoalController,
  formatGoalFooter,
  goalEventsFromBranch,
  GOAL_USAGE,
  isGoalEvent,
  MAX_OBJECTIVE_LENGTH,
  objectivePreview,
  parseGoalCommand,
  reduceGoalEvent,
  reduceGoalEvents,
  restoreGoalController,
  rotateGoalGeneration,
  settleGoal,
  shutdownGoalController,
  startGoal,
  type ActiveGoalState,
  type GoalEvent,
} from '../dist/final/node/index.mjs';

/** Stable test runtime epoch. */
const RUNTIME_EPOCH = 'runtime-1';

/** Stable test start timestamp. */
const STARTED_AT = '2026-07-16T00:00:00.000Z';

/** Stable later transition timestamp. */
const LATER_AT = '2026-07-16T00:01:00.000Z';

/**
 * Build deterministic active goal through public reducer.
 *
 * @returns active goal fixture
 *
 * @example
 * ```ts
 * const goal = activeGoal();
 * ```
 */
function activeGoal(): ActiveGoalState {
  /** Reduced fixture state. */
  const state = reduceGoalEvents([{
    kind: 'run_started',
    runId: 'run-1',
    generationId: 'generation-1',
    objective: 'Ship the exact feature',
    startedAt: STARTED_AT,
    startBoundary: 'boundary-1',
    continuationSequence: 0,
    transitionedAt: STARTED_AT,
  },],);
  if (state.phase !== 'active')
    throw new Error('expected active goal fixture',);
  return state;
}

await describe({
  name: parseGoalCommand.name,
  children: [
    it({
      name: 'trims and accepts objective',
      fn: async () => {
        expect(parseGoalCommand('  implement feature  ',),).toEqual({
          kind: 'start',
          objective: 'implement feature',
        },);
      },
    },),
    it({
      name: 'accepts exact clear only',
      fn: async () => {
        expect(parseGoalCommand(' clear ',),).toEqual({ kind: 'clear', },);
        expect(parseGoalCommand('clear now',),).toEqual({
          kind: 'rejected',
          diagnostic: GOAL_USAGE,
        },);
      },
    },),
    it({
      name: 'rejects empty and every removed command prefix',
      fn: async () => {
        expect(parseGoalCommand('',),).toEqual({
          kind: 'rejected',
          diagnostic: GOAL_USAGE,
        },);
        for (const command of [
          'status',
          'status now',
          'edit objective',
          'pause',
          'resume',
          '--tokens 100k objective',
        ]) {
          expect(parseGoalCommand(command,),).toEqual({
            kind: 'rejected',
            diagnostic: GOAL_USAGE,
          },);
        }
      },
    },),
    it({
      name: 'accepts objective at length limit and rejects longer objective',
      fn: async () => {
        /** Objective exactly at accepted limit. */
        const accepted = 'x'.repeat(MAX_OBJECTIVE_LENGTH,);
        /** Objective one character over accepted limit. */
        const rejected = `${accepted}x`;
        expect(parseGoalCommand(accepted,),).toEqual({
          kind: 'start',
          objective: accepted,
        },);
        expect(parseGoalCommand(rejected,).kind,).toBe('rejected',);
      },
    },),
  ],
},);

await describe({
  name: reduceGoalEvents.name,
  children: [
    it({
      name: 'reduces start, denial, rotation, and stale transitions',
      fn: async () => {
        /** Start event shared by transition sequence. */
        const start: GoalEvent = {
          kind: 'run_started',
          runId: 'run-1',
          generationId: 'generation-1',
          objective: 'Complete work',
          startedAt: STARTED_AT,
          startBoundary: 'boundary-1',
          continuationSequence: 0,
          transitionedAt: STARTED_AT,
        };
        /** Denial retaining active state. */
        const denied: GoalEvent = {
          kind: 'review_denied',
          runId: 'run-1',
          generationId: 'generation-1',
          feedback: 'Add evidence.',
          continuationSequence: 2,
          transitionedAt: LATER_AT,
        };
        /** Rotation preserving run boundary. */
        const rotated: GoalEvent = {
          kind: 'generation_rotated',
          runId: 'run-1',
          previousGenerationId: 'generation-1',
          generationId: 'generation-2',
          continuationSequence: 2,
          transitionedAt: LATER_AT,
          cause: 'runtime_restore',
        };
        /** Stale old-generation completion ignored after rotation. */
        const staleCompletion: GoalEvent = {
          kind: 'run_completed_model',
          runId: 'run-1',
          generationId: 'generation-1',
          summary: 'stale',
          reviewerIdentity: 'reviewer/stale',
          reviewerFeedback: 'stale',
          completedAt: LATER_AT,
        };
        /** Reduced active state after stale event suppression. */
        const state = reduceGoalEvents([
          start,
          denied,
          rotated,
          staleCompletion,
        ],);
        expect(state.phase,).toBe('active',);
        if (state.phase !== 'active')
          throw new Error('expected active reduced state',);
        expect(state.generationId,).toBe('generation-2',);
        expect(state.startBoundary,).toBe('boundary-1',);
        expect(state.reviewerFeedback,).toBe('Add evidence.',);
      },
    },),
    it({
      name: 'atomically replaces prior run in one start event',
      fn: async () => {
        /** First run start. */
        const first: GoalEvent = {
          kind: 'run_started',
          runId: 'run-1',
          generationId: 'generation-1',
          objective: 'First',
          startedAt: STARTED_AT,
          startBoundary: 'boundary-1',
          continuationSequence: 0,
          transitionedAt: STARTED_AT,
        };
        /** Replacement start names superseded run. */
        const replacement: GoalEvent = {
          kind: 'run_started',
          runId: 'run-2',
          generationId: 'generation-2',
          objective: 'Second',
          startedAt: LATER_AT,
          startBoundary: 'boundary-2',
          continuationSequence: 0,
          transitionedAt: LATER_AT,
          supersededRunId: 'run-1',
        };
        expect(reduceGoalEvents([first, replacement,]),).toEqual({
          phase: 'active',
          runId: 'run-2',
          generationId: 'generation-2',
          objective: 'Second',
          startedAt: LATER_AT,
          startBoundary: 'boundary-2',
          continuationSequence: 0,
          transitionedAt: LATER_AT,
        },);
      },
    },),
    it({
      name: 'reduces model, manual, unavailable, and clear terminal paths',
      fn: async () => {
        /** Active state shared by terminal transitions. */
        const active = activeGoal();
        /** Model completion terminal state. */
        const modelCompleted = reduceGoalEvent({
          state: active,
          event: {
            kind: 'run_completed_model',
            runId: active.runId,
            generationId: active.generationId,
            summary: 'Done.',
            reviewerIdentity: 'provider/reviewer',
            reviewerFeedback: 'Approved.',
            completedAt: LATER_AT,
          },
        },);
        expect(modelCompleted,).toMatchObject({
          phase: 'completed',
          approvalSource: 'model',
          reviewerIdentity: 'provider/reviewer',
        },);
        /** Manual completion terminal state. */
        const manualCompleted = reduceGoalEvent({
          state: active,
          event: {
            kind: 'run_completed_manual',
            runId: active.runId,
            generationId: active.generationId,
            summary: 'Done manually.',
            reviewerFeedback: 'Models unavailable.',
            completedAt: LATER_AT,
          },
        },);
        expect(manualCompleted,).toMatchObject({
          phase: 'completed',
          approvalSource: 'manual',
        },);
        /** Reviewer-unavailable terminal state. */
        const unavailable = reduceGoalEvent({
          state: active,
          event: {
            kind: 'review_unavailable',
            runId: active.runId,
            generationId: active.generationId,
            summary: 'Claimed complete.',
            attemptedReviewerIdentities: ['provider/one',],
            diagnostic: 'auth failed',
            terminalAt: LATER_AT,
          },
        },);
        expect(unavailable,).toMatchObject({
          phase: 'review_unavailable',
          diagnostic: 'auth failed',
        },);
        /** Clear tombstone over terminal state. */
        const cleared = reduceGoalEvent({
          state: unavailable,
          event: {
            kind: 'run_cleared',
            runId: active.runId,
            generationId: active.generationId,
            clearedAt: LATER_AT,
          },
        },);
        expect(cleared,).toEqual(ABSENT_GOAL_STATE,);
      },
    },),
  ],
},);

await describe({
  name: startGoal.name,
  children: [
    it({
      name: 'starts idle run with persisted event, footer, and visible custom kickoff',
      fn: async () => {
        /** Start transition from absent controller. */
        const transition = startGoal({
          controller: createGoalController(RUNTIME_EPOCH,),
          objective: 'Ship feature',
          runId: 'run-1',
          generationId: 'generation-1',
          startBoundary: 'boundary-1',
          marker: 'marker-1',
          timestamp: STARTED_AT,
          isIdle: true,
          hasPendingMessages: false,
        },);
        expect(transition.controller.goal.phase,).toBe('active',);
        expect(transition.controller.pendingKickoff,).toBeUndefined();
        expect(transition.effects.filter(effect => effect.type === 'persist'),).toHaveLength(1,);
        expect(transition.effects.filter(effect => effect.type === 'send_message'),).toHaveLength(1,);
        /** Kickoff send effect. */
        const messageEffect = transition.effects.find(effect => effect.type === 'send_message',);
        expect(messageEffect,).toBeDefined();
        if (messageEffect?.type !== 'send_message')
          throw new Error('expected kickoff send effect',);
        expect(messageEffect.message.customType,).toBe('goal',);
        expect(messageEffect.message.details.kind,).toBe('kickoff',);
        expect(messageEffect.message.content,).toContain('"Ship feature"',);
      },
    },),
    it({
      name: 'defers busy kickoff and replacement invalidates old request without confirmation',
      fn: async () => {
        /** First busy run retains generation-scoped kickoff intent. */
        const first = startGoal({
          controller: createGoalController(RUNTIME_EPOCH,),
          objective: 'First',
          runId: 'run-1',
          generationId: 'generation-1',
          startBoundary: 'boundary-1',
          marker: 'marker-1',
          timestamp: STARTED_AT,
          isIdle: false,
          hasPendingMessages: false,
        },);
        expect(first.controller.pendingKickoff?.generationId,).toBe('generation-1',);
        /** Immediate replacement stores only new kickoff intent. */
        const replacement = startGoal({
          controller: first.controller,
          objective: 'Second',
          runId: 'run-2',
          generationId: 'generation-2',
          startBoundary: 'boundary-2',
          marker: 'marker-2',
          timestamp: LATER_AT,
          isIdle: false,
          hasPendingMessages: false,
        },);
        expect(replacement.controller.pendingKickoff?.generationId,).toBe('generation-2',);
        /** Sole persisted replacement event. */
        const persisted = replacement.effects.filter(effect => effect.type === 'persist',);
        expect(persisted,).toHaveLength(1,);
        /** Persisted replacement effect after count assertion. */
        const [persistedEffect,] = persisted;
        if (persistedEffect?.type !== 'persist')
          throw new Error('expected persisted replacement event',);
        expect(persistedEffect.event.kind,).toBe('run_started',);
        if (persistedEffect.event.kind !== 'run_started')
          throw new Error('expected run-started replacement event',);
        expect(persistedEffect.event.supersededRunId,).toBe('run-1',);
        expect(replacement.effects[0],).toEqual({ type: 'clear_footer', },);
      },
    },),
  ],
},);

await describe({
  name: clearGoal.name,
  children: [
    it({
      name: 'is idempotent while absent and persists tombstone while active',
      fn: async () => {
        /** Absent clear transition. */
        const absent = clearGoal({
          controller: createGoalController(RUNTIME_EPOCH,),
          timestamp: STARTED_AT,
        },);
        expect(absent.effects,).toEqual([{
          type: 'notify',
          level: 'info',
          message: 'No goal is active.',
        },],);
        /** Active controller fixture. */
        const restored = restoreGoalController({
          controller: createGoalController(RUNTIME_EPOCH,),
          goal: activeGoal(),
        },);
        /** Active clear transition. */
        const cleared = clearGoal({
          controller: restored.controller,
          timestamp: LATER_AT,
        },);
        expect(cleared.controller.goal,).toEqual(ABSENT_GOAL_STATE,);
        expect(cleared.controller.pendingKickoff,).toBeUndefined();
        expect(cleared.effects.some(effect => effect.type === 'persist'),).toBe(true,);
        expect(cleared.effects.some(effect => effect.type === 'clear_footer'),).toBe(true,);
        expect(cleared.effects.some(effect => effect.type === 'send_message'),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: rotateGoalGeneration.name,
  children: [
    it({
      name: 'rotates active restoration without triggering turn and preserves start boundary',
      fn: async () => {
        /** Controller restored from active branch. */
        const restored = restoreGoalController({
          controller: createGoalController(RUNTIME_EPOCH,),
          goal: activeGoal(),
        },);
        /** Fresh-runtime rotation. */
        const rotated = rotateGoalGeneration({
          controller: restored.controller,
          generationId: 'generation-2',
          timestamp: LATER_AT,
          cause: 'runtime_restore',
        },);
        expect(rotated.controller.goal.phase,).toBe('active',);
        if (rotated.controller.goal.phase !== 'active')
          throw new Error('expected active rotated goal',);
        expect(rotated.controller.goal.generationId,).toBe('generation-2',);
        expect(rotated.controller.goal.startBoundary,).toBe('boundary-1',);
        expect(rotated.effects.some(effect => effect.type === 'send_message'),).toBe(false,);
      },
    },),
    it({
      name: 'does not rotate terminal state',
      fn: async () => {
        /** Completed state fixture. */
        const completed = reduceGoalEvent({
          state: activeGoal(),
          event: {
            kind: 'run_completed_manual',
            runId: 'run-1',
            generationId: 'generation-1',
            summary: 'Done.',
            reviewerFeedback: 'Manual.',
            completedAt: LATER_AT,
          },
        },);
        /** Terminal restore transition. */
        const restored = restoreGoalController({
          controller: createGoalController(RUNTIME_EPOCH,),
          goal: completed,
        },);
        /** Terminal rotation attempt. */
        const rotated = rotateGoalGeneration({
          controller: restored.controller,
          generationId: 'generation-2',
          timestamp: LATER_AT,
          cause: 'tree_navigation',
        },);
        expect(rotated.controller.goal,).toEqual(completed,);
        expect(rotated.effects,).toHaveLength(0,);
      },
    },),
  ],
},);

await describe({
  name: settleGoal.name,
  children: [
    it({
      name: 'emits deferred kickoff once after matching busy generation settles',
      fn: async () => {
        /** Busy start retaining kickoff intent. */
        const started = startGoal({
          controller: createGoalController(RUNTIME_EPOCH,),
          objective: 'Deferred goal',
          runId: 'run-1',
          generationId: 'generation-1',
          startBoundary: 'boundary-1',
          marker: 'kickoff-marker',
          timestamp: STARTED_AT,
          isIdle: false,
          hasPendingMessages: false,
        },);
        /** First final settlement drains matching kickoff. */
        const settled = settleGoal({
          controller: started.controller,
          marker: 'unused-marker',
          timestamp: LATER_AT,
          hasPendingMessages: false,
        },);
        expect(settled.effects,).toHaveLength(1,);
        /** Sole kickoff effect. */
        const [effect,] = settled.effects;
        if (effect?.type !== 'send_message')
          throw new Error('expected deferred kickoff message',);
        expect(effect.message.details.kind,).toBe('kickoff',);
        expect(effect.message.details.marker,).toBe('kickoff-marker',);
        expect(settled.controller.pendingKickoff,).toBeUndefined();
      },
    },),
    it({
      name: 'persists one continuation and one visible message per eligible settlement',
      fn: async () => {
        /** Active controller fixture. */
        const restored = restoreGoalController({
          controller: createGoalController(RUNTIME_EPOCH,),
          goal: activeGoal(),
        },);
        /** Final settlement continuation transition. */
        const settled = settleGoal({
          controller: restored.controller,
          marker: 'continuation-marker',
          timestamp: LATER_AT,
          hasPendingMessages: false,
        },);
        expect(settled.effects.filter(effect => effect.type === 'persist'),).toHaveLength(1,);
        expect(settled.effects.filter(effect => effect.type === 'send_message'),).toHaveLength(1,);
        expect(settled.controller.goal,).toMatchObject({
          phase: 'active',
          continuationSequence: 1,
        },);
      },
    },),
    it({
      name: 'does not overwrite queued human turn or act after shutdown',
      fn: async () => {
        /** Active controller fixture. */
        const restored = restoreGoalController({
          controller: createGoalController(RUNTIME_EPOCH,),
          goal: activeGoal(),
        },);
        /** Settlement while human message owns next turn. */
        const queued = settleGoal({
          controller: restored.controller,
          marker: 'marker-queued',
          timestamp: LATER_AT,
          hasPendingMessages: true,
        },);
        expect(queued.effects,).toHaveLength(0,);
        /** Runtime shutdown transition. */
        const stopped = shutdownGoalController(restored.controller,);
        expect(stopped.effects,).toEqual([{ type: 'clear_footer', },],);
        /** Settlement callback arriving after shutdown. */
        const stale = settleGoal({
          controller: stopped.controller,
          marker: 'marker-stale',
          timestamp: LATER_AT,
          hasPendingMessages: false,
        },);
        expect(stale.effects,).toHaveLength(0,);
      },
    },),
  ],
},);

await describe({
  name: goalEventsFromBranch.name,
  children: [
    it({
      name: 'extracts only valid goal events from supplied active branch',
      fn: async () => {
        /** Valid continuation event payload. */
        const continuation = {
          kind: 'continuation_issued',
          runId: 'run-1',
          generationId: 'generation-1',
          continuationSequence: 1,
          transitionedAt: LATER_AT,
        } as const;
        expect(isGoalEvent(continuation,),).toBe(true,);
        expect(goalEventsFromBranch([
          {
            type: 'custom',
            customType: 'goal:state',
            data: continuation,
          },
          {
            type: 'custom',
            customType: 'other-extension',
            data: continuation,
          },
          {
            type: 'custom',
            customType: 'goal:state',
            data: { kind: 'continuation_issued', },
          },
        ],),).toEqual([continuation,],);
      },
    },),
  ],
},);

await describe({
  name: objectivePreview.name,
  children: [
    it({
      name: 'keeps shorter and exact-limit previews',
      fn: async () => {
        expect(objectivePreview('short',),).toBe('short',);
        expect(objectivePreview('1234567890',),).toBe('1234567890',);
        expect(formatGoalFooter('short',),).toBe('goal short',);
      },
    },),
    it({
      name: 'uses nine graphemes plus ellipsis without splitting Unicode cluster',
      fn: async () => {
        /** Eleven displayed graphemes with family emoji as one cluster. */
        const objective = '12345678👨‍👩‍👧‍👦ab';
        expect(objectivePreview(objective,),).toBe('12345678👨‍👩‍👧‍👦…',);
      },
    },),
  ],
},);

await describe({
  name: buildGoalMessage.name,
  children: [
    it({
      name: 'carries exact generation, provenance, sequence, and stale-guard explanation',
      fn: async () => {
        /** Continuation message fixture. */
        const message = buildGoalMessage({
          goal: activeGoal(),
          kind: 'continuation',
          continuationSequence: 3,
          marker: 'marker-3',
        },);
        expect(message.display,).toBe(true,);
        expect(message.details,).toEqual({
          runId: 'run-1',
          generationId: 'generation-1',
          continuationSequence: 3,
          marker: 'marker-3',
          kind: 'continuation',
        },);
        expect(message.content,).toContain('only the stale-completion guard',);
        expect(message.content,).toContain('requirement-by-requirement verification',);
      },
    },),
  ],
},);

await describe({
  name: buildActiveGoalPrompt.name,
  children: [
    it({
      name: 'includes exact objective and generation with complete persistence rules',
      fn: async () => {
        /** Active prompt suffix. */
        const prompt = buildActiveGoalPrompt(activeGoal(),);
        expect(prompt,).toContain('"Ship the exact feature"',);
        expect(prompt,).toContain('generation-1',);
        expect(prompt,).toContain('Do not redefine the objective',);
        expect(prompt,).toContain('no background process is live',);
        expect(prompt,).toContain('Do not poll',);
        expect(prompt,).toContain('final action',);
        expect(prompt,).toContain('restored generation',);
      },
    },),
  ],
},);
