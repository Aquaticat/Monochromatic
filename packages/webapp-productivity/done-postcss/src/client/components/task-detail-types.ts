/**
 * Type definitions for the `\<task-detail\>` component.
 */
import type {
  Task,
  TaskComplexity,
  TaskPriority,
} from '../../lib/types.ts';

/** Blocker task summary displayed as a pill in the task detail view. */
export type BlockerSummary = {
  /** UUID of the blocking task. */
  id: string;
  /** Title of the blocking task. */
  title: string;
  /** Current status of the blocking task. */
  status: string;
};

/** Shape of the JSON response from the `/api/ai/autofill` endpoint. */
export type AutofillResult = {
  /** Suggested tags for the task. */
  tags: string[];
  /** Suggested locations for the task. */
  locations: string[];
  /** Suggested priority level. */
  priority: TaskPriority | null;
  /** Suggested complexity level. */
  complexity: TaskComplexity | null;
};

/** Determines whether the component renders as a new-task creator or an editor. */
export type TaskDetailMode = 'create' | 'edit';

/** Configuration payload passed to `TaskDetail.configure()`. */
export type TaskDetailData = {
  /** Task being viewed or edited. */
  task: Task;
  /** Summaries of tasks that block this one. */
  blockerSummaries: BlockerSummary[];
  /** Display mode: "create" for new tasks, "edit" for existing. */
  mode?: TaskDetailMode;
};
