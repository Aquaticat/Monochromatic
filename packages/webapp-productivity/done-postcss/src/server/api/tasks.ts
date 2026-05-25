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
import {
  createTask,
  deleteTask,
  updateTask,
} from '../../lib/db/tasks.ts';
import type { TaskPriority, } from '../../lib/types.ts';
import {
  HTTP_BAD_REQUEST,
  HTTP_CREATED,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
  jsonResponse,
} from './http-utils.ts';
import { parseTaskUpdateInput, } from './task-validation-update.ts';
import {
  isRecord,
  parseEnumValue,
  parseStringArray,
} from './task-validation.ts';

/** Recognized priority/complexity values for create handler. */
const priorities = new Set<string>([
  'low',
  'medium',
  'high',
],);

/**
 * POST /api/tasks; creates a new task from the request body.
 *
 * @param req - Incoming request with JSON body
 *
 * @returns 201 with the created task, or 400/500 on validation/server error
 *
 * @example
 * ```ts
 * const response = await handleCreateTask(event.req);
 * ```
 */
export async function handleCreateTask(req: Request,): Promise<Response> {
  try {
    /** Parsed JSON body retained as `unknown` until `isRecord` narrows it below. */
    const body: unknown = await req.json();
    if (!isRecord(body,)) {
      return jsonResponse({
        payload: { error: 'Invalid request body', },
        status: HTTP_BAD_REQUEST,
      },);
    }

    /** Trimmed title; empty trim short-circuits with a 400 response. */
    const title = ((typeof body.title) === 'string') ? body.title
      .trim() : '';
    if (title.length
      === 0) {
      return jsonResponse({
        payload: { error: 'Task title is required', },
        status: HTTP_BAD_REQUEST,
      },);
    }

    /** Persisted task returned to the caller as the 201 body. */
    const task = await createTask({
      title,
      description: ((typeof body.description) === 'string') ? body.description : null,
      tags: parseStringArray(body.tags,)
        ?? [],
      locations: parseStringArray(body.locations,)
        ?? [],
      priority: parseEnumValue<TaskPriority>({
        value: body.priority,
        validValues: priorities,
      },)
        ?? null,
      complexity: parseEnumValue<TaskPriority>({
        value: body.complexity,
        validValues: priorities,
      },)
        ?? null,
    },);
    return jsonResponse({
      payload: task,
      status: HTTP_CREATED,
    },);
  }
  catch (error) {
    return jsonResponse({
      payload: { error: String(error,), },
      status: HTTP_INTERNAL_SERVER_ERROR,
    },);
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
 * const response = await handleUpdateTask({ req: event.req, id: 'uuid-123' });
 * ```
 */
export async function handleUpdateTask(
  {
    req,
    id,
  }: {
    req: Request;
    id: string;
  },
): Promise<Response> {
  try {
    /** Parsed JSON body retained as `unknown` until the update parser narrows the shape. */
    const body: unknown = await req.json();
    /** Validated update payload; `null` triggers a 400 response. */
    const taskUpdateInput = parseTaskUpdateInput(body,);
    if (taskUpdateInput === null) {
      return jsonResponse({
        payload: { error: 'Invalid update payload', },
        status: HTTP_BAD_REQUEST,
      },);
    }

    /** Updated task; `null` triggers a 404 when the row was removed concurrently. */
    const task = await updateTask({
      id,
      input: taskUpdateInput,
    },);
    if (task === null) {
      return jsonResponse({
        payload: { error: 'Task not found', },
        status: HTTP_NOT_FOUND,
      },);
    }
    return jsonResponse({ payload: task, },);
  }
  catch (error) {
    return jsonResponse({
      payload: { error: String(error,), },
      status: HTTP_INTERNAL_SERVER_ERROR,
    },);
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
 * const response = await handleDeleteTask('uuid-123');
 * ```
 */
export async function handleDeleteTask(id: string,): Promise<Response> {
  /** Whether the delete affected a row; `false` triggers a 404 response. */
  const deleted = await deleteTask(id,);
  if (!deleted) {
    return jsonResponse({
      payload: { error: 'Task not found', },
      status: HTTP_NOT_FOUND,
    },);
  }
  return jsonResponse({ payload: { ok: true, }, },);
}
