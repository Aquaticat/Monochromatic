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
 */
import type { TaskPriority } from "../../lib/types.ts";
import { createTask, deleteTask, updateTask } from "../../lib/db/tasks.ts";
import { HTTP_BAD_REQUEST, HTTP_CREATED, HTTP_INTERNAL_ERROR, HTTP_NOT_FOUND, jsonResponse } from "./http-utils.ts";
import { isRecord, parseEnumValue, parseStringArray, parseTaskUpdateInput } from "./task-validation.ts";

/** Recognized priority/complexity values for create handler. */
const priorities = new Set<string>(["low", "medium", "high"]);

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
    if (!isRecord(body)) return jsonResponse({ error: "Invalid request body" }, HTTP_BAD_REQUEST);

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length === 0) return jsonResponse({ error: "Task title is required" }, HTTP_BAD_REQUEST);

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
    if (taskUpdateInput === null) return jsonResponse({ error: "Invalid update payload" }, HTTP_BAD_REQUEST);

    const task = await updateTask(id, taskUpdateInput);
    if (task === null) return jsonResponse({ error: "Task not found" }, HTTP_NOT_FOUND);
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
  if (!deleted) return jsonResponse({ error: "Task not found" }, HTTP_NOT_FOUND);
  return jsonResponse({ ok: true });
}
