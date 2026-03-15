/**
 * REST API handlers for task CRUD operations.
 *
 * Mounted by server.ts as route handlers:
 *   POST   /api/tasks       -> handleCreateTask
 *   PUT    /api/tasks/:id   -> handleUpdateTask
 *   DELETE /api/tasks/:id   -> handleDeleteTask
 */
import type { TaskPriority } from "../../lib/types.ts";
import { createTask, deleteTask, updateTask } from "../../lib/db/tasks.ts";
import { getPriorities, isRecord, parseEnumValue, parseStringArray } from "./tasks-parse.ts";
import { parseTaskUpdateInput } from "./tasks-parse-update.ts";

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

    const priorities = getPriorities();
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
