/**
 * Tool-specific input shapes for PreToolUse, PostToolUse, PostToolUseFailure, and PermissionRequest events.
 *
 * Each type describes the `tool_input` object for a specific built-in tool.
 * MCP tool inputs are opaque `Record<string, unknown>` since they vary by server.
 *
 * @module
 */

import type {
  AskUserQuestionToolInput,
  CronCreateToolInput,
  CronDeleteToolInput,
  EnterWorktreeToolInput,
  ExitPlanModeToolInput,
  LspToolInput,
  NotebookEditToolInput,
  SkillToolInput,
  TaskCreateToolInput,
  TaskGetToolInput,
  TaskOutputToolInput,
  TaskStopToolInput,
  TaskUpdateToolInput,
  ToolSearchToolInput,
} from './tool-inputs-extended.ts';

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
  BashToolInput,
  BuiltInToolInputMap,
  BuiltInToolName,
  EditToolInput,
  GenericToolInput,
  GlobToolInput,
  GrepToolInput,
  ReadToolInput,
  WebFetchToolInput,
  WebSearchToolInput,
  WriteToolInput,
};

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
} from './tool-inputs-extended.ts';
