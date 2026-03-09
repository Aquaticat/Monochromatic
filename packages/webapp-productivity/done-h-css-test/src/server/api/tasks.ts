/**
 * REST API handlers for task CRUD operations.
 *
 * Mounted by server.ts as route handlers:
 *   POST   /api/tasks       → handleCreateTask
 *   PUT    /api/tasks/:id   → handleUpdateTask
 *   DELETE /api/tasks/:id   → handleDeleteTask
 *
 * Client code calls these via the `api()` helper (see client/lib/api.ts),
 * typically followed by `window.location.reload()` to re-render with fresh data.
 *
 * Exceeds 100 lines: the validation/parsing helpers (`parseEnumValue`,
 * `parseStringArray`, `parseTaskUpdateInput`, `isRecord`) are private to this
 * module and used exclusively by the three handlers below -- extracting them
 * would create a "tasks-validation.ts" with no other consumers.
 */
import { createTask, deleteTask, updateTask } from "../../lib/db/tasks.ts";
import { TASK_PRIORITIES, TASK_STATUSES } from "../../lib/types.ts";
import type { TaskPriority, TaskStatus, TaskUpdateInput } from "../../lib/types.ts";

/** Recognized priority/complexity values for input validation. */
const priorities = new Set<string>(TASK_PRIORITIES);

/** Recognized status values for input validation. */
const statuses = new Set<string>(TASK_STATUSES);

/**
 * Wraps a payload in a JSON `Response` with the correct content type.
 * @param payload - Serializable value
 * @param status - HTTP status code (defaults to 200)
 */
function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Narrows `unknown` to a plain object for property access. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Extracts a trimmed, non-empty string array from untrusted input.
 * @returns Parsed array, or `null` when the input is not an array
 */
function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsedValues = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return parsedValues;
}

/**
 * Parses a nullable enum field (priority or complexity) from untrusted input.
 * Returns `undefined` when the value is absent or not a recognized member,
 * `null` when explicitly cleared, or the validated string otherwise.
 * @param value - Raw input value
 * @param validValues - Set of recognized enum strings
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
  return validValues.has(value) ? (value as T) : undefined;
}

/**
 * Validates a task status value from untrusted input.
 * @returns Validated status, or `undefined` when absent or unrecognized
 */
function parseStatus(value: unknown): TaskStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  return statuses.has(value as TaskStatus) ? (value as TaskStatus) : undefined;
}

/**
 * Validates and extracts a `TaskUpdateInput` from an untrusted request body.
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
 * @returns 201 with the created task, or 400/500 on validation/server error
 */
export async function handleCreateTask(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    if (!isRecord(body)) {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length === 0) {
      return jsonResponse({ error: "Task title is required" }, 400);
    }

    const task = createTask({
      title,
      description: typeof body.description === "string" ? body.description : null,
      tags: parseStringArray(body.tags) ?? [],
      locations: parseStringArray(body.locations) ?? [],
      priority: parseEnumValue<TaskPriority>(body.priority, priorities) ?? null,
      complexity: parseEnumValue<TaskPriority>(body.complexity, priorities) ?? null,
    });
    return jsonResponse(task, 201);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
}

/**
 * PUT /api/tasks/:id -- applies a partial update to an existing task.
 * @param req - Incoming request with JSON body
 * @param id - Task UUID from the route parameter
 * @returns 200 with updated task, 400 on bad payload, 404 when missing
 */
export async function handleUpdateTask(req: Request, id: string): Promise<Response> {
  try {
    const body = await req.json();
    const taskUpdateInput = parseTaskUpdateInput(body);
    if (taskUpdateInput === null) {
      return jsonResponse({ error: "Invalid update payload" }, 400);
    }

    const task = updateTask(id, taskUpdateInput);
    if (task === null) {
      return jsonResponse({ error: "Task not found" }, 404);
    }

    return jsonResponse(task);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
}

/**
 * DELETE /api/tasks/:id -- permanently removes a task.
 * @param id - Task UUID from the route parameter
 * @returns 200 on success, 404 when the task does not exist
 */
export function handleDeleteTask(id: string): Response {
  const deleted = deleteTask(id);
  if (!deleted) {
    return jsonResponse({ error: "Task not found" }, 404);
  }

  return jsonResponse({ ok: true });
}
