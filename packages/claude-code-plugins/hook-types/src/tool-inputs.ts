/**
 * Tool-specific input shapes for PreToolUse, PostToolUse, PostToolUseFailure, and PermissionRequest events.
 *
 * Each type describes the `tool_input` object for a specific built-in tool.
 * MCP tool inputs are opaque `Record<string, unknown>` since they vary by server.
 *
 * @module
 */

//region Built-in tool inputs

/**
 * Input shape for the `Bash` tool.
 *
 * @example
 * ```ts
 * if (event.tool_name === 'Bash') {
 *   const { command } = event.tool_input as BashToolInput;
 * }
 * ```
 */
type BashToolInput = {
  /** Shell command to execute. */
  command: string;

  /** Description of what the command does. */
  description?: string;

  /** Timeout in milliseconds. */
  timeout?: number;

  /** Whether to run the command in the background. */
  run_in_background?: boolean;
};

/**
 * Input shape for the `Write` tool.
 */
type WriteToolInput = {
  /** Absolute path to the file to write. */
  file_path: string;

  /** Content to write to the file. */
  content: string;
};

/**
 * Input shape for the `Edit` tool.
 */
type EditToolInput = {
  /** Absolute path to the file to edit. */
  file_path: string;

  /** Text to find and replace. */
  old_string: string;

  /** Replacement text. */
  new_string: string;

  /** Whether to replace all occurrences. */
  replace_all?: boolean;
};

/**
 * Input shape for the `Read` tool.
 */
type ReadToolInput = {
  /** Absolute path to the file to read. */
  file_path: string;

  /** Line number to start reading from. */
  offset?: number;

  /** Number of lines to read. */
  limit?: number;
};

/**
 * Input shape for the `Glob` tool.
 */
type GlobToolInput = {
  /** Glob pattern to match files against. */
  pattern: string;

  /** Directory to search in. Defaults to cwd. */
  path?: string;
};

/**
 * Input shape for the `Grep` tool.
 */
type GrepToolInput = {
  /** Regular expression pattern to search for. */
  pattern: string;

  /** File or directory to search in. */
  path?: string;

  /** Glob pattern to filter files. */
  glob?: string;

  /** Output mode: `"content"`, `"files_with_matches"`, or `"count"`. */
  output_mode?: 'content' | 'files_with_matches' | 'count';

  /** Case insensitive search. */
  '-i'?: boolean;

  /** Enable multiline matching. */
  multiline?: boolean;
};

/**
 * Input shape for the `WebFetch` tool.
 */
type WebFetchToolInput = {
  /** URL to fetch content from. */
  url: string;

  /** Prompt to run on the fetched content. */
  prompt: string;
};

/**
 * Input shape for the `WebSearch` tool.
 */
type WebSearchToolInput = {
  /** Search query. */
  query: string;

  /** Only include results from these domains. */
  allowed_domains?: string[];

  /** Exclude results from these domains. */
  blocked_domains?: string[];
};

/**
 * Input shape for the `Agent` tool.
 */
type AgentToolInput = {
  /** Task for the agent to perform. */
  prompt: string;

  /** Short description of the task. */
  description: string;

  /** Type of specialized agent to use. */
  subagent_type?: string;

  /** Model alias to override the default. */
  model?: string;

  /** Agent ID to resume from a previous invocation. */
  resume?: string;

  /** Whether to run this agent in the background. */
  run_in_background?: boolean;

  /** Isolation mode (`"worktree"` creates a temporary git worktree). */
  isolation?: 'worktree';
};

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

//region Union

/**
 * Map from built-in tool name to its input type.
 */
type BuiltInToolInputMap = {
  Bash: BashToolInput;
  Write: WriteToolInput;
  Edit: EditToolInput;
  Read: ReadToolInput;
  Glob: GlobToolInput;
  Grep: GrepToolInput;
  WebFetch: WebFetchToolInput;
  WebSearch: WebSearchToolInput;
  Agent: AgentToolInput;
  AskUserQuestion: AskUserQuestionToolInput;
  NotebookEdit: NotebookEditToolInput;
  LSP: LspToolInput;
  EnterPlanMode: Record<string, never>;
  ExitPlanMode: ExitPlanModeToolInput;
  EnterWorktree: EnterWorktreeToolInput;
  TaskCreate: TaskCreateToolInput;
  TaskGet: TaskGetToolInput;
  TaskList: Record<string, never>;
  TaskOutput: TaskOutputToolInput;
  TaskStop: TaskStopToolInput;
  TaskUpdate: TaskUpdateToolInput;
  CronCreate: CronCreateToolInput;
  CronDelete: CronDeleteToolInput;
  CronList: Record<string, never>;
  Skill: SkillToolInput;
  ToolSearch: ToolSearchToolInput;
};

/**
 * Names of all built-in tools that have typed inputs.
 */
type BuiltInToolName = keyof BuiltInToolInputMap;

/**
 * Opaque input for MCP or unknown tools.
 */
type GenericToolInput = Record<string, unknown>;

//endregion

export type {
  AgentToolInput,
  AskUserQuestionEntry,
  AskUserQuestionOption,
  AskUserQuestionToolInput,
  BashToolInput,
  BuiltInToolInputMap,
  BuiltInToolName,
  CronCreateToolInput,
  CronDeleteToolInput,
  EditToolInput,
  EnterWorktreeToolInput,
  ExitPlanModeToolInput,
  GenericToolInput,
  GlobToolInput,
  GrepToolInput,
  LspOperation,
  LspToolInput,
  NotebookEditToolInput,
  ReadToolInput,
  SkillToolInput,
  TaskCreateToolInput,
  TaskGetToolInput,
  TaskOutputToolInput,
  TaskStatus,
  TaskStopToolInput,
  TaskUpdateToolInput,
  ToolSearchToolInput,
  WebFetchToolInput,
  WebSearchToolInput,
  WriteToolInput,
};
