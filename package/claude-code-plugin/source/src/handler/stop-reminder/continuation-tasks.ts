/**
 * Task-list release for forced continuation.
 *
 * A session whose tracked tasks are all finished has nothing for another turn
 * to advance, so blocking its stop buys a restatement rather than work.
 *
 * State is replayed from the transcript because the `Stop` payload carries
 * background tasks but not the task list. `TaskCreate` results announce an id,
 * and `TaskUpdate` calls carry `taskId` and `status`, so the latest status per
 * id reconstructs the list without a sidecar.
 *
 * An absent task list is deliberately not treated as finished. Most sessions
 * never create a task, and releasing on an empty list would disable forced
 * continuation for all of them.
 *
 * @module
 */

import type { TranscriptRecord, } from '@monochromatic-dev/claude-code-plugin-hook-type/ts';

import {
  parseRecord,
  UNPARSABLE,
} from './continuation-depth.ts';

/**
 * Statuses meaning a task needs no further work.
 *
 * Observed vocabulary across this repository's transcripts is `pending`,
 * `in_progress`, `completed`, and `deleted`. A deleted task is finished in the
 * sense that matters here: nothing remains to do for it.
 */
const FINISHED_STATUSES: ReadonlySet<string> = new Set([
  'completed',
  'deleted',
],);

/**
 * Status a task carries between creation and its first update.
 */
const INITIAL_STATUS = 'pending' as const;

/**
 * Outcome of reading task state from a transcript.
 *
 * `no-task-list` is distinct from `all-finished` because an absent list must not
 * release, while a list whose every entry is done must.
 */
type TaskListState = 'no-task-list' | 'all-finished' | 'work-remains';

/**
 * Replays task state from transcript records.
 *
 * Scans oldest to newest so later updates win. Only successful calls matter, but
 * a failed `TaskUpdate` merely records a status that a later call corrects, so
 * result inspection is not needed for the release decision.
 *
 * @param transcriptLines - transcript JSONL lines, oldest first
 *
 * @returns whether the list is absent, entirely finished, or still has work
 *
 * @example
 * ```ts
 * taskListState(lines); // 'all-finished'
 * ```
 */
function taskListState(transcriptLines: readonly string[],): TaskListState {
  /**
   * Latest known status per task id.
   */
  const statusById = new Map<string, string>();

  for (const line of transcriptLines) {
    if (line === '') {
      continue;
    }

    /**
     * Parsed record, or the sentinel for a truncated line.
     */
    const record = parseRecord(line,);

    if (record === UNPARSABLE) {
      continue;
    }
    recordTaskCreation({
      record,
      statusById,
    },);
    recordTaskUpdate({
      record,
      statusById,
    },);
  }

  if (statusById.size === 0) {
    return 'no-task-list';
  }
  return [...statusById.values(),].every(isFinishedStatus,)
    ? 'all-finished'
    : 'work-remains';
}

/**
 * Reports whether a status means no further work is needed.
 *
 * @param status - task status from a `TaskUpdate` call
 *
 * @returns whether this status is terminal
 *
 * @example
 * ```ts
 * isFinishedStatus('completed'); // true
 * ```
 */
function isFinishedStatus(status: string,): boolean {
  return FINISHED_STATUSES.has(status,);
}

/**
 * Registers a task announced by a `TaskCreate` result.
 *
 * @param record - parsed transcript record
 *
 * @param statusById - accumulator mutated with newly created task ids
 *
 * @mutates statusById - inserts newly created task ids at their initial status
 *
 * @example
 * ```ts
 * recordTaskCreation(record, new Map());
 * ```
 */
function recordTaskCreation(
  {
    record,
    statusById,
  }: {
    readonly record: TranscriptRecord;
    readonly statusById: Map<string, string>;
  },
): void {
  /**
   * Task envelope present on a successful `TaskCreate` result.
   */
  const task = record
    .toolUseResult
    ?.task;
  /**
   * Identifier Claude Code assigned, absent on every other record.
   */
  const id = task?.id;

  if (((typeof id) !== 'string')
    || statusById.has(id,)) {
    return;
  }
  statusById.set(
    id,
    INITIAL_STATUS,
  );
}

/**
 * Applies a `TaskUpdate` call to the replayed state.
 *
 * @param record - parsed transcript record
 *
 * @param statusById - accumulator mutated with the updated status
 *
 * @mutates statusById - overwrites the status for the referenced task id
 *
 * @example
 * ```ts
 * recordTaskUpdate(record, new Map());
 * ```
 */
function recordTaskUpdate(
  {
    record,
    statusById,
  }: {
    readonly record: TranscriptRecord;
    readonly statusById: Map<string, string>;
  },
): void {
  /**
   * Assistant content blocks, an array only for structured messages.
   */
  const content = record
    .message
    ?.content;

  if ((content === undefined)
    || ((typeof content) === 'string')) {
    return;
  }
  for (const call of content) {
    /**
     * Task identifier the call addresses, absent on every other tool.
     */
    const taskId = call
      .input
      ?.taskId;
    /**
     * Status the call applies.
     */
    const status = call
      .input
      ?.status;

    if ((call.type !== 'tool_use')
      || (call.name !== 'TaskUpdate')
      || ((typeof taskId) !== 'string')
      || ((typeof status) !== 'string')) {
      continue;
    }
    statusById.set(
      taskId,
      status,
    );
  }
}

export type { TaskListState, };

export {
  FINISHED_STATUSES,
  INITIAL_STATUS,
  isFinishedStatus,
  taskListState,
};
