/**
 * Task update input parsing and validation.
 *
 * Separated from `tasks-parse.ts` because `parseTaskUpdateInput` is the
 * largest single validation function and exceeds the line budget when
 * combined with the primitive helpers.
 */
import type {
  TaskPriority,
  TaskStatus,
  TaskUpdateInput,
} from '../../lib/types.ts';
import {
  isRecord,
  parseEnumValue,
  parseStringArray,
} from './tasks-parse.ts';

/** Recognized priority/complexity values for input validation. */
const priorities = new Set<string>([
  'low',
  'medium',
  'high',
],);

/** Recognized status values for input validation. */
const statuses = new Set<string>([
  'inbox',
  'in_progress',
  'done',
],);

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
 * ```
 */
export function parseTaskUpdateInput(value: unknown,): TaskUpdateInput | null {
  if (!isRecord(value,))
    return null;

  /** Accumulator filled field-by-field below; only present keys are assigned. */
  const taskUpdateInput: TaskUpdateInput = {};

  if ('title' in value) {
    if ((typeof value.title) !== 'string')
      return null;
    taskUpdateInput.title = value.title;
  }

  if ('description' in value) {
    if (((typeof value.description) !== 'string') && (value.description !== null))
      return null;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated above: string | null
    taskUpdateInput.description = value.description;
  }

  if ('tags' in value) {
    /** Normalised tag array; null indicates the field failed validation. */
    const tags = parseStringArray(value.tags,);
    if (tags === null)
      return null;
    taskUpdateInput.tags = tags;
  }

  if ('locations' in value) {
    /** Normalised location array; null indicates the field failed validation. */
    const locations = parseStringArray(value.locations,);
    if (locations === null)
      return null;
    taskUpdateInput.locations = locations;
  }

  if ('blockedBy' in value) {
    /** Normalised blockedBy array; null indicates the field failed validation. */
    const blockedBy = parseStringArray(value.blockedBy,);
    if (blockedBy === null)
      return null;
    taskUpdateInput.blockedBy = blockedBy;
  }

  if ('reminders' in value) {
    /** Normalised reminders array; null indicates the field failed validation. */
    const reminders = parseStringArray(value.reminders,);
    if (reminders === null)
      return null;
    taskUpdateInput.reminders = reminders;
  }

  if ('priority' in value) {
    /** Enum-validated priority; undefined indicates the field failed validation. */
    const priority = parseEnumValue<TaskPriority>({
      value: value.priority,
      validValues: priorities,
    },);
    if (priority === undefined)
      return null;
    taskUpdateInput.priority = priority;
  }

  if ('complexity' in value) {
    /** Enum-validated complexity; undefined indicates the field failed validation. */
    const complexity = parseEnumValue<TaskPriority>({
      value: value.complexity,
      validValues: priorities,
    },);
    if (complexity === undefined)
      return null;
    taskUpdateInput.complexity = complexity;
  }

  if ('dueDate' in value) {
    if (((typeof value.dueDate) !== 'string') && (value.dueDate !== null))
      return null;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated above: string | null
    taskUpdateInput.dueDate = value.dueDate;
  }

  if ('status' in value) {
    /** Validated status string; undefined indicates the field failed validation. */
    const status = parseStatus(value.status,);
    if (status === undefined)
      return null;
    taskUpdateInput.status = status;
  }

  return taskUpdateInput;
}
