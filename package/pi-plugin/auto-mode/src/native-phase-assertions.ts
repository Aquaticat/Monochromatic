/**
 Strict outcome assertions for the native phase catalog.

 Every named mode keeps its exact branch checks, counts, sequences, and messages
 against the recorded event trace and live fixture observations. @module
 */
import assert from 'node:assert/strict';
import type {
  NativePhaseObservations,
  NativePhasePlan,
  NativePhaseState
} from './native-phase-types.ts';
import type { NativePhaseEvents } from './native-phase-callbacks.ts';

/**
 Assessment rounds recorded before the followup member executes.
 */
const FOLLOWUP_ASSESS_ROUNDS = 4;

/**
 Assessment rounds recorded before an ordinary member executes.
 */
const GROUP_ASSESS_ROUNDS = 2;

/**
 Followup tool-call identifier whose assessment rounds differ.
 */
const FOLLOWUP_ID = 'phase-3';

//region Event selectors reproduce the original trace filtering exactly.

/**
 Select the prepare trace entries recorded by argument preparation.

 @param event - recorded event trace entry

 @returns whether the entry records preparation
 */
function isPrepareEvent(event: string): boolean {
  return event === 'prepare';
}

/**
 Select the assess trace entries recorded by the wire sender.

 @param event - recorded event trace entry

 @returns whether the entry records an assessment round
 */
function isAssessEvent(event: string): boolean {
  return event === 'assess';
}

/**
 Report whether the trace records any tool result hook.

 @param event - recorded event trace entry

 @returns whether the entry records a tool result hook
 */
function startsAfterHook(event: string): boolean {
  return event.startsWith('after:');
}

//endregion

//region Outcome assertions preserve every named branch exactly.

/**
 Assert the complete catalog outcome for one named mode.

 @param plan - mode plan carrying the exact expected counts and identifiers

 @param observations - counters recorded by fixture callbacks

 @param state - live fixture state retaining notification capture flags

 @param events - event trace entries recording native call identity

 @example
 ```ts
 assertNativePhaseOutcome({ plan, observations, state, events });
 ```
 */
export function assertNativePhaseOutcome({
  plan,
  observations,
  state,
  events
}: Readonly<{
  plan: NativePhasePlan;
  observations: NativePhaseObservations;
  state: NativePhaseState;
  events: NativePhaseEvents;
}>): void {
  assert.equal(
    observations.executions,
    plan.expectedExecutions
  );
  assert.equal(
    observations.attempts,
    plan.expectedAttempts
  );
  assert.equal(
    observations.active,
    0
  );
  assert.equal(
    events.filter(isPrepareEvent)
      .length,
    plan.expectedPrepares
  );
  assert.deepEqual(
    events.filter(function messageEvent(event: string): boolean {
      return event.startsWith('message:');
    }),
    plan.ids
      .map(function messageId(id: string): string {
        return `message:${id}`;
      })
  );
  assert.deepEqual(
    events.filter(function startEvent(event: string): boolean {
      return event.startsWith('start:');
    }),
    plan.ids
      .map(function startId(id: string): string {
        return `start:${id}`;
      })
  );
  assert.deepEqual(
    events.filter(function beforeEvent(event: string): boolean {
      return event.startsWith('before:');
    }),
    plan.expectedBeforeIds
      .map(function beforeId(id: string): string {
        return `before:${id}`;
      })
  );
  for (const id of plan.ids) {
    assert.equal(
      events.filter(function finishEvent(event: string): boolean {
        return event.startsWith(`finish:${id}:`);
      })
        .length,
      1
    );
    if (!events.includes(`execute:${id}`))
      continue;
    assert.ok(events.indexOf(`before:${id}`) < events.indexOf(`execute:${id}`));
    assert.equal(
      events.slice(
        0,
        events.indexOf(`execute:${id}`)
      )
        .filter(isAssessEvent)
        .length,
      id === FOLLOWUP_ID
        ? FOLLOWUP_ASSESS_ROUNDS
        : GROUP_ASSESS_ROUNDS
    );
    assert.ok(events.indexOf(`updated:${id}`) > events.indexOf(`returned:${id}`));
    assert.ok(events.indexOf(`after:${id}`) > events.indexOf(`updated:${id}`));
    assert.equal(
      events.filter(function afterEvent(event: string): boolean {
        return event === `after:${id}`;
      })
        .length,
      1
    );
  }
  if ((!plan.withheld) && (!plan.cancel))
    assert.equal(
      observations.maximumActive,
      plan.expectedMaximumActive
    );
  if (plan.withheld)
    assert.equal(
      events.some(startsAfterHook),
      false
    );
  if (plan.notification)
    assert.equal(
      state.sawNotification,
      true,
      'Captured custom data must reach the next real primary request'
    );
  if (plan.steering)
    assert.equal(
      state.sawSteering,
      true,
      'Queued steering text must reach the subsequent request'
    );
}

//endregion
