/**
 * Task mutation operations against the SQLite database.
 *
 * Read-only queries are in task-queries.ts; this module handles
 * create, update, delete, and timer operations. Re-exports all
 * query functions so existing consumers can import from one place.
 */
import db from '../db.ts';
import type {
  Task,
  TaskCreateInput,
  TaskUpdateInput,
} from '../types.ts';
import {
  normalizeStringArray,
  nowIso,
} from './task-mapping.ts';
import { getTaskById, } from './task-queries.ts';
import {
  SQL_DELETE_TASK,
  SQL_INSERT_TASK,
  SQL_SELECT_BLOCKERS,
  SQL_START_TIMER,
  SQL_STOP_TIMER,
  SQL_UPDATE_TASK,
} from './task-sql.ts';

// Re-export all query functions for backward compatibility
export {
  getTaskById,
  listAllTags,
  listBlockedInboxTasks,
  listInboxUnblockedTasks,
  listInProgressTasks,
  listTasksForBlockerPicker,
  searchTasks,
} from './task-queries.ts';

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
 * Inserts a new task with a generated UUID and current timestamp.
 *
 * @param input - Task creation payload
 *
 * @returns Freshly created task
 *
 * @throws When the read-back fails
 */
export async function createTask(input: TaskCreateInput,): Promise<Task> {
  const id = crypto.randomUUID();
  const timestamp = nowIso();

  await db.prepare(SQL_INSERT_TASK,).run(
    id,
    input.title.trim(),
    input.description ?? null,
    JSON.stringify(normalizeStringArray(input.tags,),),
    JSON.stringify(normalizeStringArray(input.locations,),),
    input.priority ?? null,
    input.dueDate ?? null,
    input.complexity ?? null,
    JSON.stringify(normalizeStringArray(input.reminders,),),
    JSON.stringify(normalizeStringArray(input.blockedBy,),),
    0,
    null,
    'inbox',
    'local',
    null,
    null,
    timestamp,
    timestamp,
  );

  const createdTask = await getTaskById(id,);
  if (createdTask === null)
    throw new Error('Failed to read created task',);
  return createdTask;
}

/**
 * Applies a partial update to an existing task.
 *
 * @param id - Task UUID
 *
 * @param input - Fields to update
 *
 * @returns Updated task, or `null` when not found
 */
export async function updateTask(id: string,
  input: TaskUpdateInput,): Promise<Task | null>
{
  const currentTask = await getTaskById(id,);
  if (currentTask === null)
    return null;

  const updated: Task = {
    ...currentTask,
    title: input.title?.trim() ?? currentTask.title,
    description: input.description ?? currentTask.description,
    tags: input.tags ?? currentTask.tags,
    locations: input.locations ?? currentTask.locations,
    priority: input.priority ?? currentTask.priority,
    dueDate: input.dueDate ?? currentTask.dueDate,
    complexity: input.complexity ?? currentTask.complexity,
    reminders: input.reminders ?? currentTask.reminders,
    blockedBy: input.blockedBy ?? currentTask.blockedBy,
    status: input.status ?? currentTask.status,
    updatedAt: nowIso(),
  };

  await db.prepare(SQL_UPDATE_TASK,).run(
    updated.title,
    updated.description,
    JSON.stringify(normalizeStringArray(updated.tags,),),
    JSON.stringify(normalizeStringArray(updated.locations,),),
    updated.priority,
    updated.dueDate,
    updated.complexity,
    JSON.stringify(normalizeStringArray(updated.reminders,),),
    JSON.stringify(normalizeStringArray(updated.blockedBy,),),
    updated.status,
    updated.updatedAt,
    id,
  );

  return getTaskById(id,);
}

/**
 * Permanently removes a task by UUID.
 *
 * @param id - Task UUID
 *
 * @returns `true` when the task existed and was deleted
 */
export async function deleteTask(id: string,): Promise<boolean> {
  const result = await db.prepare(SQL_DELETE_TASK,).run(id,);
  return result.changes > 0;
}

/**
 * Starts the timer on a task, transitioning its status to `in_progress`.
 *
 * @param id - Task UUID
 *
 * @returns Updated task, or `null` when not found
 */
export async function startTaskTimer(id: string,): Promise<Task | null> {
  const timestamp = nowIso();
  await db.prepare(SQL_START_TIMER,).run(timestamp, timestamp, id,);
  return getTaskById(id,);
}

/**
 * Stops the running timer, accumulates elapsed seconds, and resets to inbox.
 *
 * @param id - Task UUID
 *
 * @returns Updated task, or `null` when not found
 */
export async function stopTaskTimer(id: string,): Promise<Task | null> {
  const currentTask = await getTaskById(id,);
  if (currentTask === null)
    return null;

  const elapsedSeconds = currentTask.timerStartedAt === null
    ? 0
    : Math.max(0, Math.floor(
      (Date.now() - Date.parse(currentTask.timerStartedAt,)) / MS_PER_SECOND,
    ),);
  const timestamp = nowIso();
  await db.prepare(SQL_STOP_TIMER,).run(currentTask.trackedTime + elapsedSeconds,
    timestamp, id,);
  return getTaskById(id,);
}

/**
 * Attempts to complete a task: refuses if blockers remain, otherwise deletes.
 *
 * @param id - Task UUID
 *
 * @returns Completion result with blocker information
 */
export async function completeTask(id: string,): Promise<CompleteTaskResult> {
  const currentTask = await getTaskById(id,);
  if (currentTask === null)
    return { completed: false, notFound: true, blockedBy: [], };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- database query returns blocker join columns
  const blockingRows = await db.prepare(SQL_SELECT_BLOCKERS,).all(id,) as {
    blocker_id: string;
    blocker_title: string;
  }[];
  const blockedBy = blockingRows.map(function toSummary(row,) {
    return { blockerId: row.blocker_id, blockerTitle: row.blocker_title, };
  },);
  if (blockedBy.length > 0)
    return { completed: false, notFound: false, blockedBy, };

  if (currentTask.timerStartedAt !== null)
    await stopTaskTimer(id,);
  await db.prepare(SQL_DELETE_TASK,).run(id,);
  return { completed: true, notFound: false, blockedBy: [], };
}
