/**
 * Built-artifact tests for manual and non-interactive reviewer exhaustion.
 *
 * @module
 */

import type {
  ExtensionContext,
  KeybindingsManager,
  Theme,
} from '@earendil-works/pi-coding-agent';
import type {
  Component,
  TUI,
} from '@earendil-works/pi-tui';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { ReviewUnavailableError, } from '@monochromatic-dev/pi-shared-model-review/ts';

import {
  createGoalReviewerUnavailableHandler,
  promptManualGoalReview,
  reduceGoalEvents,
  type GoalCompletionResult,
  type GoalControllerState,
  type GoalEffect,
  type GoalLifecycleHandle,
  type ManualGoalReviewDecision,
  type ValidGoalCompletionRequest,
} from '../dist/final/node/index.mjs';

/** Stable start timestamp. */
const STARTED_AT = '2026-07-16T00:00:00.000Z';

/** Stable terminal timestamp. */
const TERMINAL_AT = '2026-07-16T00:01:00.000Z';

/**
 * Fallback handler test harness.
 */
type FallbackHarness = {
  readonly lifecycle: GoalLifecycleHandle;
  readonly context: ExtensionContext;
  readonly state: { value: GoalControllerState; };
  readonly leaf: { value: string; };
  readonly effects: GoalEffect[];
};

/**
 * Focused manual-dialog component factory used by fake custom UI.
 */
type ManualDialogFactory = (
  tui: TUI,
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (decision: ManualGoalReviewDecision) => void,
) => Component;

/**
 * Sentinel before manual dialog calls completion callback.
 */
const MANUAL_DECISION_PENDING: unique symbol = Symbol('manual-decision-pending',);

/**
 * Build active request shared by exhaustion tests.
 *
 * @returns validated completion request
 */
function fallbackRequest(): ValidGoalCompletionRequest {
  /** Active goal fixture. */
  const goal = reduceGoalEvents([{
    kind: 'run_started',
    runId: 'run-1',
    generationId: 'generation-1',
    objective: 'Finish fallback behavior',
    startedAt: STARTED_AT,
    startBoundary: 'leaf-start',
    continuationSequence: 0,
    transitionedAt: STARTED_AT,
  },],);
  if (goal.phase !== 'active')
    throw new Error('expected active fallback fixture',);
  return {
    goal,
    goalId: 'generation-1',
    summary: 'Implemented and verified.',
    runtimeEpoch: 'runtime-1',
    branchLeafId: 'leaf-current',
    toolCallId: 'completion-call',
  };
}

/**
 * Build mode-specific lifecycle and context.
 *
 * @param mode - Pi execution mode
 *
 * @returns mutable test state behind immutable lifecycle snapshots
 */
function fallbackHarness(mode: ExtensionContext['mode'],): FallbackHarness {
  /** Runtime controller cell. */
  const state: { value: GoalControllerState; } = {
    value: {
      goal: fallbackRequest().goal,
      runtimeEpoch: 'runtime-1',
      settlementSequence: 0,
      shutdown: false,
    },
  };
  /** Selected branch leaf cell. */
  const leaf = { value: 'leaf-current', };
  /** Applied semantic effects. */
  const effects: GoalEffect[] = [];
  /** Fake lifecycle boundary. */
  const lifecycle: GoalLifecycleHandle = {
    currentController() {
      return state.value;
    },
    applyTransition({ transition, },) {
      state.value = transition.controller;
      effects.push(...transition.effects,);
    },
  };
  /** Focused completion fallback context. */
  const context = {
    mode,
    sessionManager: {
      getLeafId() {
        return leaf.value;
      },
    },
  } as unknown as ExtensionContext;
  return {
    lifecycle,
    context,
    state,
    leaf,
    effects,
  };
}

/**
 * Shared exhausted-review error with transport audit.
 */
const REVIEW_ERROR = new ReviewUnavailableError({
  attemptedCandidateIdentities: [
    'review/one',
    'review/two',
  ],
  diagnostics: [
    'review/one: timeout',
    'review/two: malformed verdict',
  ],
});

