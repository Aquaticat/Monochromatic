/**
 * Tool lifecycle hook event types: PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest.
 *
 * @module
 */

import type {
  HookInputBase,
  HookOutputBase,
} from './common.ts';
import type {
  GenericToolInput,
} from './tool-inputs.ts';

//region PreToolUse

/**
 * Input for `PreToolUse` hooks.
 * Fires before a tool call executes. Can block, allow, or escalate to the user.
 */
type PreToolUseInput = HookInputBase & {
  hook_event_name: 'PreToolUse';

  /** Name of the tool being invoked (e.g. `"Bash"`, `"Edit"`, `"mcp__memory__create_entities"`). */
  tool_name: string;

  /** Tool-specific input parameters. Shape depends on `tool_name`. */
  tool_input: GenericToolInput;

  /** Unique identifier for this tool use. */
  tool_use_id: string;
};

/**
 * Permission decision for `PreToolUse` hooks.
 */
type PreToolUsePermissionDecision = 'allow' | 'deny' | 'ask';

/**
 * Output for `PreToolUse` hooks.
 * Uses `hookSpecificOutput` for richer control than a simple block/allow.
 */
type PreToolUseOutput = HookOutputBase & {
  hookSpecificOutput?: {
    hookEventName: 'PreToolUse';

    /**
     * `"allow"` bypasses the permission system.
     * `"deny"` prevents the tool call.
     * `"ask"` prompts the user to confirm.
     */
    permissionDecision?: PreToolUsePermissionDecision;

    /**
     * For `"allow"` and `"ask"`: shown to the user but not Claude.
     * For `"deny"`: shown to Claude.
     */
    permissionDecisionReason?: string;

    /** Modifies the tool's input parameters before execution. */
    updatedInput?: GenericToolInput;

    /** Context added to Claude's conversation before tool execution. */
    additionalContext?: string;
  };
};

//endregion

//region PermissionRequest

/**
 * Suggestion for "always allow" options in the permission dialog.
 */
type PermissionSuggestion = {
  type: string;
  tool: string;
};

/**
 * Input for `PermissionRequest` hooks.
 * Fires when a permission dialog is about to be shown to the user.
 */
type PermissionRequestInput = HookInputBase & {
  hook_event_name: 'PermissionRequest';

  /** Name of the tool requesting permission. */
  tool_name: string;

  /** Tool-specific input parameters. */
  tool_input: GenericToolInput;

  /** "Always allow" options the user would normally see. */
  permission_suggestions?: PermissionSuggestion[];
};

/**
 * Output for `PermissionRequest` hooks.
 * Can allow or deny on behalf of the user.
 */
type PermissionRequestOutput = HookOutputBase & {
  hookSpecificOutput?: {
    hookEventName: 'PermissionRequest';
    decision: {
      /** `"allow"` grants the permission, `"deny"` denies it. */
      behavior: 'allow' | 'deny';

      /** For `"allow"` only: modifies the tool's input before execution. */
      updatedInput?: GenericToolInput;

      /** For `"allow"` only: applies permission rule updates. */
      updatedPermissions?: unknown;

      /** For `"deny"` only: tells Claude why the permission was denied. */
      message?: string;

      /** For `"deny"` only: if `true`, stops Claude. */
      interrupt?: boolean;
    };
  };
};

//endregion

//region PostToolUse

/**
 * Input for `PostToolUse` hooks.
 * Fires immediately after a tool completes successfully.
 */
type PostToolUseInput = HookInputBase & {
  hook_event_name: 'PostToolUse';

  /** Name of the tool that executed. */
  tool_name: string;

  /** Arguments sent to the tool. */
  tool_input: GenericToolInput;

  /** Result the tool returned. Shape depends on the tool. */
  tool_response: Record<string, unknown>;

  /** Unique identifier for this tool use. */
  tool_use_id: string;
};

/**
 * Output for `PostToolUse` hooks.
 * Can provide feedback to Claude or replace MCP tool output.
 */
type PostToolUseOutput = HookOutputBase & {
  /** `"block"` prompts Claude with the `reason`. */
  decision?: 'block';

  /** Explanation shown to Claude when `decision` is `"block"`. */
  reason?: string;

  hookSpecificOutput?: {
    hookEventName: 'PostToolUse';

    /** Additional context for Claude. */
    additionalContext?: string;

    /** For MCP tools only: replaces the tool's output. */
    updatedMCPToolOutput?: unknown;
  };
};

//endregion

//region PostToolUseFailure

/**
 * Input for `PostToolUseFailure` hooks.
 * Fires when a tool execution fails.
 */
type PostToolUseFailureInput = HookInputBase & {
  hook_event_name: 'PostToolUseFailure';

  /** Name of the tool that failed. */
  tool_name: string;

  /** Arguments sent to the tool. */
  tool_input: GenericToolInput;

  /** Unique identifier for this tool use. */
  tool_use_id: string;

  /** Description of what went wrong. */
  error: string;

  /** Whether the failure was caused by user interruption. */
  is_interrupt?: boolean;
};

/**
 * Output for `PostToolUseFailure` hooks.
 * Can inject context alongside the error.
 */
type PostToolUseFailureOutput = HookOutputBase & {
  hookSpecificOutput?: {
    hookEventName: 'PostToolUseFailure';

    /** Additional context for Claude alongside the error. */
    additionalContext?: string;
  };
};

//endregion

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
};
