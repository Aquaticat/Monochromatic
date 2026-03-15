/**
 * Shared types and helper functions for the task data-access layer.
 */
import db from '../db.ts';
import type {
  Task,
  TaskComplexity,
  TaskPriority,
  TaskStatus,
} from '../types.ts';
import { SQL_SELECT_TASK_BY_ID, } from './tasks-sql.ts';

/** Milliseconds per second, used for timer elapsed-time calculations. */
export const MS_PER_SECOND = 1_000;

/** Raw SQLite row shape before mapping to the application-level `Task` type. */
export type TaskRow = {
  /** Primary key UUID. */
  id: string;
  /** Task title text. */
  title: string;
  /** Optional task description. */
  description: string | null;
  /** JSON-encoded string array (`'["tag1","tag2"]'`). */
  tags: string;
  /** JSON-encoded string array. */
  locations: string;
  /** Task priority level or null. */
  priority: TaskPriority | null;
  /** ISO date string for due date or null. */
  due_date: string | null;
  /** Task complexity level or null. */
  complexity: TaskComplexity | null;
  /** JSON-encoded string array. */
  reminders: string;
  /** JSON-encoded string array of blocker task IDs. */
  blocked_by: string;
  /** Total tracked seconds. */
  tracked_time: number;
  /** ISO timestamp when timer was started, or null. */
  timer_started_at: string | null;
  /** Current task workflow status. */
  status: TaskStatus;
  /** Source system that created this task. */
  source: Task['source'];
  /** External source identifier. */
  source_id: string | null;
  /** Additional source metadata as JSON. */
  source_meta: string | null;
  /** ISO timestamp of creation. */
  created_at: string;
  /** ISO timestamp of last update. */
  updated_at: string;
};

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
 * Returns the current timestamp in ISO 8601 format for database writes.
 *
 * @returns Current ISO timestamp string
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Safely parses a JSON string expected to contain a string array.
 * Returns an empty array on parse failure or unexpected shape.
 *
 * @param value - Raw JSON text from a SQLite TEXT column
 *
 * @returns Parsed string array, or empty array on failure
 */
export function parseStringArray(value: string,): string[] {
  try {
    const parsed = JSON.parse(value,) as unknown;
    if (!Array.isArray(parsed,))
      return [];
    return parsed.filter(function isString(entry,): entry is string {
      return typeof entry === 'string';
    },);
  }
  catch {
    return [];
  }
}

/**
 * Deduplicates, trims, and filters empty strings from an optional array.
 * Used to normalize user-supplied tag/location/blocker arrays before DB writes.
 *
 * @param values - Raw string array, or `undefined` to produce an empty result
 *
 * @returns Normalized deduplicated array
 */
export function normalizeStringArray(values: readonly string[] | undefined,): string[] {
  if (values === undefined)
    return [];
  return [...new Set(values
    .map(function trimValue(value,) {
      return value.trim();
    },)
    .filter(function isNonEmpty(value,) {
      return value.length > 0;
    },),),];
}

/**
 * Converts a raw SQLite `TaskRow` to the application-level `Task` shape.
 * Parses JSON-encoded array columns and renames snake_case to camelCase.
 *
 * @param row - Raw database row
 *
 * @returns Mapped task object
 */
export function mapTask(row: TaskRow,): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: parseStringArray(row.tags,),
    locations: parseStringArray(row.locations,),
    priority: row.priority,
    dueDate: row.due_date,
    complexity: row.complexity,
    reminders: parseStringArray(row.reminders,),
    blockedBy: parseStringArray(row.blocked_by,),
    trackedTime: row.tracked_time,
    timerStartedAt: row.timer_started_at,
    status: row.status,
    source: row.source,
    sourceId: row.source_id,
    sourceMeta: row.source_meta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetches a single task row by primary key without mapping.
 *
 * @param id - Task UUID
 *
 * @returns Raw task row, or null when not found
 */
export async function getTaskRowById(id: string,): Promise<TaskRow | null> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- database prepare().get() returns the row shape we defined
  const taskRow = await db.prepare(SQL_SELECT_TASK_BY_ID,).get(id,) as
    | TaskRow
    | undefined;
  return taskRow ?? null;
}
