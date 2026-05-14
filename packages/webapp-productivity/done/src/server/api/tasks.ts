/**
 * REST API handlers for task CRUD operations.
 *
 * Mounted by server.ts as route handlers:
 *   POST   /api/tasks       -> handleCreateTask
 *   PUT    /api/tasks/:id   -> handleUpdateTask
 *   DELETE /api/tasks/:id   -> handleDeleteTask
 */
import {
  HTTP_BAD_REQUEST,
  HTTP_CREATED,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
  HTTP_OK,
} from '@monochromatic-dev/module-numeric-const';

import {
  createTask,
  deleteTask,
  updateTask,
} from '../../lib/db/tasks.ts';
import type { TaskPriority, } from '../../lib/types.ts';
import { parseTaskUpdateInput, } from './tasks-parse-update.ts';
import {
  getPriorities,
  isRecord,
  parseEnumValue,
  parseStringArray,
} from './tasks-parse.ts';

/**
 * Wraps a payload in a JSON `Response` with the correct content type.
 *
 * @param payload - Serializable value
 *
 * @param status - HTTP status code (defaults to 200)
 *
 * @returns JSON response with content-type header
 */
function jsonResponse(
  payload: unknown,
  status: number = HTTP_OK,
): Response {
  return Response.json(
    payload,
    { status, },
  );
}

/**
 * POST /api/tasks; creates a new task from the request body.
 *
 * @param req - Incoming request with JSON body
 *
 * @returns 201 with the created task, or 400/500 on validation/server error
 *
 * @example
 * ```ts
 * const response = await handleCreateTask(request);
 * ```
 */
export async function handleCreateTask(req: Request,): Promise<Response> {
  try {
    /** Loosely-typed body validated by `isRecord` before field-by-field access. */
    const body: unknown = await req.json();
    if (!isRecord(body,)) {
      return jsonResponse(
        { error: 'Invalid request body', },
        HTTP_BAD_REQUEST,
      );
    }

    /** Trimmed title; empty string short-circuits to the 400 branch below. */
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (title.length === 0) {
      return jsonResponse(
        { error: 'Task title is required', },
        HTTP_BAD_REQUEST,
      );
    }

    /** Allowed priority values reused for both `priority` and `complexity` parsing. */
    const priorities = getPriorities();
    /** Created row returned by the data layer; serialised below with 201. */
    const task = await createTask({
      title,
      description: typeof body.description === 'string' ? body.description : null,
      tags: parseStringArray(body.tags,) ?? [],
      locations: parseStringArray(body.locations,) ?? [],
      priority: parseEnumValue<TaskPriority>(
        body.priority,
        priorities,
      ) ?? null,
      complexity: parseEnumValue<TaskPriority>(
        body.complexity,
        priorities,
      ) ?? null,
    },);
    return jsonResponse(
      task,
      HTTP_CREATED,
    );
  }
  catch (error) {
    return jsonResponse(
      { error: String(error,), },
      HTTP_INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * PUT /api/tasks/:id; applies a partial update to an existing task.
 *
 * @param req - Incoming request with JSON body
 *
 * @param id - Task UUID from the route parameter
 *
 * @returns 200 with updated task, 400 on bad payload, 404 when missing
 *
 * @example
 * ```ts
 * const response = await handleUpdateTask(request, 'abc-123');
 * ```
 */
export async function handleUpdateTask(
  req: Request,
  id: string,
): Promise<Response> {
  try {
    /** Loosely-typed body validated by `parseTaskUpdateInput` below. */
    const body: unknown = await req.json();
    /** Normalised update payload; null indicates the body failed validation. */
    const taskUpdateInput = parseTaskUpdateInput(body,);
    if (taskUpdateInput === null) {
      return jsonResponse(
        { error: 'Invalid update payload', },
        HTTP_BAD_REQUEST,
      );
    }

    /** Result row; null indicates the row was not found, surfaced as 404 below. */
    const task = await updateTask(
      id,
      taskUpdateInput,
    );
    if (task === null) {
      return jsonResponse(
        { error: 'Task not found', },
        HTTP_NOT_FOUND,
      );
    }

    return jsonResponse(task,);
  }
  catch (error) {
    return jsonResponse(
      { error: String(error,), },
      HTTP_INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * DELETE /api/tasks/:id; permanently removes a task.
 *
 * @param id - Task UUID from the route parameter
 *
 * @returns 200 on success, 404 when the task does not exist
 *
 * @example
 * ```ts
 * const response = await handleDeleteTask('abc-123');
 * ```
 */
export async function handleDeleteTask(id: string,): Promise<Response> {
  /** Whether a row was actually removed; `false` is surfaced as 404 below. */
  const deleted = await deleteTask(id,);
  if (!deleted) {
    return jsonResponse(
      { error: 'Task not found', },
      HTTP_NOT_FOUND,
    );
  }

  return jsonResponse({ ok: true, },);
}
