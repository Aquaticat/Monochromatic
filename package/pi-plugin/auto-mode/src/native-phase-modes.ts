/**
 Named-mode planning for the native phase catalog.

 Every strict branch reads its expectation from one derived plan, so the named
 modes stay addressable and their exact counts live in one place. @module
 */
import assert from 'node:assert/strict';
import type {
  NativePhaseMode,
  NativePhaseNotificationDelivery,
  NativePhasePlan
} from './native-phase-types.ts';

//region Mode tables keep the named catalog branches in one checked list.

/**
 All named modes the fixture accepts before dispatch.
 */
const NATIVE_PHASE_MODES: readonly NativePhaseMode[] = [
  'parallel',
  'sequential',
  'implicit-sequential',
  'invalid',
  'before-block',
  'tool-error',
  'deny',
  'cancel',
  'notification-context',
  'notification-turn',
  'notification-followup',
  'notification-primary',
  'notification-primary-turn',
  'notification-primary-followup',
  'steer-user',
  'steer-primary',
  'policy-change',
  'policy-primary'
];

/**
 Modes whose complete groups stay withheld before execution.
 */
const WITHHELD_MODES: readonly NativePhaseMode[] = [
  'invalid',
  'before-block',
  'deny',
  'steer-user',
  'steer-primary',
  'policy-change',
  'policy-primary'
];

/**
 Modes that never reach the assessment wire.
 */
const ZERO_ATTEMPT_MODES: readonly NativePhaseMode[] = [
  'invalid',
  'before-block',
  'steer-primary',
  'policy-primary'
];

/**
 Modes that execute their members one at a time.
 */
const SEQUENTIAL_ACTIVE_MODES: readonly NativePhaseMode[] = [
  'sequential',
  'implicit-sequential'
];

/**
 Tool-call identifiers the proposed group carries.
 */
const PROPOSAL_IDS: readonly string[] = [
  'phase-0',
  'phase-1',
  'phase-2'
];

/**
 Followup tool-call identifier the notification flow adds.
 */
const FOLLOWUP_ID = 'phase-3';

/**
 Executed members the parallel path admits.
 */
const PARALLEL_EXECUTIONS = 3;

/**
 Executed members the notification flow admits.
 */
const NOTIFICATION_EXECUTIONS = 4;

/**
 Executed members the cancellation path admits.
 */
const CANCELLATION_EXECUTIONS = 1;

/**
 Assessment rounds the ordinary automatic path needs.
 */
const AUTOMATIC_ASSESSMENT_ATTEMPTS = 2;

/**
 Notification flow rounds include one extra followup assessment.
 */
const NOTIFICATION_ASSESSMENT_ATTEMPTS = 4;

/**
 Sequential modes hold one member active at a time.
 */
const SEQUENTIAL_MAXIMUM_ACTIVE = 1;

/**
 Parallel modes hold the whole admitted group active together.
 */
const PARALLEL_MAXIMUM_ACTIVE = 3;

//endregion

//region Mode facts derive once and feed every strict branch.

/**
 Check mode-table membership without narrowing the table to plain strings.

 @param list - named mode table to search

 @param value - parsed mode text

 @returns whether the table contains the parsed mode
 */
function modeListIncludes({
  list,
  value
}: Readonly<{
  list: readonly string[];
  value: string;
}>): boolean {
  return list.includes(value);
}

/**
 Require the parsed mode before any plan fact is derived.

 @param value - parsed mode text after dispatch

 @returns narrowed named mode for plan derivation

 @example
 ```ts
 assertNativePhaseMode('parallel');
 ```

 @throws AssertionError when the mode is outside the named catalog
 */
export function assertNativePhaseMode(value: string): asserts value is NativePhaseMode {
  assert.ok(modeListIncludes({
    list: NATIVE_PHASE_MODES,
    value
  }));
}

/**
 Derive the notification delivery options for one named mode.

 @param mode - named catalog mode

 @returns delivery options the real session receives
 */
function notificationDeliveryFor({ mode }: Readonly<{ mode: NativePhaseMode }>): NativePhaseNotificationDelivery {
  if (mode.endsWith('-turn'))
    return {
      triggerTurn: true,
      deliverAs: 'steer'
    };
  if (mode.endsWith('-followup'))
    return {
      triggerTurn: true,
      deliverAs: 'followUp'
    };
  return { triggerTurn: false };
}

/**
 Parse the requested mode and derive every strict branch expectation.

 @param requestedMode - mode argument forwarded by the task dispatch

 @returns complete mode plan with exact expected counts

 @example
 ```ts
 const plan = readNativePhasePlan({ requestedMode: 'parallel' });
 ```

 @throws AssertionError when the parsed mode is outside the named catalog
 */
export function readNativePhasePlan({ requestedMode }: Readonly<{ requestedMode: string }>): NativePhasePlan {
  assertNativePhaseMode(requestedMode);
  /**
   Mode text stays the dispatched request value through the whole plan.
   */
  const mode: NativePhaseMode = requestedMode;
  /**
   Notification modes extend the group with one followup member.
   */
  const notification = mode.startsWith('notification-');
  /**
   Primary notification modes deliver inside the terminal request instead.
   */
  const notificationPrimary = mode.startsWith('notification-primary');
  /**
   Withheld modes never reach native execution.
   */
  const withheld = modeListIncludes({
    list: WITHHELD_MODES,
    value: mode
  });
  /**
   Cancellation admits exactly one executed member before abort.
   */
  const cancel = mode === 'cancel';
  /**
   Sequential and cancellation modes request serial native execution.
   */
  const sequentialExecution = (mode === 'sequential') || cancel;
  /**
   Implicit sequential mode keeps serial execution on the tool itself.
   */
  const implicitSequential = mode === 'implicit-sequential';
  /**
   Proposal identifiers keep their original phase ordering.
   */
  const ids = notification
    ? [
      ...PROPOSAL_IDS,
      FOLLOWUP_ID
    ]
    : [
      ...PROPOSAL_IDS
    ];
  return {
    requestedMode,
    mode,
    notification,
    notificationPrimary,
    withheld,
    cancel,
    sequentialExecution,
    implicitSequential,
    expectedExecutions: withheld
      ? 0
      : cancel
        ? CANCELLATION_EXECUTIONS
        : notification
          ? NOTIFICATION_EXECUTIONS
          : PARALLEL_EXECUTIONS,
    expectedAttempts: modeListIncludes({
      list: ZERO_ATTEMPT_MODES,
      value: mode
    })
      ? 0
      : notification
        ? NOTIFICATION_ASSESSMENT_ATTEMPTS
        : AUTOMATIC_ASSESSMENT_ATTEMPTS,
    expectedPrepares: notification
      ? NOTIFICATION_EXECUTIONS
      : PARALLEL_EXECUTIONS,
    expectedMaximumActive: modeListIncludes({
      list: SEQUENTIAL_ACTIVE_MODES,
      value: mode
    })
      ? SEQUENTIAL_MAXIMUM_ACTIVE
      : PARALLEL_MAXIMUM_ACTIVE,
    ids,
    expectedBeforeIds: ids.filter(function beforeHookedId(id: string): boolean {
      return (mode !== 'invalid') || (id !== 'phase-1');
    }),
    notificationDelivery: notificationDeliveryFor({ mode })
  };
}

//endregion
