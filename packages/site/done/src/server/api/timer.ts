/**
 * REST API handlers for timer and task completion.
 *
 * Mounted by server.ts as route handlers:
 *   POST /api/tasks/:id/start    → handleStartTimer
 *   POST /api/tasks/:id/stop     → handleStopTimer
 *   POST /api/tasks/:id/complete → handleCompleteTask
 */
import { completeTask, startTaskTimer, stopTaskTimer } from "../../lib/db/tasks.ts";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function handleStartTimer(id: string): Response {
  const task = startTaskTimer(id);
  if (task === null) {
    return jsonResponse({ error: "Task not found" }, 404);
  }

  return jsonResponse(task);
}

export function handleStopTimer(id: string): Response {
  const task = stopTaskTimer(id);
  if (task === null) {
    return jsonResponse({ error: "Task not found" }, 404);
  }

  return jsonResponse(task);
}

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
