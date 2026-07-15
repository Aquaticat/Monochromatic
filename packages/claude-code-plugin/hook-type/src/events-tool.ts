/**
 * PreToolUse and PermissionRequest hook event types.
 *
 * PostToolUse and PostToolUseFailure types live in `events-tool-post.ts`.
 *
 * @module
 */

import type {
  HookInputBase,
  HookOutputBase,
} from './common.ts';
import type { GenericToolInput, } from './tool-inputs-union.ts';

//region PreToolUse

/**
 * Input for `PreToolUse` hooks.
 * Fires before a tool call executes. Can block, allow, or escalate to the user.
 */
export type PreToolUseInput = HookInputBase & {
  hook_event_name: 'PreToolUse';

  /**
   * Name of the tool being invoked (e.g. `"Bash"`, `"Edit"`, `"mcp__memory__create_entities"`).
   */
  tool_name: string;

  /**
   * Tool-specific input parameters. Shape depends on `tool_name`.
   */
  tool_input: GenericToolInput;

  /**
   * Unique identifier for this tool use.
   */
  tool_use_id: string;
};

/**
 * Permission decision for `PreToolUse` hooks.
 */
export type PreToolUsePermissionDecision = 'allow' | 'deny' | 'ask';

/**
 * Output for `PreToolUse` hooks.
 * Uses `hookSpecificOutput` for richer control than a simple block/allow.
 */
export type PreToolUseOutput = HookOutputBase & {
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

    /**
     * Modifies the tool's input parameters before execution.
     */
    updatedInput?: GenericToolInput;

    /**
     * Context added to Claude's conversation before tool execution.
     */
    additionalContext?: string;
  };
};

//endregion

//region PermissionRequest

/**
 * Suggestion for "always allow" options in the permission dialog.
 */
export type PermissionSuggestion = {
  type: string;
  tool: string;
};

/**
 * Input for `PermissionRequest` hooks.
 * Fires when a permission dialog is about to be shown to the user.
 */
export type PermissionRequestInput = HookInputBase & {
  hook_event_name: 'PermissionRequest';

  /**
   * Name of the tool requesting permission.
   */
  tool_name: string;

  /**
   * Tool-specific input parameters.
   */
  tool_input: GenericToolInput;

  /**
   * "Always allow" options the user would normally see.
   */
  permission_suggestions?: PermissionSuggestion[];
};

/**
 * Output for `PermissionRequest` hooks.
 * Can allow or deny on behalf of the user.
 */
export type PermissionRequestOutput = HookOutputBase & {
  hookSpecificOutput?: {
    hookEventName: 'PermissionRequest';
    decision: {
      /**
       * `"allow"` grants the permission, `"deny"` denies it.
       */
      behavior: 'allow' | 'deny';

      /**
       * For `"allow"` only: modifies the tool's input before execution.
       */
      updatedInput?: GenericToolInput;

      /**
       * For `"allow"` only: applies permission rule updates.
       */
      updatedPermissions?: unknown;

      /**
       * For `"deny"` only: tells Claude why the permission was denied.
       */
      message?: string;

      /**
       * For `"deny"` only: if `true`, stops Claude.
       */
      interrupt?: boolean;
    };
  };
};

//endregion
