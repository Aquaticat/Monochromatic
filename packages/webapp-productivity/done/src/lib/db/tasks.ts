/**
 * Task CRUD operations against the SQLite database.
 *
 * Read-only queries are in task-queries.ts; timer and completion
 * operations are in task-timer.ts. Re-exports all query and timer
 * functions so existing consumers can import from one place.
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

// Re-export timer and completion functions
export {
  type BlockerSummary,
  completeTask,
  type CompleteTaskResult,
  startTaskTimer,
  stopTaskTimer,
} from './task-timer.ts';

/**
 * Inserts a new task with a generated UUID and current timestamp.
 *
 * @param input - Task creation payload
 *
 * @returns Freshly created task
 *
 * @throws When the read-back fails
 *
 * @example
 * ```ts
 * const task = await createTask({ title: 'Buy groceries', tags: ['shopping'] });
 * ```
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
 *
 * @example
 * ```ts
 * const task = await updateTask('uuid-123', { title: 'Updated title' });
 * ```
 */
export async function updateTask(
  id: string,
  input: TaskUpdateInput,
): Promise<Task | null> {
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
 *
 * @example
 * ```ts
 * const deleted = await deleteTask('uuid-123');
 * ```
 */
export async function deleteTask(id: string,): Promise<boolean> {
  const result = await db.prepare(SQL_DELETE_TASK,).run(id,);
  return result.changes > 0;
}
