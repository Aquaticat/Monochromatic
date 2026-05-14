/**
 * Read-only query functions for the task data-access layer.
 */
import db from '../db.ts';
import type {
  BlockedTaskLink,
  SearchTask,
  Task,
} from '../types.ts';
import {
  getTaskRowById,
  mapTask,
  type TaskRow,
} from './tasks-helpers.ts';
import {
  SQL_SEARCH_FTS,
  SQL_SEARCH_LIKE,
  SQL_SELECT_ALL_TAGS,
  SQL_SELECT_BLOCKED_INBOX,
  SQL_SELECT_FOR_BLOCKER_PICKER,
  SQL_SELECT_IN_PROGRESS,
  SQL_SELECT_INBOX_UNBLOCKED,
} from './tasks-sql.ts';

/**
 * Retrieves a single task by UUID, mapped to the application type.
 *
 * @param id - Task UUID
 *
 * @returns Mapped task, or `null` when the ID does not exist
 *
 * @example
 * ```ts
 * const task = await getTaskById('abc-123');
 * ```
 */
export async function getTaskById(id: string,): Promise<Task | null> {
  const taskRow = await getTaskRowById(id,);
  return taskRow === null ? null : mapTask(taskRow,);
}

/**
 * Lists inbox tasks that have no blockers, newest first.
 *
 * @returns Unblocked inbox tasks sorted by creation date
 *
 * @example
 * ```ts
 * const tasks = await listInboxUnblockedTasks();
 * ```
 */
export async function listInboxUnblockedTasks(): Promise<Task[]> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- database query returns TaskRow shape
  const rows = await db.prepare(SQL_SELECT_INBOX_UNBLOCKED,).all() as TaskRow[];
  return rows.map(function toTask(row,) {
    return mapTask(row,);
  },);
}

/**
 * Lists inbox tasks that are blocked, paired with each blocker ID for nesting.
 *
 * @returns Blocked task links with blocker IDs
 *
 * @example
 * ```ts
 * const links = await listBlockedInboxTasks();
 * ```
 */
export async function listBlockedInboxTasks(): Promise<BlockedTaskLink[]> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- database query returns TaskRow with blocker_id join column
  const rows = await db
    .prepare(SQL_SELECT_BLOCKED_INBOX,)
    .all() as (TaskRow & { blocker_id: string; })[];
  return rows.map(function toBlockedLink(row,) {
    return {
      blockerId: row.blocker_id,
      task: mapTask(row,),
    };
  },);
}

/**
 * Lists tasks with active timers (`status = 'in_progress'`), most recently updated first.
 *
 * @returns In-progress tasks sorted by update date
 *
 * @example
 * ```ts
 * const running = await listInProgressTasks();
 * ```
 */
export async function listInProgressTasks(): Promise<Task[]> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- database query returns TaskRow shape
  const rows = await db.prepare(SQL_SELECT_IN_PROGRESS,).all() as TaskRow[];
  return rows.map(function toTask(row,) {
    return mapTask(row,);
  },);
}

/**
 * Lists non-done tasks excluding the given task, for the blocker picker UI.
 *
 * @param taskId - Task to exclude (the task being edited)
 *
 * @returns Available tasks for blocker selection
 *
 * @example
 * ```ts
 * const candidates = await listTasksForBlockerPicker('current-task-id');
 * ```
 */
export async function listTasksForBlockerPicker(taskId: string,): Promise<Task[]> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- database query returns TaskRow shape
  const rows = await db.prepare(SQL_SELECT_FOR_BLOCKER_PICKER,).all(taskId,) as TaskRow[];
  return rows.map(function toTask(row,) {
    return mapTask(row,);
  },);
}

/**
 * Collects all unique tags across every task, sorted alphabetically.
 *
 * @returns Sorted array of unique tag strings
 *
 * @example
 * ```ts
 * const tags = await listAllTags();
 * // ['errand', 'home', 'work']
 * ```
 */
export async function listAllTags(): Promise<string[]> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- database query returns rows with tag column
  const rows = await db.prepare(SQL_SELECT_ALL_TAGS,).all() as { tag: string; }[];
  return rows.map(function extractTag(row,) {
    return row.tag;
  },);
}

/**
 * Full-text searches tasks by title, description, and tags.
 * Falls back to LIKE matching when the FTS query syntax is invalid.
 *
 * @param searchQuery - User-entered search string
 *
 * @returns Matching tasks with blocked status
 *
 * @example
 * ```ts
 * const results = await searchTasks('groceries');
 * ```
 */
export async function searchTasks(searchQuery: string,): Promise<SearchTask[]> {
  const normalizedSearchQuery = searchQuery.trim();
  if (normalizedSearchQuery.length === 0)
    return [];

  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- database FTS query returns TaskRow with is_blocked column
    const rows = await db.prepare(SQL_SEARCH_FTS,).all(
      normalizedSearchQuery,
    ) as (TaskRow & { is_blocked: number; })[];
    return rows.map(function toSearchTask(row,) {
      return {
        ...mapTask(row,),
        isBlocked: row.is_blocked === 1,
      };
    },);
  }
  catch {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- database LIKE query returns TaskRow with is_blocked column
    const rows = await db
      .prepare(SQL_SEARCH_LIKE,)
      .all(
        `%${normalizedSearchQuery}%`,
        `%${normalizedSearchQuery}%`,
      ) as (TaskRow & {
        is_blocked: number;
      })[];
    return rows.map(function toSearchTask(row,) {
      return {
        ...mapTask(row,),
        isBlocked: row.is_blocked === 1,
      };
    },);
  }
}
