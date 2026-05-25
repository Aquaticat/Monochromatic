/**
 * Task-specific input parsing for the update API handler.
 *
 * Delegates to generic validation helpers from task-validation.ts,
 * adding task-domain field parsing on top.
 */
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
  type TaskUpdateInput,
} from '../../lib/types.ts';
import {
  isRecord,
  parseEnumValue,
  parseStringArray,
} from './task-validation.ts';

/** Recognized priority/complexity values for input validation. */
const priorities = new Set<string>(TASK_PRIORITIES,);

/** Recognized status values for input validation. */
const statuses = new Set<string>(TASK_STATUSES,);

/**
 * Validates a task status value from untrusted input.
 *
 * @param value - Raw input value
 *
 * @returns Validated status, or `undefined` when absent or unrecognized
 */
function parseStatus(value: unknown,): TaskStatus | undefined {
  if (value === undefined)
    return undefined;
  if ((typeof value) !== 'string')
    return undefined;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated by Set.has check
  return statuses.has(value as TaskStatus,) ? (value as TaskStatus) : undefined;
}

/**
 * Validates and extracts a `TaskUpdateInput` from an untrusted request body.
 *
 * @param value - Raw parsed JSON body
 *
 * @returns Parsed update payload, or `null` when any field fails validation
 *
 * @example
 * ```ts
 * const input = parseTaskUpdateInput(await req.json());
 * if (input === null) return badRequest();
 * ```
 */
export function parseTaskUpdateInput(value: unknown,): TaskUpdateInput | null {
  if (!isRecord(value,))
    return null;
  /** Accumulator: each field block validates the input and adds the parsed value here. */
  const result: TaskUpdateInput = {};

  if ('title' in value) {
    if ((typeof value.title) !== 'string')
      return null;
    result.title = value.title;
  }
  if ('description' in value) {
    if (((typeof value.description) !== 'string') && (value.description
      !== null))
      return null;
    result.description = value.description;
  }
  if ('tags' in value) {
    /** Parsed `tags` array; `null` signals a validation failure and aborts the parse. */
    const v = parseStringArray(value.tags,);
    if (v === null)
      return null;
    result.tags = v;
  }
  if ('locations' in value) {
    /** Parsed `locations` array; `null` signals a validation failure and aborts the parse. */
    const v = parseStringArray(value.locations,);
    if (v === null)
      return null;
    result.locations = v;
  }
  if ('blockedBy' in value) {
    /** Parsed `blockedBy` array; `null` signals a validation failure and aborts the parse. */
    const v = parseStringArray(value.blockedBy,);
    if (v === null)
      return null;
    result.blockedBy = v;
  }
  if ('reminders' in value) {
    /** Parsed `reminders` array; `null` signals a validation failure and aborts the parse. */
    const v = parseStringArray(value.reminders,);
    if (v === null)
      return null;
    result.reminders = v;
  }
  if ('priority' in value) {
    /** Parsed priority enum; `undefined` signals an unrecognised value and aborts the parse. */
    const v = parseEnumValue<TaskPriority>({
      value: value.priority,
      validValues: priorities,
    },);
    if (v === undefined)
      return null;
    result.priority = v;
  }
  if ('complexity' in value) {
    /** Parsed complexity enum; `undefined` signals an unrecognised value and aborts the parse. */
    const v = parseEnumValue<TaskPriority>({
      value: value.complexity,
      validValues: priorities,
    },);
    if (v === undefined)
      return null;
    result.complexity = v;
  }
  if ('dueDate' in value) {
    if (((typeof value.dueDate) !== 'string') && (value.dueDate
      !== null))
      return null;
    result.dueDate = value.dueDate;
  }
  if ('status' in value) {
    /** Parsed task status; `undefined` signals an unrecognised value and aborts the parse. */
    const v = parseStatus(value.status,);
    if (v === undefined)
      return null;
    result.status = v;
  }

  return result;
}
