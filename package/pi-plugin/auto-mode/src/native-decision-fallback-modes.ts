/**
 Named-mode planning for the native decision fallback catalog.

 Every strict branch reads its expectation from one derived plan, so the named
 modes stay addressable and their exact counts live in one place. @module
 */
import assert from 'node:assert/strict';
import type {
  DecisionFallbackMode,
  DecisionFallbackOperationDecision,
  DecisionFallbackPlan,
  DecisionFallbackRelation
} from './native-decision-fallback-types.ts';

//region Mode tables keep the named catalog branches in one checked list.

/**
 All named plain modes the fixture accepts before any prefix handling.
 */
const DECISION_FALLBACK_MODES: readonly DecisionFallbackMode[] = [
  'approve',
  'deny',
  'transient',
  'transient-deny',
  'unknown',
  'low',
  'transport',
  'malformed',
  'initial-failure',
  'stop',
  'cancel',
  'headless',
  'stale',
  'abort',
  'prohibition',
  'deadline',
  'fresh',
  'allow-stale',
  'allow-abort'
];

/**
 Modes whose authored whole-operation answer approves execution.
 */
const AUTO_APPROVE_MODES: readonly DecisionFallbackMode[] = [
  'approve',
  'transient',
  'initial-failure',
  'stale',
  'abort',
  'deadline'
];

/**
 Modes whose authored whole-operation answer denies execution.
 */
const AUTO_DENY_MODES: readonly DecisionFallbackMode[] = [
  'deny',
  'transient-deny',
  'prohibition'
];

/**
 Modes whose members both reach original execution after automatic decisions.
 */
const ALLOWED_EXECUTION_MODES: readonly DecisionFallbackMode[] = [
  'approve',
  'transient',
  'unknown',
  'low',
  'transport',
  'malformed',
  'initial-failure',
  'deadline',
  'fresh'
];

/**
 Modes that must reach scoped manual confirmation instead of automatic approval.
 */
const MANUAL_REVIEW_MODES: readonly DecisionFallbackMode[] = [
  'unknown',
  'low',
  'transport',
  'malformed',
  'stop',
  'cancel',
  'fresh',
  'allow-stale',
  'allow-abort'
];

/**
 Send rounds the ordinary automatic path needs before confirmation.
 */
const AUTOMATIC_ASSESSMENT_ATTEMPTS = 2;

/**
 Transient transport failures consume one extra assessment and HTTP round.
 */
export const TRANSIENT_ASSESSMENT_ATTEMPTS = 3;

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

 @param value - parsed mode text after prefix handling

 @returns narrowed named mode for plan derivation

 @example
 ```ts
 assertDecisionFallbackMode('approve');
 ```

 @throws AssertionError when the mode is outside the named catalog
 */
export function assertDecisionFallbackMode(value: string): asserts value is DecisionFallbackMode {
  assert.ok(modeListIncludes({
    list: DECISION_FALLBACK_MODES,
    value
  }));
}

/**
 Derive the authored whole-operation answer for one named mode.

 @param mode - named catalog mode

 @returns authored operation decision choice
 */
function operationDecisionFor({ mode }: Readonly<{ mode: DecisionFallbackMode }>): DecisionFallbackOperationDecision {
  if (modeListIncludes({
    list: AUTO_APPROVE_MODES,
    value: mode
  }))
    return 'approve';
  if (modeListIncludes({
    list: AUTO_DENY_MODES,
    value: mode
  }))
    return 'deny';
  return 'unknown';
}

/**
 Derive the unresolved clause relation one named mode exercises.

 @param mode - named catalog mode

 @param clauseDenial - whether the request carried a clause-deny prefix

 @returns clause relation sent with the clause question
 */
function relationFor({
  mode,
  clauseDenial
}: Readonly<{
  mode: DecisionFallbackMode;
  clauseDenial: boolean;
}>): DecisionFallbackRelation {
  if (clauseDenial || (mode === 'prohibition'))
    return 'prohibition';
  return mode === 'fresh' ? 'fresh-session-approval' : 'prerequisite';
}

/**
 Parse the requested mode and derive every strict branch expectation.

 @param requestedMode - mode argument forwarded by the task configuration

 @returns complete mode plan with exact expected counts

 @example
 ```ts
 const plan = readDecisionFallbackPlan({ requestedMode: 'transient' });
 ```

 @throws AssertionError when the parsed mode is outside the named catalog
 */
export function readDecisionFallbackPlan({ requestedMode }: Readonly<{ requestedMode: string }>): DecisionFallbackPlan {
  /**
   Clause-deny prefix selects the prohibition relation branch.
   */
  const clauseDenial = requestedMode.startsWith('clause-deny-');
  /**
   Startup-failure prefix selects the failed-classification branch.
   */
  const startupFailure = requestedMode.startsWith('startup-failure-');
  /**
   Parsed mode text keeps the original slice order across both prefixes.
   */
  const modeText = startupFailure
    ? requestedMode.slice('startup-failure-'.length)
    : clauseDenial
      ? requestedMode.slice('clause-deny-'.length)
      : requestedMode;
  assertDecisionFallbackMode(modeText);
  /**
   Named mode drives every remaining plan fact.
   */
  const mode: DecisionFallbackMode = modeText;
  /**
   Transient modes consume one extra assessment round through retry.
   */
  const transient = mode.startsWith('transient');
  return {
    requestedMode,
    mode,
    clauseDenial,
    startupFailure,
    transient,
    operationDecision: operationDecisionFor({ mode }),
    relation: relationFor({
      mode,
      clauseDenial
    }),
    allowed: modeListIncludes({
      list: ALLOWED_EXECUTION_MODES,
      value: mode
    }),
    manualReview: (startupFailure && (mode !== 'headless'))
      || modeListIncludes({
        list: MANUAL_REVIEW_MODES,
        value: mode
      }),
    expectedAttempts: startupFailure
      ? 0
      : transient
        ? TRANSIENT_ASSESSMENT_ATTEMPTS
        : AUTOMATIC_ASSESSMENT_ATTEMPTS
  };
}

//endregion
