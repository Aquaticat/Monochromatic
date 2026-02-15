export type TaskPriority = "low" | "medium" | "high";

export type TaskComplexity = "low" | "medium" | "high";

export type TaskStatus = "inbox" | "in_progress" | "done";

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
