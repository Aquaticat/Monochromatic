/**
 * Extended tool input shapes for session management, task management, cron, skill, and search tools.
 *
 * Separated from `tool-inputs.ts` to keep each file under the max-lines limit.
 * Question types live in `tool-inputs-questions.ts` and notebook/LSP types
 * live in `tool-inputs-notebook-lsp.ts`.
 *
 * @module
 */

//region Session tools

/**
 * Input shape for the `EnterWorktree` tool.
 */
export type EnterWorktreeToolInput = {
  /**
   * Optional name for the worktree.
   */
  name?: string;
};

/**
 * Input shape for the `ExitPlanMode` tool.
 */
export type ExitPlanModeToolInput = {
  /**
   * Prompt-based permissions needed to implement the plan.
   */
  allowedPrompts?: {
    /**
     * Tool this permission applies to.
     */
    tool: 'Bash';

    /**
     * Semantic description of the action.
     */
    prompt: string;
  }[];
};

//endregion

//region Task tools

/**
 * Input shape for the `TaskCreate` tool.
 */
export type TaskCreateToolInput = {
  /**
   * Brief title for the task.
   */
  subject: string;

  /**
   * Detailed description of what needs to be done.
   */
  description: string;

  /**
   * Present continuous form shown in spinner when in progress.
   */
  activeForm?: string;

  /**
   * Arbitrary metadata to attach to the task.
   */
  metadata?: Record<string, unknown>;
};

/**
 * Input shape for the `TaskGet` tool.
 */
export type TaskGetToolInput = {
  /**
   * ID of the task to retrieve.
   */
  taskId: string;
};

/**
 * Input shape for the `TaskOutput` tool.
 */
export type TaskOutputToolInput = {
  /**
   * ID of the task to get output from.
   */
  task_id: string;

  /**
   * Whether to wait for completion.
   */
  block: boolean;

  /**
   * Max wait time in milliseconds.
   */
  timeout: number;
};

/**
 * Input shape for the `TaskStop` tool.
 */
export type TaskStopToolInput = {
  /**
   * ID of the background task to stop.
   */
  task_id?: string;
};

/**
 * Valid task status values for {@link TaskUpdateToolInput}.
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';

/**
 * Input shape for the `TaskUpdate` tool.
 */
export type TaskUpdateToolInput = {
  /**
   * ID of the task to update.
   */
  taskId: string;

  /**
   * New status for the task.
   */
  status?: TaskStatus;

  /**
   * New subject for the task.
   */
  subject?: string;

  /**
   * New description for the task.
   */
  description?: string;

  /**
   * Present continuous form shown in spinner when in progress.
   */
  activeForm?: string;

  /**
   * New owner for the task.
   */
  owner?: string;

  /**
   * Metadata keys to merge into the task.
   */
  metadata?: Record<string, unknown>;

  /**
   * Task IDs that this task blocks.
   */
  addBlocks?: string[];

  /**
   * Task IDs that block this task.
   */
  addBlockedBy?: string[];
};

//endregion

//region Cron tools

/**
 * Input shape for the `CronCreate` tool.
 */
export type CronCreateToolInput = {
  /**
   * Standard 5-field cron expression in local time.
   */
  cron: string;

  /**
   * Prompt to enqueue at each fire time.
   */
  prompt: string;

  /**
   * Whether the job recurs or fires once then auto-deletes.
   */
  recurring?: boolean;
};

/**
 * Input shape for the `CronDelete` tool.
 */
export type CronDeleteToolInput = {
  /**
   * Job ID returned by CronCreate.
   */
  id: string;
};

//endregion

//region Skill and search tools

/**
 * Input shape for the `Skill` tool.
 */
export type SkillToolInput = {
  /**
   * Skill name to invoke.
   */
  skill: string;

  /**
   * Optional arguments for the skill.
   */
  args?: string;
};

/**
 * Input shape for the `ToolSearch` tool.
 */
export type ToolSearchToolInput = {
  /**
   * Query to find deferred tools, or `"select:<tool_name>"` for direct selection.
   */
  query: string;

  /**
   * Maximum number of results to return.
   */
  max_results?: number;
};

//endregion
