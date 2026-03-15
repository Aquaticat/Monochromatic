/**
 * Row mapping and utility functions for the task data-access layer.
 *
 * Shared by both query and mutation modules.
 */
import type { Task, } from '../types.ts';
import type { TaskRow, } from './task-sql.ts';

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
