/** All recognized priority levels, ordered ascending. */
export const TASK_PRIORITIES = [
  'low',
  'medium',
  'high',
] as const satisfies readonly string[];

/** Discriminated union of valid priority values. */
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** All recognized complexity levels, ordered ascending. */
export const TASK_COMPLEXITIES = [
  'low',
  'medium',
  'high',
] as const satisfies readonly string[];

/** Discriminated union of valid complexity values. */
export type TaskComplexity = (typeof TASK_COMPLEXITIES)[number];

/** All recognized task statuses. */
export const TASK_STATUSES = [
  'inbox',
  'in_progress',
  'done',
] as const satisfies readonly string[];

/** Discriminated union of valid task lifecycle statuses. */
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** External system from which a task was imported, or `"local"` for manually created tasks. */
export type TaskSource = 'local' | 'github' | 'linear' | 'calendar' | 'codebase';

/** Canonical task shape shared between server (DB layer) and client (page data JSON). */
export type Task = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  locations: string[];
  priority: TaskPriority | null;
  dueDate: string | null;
  complexity: TaskComplexity | null;
  reminders: string[];
  blockedBy: string[];
  /** Accumulated tracked time in seconds (excludes any running timer). */
  trackedTime: number;
  /** ISO timestamp when the current timer was started, or `null` when idle. */
  timerStartedAt: string | null;
  status: TaskStatus;
  source: TaskSource;
  sourceId: string | null;
  sourceMeta: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Associates a blocked inbox task with the blocker task that gates it. */
export type BlockedTaskLink = {
  blockerId: string;
  task: Task;
};

/** Search result task with an additional `isBlocked` flag for UI badge display. */
export type SearchTask = Task & {
  isBlocked: boolean;
};

/** Payload accepted by `createTask()` -- only `title` is required; all others default. */
export type TaskCreateInput = {
  title: string;
  description?: string | null;
  tags?: string[];
  locations?: string[];
  priority?: TaskPriority | null;
  dueDate?: string | null;
  complexity?: TaskComplexity | null;
  reminders?: string[];
  blockedBy?: string[];
};

/** Partial update payload accepted by `updateTask()` -- omitted fields stay unchanged. */
export type TaskUpdateInput = {
  title?: string;
  description?: string | null;
  tags?: string[];
  locations?: string[];
  priority?: TaskPriority | null;
  dueDate?: string | null;
  complexity?: TaskComplexity | null;
  reminders?: string[];
  blockedBy?: string[];
  status?: TaskStatus;
};
