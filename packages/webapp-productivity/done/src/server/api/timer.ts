/**
 * REST API handlers for timer and task completion.
 *
 * Mounted by server.ts as route handlers:
 *   POST /api/tasks/:id/start    -\> handleStartTimer
 *   POST /api/tasks/:id/stop     -\> handleStopTimer
 *   POST /api/tasks/:id/complete -\> handleCompleteTask
 */
import { completeTask, startTaskTimer, stopTaskTimer } from "../../lib/db/tasks.ts";

/** HTTP status code for successful responses. */
const HTTP_OK = 200;

/** HTTP status code for not found. */
const HTTP_NOT_FOUND = 404;

/** HTTP status code for conflict (blocked task). */
const HTTP_CONFLICT = 409;

/**
 * Wraps a payload in a JSON `Response` with the correct content type.
 *
 * @param payload - Serializable value
 *
 * @param status - HTTP status code (defaults to 200)
 *
 * @returns JSON response
 */
function jsonResponse(payload: unknown, status: number = HTTP_OK): Response {
  return Response.json(payload, { status });
}

/**
 * POST /api/tasks/:id/start -- starts the task timer.
 *
 * @param id - Task UUID from the route parameter
 *
 * @returns 200 with updated task, or 404 when not found
 */
export async function handleStartTimer(id: string): Promise<Response> {
  const task = await startTaskTimer(id);
  if (task === null) {
    return jsonResponse({ error: "Task not found" }, HTTP_NOT_FOUND);
  }

  return jsonResponse(task);
}

/**
 * POST /api/tasks/:id/stop -- stops the running timer and accumulates tracked time.
 *
 * @param id - Task UUID from the route parameter
 *
 * @returns 200 with updated task, or 404 when not found
 */
export async function handleStopTimer(id: string): Promise<Response> {
  const task = await stopTaskTimer(id);
  if (task === null) {
    return jsonResponse({ error: "Task not found" }, HTTP_NOT_FOUND);
  }

  return jsonResponse(task);
}

/**
 * POST /api/tasks/:id/complete -- completes the task if all blockers are resolved.
 *
 * @param id - Task UUID from the route parameter
 *
 * @returns 200 on success, 404 when missing, 409 when blocked
 */
export async function handleCompleteTask(id: string): Promise<Response> {
  const result = await completeTask(id);
  if (result.notFound) {
    return jsonResponse({ error: "Task not found" }, HTTP_NOT_FOUND);
  }

  if (!result.completed) {
    return jsonResponse(
      {
        error: "Task is blocked",
        blockedBy: result.blockedBy,
      },
      HTTP_CONFLICT
    );
  }

  return jsonResponse({ ok: true });
}
