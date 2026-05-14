/**
 * REST API handlers for timer and task completion.
 *
 * Mounted by server.ts as route handlers:
 *   POST /api/tasks/:id/start    -\> handleStartTimer
 *   POST /api/tasks/:id/stop     -\> handleStopTimer
 *   POST /api/tasks/:id/complete -\> handleCompleteTask
 */
import {
  HTTP_CONFLICT,
  HTTP_NOT_FOUND,
  HTTP_OK,
} from '@monochromatic-dev/module-numeric-const';

import {
  completeTask,
  startTaskTimer,
  stopTaskTimer,
} from '../../lib/db/tasks.ts';

/**
 * Wraps a payload in a JSON `Response` with the correct content type.
 *
 * @param payload - Serializable value
 *
 * @param status - HTTP status code (defaults to 200)
 *
 * @returns JSON response
 *
 * @example
 * ```ts
 * return jsonResponse({ payload: { ok: true, }, });
 * return jsonResponse({ payload: { error: 'not found', }, status: HTTP_NOT_FOUND, });
 * ```
 */
function jsonResponse({
  payload,
  status = HTTP_OK,
}: {
  payload: unknown;
  status?: number;
},): Response {
  return Response.json(
    payload,
    { status, },
  );
}

/**
 * POST /api/tasks/:id/start; starts the task timer.
 *
 * @param id - Task UUID from the route parameter
 *
 * @returns 200 with updated task, or 404 when not found
 *
 * @example
 * ```ts
 * const response = await handleStartTimer('abc-123');
 * ```
 */
export async function handleStartTimer(id: string,): Promise<Response> {
  /** Updated row; null distinguishes not-found from a successful start. */
  const task = await startTaskTimer(id,);
  if (task === null) {
    return jsonResponse({
      payload: { error: 'Task not found', },
      status: HTTP_NOT_FOUND,
    },);
  }

  return jsonResponse({ payload: task, },);
}

/**
 * POST /api/tasks/:id/stop; stops the running timer and accumulates tracked time.
 *
 * @param id - Task UUID from the route parameter
 *
 * @returns 200 with updated task, or 404 when not found
 *
 * @example
 * ```ts
 * const response = await handleStopTimer('abc-123');
 * ```
 */
export async function handleStopTimer(id: string,): Promise<Response> {
  /** Updated row; null distinguishes not-found from a successful stop. */
  const task = await stopTaskTimer(id,);
  if (task === null) {
    return jsonResponse({
      payload: { error: 'Task not found', },
      status: HTTP_NOT_FOUND,
    },);
  }

  return jsonResponse({ payload: task, },);
}

/**
 * POST /api/tasks/:id/complete; completes the task if all blockers are resolved.
 *
 * @param id - Task UUID from the route parameter
 *
 * @returns 200 on success, 404 when missing, 409 when blocked
 *
 * @example
 * ```ts
 * const response = await handleCompleteTask('abc-123');
 * ```
 */
export async function handleCompleteTask(id: string,): Promise<Response> {
  /** Discriminated outcome distinguishing completion, missing row, and blocker errors. */
  const result = await completeTask(id,);
  if (result.notFound) {
    return jsonResponse({
      payload: { error: 'Task not found', },
      status: HTTP_NOT_FOUND,
    },);
  }

  if (!result.completed) {
    return jsonResponse({
      payload: {
        error: 'Task is blocked',
        blockedBy: result.blockedBy,
      },
      status: HTTP_CONFLICT,
    },);
  }

  return jsonResponse({ payload: { ok: true, }, },);
}
