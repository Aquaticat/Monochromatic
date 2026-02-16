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

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  tags: string;
  locations: string;
  priority: TaskPriority | null;
  due_date: string | null;
  complexity: TaskComplexity | null;
  reminders: string;
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

export type BlockerSummary = {
  blockerId: string;
  blockerTitle: string;
};

export type CompleteTaskResult = {
  completed: boolean;
  notFound: boolean;
  blockedBy: BlockerSummary[];
};

function nowIso(): string {
  return new Date().toISOString();
}

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

function normalizeStringArray(values: readonly string[] | undefined): string[] {
  if (values === undefined) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

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

function getTaskRowById(id: string): TaskRow | null {
  const taskRow = db.query(SQL_SELECT_TASK_BY_ID).get(id) as TaskRow | null;
  return taskRow;
}

export function getTaskById(id: string): Task | null {
  const taskRow = getTaskRowById(id);
  return taskRow === null ? null : mapTask(taskRow);
}

export function listInboxUnblockedTasks(): Task[] {
  const rows = db.query(SQL_SELECT_INBOX_UNBLOCKED).all() as TaskRow[];

  return rows.map(mapTask);
}

export function listBlockedInboxTasks(): BlockedTaskLink[] {
  const rows = db.query(SQL_SELECT_BLOCKED_INBOX).all() as (TaskRow & { blocker_id: string })[];

  return rows.map((row) => ({ blockerId: row.blocker_id, task: mapTask(row) }));
}

export function listInProgressTasks(): Task[] {
  const rows = db.query(SQL_SELECT_IN_PROGRESS).all() as TaskRow[];

  return rows.map(mapTask);
}

export function listTasksForBlockerPicker(taskId: string): Task[] {
  const rows = db.query(SQL_SELECT_FOR_BLOCKER_PICKER).all(taskId) as TaskRow[];

  return rows.map(mapTask);
}

export function listAllTags(): string[] {
  const rows = db.query(SQL_SELECT_ALL_TAGS).all() as { tag: string }[];

  return rows.map((row) => row.tag);
}

export function searchTasks(searchQuery: string): SearchTask[] {
  const normalizedSearchQuery = searchQuery.trim();
  if (normalizedSearchQuery.length === 0) {
    return [];
  }

  try {
    const rows = db.query(SQL_SEARCH_FTS).all(normalizedSearchQuery) as (TaskRow & { is_blocked: number })[];
    return rows.map((row) => ({ ...mapTask(row), isBlocked: row.is_blocked === 1 }));
  } catch {
    const rows = db
      .query(SQL_SEARCH_LIKE)
      .all(`%${normalizedSearchQuery}%`, `%${normalizedSearchQuery}%`) as (TaskRow & {
      is_blocked: number;
    })[];
    return rows.map((row) => ({ ...mapTask(row), isBlocked: row.is_blocked === 1 }));
  }
}

export function createTask(input: TaskCreateInput): Task {
  const id = crypto.randomUUID();
  const timestamp = nowIso();

  db.query(SQL_INSERT_TASK).run(
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

  const createdTask = getTaskById(id);
  if (createdTask === null) {
    throw new Error("Failed to read created task");
  }

  return createdTask;
}

export function updateTask(id: string, input: TaskUpdateInput): Task | null {
  const currentTask = getTaskById(id);
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

  db.query(SQL_UPDATE_TASK).run(
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

export function deleteTask(id: string): boolean {
  const result = db.query(SQL_DELETE_TASK).run(id);
  return result.changes > 0;
}

export function startTaskTimer(id: string): Task | null {
  const timestamp = nowIso();
  db.query(SQL_START_TIMER).run(
    timestamp,
    timestamp,
    id
  );
  return getTaskById(id);
}

export function stopTaskTimer(id: string): Task | null {
  const currentTask = getTaskById(id);
  if (currentTask === null) {
    return null;
  }

  const elapsedSeconds =
    currentTask.timerStartedAt === null
      ? 0
      : Math.max(0, Math.floor((Date.now() - Date.parse(currentTask.timerStartedAt)) / 1000));
  const updatedTrackedTime = currentTask.trackedTime + elapsedSeconds;
  const timestamp = nowIso();

  db.query(SQL_STOP_TIMER).run(updatedTrackedTime, timestamp, id);

  return getTaskById(id);
}

export function completeTask(id: string): CompleteTaskResult {
  const currentTask = getTaskById(id);
  if (currentTask === null) {
    return { completed: false, notFound: true, blockedBy: [] };
  }

  const blockingRows = db
    .query(SQL_SELECT_BLOCKERS)
    .all(id) as { blocker_id: string; blocker_title: string }[];

  const blockedBy = blockingRows.map((row) => ({ blockerId: row.blocker_id, blockerTitle: row.blocker_title }));
  if (blockedBy.length > 0) {
    return { completed: false, notFound: false, blockedBy };
  }

  if (currentTask.timerStartedAt !== null) {
    stopTaskTimer(id);
  }

  db.query(SQL_DELETE_TASK).run(id);
  return { completed: true, notFound: false, blockedBy: [] };
}
