/**
 * TypeScript type definitions for all Claude Code hook events.
 *
 * Covers every hook event in the Claude Code lifecycle with typed inputs, outputs,
 * and tool-specific input shapes for built-in tools.
 *
 * @see [Hooks reference](https://docs.anthropic.com/en/docs/claude-code/hooks)
 *
 * @example
 * ```ts
 * import type { HookInput } from '@monochromatic-dev/claude-code-hook-types';
 *
 * const event = JSON.parse(raw) as HookInput;
 * switch (event.hook_event_name) {
 *   case 'PreToolUse':
 *     console.log(event.tool_name, event.tool_input);
 *     break;
 *   case 'Stop':
 *     console.log(event.stop_hook_active);
 *     break;
 * }
 * ```
 *
 * @module
 */

import type {
  ConfigChangeInput,
  InstructionsLoadedInput,
  SessionEndInput,
  SessionStartInput,
} from './events-session.ts';
import type {
  PermissionRequestInput,
  PostToolUseFailureInput,
  PostToolUseInput,
  PreToolUseInput,
} from './events-tool.ts';
import type {
  StopInput,
  SubagentStartInput,
  SubagentStopInput,
  TaskCompletedInput,
  TeammateIdleInput,
} from './events-agent.ts';
import type {
  NotificationInput,
  PreCompactInput,
  UserPromptSubmitInput,
  WorktreeCreateInput,
  WorktreeRemoveInput,
} from './events-misc.ts';

//region Re-exports

export type {
  HookEventName,
  HookInputBase,
  HookOutputBase,
  PermissionMode,
} from './common.ts';

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
} from './tool-inputs.ts';

export type {
  ConfigChangeInput,
  ConfigChangeOutput,
  ConfigChangeSource,
  InstructionsLoadReason,
  InstructionsLoadedInput,
  InstructionsLoadedOutput,
  InstructionsMemoryType,
  SessionEndInput,
  SessionEndOutput,
  SessionEndReason,
  SessionStartInput,
  SessionStartOutput,
  SessionStartSource,
} from './events-session.ts';

export type {
  PermissionRequestInput,
  PermissionRequestOutput,
  PermissionSuggestion,
  PostToolUseFailureInput,
  PostToolUseFailureOutput,
  PostToolUseInput,
  PostToolUseOutput,
  PreToolUseInput,
  PreToolUseOutput,
  PreToolUsePermissionDecision,
} from './events-tool.ts';

export type {
  StopInput,
  StopOutput,
  SubagentStartInput,
  SubagentStartOutput,
  SubagentStopInput,
  SubagentStopOutput,
  TaskCompletedInput,
  TaskCompletedOutput,
  TeammateIdleInput,
  TeammateIdleOutput,
} from './events-agent.ts';

export type {
  NotificationInput,
  NotificationOutput,
  NotificationType,
  PreCompactInput,
  PreCompactOutput,
  PreCompactTrigger,
  UserPromptSubmitInput,
  UserPromptSubmitOutput,
  WorktreeCreateInput,
  WorktreeRemoveInput,
  WorktreeRemoveOutput,
} from './events-misc.ts';

//endregion

//region Discriminated unions

/**
 * Discriminated union of all hook event inputs.
 * Narrows via `hook_event_name`.
 *
 * @example
 * ```ts
 * function handle(event: HookInput) {
 *   if (event.hook_event_name === 'PreToolUse') {
 *     event.tool_name; // narrowed to PreToolUseInput
 *   }
 * }
 * ```
 */
type HookInput =
  | SessionStartInput
  | InstructionsLoadedInput
  | UserPromptSubmitInput
  | PreToolUseInput
  | PermissionRequestInput
  | PostToolUseInput
  | PostToolUseFailureInput
  | NotificationInput
  | SubagentStartInput
  | SubagentStopInput
  | StopInput
  | TeammateIdleInput
  | TaskCompletedInput
  | ConfigChangeInput
  | WorktreeCreateInput
  | WorktreeRemoveInput
  | PreCompactInput
  | SessionEndInput;

export type {
  HookInput,
};

//endregion
