/**
 * Input validation and parsing helpers for task API handlers.
 *
 * Pure functions with no handler coupling -- used exclusively
 * by the three handlers in tasks.ts.
 */
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus, type TaskUpdateInput } from "../../lib/types.ts";

/** Recognized priority/complexity values for input validation. */
const priorities = new Set<string>(TASK_PRIORITIES);

/** Recognized status values for input validation. */
const statuses = new Set<string>(TASK_STATUSES);

/**
 * Narrows `unknown` to a plain object for property access.
 *
 * @param value - Value to check
 *
 * @returns True when value is a non-null object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Extracts a trimmed, non-empty string array from untrusted input.
 *
 * @param value - Raw input that may be an array
 *
 * @returns Parsed array, or `null` when the input is not an array
 */
export function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  return value
    .filter(function isString(entry): entry is string { return typeof entry === "string"; })
    .map(function trimEntry(entry) { return entry.trim(); })
    .filter(function isNonEmpty(entry) { return entry.length > 0; });
}

/**
 * Parses a nullable enum field from untrusted input.
 *
 * @param value - Raw input value
 *
 * @param validValues - Set of recognized enum strings
 *
 * @returns Validated enum value, null, or undefined
 */
export function parseEnumValue<T extends string>(value: unknown, validValues: Set<string>): T | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated by Set.has check
  return validValues.has(value) ? (value as T) : undefined;
}

/**
 * Validates a task status value from untrusted input.
 *
 * @param value - Raw input value
 *
 * @returns Validated status, or `undefined` when absent or unrecognized
 */
function parseStatus(value: unknown): TaskStatus | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated by Set.has check
  return statuses.has(value as TaskStatus) ? (value as TaskStatus) : undefined;
}

/**
 * Validates and extracts a `TaskUpdateInput` from an untrusted request body.
 *
 * @param value - Raw parsed JSON body
 *
 * @returns Parsed update payload, or `null` when any field fails validation
 */
export function parseTaskUpdateInput(value: unknown): TaskUpdateInput | null {
  if (!isRecord(value)) return null;
  const result: TaskUpdateInput = {};

  if ("title" in value) { if (typeof value.title !== "string") return null; result.title = value.title; }
  if ("description" in value) {
    if (typeof value.description !== "string" && value.description !== null) return null;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated above
    result.description = value.description;
  }
  if ("tags" in value) { const v = parseStringArray(value.tags); if (v === null) return null; result.tags = v; }
  if ("locations" in value) { const v = parseStringArray(value.locations); if (v === null) return null; result.locations = v; }
  if ("blockedBy" in value) { const v = parseStringArray(value.blockedBy); if (v === null) return null; result.blockedBy = v; }
  if ("reminders" in value) { const v = parseStringArray(value.reminders); if (v === null) return null; result.reminders = v; }
  if ("priority" in value) { const v = parseEnumValue<TaskPriority>(value.priority, priorities); if (v === undefined) return null; result.priority = v; }
  if ("complexity" in value) { const v = parseEnumValue<TaskPriority>(value.complexity, priorities); if (v === undefined) return null; result.complexity = v; }
  if ("dueDate" in value) {
    if (typeof value.dueDate !== "string" && value.dueDate !== null) return null;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated above
    result.dueDate = value.dueDate;
  }
  if ("status" in value) { const v = parseStatus(value.status); if (v === undefined) return null; result.status = v; }

  return result;
}
