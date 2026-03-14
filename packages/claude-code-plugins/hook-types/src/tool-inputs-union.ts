/**
 * Union and map types that aggregate all built-in tool inputs.
 *
 * Separated from `tool-inputs.ts` to keep each file under the max-lines limit.
 *
 * @module
 */

import type {
  AgentToolInput,
  AskUserQuestionToolInput,
  BashToolInput,
  CronCreateToolInput,
  CronDeleteToolInput,
  EditToolInput,
  EnterWorktreeToolInput,
  ExitPlanModeToolInput,
  GlobToolInput,
  GrepToolInput,
  LspToolInput,
  NotebookEditToolInput,
  ReadToolInput,
  SkillToolInput,
  TaskCreateToolInput,
  TaskGetToolInput,
  TaskOutputToolInput,
  TaskStopToolInput,
  TaskUpdateToolInput,
  ToolSearchToolInput,
  WebFetchToolInput,
  WebSearchToolInput,
  WriteToolInput,
} from './tool-inputs.ts';

/**
 * Map from built-in tool name to its input type.
 *
 * @example
 * ```ts
 * type BashInput = BuiltInToolInputMap['Bash'];
 * ```
 */
export type BuiltInToolInputMap = {
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
export type BuiltInToolName = keyof BuiltInToolInputMap;

/**
 * Opaque input for MCP or unknown tools.
 *
 * Used when the tool name does not match any built-in tool, such as MCP tools
 * whose input shapes vary by server.
 */
export type GenericToolInput = Record<string, unknown>;
