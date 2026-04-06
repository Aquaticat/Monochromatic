/**
 * Timer and completion operations for tasks.
 *
 * Handles start/stop timer state transitions and blocker-aware
 * task completion. Basic CRUD remains in tasks.ts.
 */
import db from '../db.ts';
import type { Task, } from '../types.ts';
import { nowIso, } from './task-mapping.ts';
import { getTaskById, } from './task-queries.ts';
import {
  SQL_DELETE_TASK,
  SQL_SELECT_BLOCKERS,
  SQL_START_TIMER,
  SQL_STOP_TIMER,
} from './task-sql.ts';

/** Milliseconds per second, used for timer elapsed-time calculations. */
const MS_PER_SECOND = 1_000;

/** Summary of a single blocker task, used to report why completion was refused. */
export type BlockerSummary = {
  /** UUID of the blocking task. */
  blockerId: string;
  /** Title of the blocking task. */
  blockerTitle: string;
};

/** Outcome of a `completeTask()` call -- carries blockers when completion is refused. */
export type CompleteTaskResult = {
  /** Whether the task was successfully completed and deleted. */
  completed: boolean;
  /** Whether the task ID was not found in the database. */
  notFound: boolean;
  /** List of active blockers that prevented completion. */
  blockedBy: BlockerSummary[];
};

/**
 * Starts the timer on a task, transitioning its status to `in_progress`.
 *
 * @param id - Task UUID
 *
 * @returns Updated task, or `null` when not found
 *
 * @example
 * ```ts
 * const task = await startTaskTimer('uuid-123');
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
 * Stops the running timer, accumulates elapsed seconds, and resets to inbox.
 *
 * @param id - Task UUID
 *
 * @returns Updated task, or `null` when not found
 *
 * @example
 * ```ts
 * const task = await stopTaskTimer('uuid-123');
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
  const timestamp = nowIso();
  await db.prepare(SQL_STOP_TIMER,).run(
    currentTask.trackedTime + elapsedSeconds,
    timestamp,
    id,
  );
  return getTaskById(id,);
}

/**
 * Attempts to complete a task: refuses if blockers remain, otherwise deletes.
 *
 * @param id - Task UUID
 *
 * @returns Completion result with blocker information
 *
 * @example
 * ```ts
 * const result = await completeTask('uuid-123');
 * if (!result.completed) console.error('Blocked by', result.blockedBy);
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
  const blockingRows = await db.prepare(SQL_SELECT_BLOCKERS,).all(id,) as {
    blocker_id: string;
    blocker_title: string;
  }[];
  const blockedBy = blockingRows.map(function toSummary(row,) {
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
