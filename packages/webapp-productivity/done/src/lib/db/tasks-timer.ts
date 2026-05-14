/**
 * Task timer and completion operations.
 */
import { MS_PER_SECOND, } from '@monochromatic-dev/module-numeric-const';

import db from '../db.ts';
import type { Task, } from '../types.ts';
import {
  type CompleteTaskResult,
  nowIso,
} from './tasks-helpers.ts';
import { getTaskById, } from './tasks-queries.ts';
import {
  SQL_DELETE_TASK,
  SQL_SELECT_BLOCKERS,
  SQL_START_TIMER,
  SQL_STOP_TIMER,
} from './tasks-sql.ts';

/**
 * Starts the timer on a task, transitioning its status to `in_progress`.
 *
 * @param id - Task UUID
 *
 * @returns Updated task, or `null` when the ID does not exist
 *
 * @example
 * ```ts
 * const task = await startTaskTimer('abc-123');
 * ```
 */
export async function startTaskTimer(id: string,): Promise<Task | null> {
  const timestamp = nowIso();
  await db.prepare(SQL_START_TIMER,).run(
    timestamp,
    timestamp,
    id,
  );
  return getTaskById(id,);
}

/**
 * Stops the running timer, accumulates elapsed seconds into `trackedTime`,
 * and transitions the task back to `inbox` status.
 *
 * @param id - Task UUID
 *
 * @returns Updated task, or `null` when the ID does not exist
 *
 * @example
 * ```ts
 * const task = await stopTaskTimer('abc-123');
 * ```
 */
export async function stopTaskTimer(id: string,): Promise<Task | null> {
  const currentTask = await getTaskById(id,);
  if (currentTask === null)
    return null;

  const elapsedSeconds = currentTask.timerStartedAt === null
    ? 0
    : Math.max(
      0,
      Math.floor(
        (Date.now() - Date.parse(currentTask.timerStartedAt,)) / MS_PER_SECOND,
      ),
    );
  const updatedTrackedTime = currentTask.trackedTime + elapsedSeconds;
  const timestamp = nowIso();

  await db.prepare(SQL_STOP_TIMER,).run(
    updatedTrackedTime,
    timestamp,
    id,
  );

  return getTaskById(id,);
}

/**
 * Attempts to complete a task: stops any running timer, then deletes it.
 * Refuses completion when the task has unresolved blockers.
 *
 * @param id - Task UUID
 *
 * @returns Completion result with blocker information
 *
 * @example
 * ```ts
 * const result = await completeTask('abc-123');
 * ```
 */
export async function completeTask(id: string,): Promise<CompleteTaskResult> {
  const currentTask = await getTaskById(id,);
  if (currentTask === null) {
    return {
      completed: false,
      notFound: true,
      blockedBy: [],
    };
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- database query returns blocker join columns
  const blockingRows = await db
    .prepare(SQL_SELECT_BLOCKERS,)
    .all(id,) as {
      blocker_id: string;
      blocker_title: string;
    }[];

  const blockedBy = blockingRows.map(function toBlockerSummary(row,) {
    return {
      blockerId: row.blocker_id,
      blockerTitle: row.blocker_title,
    };
  },);
  if (blockedBy.length > 0) {
    return {
      completed: false,
      notFound: false,
      blockedBy,
    };
  }

  if (currentTask.timerStartedAt !== null)
    await stopTaskTimer(id,);

  await db.prepare(SQL_DELETE_TASK,).run(id,);
  return {
    completed: true,
    notFound: false,
    blockedBy: [],
  };
}
