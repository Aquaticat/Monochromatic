/**
 * Task CRUD operations and query functions against the SQLite database.
 *
 * Exceeds 100 lines: SQL constants, row-mapping, and CRUD functions form a
 * single data-access layer -- splitting SQL from the functions that use them
 * would scatter a tightly-coupled concern across files, and each function
 * shares the `db` import, `TaskRow` type, and `mapTask`/`parseStringArray`
 * helpers, making extraction costly for little benefit.
 */
import db from "../db.ts";
import type {
  BlockedTaskLink,
  SearchTask,
  Task,
  TaskComplexity,
  TaskCreateInput,
  TaskPriority,
  TaskStatus,
  TaskUpdateInput,
} from "../types.ts";

/** Raw SQLite row shape before mapping to the application-level `Task` type. */
type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  /** JSON-encoded string array (`'["tag1","tag2"]'`). */
  tags: string;
  /** JSON-encoded string array. */
  locations: string;
  priority: TaskPriority | null;
  due_date: string | null;
  complexity: TaskComplexity | null;
  /** JSON-encoded string array. */
  reminders: string;
  /** JSON-encoded string array of blocker task IDs. */
  blocked_by: string;
  tracked_time: number;
  timer_started_at: string | null;
  status: TaskStatus;
  source: Task["source"];
  source_id: string | null;
  source_meta: string | null;
  created_at: string;
  updated_at: string;
};

//region SQL queries -- extracted for readability; each constant is used by exactly one function

const SQL_SELECT_TASK_BY_ID = "SELECT * FROM tasks WHERE id = ?";

const SQL_SELECT_INBOX_UNBLOCKED =
  "SELECT * FROM tasks WHERE status = 'inbox' AND blocked_by = '[]' ORDER BY created_at DESC";

const SQL_SELECT_BLOCKED_INBOX = `
  SELECT tasks.*, blocker.value AS blocker_id
  FROM tasks, json_each(tasks.blocked_by) AS blocker
  WHERE tasks.status = 'inbox' AND tasks.blocked_by != '[]'
  ORDER BY tasks.created_at DESC`;

const SQL_SELECT_IN_PROGRESS =
  "SELECT * FROM tasks WHERE status = 'in_progress' ORDER BY updated_at DESC";

const SQL_SELECT_FOR_BLOCKER_PICKER =
  "SELECT * FROM tasks WHERE id != ? AND status != 'done' ORDER BY title ASC";

const SQL_SELECT_ALL_TAGS =
  "SELECT DISTINCT tag.value AS tag FROM tasks, json_each(tasks.tags) AS tag ORDER BY tag.value ASC";

const SQL_SEARCH_FTS = `
  SELECT tasks.*, CASE WHEN blocked_by != '[]' THEN 1 ELSE 0 END AS is_blocked
  FROM tasks_fts
  JOIN tasks ON tasks.rowid = tasks_fts.rowid
  WHERE tasks_fts MATCH ?
  ORDER BY rank`;

const SQL_SEARCH_LIKE = `
  SELECT tasks.*, CASE WHEN blocked_by != '[]' THEN 1 ELSE 0 END AS is_blocked
  FROM tasks
  WHERE tasks.title LIKE ? OR tasks.description LIKE ?
  ORDER BY tasks.updated_at DESC`;

