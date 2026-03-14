/**
 * Extended tool input shapes for session management, task management, and cron tools.
 *
 * Separated from `tool-inputs.ts` to keep each file under the max-lines limit.
 *
 * @module
 */

//region Question tools

/**
 * Single question within an {@link AskUserQuestionToolInput}.
 */
type AskUserQuestionOption = {
  /** Display text for this option. */
  label: string;

  /** Explanation of what this option means. */
  description: string;

  /** Optional preview content rendered when focused. */
  preview?: string;
};

/**
 * Single question within an {@link AskUserQuestionToolInput}.
 */
type AskUserQuestionEntry = {
  /** Question text to display to the user. */
  question: string;

  /** Short label displayed as a chip/tag (max 12 chars). */
  header: string;

  /** Available choices (2-4 options). */
  options: AskUserQuestionOption[];

  /** Whether multiple options can be selected. */
  multiSelect: boolean;
};

/**
 * Input shape for the `AskUserQuestion` tool.
 */
type AskUserQuestionToolInput = {
  /** Questions to present to the user (1-4). */
  questions: AskUserQuestionEntry[];
};

//endregion

//region Notebook and LSP tools

/**
 * Input shape for the `NotebookEdit` tool.
 */
type NotebookEditToolInput = {
  /** Absolute path to the Jupyter notebook file. */
  notebook_path: string;

  /** New source content for the cell. */
  new_source: string;

  /** ID of the cell to edit. */
  cell_id?: string;

  /** Cell type. */
  cell_type?: 'code' | 'markdown';

  /** Edit operation type. */
  edit_mode?: 'replace' | 'insert' | 'delete';
};

/**
 * LSP operation names supported by the `LSP` tool.
 */
type LspOperation =
  | 'goToDefinition'
  | 'findReferences'
  | 'hover'
  | 'documentSymbol'
  | 'workspaceSymbol'
  | 'goToImplementation'
  | 'prepareCallHierarchy'
  | 'incomingCalls'
  | 'outgoingCalls';

/**
 * Input shape for the `LSP` tool.
 */
type LspToolInput = {
  /** LSP operation to perform. */
  operation: LspOperation;

  /** Absolute or relative path to the file. */
  filePath: string;

  /** Line number (1-based). */
  line: number;

  /** Character offset (1-based). */
  character: number;
};

//endregion

//region Session tools

/**
 * Input shape for the `EnterWorktree` tool.
 */
type EnterWorktreeToolInput = {
  /** Optional name for the worktree. */
  name?: string;
};

/**
 * Input shape for the `ExitPlanMode` tool.
 */
type ExitPlanModeToolInput = {
  /** Prompt-based permissions needed to implement the plan. */
  allowedPrompts?: {
    /** Tool this permission applies to. */
    tool: 'Bash';

    /** Semantic description of the action. */
    prompt: string;
  }[];
};

//endregion

//region Task tools

/**
 * Input shape for the `TaskCreate` tool.
 */
type TaskCreateToolInput = {
  /** Brief title for the task. */
  subject: string;

  /** Detailed description of what needs to be done. */
  description: string;

  /** Present continuous form shown in spinner when in progress. */
  activeForm?: string;

  /** Arbitrary metadata to attach to the task. */
  metadata?: Record<string, unknown>;
};

/**
 * Input shape for the `TaskGet` tool.
 */
type TaskGetToolInput = {
  /** ID of the task to retrieve. */
  taskId: string;
};

/**
 * Input shape for the `TaskOutput` tool.
 */
type TaskOutputToolInput = {
  /** ID of the task to get output from. */
  task_id: string;

  /** Whether to wait for completion. */
  block: boolean;

  /** Max wait time in milliseconds. */
  timeout: number;
};

/**
 * Input shape for the `TaskStop` tool.
 */
type TaskStopToolInput = {
  /** ID of the background task to stop. */
  task_id?: string;
};

/**
 * Valid task status values for {@link TaskUpdateToolInput}.
 */
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';

/**
 * Input shape for the `TaskUpdate` tool.
 */
type TaskUpdateToolInput = {
  /** ID of the task to update. */
  taskId: string;

  /** New status for the task. */
  status?: TaskStatus;

  /** New subject for the task. */
  subject?: string;

  /** New description for the task. */
  description?: string;

  /** Present continuous form shown in spinner when in progress. */
  activeForm?: string;

  /** New owner for the task. */
  owner?: string;

  /** Metadata keys to merge into the task. */
  metadata?: Record<string, unknown>;

  /** Task IDs that this task blocks. */
  addBlocks?: string[];

  /** Task IDs that block this task. */
  addBlockedBy?: string[];
};

//endregion

//region Cron tools

/**
 * Input shape for the `CronCreate` tool.
 */
type CronCreateToolInput = {
  /** Standard 5-field cron expression in local time. */
  cron: string;

  /** Prompt to enqueue at each fire time. */
  prompt: string;

  /** Whether the job recurs or fires once then auto-deletes. */
  recurring?: boolean;
};

/**
 * Input shape for the `CronDelete` tool.
 */
type CronDeleteToolInput = {
  /** Job ID returned by CronCreate. */
  id: string;
};

//endregion

//region Skill and search tools

/**
 * Input shape for the `Skill` tool.
 */
type SkillToolInput = {
  /** Skill name to invoke. */
  skill: string;

  /** Optional arguments for the skill. */
  args?: string;
};

/**
 * Input shape for the `ToolSearch` tool.
 */
type ToolSearchToolInput = {
  /** Query to find deferred tools, or `"select:<tool_name>"` for direct selection. */
  query: string;

  /** Maximum number of results to return. */
  max_results?: number;
};

//endregion

export type {
  AskUserQuestionEntry,
  AskUserQuestionOption,
  AskUserQuestionToolInput,
  CronCreateToolInput,
  CronDeleteToolInput,
  EnterWorktreeToolInput,
  ExitPlanModeToolInput,
  LspOperation,
  LspToolInput,
  NotebookEditToolInput,
  SkillToolInput,
  TaskCreateToolInput,
  TaskGetToolInput,
  TaskOutputToolInput,
  TaskStatus,
  TaskStopToolInput,
  TaskUpdateToolInput,
  ToolSearchToolInput,
};
