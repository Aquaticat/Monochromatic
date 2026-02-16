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
 */
import { createTask, deleteTask, updateTask } from "../../lib/db/tasks.ts";
import { TASK_PRIORITIES, TASK_STATUSES } from "../../lib/types.ts";
import type { TaskPriority, TaskStatus, TaskUpdateInput } from "../../lib/types.ts";

const priorities = new Set<string>(TASK_PRIORITIES);
const statuses = new Set<string>(TASK_STATUSES);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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

function parsePriority(value: unknown): TaskPriority | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  return priorities.has(value as TaskPriority) ? (value as TaskPriority) : undefined;
}

function parseStatus(value: unknown): TaskStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  return statuses.has(value as TaskStatus) ? (value as TaskStatus) : undefined;
}

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
    const priority = parsePriority(value.priority);
    if (priority === undefined) {
      return null;
    }
    taskUpdateInput.priority = priority;
  }

  if ("complexity" in value) {
    const complexity = parsePriority(value.complexity);
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
      priority: parsePriority(body.priority) ?? null,
      complexity: parsePriority(body.complexity) ?? null,
    });
    return jsonResponse(task, 201);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
}

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

export function handleDeleteTask(id: string): Response {
  const deleted = deleteTask(id);
  if (!deleted) {
    return jsonResponse({ error: "Task not found" }, 404);
  }

  return jsonResponse({ ok: true });
}