const SQL_INSERT_TASK = `
  INSERT INTO tasks (
    id, title, description, tags, locations, priority, due_date,
    complexity, reminders, blocked_by, tracked_time, timer_started_at,
    status, source, source_id, source_meta, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const SQL_UPDATE_TASK = `
  UPDATE tasks
  SET title = ?, description = ?, tags = ?, locations = ?, priority = ?, due_date = ?,
      complexity = ?, reminders = ?, blocked_by = ?, status = ?, updated_at = ?
  WHERE id = ?`;

const SQL_DELETE_TASK = "DELETE FROM tasks WHERE id = ?";

const SQL_START_TIMER =
  "UPDATE tasks SET timer_started_at = ?, status = 'in_progress', updated_at = ? WHERE id = ?";

const SQL_STOP_TIMER =
  "UPDATE tasks SET tracked_time = ?, timer_started_at = NULL, status = 'inbox', updated_at = ? WHERE id = ?";

const SQL_SELECT_BLOCKERS = `
  SELECT blocker.value AS blocker_id, tasks.title AS blocker_title
  FROM json_each((SELECT blocked_by FROM tasks WHERE id = ?)) AS blocker
  JOIN tasks ON tasks.id = blocker.value
  WHERE tasks.status != 'done'`;

//endregion SQL queries

/** Summary of a single blocker task, used to report why completion was refused. */
export type BlockerSummary = {
  blockerId: string;
  blockerTitle: string;
};

/** Outcome of a `completeTask()` call -- carries blockers when completion is refused. */
export type CompleteTaskResult = {
  completed: boolean;
  notFound: boolean;
  blockedBy: BlockerSummary[];
};

/** Returns the current timestamp in ISO 8601 format for database writes. */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Safely parses a JSON string expected to contain a string array.
 * Returns an empty array on parse failure or unexpected shape.
 * @param value - Raw JSON text from a SQLite TEXT column
 */
function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

/**
 * Deduplicates, trims, and filters empty strings from an optional array.
 * Used to normalize user-supplied tag/location/blocker arrays before DB writes.
 * @param values - Raw string array, or `undefined` to produce an empty result
 */
function normalizeStringArray(values: readonly string[] | undefined): string[] {
  if (values === undefined) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

/**
 * Converts a raw SQLite `TaskRow` to the application-level `Task` shape.
 * Parses JSON-encoded array columns and renames snake_case to camelCase.
 */
function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: parseStringArray(row.tags),
    locations: parseStringArray(row.locations),
    priority: row.priority,
    dueDate: row.due_date,
    complexity: row.complexity,
    reminders: parseStringArray(row.reminders),
    blockedBy: parseStringArray(row.blocked_by),
    trackedTime: row.tracked_time,
    timerStartedAt: row.timer_started_at,
    status: row.status,
    source: row.source,
    sourceId: row.source_id,
    sourceMeta: row.source_meta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetches a single task row by primary key without mapping.
 * @param id - Task UUID
 */
async function getTaskRowById(id: string): Promise<TaskRow | null> {
  const taskRow = await db.prepare(SQL_SELECT_TASK_BY_ID).get(id) as TaskRow | undefined;
  return taskRow ?? null;
}

/**
 * Retrieves a single task by UUID, mapped to the application type.
 * @param id - Task UUID
 * @returns Mapped task, or `null` when the ID does not exist
 */
export async function getTaskById(id: string): Promise<Task | null> {
  const taskRow = await getTaskRowById(id);
  return taskRow === null ? null : mapTask(taskRow);
}

/** Lists inbox tasks that have no blockers, newest first. */
export async function listInboxUnblockedTasks(): Promise<Task[]> {
  const rows = await db.prepare(SQL_SELECT_INBOX_UNBLOCKED).all() as TaskRow[];

  return rows.map(mapTask);
}

/** Lists inbox tasks that are blocked, paired with each blocker ID for nesting. */
export async function listBlockedInboxTasks(): Promise<BlockedTaskLink[]> {
  const rows = await db.prepare(SQL_SELECT_BLOCKED_INBOX).all() as (TaskRow & { blocker_id: string })[];

  return rows.map((row) => ({ blockerId: row.blocker_id, task: mapTask(row) }));
}

/** Lists tasks with active timers (`status = 'in_progress'`), most recently updated first. */
export async function listInProgressTasks(): Promise<Task[]> {
  const rows = await db.prepare(SQL_SELECT_IN_PROGRESS).all() as TaskRow[];

  return rows.map(mapTask);
}

/**
 * Lists non-done tasks excluding the given task, for the blocker picker UI.
 * @param taskId - Task to exclude (the task being edited)
 */
export async function listTasksForBlockerPicker(taskId: string): Promise<Task[]> {
  const rows = await db.prepare(SQL_SELECT_FOR_BLOCKER_PICKER).all(taskId) as TaskRow[];

  return rows.map(mapTask);
}

/** Collects all unique tags across every task, sorted alphabetically. */
export async function listAllTags(): Promise<string[]> {
  const rows = await db.prepare(SQL_SELECT_ALL_TAGS).all() as { tag: string }[];

  return rows.map((row) => row.tag);
}

/**
 * Full-text searches tasks by title, description, and tags.
 * Falls back to LIKE matching when the FTS query syntax is invalid.
 * @param searchQuery - User-entered search string
 */
export async function searchTasks(searchQuery: string): Promise<SearchTask[]> {
  const normalizedSearchQuery = searchQuery.trim();
  if (normalizedSearchQuery.length === 0) {
    return [];
  }

  try {
    const rows = await db.prepare(SQL_SEARCH_FTS).all(normalizedSearchQuery) as (TaskRow & { is_blocked: number })[];
    return rows.map((row) => ({ ...mapTask(row), isBlocked: row.is_blocked === 1 }));
  } catch {
    const rows = await db
      .prepare(SQL_SEARCH_LIKE)
      .all(`%${normalizedSearchQuery}%`, `%${normalizedSearchQuery}%`) as (TaskRow & {
      is_blocked: number;
    })[];
    return rows.map((row) => ({ ...mapTask(row), isBlocked: row.is_blocked === 1 }));
  }
}

/**
 * Inserts a new task with a generated UUID and current timestamp.
 * @param input - Task creation payload (only `title` is required)
 * @returns Freshly created task read back from the database
 * @throws When the read-back fails (should never happen)
 */
export async function createTask(input: TaskCreateInput): Promise<Task> {
  const id = crypto.randomUUID();
  const timestamp = nowIso();

  await db.prepare(SQL_INSERT_TASK).run(
    id,
    input.title.trim(),
    input.description ?? null,
    JSON.stringify(normalizeStringArray(input.tags)),
    JSON.stringify(normalizeStringArray(input.locations)),
    input.priority ?? null,
    input.dueDate ?? null,
    input.complexity ?? null,
    JSON.stringify(normalizeStringArray(input.reminders)),
    JSON.stringify(normalizeStringArray(input.blockedBy)),
    0,
    null,
    "inbox",
    "local",
    null,
    null,
    timestamp,
    timestamp
  );

  const createdTask = await getTaskById(id);
  if (createdTask === null) {
    throw new Error("Failed to read created task");
  }

  return createdTask;
}

/**
 * Applies a partial update to an existing task.
 * @param id - Task UUID
 * @param input - Fields to update (omitted fields keep their current value)
 * @returns Updated task, or `null` when the ID does not exist
 */
export async function updateTask(id: string, input: TaskUpdateInput): Promise<Task | null> {
  const currentTask = await getTaskById(id);
  if (currentTask === null) {
    return null;
  }

  const updatedTask: Task = {
    ...currentTask,
    title: input.title?.trim() ?? currentTask.title,
    description: input.description ?? currentTask.description,
    tags: input.tags ?? currentTask.tags,
    locations: input.locations ?? currentTask.locations,
    priority: input.priority ?? currentTask.priority,
    dueDate: input.dueDate ?? currentTask.dueDate,
    complexity: input.complexity ?? currentTask.complexity,
    reminders: input.reminders ?? currentTask.reminders,
    blockedBy: input.blockedBy ?? currentTask.blockedBy,
    status: input.status ?? currentTask.status,
    updatedAt: nowIso(),
  };

  await db.prepare(SQL_UPDATE_TASK).run(
    updatedTask.title,
    updatedTask.description,
    JSON.stringify(normalizeStringArray(updatedTask.tags)),
    JSON.stringify(normalizeStringArray(updatedTask.locations)),
    updatedTask.priority,
    updatedTask.dueDate,
    updatedTask.complexity,
    JSON.stringify(normalizeStringArray(updatedTask.reminders)),
    JSON.stringify(normalizeStringArray(updatedTask.blockedBy)),
    updatedTask.status,
    updatedTask.updatedAt,
    id
  );

  return getTaskById(id);
}

/**
 * Permanently removes a task by UUID.
 * @param id - Task UUID
 * @returns `true` when the task existed and was deleted
 */
export async function deleteTask(id: string): Promise<boolean> {
  const result = await db.prepare(SQL_DELETE_TASK).run(id);
  return result.changes > 0;
}

/**
 * Starts the timer on a task, transitioning its status to `in_progress`.
 * @param id - Task UUID
 * @returns Updated task, or `null` when the ID does not exist
 */
export async function startTaskTimer(id: string): Promise<Task | null> {
  const timestamp = nowIso();
  await db.prepare(SQL_START_TIMER).run(
    timestamp,
    timestamp,
    id
  );
  return getTaskById(id);
}

/**
 * Stops the running timer, accumulates elapsed seconds into `trackedTime`,
 * and transitions the task back to `inbox` status.
 * @param id - Task UUID
 * @returns Updated task, or `null` when the ID does not exist
 */
export async function stopTaskTimer(id: string): Promise<Task | null> {
  const currentTask = await getTaskById(id);
  if (currentTask === null) {
    return null;
  }

  const elapsedSeconds =
    currentTask.timerStartedAt === null
      ? 0
      : Math.max(0, Math.floor((Date.now() - Date.parse(currentTask.timerStartedAt)) / 1000));
  const updatedTrackedTime = currentTask.trackedTime + elapsedSeconds;
  const timestamp = nowIso();

  await db.prepare(SQL_STOP_TIMER).run(updatedTrackedTime, timestamp, id);

  return getTaskById(id);
}

/**
 * Attempts to complete a task: stops any running timer, then deletes it.
 * Refuses completion when the task has unresolved blockers.
 * @param id - Task UUID
 */
export async function completeTask(id: string): Promise<CompleteTaskResult> {
  const currentTask = await getTaskById(id);
  if (currentTask === null) {
    return { completed: false, notFound: true, blockedBy: [] };
  }

  const blockingRows = await db
    .prepare(SQL_SELECT_BLOCKERS)
    .all(id) as { blocker_id: string; blocker_title: string }[];

  const blockedBy = blockingRows.map((row) => ({ blockerId: row.blocker_id, blockerTitle: row.blocker_title }));
  if (blockedBy.length > 0) {
    return { completed: false, notFound: false, blockedBy };
  }

  if (currentTask.timerStartedAt !== null) {
    await stopTaskTimer(id);
  }

  await db.prepare(SQL_DELETE_TASK).run(id);
  return { completed: true, notFound: false, blockedBy: [] };
}
