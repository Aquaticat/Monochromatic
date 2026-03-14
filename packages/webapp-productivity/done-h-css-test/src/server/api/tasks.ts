/**
 * REST API handlers for task CRUD operations.
 *
 * Mounted by server.ts as route handlers:
 *   POST   /api/tasks       -\> handleCreateTask
 *   PUT    /api/tasks/:id   -\> handleUpdateTask
 *   DELETE /api/tasks/:id   -\> handleDeleteTask
 *
 * Client code calls these via the `api()` helper (see client/lib/api.ts),
 * typically followed by `globalThis.location.reload()` to re-render with fresh data.
 *
 * Exceeds 100 lines: the validation/parsing helpers (`parseEnumValue`,
 * `parseStringArray`, `parseTaskUpdateInput`, `isRecord`) are private to this
 * module and used exclusively by the three handlers below -- extracting them
 * would create a "tasks-validation.ts" with no other consumers.
 */
import { createTask, deleteTask, updateTask } from "../../lib/db/tasks.ts";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus, type TaskUpdateInput } from "../../lib/types.ts";

/** HTTP status code for successful responses. */
const HTTP_OK = 200;

/** HTTP status code for resource creation. */
const HTTP_CREATED = 201;

/** HTTP status code for bad requests. */
const HTTP_BAD_REQUEST = 400;

/** HTTP status code for not found. */
const HTTP_NOT_FOUND = 404;

/** HTTP status code for internal server errors. */
const HTTP_INTERNAL_ERROR = 500;

/** Recognized priority/complexity values for input validation. */
const priorities = new Set<string>(TASK_PRIORITIES);

/** Recognized status values for input validation. */
const statuses = new Set<string>(TASK_STATUSES);

/**
 * Wraps a payload in a JSON `Response` with the correct content type.
 *
 * @param payload - Serializable value
 *
 * @param status - HTTP status code (defaults to 200)
 *
 * @returns JSON response with content-type header
 */
function jsonResponse(payload: unknown, status: number = HTTP_OK): Response {
  return Response.json(payload, { status });
}

/**
 * Narrows `unknown` to a plain object for property access.
 *
 * @param value - Value to check
 *
 * @returns True when value is a non-null object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Extracts a trimmed, non-empty string array from untrusted input.
 *
 * @param value - Raw input that may be an array
 *
 * @returns Parsed array, or `null` when the input is not an array
 */
function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsedValues = value
    .filter(function isString(entry): entry is string {
      return typeof entry === "string";
    })
    .map(function trimEntry(entry) {
      return entry.trim();
    })
    .filter(function isNonEmpty(entry) {
      return entry.length > 0;
    });
  return parsedValues;
}

/**
 * Parses a nullable enum field (priority or complexity) from untrusted input.
 * Returns `undefined` when the value is absent or not a recognized member,
 * `null` when explicitly cleared, or the validated string otherwise.
 *
 * @param value - Raw input value
 *
 * @param validValues - Set of recognized enum strings
 *
 * @returns Validated enum value, null, or undefined
 */
function parseEnumValue<T extends string>(value: unknown, validValues: Set<string>): T | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return undefined;
  }
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
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
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
function parseTaskUpdateInput(value: unknown): TaskUpdateInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const taskUpdateInput: TaskUpdateInput = {};

  if ("title" in value) {
    if (typeof value.title !== "string") {
      return null;
    }
    taskUpdateInput.title = value.title;
  }

  if ("description" in value) {
    if (typeof value.description !== "string" && value.description !== null) {
      return null;
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated above: string | null
    taskUpdateInput.description = value.description;
  }

  if ("tags" in value) {
    const tags = parseStringArray(value.tags);
    if (tags === null) {
      return null;
    }
    taskUpdateInput.tags = tags;
  }

  if ("locations" in value) {
    const locations = parseStringArray(value.locations);
    if (locations === null) {
      return null;
    }
    taskUpdateInput.locations = locations;
  }

  if ("blockedBy" in value) {
    const blockedBy = parseStringArray(value.blockedBy);
    if (blockedBy === null) {
      return null;
    }
    taskUpdateInput.blockedBy = blockedBy;
  }

  if ("reminders" in value) {
    const reminders = parseStringArray(value.reminders);
    if (reminders === null) {
      return null;
    }
    taskUpdateInput.reminders = reminders;
  }

  if ("priority" in value) {
    const priority = parseEnumValue<TaskPriority>(value.priority, priorities);
    if (priority === undefined) {
      return null;
    }
    taskUpdateInput.priority = priority;
  }

  if ("complexity" in value) {
    const complexity = parseEnumValue<TaskPriority>(value.complexity, priorities);
    if (complexity === undefined) {
      return null;
    }
    taskUpdateInput.complexity = complexity;
  }

  if ("dueDate" in value) {
    if (typeof value.dueDate !== "string" && value.dueDate !== null) {
      return null;
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated above: string | null
    taskUpdateInput.dueDate = value.dueDate;
  }

  if ("status" in value) {
    const status = parseStatus(value.status);
    if (status === undefined) {
      return null;
    }
    taskUpdateInput.status = status;
  }

  return taskUpdateInput;
}

/**
 * POST /api/tasks -- creates a new task from the request body.
 *
 * @param req - Incoming request with JSON body
 *
 * @returns 201 with the created task, or 400/500 on validation/server error
 */
export async function handleCreateTask(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    if (!isRecord(body)) {
      return jsonResponse({ error: "Invalid request body" }, HTTP_BAD_REQUEST);
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length === 0) {
      return jsonResponse({ error: "Task title is required" }, HTTP_BAD_REQUEST);
    }

    const task = await createTask({
      title,
      description: typeof body.description === "string" ? body.description : null,
      tags: parseStringArray(body.tags) ?? [],
      locations: parseStringArray(body.locations) ?? [],
      priority: parseEnumValue<TaskPriority>(body.priority, priorities) ?? null,
      complexity: parseEnumValue<TaskPriority>(body.complexity, priorities) ?? null,
    });
    return jsonResponse(task, HTTP_CREATED);
  } catch (error) {
    return jsonResponse({ error: String(error) }, HTTP_INTERNAL_ERROR);
  }
}

/**
 * PUT /api/tasks/:id -- applies a partial update to an existing task.
 *
 * @param req - Incoming request with JSON body
 *
 * @param id - Task UUID from the route parameter
 *
 * @returns 200 with updated task, 400 on bad payload, 404 when missing
 */
export async function handleUpdateTask(req: Request, id: string): Promise<Response> {
  try {
    const body = await req.json();
    const taskUpdateInput = parseTaskUpdateInput(body);
    if (taskUpdateInput === null) {
      return jsonResponse({ error: "Invalid update payload" }, HTTP_BAD_REQUEST);
    }

    const task = await updateTask(id, taskUpdateInput);
    if (task === null) {
      return jsonResponse({ error: "Task not found" }, HTTP_NOT_FOUND);
    }

    return jsonResponse(task);
  } catch (error) {
    return jsonResponse({ error: String(error) }, HTTP_INTERNAL_ERROR);
  }
}

/**
 * DELETE /api/tasks/:id -- permanently removes a task.
 *
 * @param id - Task UUID from the route parameter
 *
 * @returns 200 on success, 404 when the task does not exist
 */
export async function handleDeleteTask(id: string): Promise<Response> {
  const deleted = await deleteTask(id);
  if (!deleted) {
    return jsonResponse({ error: "Task not found" }, HTTP_NOT_FOUND);
  }

  return jsonResponse({ ok: true });
}
