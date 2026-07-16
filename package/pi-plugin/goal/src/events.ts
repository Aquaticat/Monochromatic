/**
 * Persisted goal event validation and active-branch extraction.
 *
 * @module
 */

import { GOAL_STATE_ENTRY_TYPE, } from './constants.ts';
import type { GoalEvent, } from './types.ts';

/**
 * Minimal Pi custom-entry shape accepted by branch extractor.
 *
 * @example
 * ```ts
 * const entry: GoalBranchEntry = { type: 'custom', customType: 'goal:state', data: event };
 * ```
 */
type GoalBranchEntry = {
  /**
   * Pi session entry discriminator.
   */
  readonly type: string;
  /**
   * Extension custom type when entry is custom.
   */
  readonly customType?: unknown;
  /**
   * Persisted custom payload.
   */
  readonly data?: unknown;
};

/**
 * Narrow unknown value to property record.
 *
 * @param value - candidate event payload
 *
 * @returns whether string property lookup is safe
 *
 * @example
 * ```ts
 * isRecord({ kind: 'run_started' });
 * ```
 */
function isRecord(value: unknown,): value is Record<string, unknown> {
  return (value !== null)
    && ((typeof value) === 'object');
}

/**
 * Require named string properties on record.
 *
 * @param record - candidate event record
 *
 * @param names - required string property names
 *
 * @returns whether every named property is string
 *
 * @example
 * ```ts
 * hasStringProperties({ runId: 'r' }, ['runId']);
 * ```
 */
function hasStringProperties(
  {
    record,
    names,
  }: {
    readonly record: Readonly<Record<string, unknown>>;
    readonly names: readonly string[];
  },
): boolean {
  return names.every(function propertyIsString(name,) {
    return (typeof record[name]) === 'string';
  },);
}

/**
 * Validate persisted unknown payload as one supported goal event.
 *
 * @param value - custom-entry payload
 *
 * @returns whether payload is goal event
 *
 * @example
 * ```ts
 * isGoalEvent({ kind: 'run_cleared', runId: 'r', generationId: 'g', clearedAt: 'now' });
 * ```
 */
function isGoalEvent(value: unknown,): value is GoalEvent {
  if (!isRecord(value,))
    return false;
  /**
   * Event kind inspected by guarded branches.
   */
  const { kind, } = value;
  if ((typeof kind) !== 'string')
    return false;
  if (kind === 'run_started') {
    return hasStringProperties({
      record: value,
      names: [
        'runId',
        'generationId',
        'objective',
        'startedAt',
        'startBoundary',
        'transitionedAt',
      ],
    },)
      && (value.continuationSequence === 0)
      && ((value.supersededRunId === undefined)
        || ((typeof value.supersededRunId) === 'string'));
  }
  if (kind === 'generation_rotated') {
    return hasStringProperties({
      record: value,
      names: [
        'runId',
        'previousGenerationId',
        'generationId',
        'transitionedAt',
      ],
    },)
      && ((typeof value.continuationSequence) === 'number')
      && ((value.cause === 'runtime_restore')
        || (value.cause === 'tree_navigation'));
  }
  if (kind === 'review_denied') {
    return hasStringProperties({
      record: value,
      names: [
        'runId',
        'generationId',
        'feedback',
        'transitionedAt',
      ],
    },)
      && ((typeof value.continuationSequence) === 'number');
  }
  if (kind === 'continuation_issued') {
    return hasStringProperties({
      record: value,
      names: [
        'runId',
        'generationId',
        'transitionedAt',
      ],
    },)
      && ((typeof value.continuationSequence) === 'number');
  }
  if (kind === 'run_completed_model') {
    return hasStringProperties({
      record: value,
      names: [
        'runId',
        'generationId',
        'summary',
        'reviewerIdentity',
        'reviewerFeedback',
        'completedAt',
      ],
    },);
  }
  if (kind === 'run_completed_manual') {
    return hasStringProperties({
      record: value,
      names: [
        'runId',
        'generationId',
        'summary',
        'reviewerFeedback',
        'completedAt',
      ],
    },);
  }
  if (kind === 'review_unavailable') {
    return hasStringProperties({
      record: value,
      names: [
        'runId',
        'generationId',
        'summary',
        'diagnostic',
        'terminalAt',
      ],
    },)
      && Array.isArray(value.attemptedReviewerIdentities,)
      && value.attemptedReviewerIdentities
      .every(function reviewerIsString(reviewer,) {
        return (typeof reviewer) === 'string';
      },);
  }
  if (kind === 'run_cleared') {
    return hasStringProperties({
      record: value,
      names: [
        'runId',
        'generationId',
        'clearedAt',
      ],
    },);
  }
  return false;
}

/**
 * Extract validated goal events from ordered active branch entries.
 *
 * @param entries - `SessionManager.getBranch()` result or compatible fixture
 *
 * @returns ordered validated goal events
 *
 * @example
 * ```ts
 * const events = goalEventsFromBranch(entries);
 * ```
 */
function goalEventsFromBranch(entries: readonly GoalBranchEntry[],): GoalEvent[] {
  return entries
    .filter(function isGoalCustomEntry(entry,) {
      return (entry.type === 'custom')
        && (entry.customType === GOAL_STATE_ENTRY_TYPE)
        && isGoalEvent(entry.data,);
    },)
    .map(function goalEventData(entry,) {
      if (!isGoalEvent(entry.data,))
        throw new Error('Validated goal custom entry lost event shape',);
      return entry.data;
    },);
}

export {
  goalEventsFromBranch,
  isGoalEvent,
};
export type { GoalBranchEntry, };