await describe({
  name: createGoalReviewerUnavailableHandler.name,
  children: [
    it({
      name: 'ignores escape and requires explicit dialog activation',
      fn: async () => {
        /** Dialog completion state observed by fake UI. */
        const decision = {
          value: MANUAL_DECISION_PENDING as ManualGoalReviewDecision | typeof MANUAL_DECISION_PENDING,
        };
        /** Minimal TUI used by component and inline editor. */
        const tui = {
          requestRender() {},
        } as unknown as TUI;
        /** Minimal theme methods used by manual component. */
        const theme = {
          fg(_color: string, text: string,) {
            return text;
          },
          bold(text: string,) {
            return text;
          },
        } as unknown as Theme;
        /** Focused context whose custom UI drives escape then explicit accept. */
        const context = {
          ui: {
            async custom(factory: ManualDialogFactory,) {
              /** Manual dialog component under test. */
              const component = factory(
                tui,
                theme,
                {} as KeybindingsManager,
                function finishDialog(result,) {
                  decision.value = result;
                },
              );
              if (component.handleInput === undefined)
                throw new Error('manual dialog component lacks input handler',);
              component.handleInput('\u001B',);
              if (decision.value !== MANUAL_DECISION_PENDING)
                throw new Error('escape incorrectly settled manual dialog',);
              component.handleInput('\r',);
              if (decision.value === MANUAL_DECISION_PENDING)
                throw new Error('enter did not activate manual dialog choice',);
              return decision.value;
            },
          },
        } as unknown as ExtensionContext;
        /** Explicit decision after ignored escape. */
        const result = await promptManualGoalReview({
          context,
          diagnostic: 'all model reviewers failed',
        },);
        expect(result,).toEqual({ action: 'accept', },);
      },
    },),
    it({
      name: 'terminates RPC, JSON, and print modes as persisted review unavailable',
      fn: async () => {
        /** Non-interactive modes required to avoid TUI substitution. */
        const modes = [
          'rpc',
          'json',
          'print',
        ] as const;
        /** Terminal results and harnesses per mode. */
        const outcomes = await Promise.all(modes.map(async function runMode(mode,) {
          /** Mode-specific harness. */
          const harness = fallbackHarness(mode,);
          /** Production non-interactive exhaustion handler. */
          const handler = createGoalReviewerUnavailableHandler({
            lifecycle: harness.lifecycle,
            now() {
              return TERMINAL_AT;
            },
          },);
          /** Terminal non-interactive result. */
          const result = await handler({
            error: REVIEW_ERROR,
            request: fallbackRequest(),
            context: harness.context,
          },);
          return { harness, result, };
        },));
        for (const { harness, result, } of outcomes) {
          expect(result.details.outcome,).toBe('review_unavailable',);
          expect(result.terminate,).toBe(true,);
          expect(harness.state.value.goal.phase,).toBe('review_unavailable',);
          expect(harness.effects.flatMap(function persistedKind(effect,) {
            return effect.type === 'persist' ? [effect.event.kind,] : [];
          },),).toEqual(['review_unavailable',],);
          expect(harness.effects.some(function isDiagnostic(effect,) {
            return effect.type === 'persist_review_unavailable_diagnostic';
          },),).toBe(true,);
          expect(harness.effects.some(function sendsTurn(effect,) {
            return effect.type === 'send_message';
          },),).toBe(false,);
        }
      },
    },),
    it({
      name: 'manually accepts in TUI after one mandatory combined decision',
      fn: async () => {
        /** TUI fallback harness. */
        const harness = fallbackHarness('tui',);
        /** Dialog invocation audit. */
        const dialogs = { value: 0, };
        /** Manual-accept handler. */
        const handler = createGoalReviewerUnavailableHandler({
          lifecycle: harness.lifecycle,
          async promptManualReview({ diagnostic, },) {
            dialogs.value += 1;
            expect(diagnostic,).toContain('timeout',);
            return { action: 'accept', };
          },
          now() {
            return TERMINAL_AT;
          },
        },);
        /** Manually approved result. */
        const result = await handler({
          error: REVIEW_ERROR,
          request: fallbackRequest(),
          context: harness.context,
        },);
        expect(dialogs.value,).toBe(1,);
        expect(result.details.outcome,).toBe('approved',);
        expect(result.terminate,).toBe(true,);
        expect(harness.state.value.goal,).toMatchObject({
          phase: 'completed',
          approvalSource: 'manual',
        },);
        expect(harness.effects.flatMap(function persistedKind(effect,) {
          return effect.type === 'persist' ? [effect.event.kind,] : [];
        },),).toEqual(['run_completed_manual',],);
      },
    },),
    it({
      name: 'keeps TUI goal active after rejection and returns exact optional reason',
      fn: async () => {
        /** Reasoned manual rejection harness. */
        const reasonedHarness = fallbackHarness('tui',);
        /** Reasoned rejection handler. */
        const reasonedHandler = createGoalReviewerUnavailableHandler({
          lifecycle: reasonedHarness.lifecycle,
          async promptManualReview() {
            return {
              action: 'reject',
              reason: 'Run the end-user verifier.',
            };
          },
        },);
        /** Reasoned rejection result. */
        const reasoned = await reasonedHandler({
          error: REVIEW_ERROR,
          request: fallbackRequest(),
          context: reasonedHarness.context,
        },);
        expect(reasoned.content,).toEqual([{
          type: 'text',
          text: 'Run the end-user verifier.',
        },],);
        expect(reasonedHarness.state.value.goal.phase,).toBe('active',);
        expect(reasonedHarness.effects,).toHaveLength(0,);
        /** Empty-reason manual rejection harness. */
        const emptyHarness = fallbackHarness('tui',);
        /** Empty-reason rejection handler. */
        const emptyHandler = createGoalReviewerUnavailableHandler({
          lifecycle: emptyHarness.lifecycle,
          async promptManualReview() {
            return {
              action: 'reject',
              reason: ' ',
            };
          },
        },);
        /** Generic empty-reason rejection result. */
        const empty = await emptyHandler({
          error: REVIEW_ERROR,
          request: fallbackRequest(),
          context: emptyHarness.context,
        },);
        expect(empty.content,).toEqual([{
          type: 'text',
          text: 'Manual reviewer rejected completion after model review was unavailable.',
        },],);
        expect(emptyHarness.state.value.goal.phase,).toBe('active',);
      },
    },),
    it({
      name: 'ignores stale manual acceptance after branch changes during dialog',
      fn: async () => {
        /** TUI harness whose branch changes inside dialog. */
        const harness = fallbackHarness('tui',);
        /** Stale manual handler. */
        const handler = createGoalReviewerUnavailableHandler({
          lifecycle: harness.lifecycle,
          async promptManualReview() {
            harness.leaf.value = 'leaf-other';
            return { action: 'accept', };
          },
        },);
        /** Stale fallback result. */
        const result: GoalCompletionResult = await handler({
          error: REVIEW_ERROR,
          request: fallbackRequest(),
          context: harness.context,
        },);
        expect(result.details.outcome,).toBe('stale',);
        expect(harness.state.value.goal.phase,).toBe('active',);
        expect(harness.effects,).toHaveLength(0,);
      },
    },),
  ],
},);
