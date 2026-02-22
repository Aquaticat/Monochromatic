/**
 * REST API handlers for timer and task completion.
 *
 * Mounted by server.ts as route handlers:
 *   POST /api/tasks/:id/start    → handleStartTimer
 *   POST /api/tasks/:id/stop     → handleStopTimer
 *   POST /api/tasks/:id/complete → handleCompleteTask
 */
import { completeTask, startTaskTimer, stopTaskTimer } from "../../lib/db/tasks.ts";

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

/**
 * POST /api/tasks/:id/start -- starts the task timer.
 * @param id - Task UUID from the route parameter
 */
export function handleStartTimer(id: string): Response {
  const task = startTaskTimer(id);
  if (task === null) {
    return jsonResponse({ error: "Task not found" }, 404);
  }

  return jsonResponse(task);
}

/**
 * POST /api/tasks/:id/stop -- stops the running timer and accumulates tracked time.
 * @param id - Task UUID from the route parameter
 */
export function handleStopTimer(id: string): Response {
  const task = stopTaskTimer(id);
  if (task === null) {
    return jsonResponse({ error: "Task not found" }, 404);
  }

  return jsonResponse(task);
}

/**
 * POST /api/tasks/:id/complete -- completes the task if all blockers are resolved.
 * @param id - Task UUID from the route parameter
 * @returns 200 on success, 404 when missing, 409 when blocked
 */
export function handleCompleteTask(id: string): Response {
  const result = completeTask(id);
  if (result.notFound) {
    return jsonResponse({ error: "Task not found" }, 404);
  }

  if (!result.completed) {
    return jsonResponse(
      {
        error: "Task is blocked",
        blockedBy: result.blockedBy,
      },
      409
    );
  }

  return jsonResponse({ ok: true });
}
