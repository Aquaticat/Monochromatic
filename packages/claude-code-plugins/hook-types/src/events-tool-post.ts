/**
 * PostToolUse and PostToolUseFailure hook event types.
 *
 * Separated from `events-tool.ts` to keep each file under the max-lines limit.
 *
 * @module
 */

import type {
  HookInputBase,
  HookOutputBase,
} from './common.ts';
import type { GenericToolInput, } from './tool-inputs-union.ts';

//region PostToolUse

/**
 * Input for `PostToolUse` hooks.
 * Fires immediately after a tool completes successfully.
 */
export type PostToolUseInput = HookInputBase & {
  hook_event_name: 'PostToolUse';

  /**
   * Name of the tool that executed.
   */
  tool_name: string;

  /**
   * Arguments sent to the tool.
   */
  tool_input: GenericToolInput;

  /**
   * Result the tool returned. Shape depends on the tool.
   */
  tool_response: Record<string, unknown>;

  /**
   * Unique identifier for this tool use.
   */
  tool_use_id: string;
};

/**
 * Output for `PostToolUse` hooks.
 * Can provide feedback to Claude or replace MCP tool output.
 */
export type PostToolUseOutput = HookOutputBase & {
  /**
   * `"block"` prompts Claude with the `reason`.
   */
  decision?: 'block';

  /**
   * Explanation shown to Claude when `decision` is `"block"`.
   */
  reason?: string;

  hookSpecificOutput?: {
    hookEventName: 'PostToolUse';

    /**
     * Additional context for Claude.
     */
    additionalContext?: string;

    /**
     * For MCP tools only: replaces the tool's output.
     */
    updatedMCPToolOutput?: unknown;
  };
};

//endregion

//region PostToolUseFailure

/**
 * Input for `PostToolUseFailure` hooks.
 * Fires when a tool execution fails.
 */
export type PostToolUseFailureInput = HookInputBase & {
  hook_event_name: 'PostToolUseFailure';

  /**
   * Name of the tool that failed.
   */
  tool_name: string;

  /**
   * Arguments sent to the tool.
   */
  tool_input: GenericToolInput;

  /**
   * Unique identifier for this tool use.
   */
  tool_use_id: string;

  /**
   * Description of what went wrong.
   */
  error: string;

  /**
   * Whether the failure was caused by user interruption.
   */
  is_interrupt?: boolean;
};

/**
 * Output for `PostToolUseFailure` hooks.
 * Can inject context alongside the error.
 */
export type PostToolUseFailureOutput = HookOutputBase & {
  hookSpecificOutput?: {
    hookEventName: 'PostToolUseFailure';

    /**
     * Additional context for Claude alongside the error.
     */
    additionalContext?: string;
  };
};

//endregion
