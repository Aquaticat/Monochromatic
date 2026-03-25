/**
 * Task mutation operations against the SQLite database.
 *
 * Read-only query functions are in `tasks-queries.ts`.
 * Timer and completion operations are in `tasks-timer.ts`.
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
} from './tasks-helpers.ts';
import { getTaskById, } from './tasks-queries.ts';
import {
  SQL_DELETE_TASK,
  SQL_INSERT_TASK,
  SQL_UPDATE_TASK,
} from './tasks-sql.ts';

export type {
  BlockerSummary,
  CompleteTaskResult,
} from './tasks-helpers.ts';
export { getTaskById, } from './tasks-queries.ts';
export {
  completeTask,
  startTaskTimer,
  stopTaskTimer,
} from './tasks-timer.ts';

/**
 * Inserts a new task with a generated UUID and current timestamp.
 *
 * @param input - Task creation payload (only `title` is required)
 *
 * @returns Freshly created task read back from the database
 *
 * @throws When the read-back fails (should never happen)
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
 * @param input - Fields to update (omitted fields keep their current value)
 *
 * @returns Updated task, or `null` when the ID does not exist
 */
export async function updateTask(
  id: string,
  input: TaskUpdateInput,
): Promise<Task | null>
{
  const currentTask = await getTaskById(id,);
  if (currentTask === null)
    return null;

  const updatedTask: Task = {
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
    updatedTask.title,
    updatedTask.description,
    JSON.stringify(normalizeStringArray(updatedTask.tags,),),
    JSON.stringify(normalizeStringArray(updatedTask.locations,),),
    updatedTask.priority,
    updatedTask.dueDate,
    updatedTask.complexity,
    JSON.stringify(normalizeStringArray(updatedTask.reminders,),),
    JSON.stringify(normalizeStringArray(updatedTask.blockedBy,),),
    updatedTask.status,
    updatedTask.updatedAt,
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
