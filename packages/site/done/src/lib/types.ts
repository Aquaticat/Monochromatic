/** All recognized priority levels, ordered ascending. */
export const TASK_PRIORITIES = ["low", "medium", "high"] as const satisfies readonly string[];

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** All recognized complexity levels, ordered ascending. */
export const TASK_COMPLEXITIES = ["low", "medium", "high"] as const satisfies readonly string[];

export type TaskComplexity = (typeof TASK_COMPLEXITIES)[number];

/** All recognized task statuses. */
export const TASK_STATUSES = ["inbox", "in_progress", "done"] as const satisfies readonly string[];

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskSource = "local" | "github" | "linear" | "calendar" | "codebase";

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
  trackedTime: number;
  timerStartedAt: string | null;
  status: TaskStatus;
  source: TaskSource;
  sourceId: string | null;
  sourceMeta: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BlockedTaskLink = {
  blockerId: string;
  task: Task;
};

export type SearchTask = Task & {
  isBlocked: boolean;
};

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
