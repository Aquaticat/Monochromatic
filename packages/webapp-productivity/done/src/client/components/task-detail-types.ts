/**
 * Types and constants for the `<task-detail>` web component.
 */
import type {
  Task,
  TaskComplexity,
  TaskPriority,
} from '../../lib/types.ts';

/** Blocker task summary displayed as a pill in the task detail view. */
export type BlockerSummary = {
  /** Blocker task ID. */
  id: string;
  /** Blocker task title. */
  title: string;
  /** Blocker task status. */
  status: string;
};

/** Shape of the JSON response from the `/api/ai/autofill` endpoint. */
export type AutofillResult = {
  /** AI-suggested tags. */
  tags: string[];
  /** AI-suggested locations. */
  locations: string[];
  /** AI-suggested priority. */
  priority: TaskPriority | null;
  /** AI-suggested complexity. */
  complexity: TaskComplexity | null;
};

/** Determines whether the component renders as a new-task creator or an editor. */
export type TaskDetailMode = 'create' | 'edit';

/** Mutable metadata state managed by the `<task-detail>` component. */
export type MetadataState = {
  /** Current tags (user-set or autofilled). */
  tags: string[];
  /** Current locations (user-set or autofilled). */
  locations: string[];
  /** Current priority (user-set or autofilled). */
  priority: TaskPriority | null;
  /** Current complexity (user-set or autofilled). */
  complexity: TaskComplexity | null;
};

/** Configuration payload passed to `TaskDetail.configure()`. */
export type TaskDetailData = {
  /** Task being displayed or edited. */
  task: Task;
  /** Summaries of tasks that block this one. */
  blockerSummaries: BlockerSummary[];
  /** Component mode: `"create"` for new tasks, `"edit"` (default) for existing. */
  mode?: TaskDetailMode;
};

/** Delay before triggering AI autofill after the user stops typing. */
export const AUTOFILL_DEBOUNCE_MS = 500;
