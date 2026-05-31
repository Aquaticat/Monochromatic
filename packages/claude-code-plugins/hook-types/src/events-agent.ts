/**
 * Agent and stop hook event types: Stop, SubagentStart, SubagentStop, TeammateIdle, TaskCompleted.
 *
 * @module
 */

import type {
  HookInputBase,
  HookOutputBase,
} from './common.ts';

//region Stop

/**
 * Input for `Stop` hooks.
 * Fires when the main Claude Code agent finishes responding.
 * Does not fire on user interrupt.
 */
type StopInput = HookInputBase & {
  hook_event_name: 'Stop';

  /**
   * `true` when Claude is already continuing as a result of a stop hook.
   * Check this to prevent infinite loops.
   */
  stop_hook_active: boolean;

  /**
   * Text content of Claude's final response. May be absent if the stop was triggered before any message was generated.
   */
  last_assistant_message?: string;
};

/**
 * Output for `Stop` and `SubagentStop` hooks.
 * Can prevent Claude from stopping.
 */
type StopOutput = HookOutputBase & {
  /**
   * `"block"` prevents Claude from stopping.
   */
  decision?: 'block';

  /**
   * Required when `decision` is `"block"`. Tells Claude why it should continue.
   */
  reason?: string;
};

//endregion

//region SubagentStart

/**
 * Input for `SubagentStart` hooks.
 * Fires when a subagent is spawned via the Agent tool.
 */
type SubagentStartInput = HookInputBase & {
  hook_event_name: 'SubagentStart';

  /**
   * Unique identifier for the subagent.
   */
  agent_id: string;

  /**
   * Agent type name (e.g. `"Bash"`, `"Explore"`, `"Plan"`, or custom agent names).
   */
  agent_type: string;
};

/**
 * Output for `SubagentStart` hooks.
 * Cannot block subagent creation, but can inject context.
 */
type SubagentStartOutput = HookOutputBase & {
  hookSpecificOutput?: {
    hookEventName: 'SubagentStart';

    /**
     * Context added to the subagent's conversation.
     */
    additionalContext?: string;
  };
};

//endregion

//region SubagentStop

/**
 * Input for `SubagentStop` hooks.
 * Fires when a subagent finishes responding.
 */
type SubagentStopInput = HookInputBase & {
  hook_event_name: 'SubagentStop';

  /**
   * `true` when the subagent is already continuing as a result of a stop hook.
   * Check this to prevent infinite loops.
   */
  stop_hook_active: boolean;

  /**
   * Unique identifier for the subagent.
   */
  agent_id: string;

  /**
   * Agent type name.
   */
  agent_type: string;

  /**
   * Path to the subagent's own transcript, stored in a `subagents/` subfolder.
   * Distinct from the main session's `transcript_path`.
   */
  agent_transcript_path: string;

  /**
   * Text content of the subagent's final response. May be absent if the stop was triggered before any message was generated.
   */
  last_assistant_message?: string;
};

/**
 * Output for `SubagentStop` hooks.
 * Uses the same decision control format as `Stop` hooks.
 */
type SubagentStopOutput = StopOutput;

//endregion

//region TeammateIdle

/**
 * Input for `TeammateIdle` hooks.
 * Fires when an agent team teammate is about to go idle.
 */
type TeammateIdleInput = HookInputBase & {
  hook_event_name: 'TeammateIdle';

  /**
   * Name of the teammate about to go idle.
   */
  teammate_name: string;

  /**
   * Name of the team.
   */
  team_name: string;
};

/**
 * Output for `TeammateIdle` hooks.
 * Exit code 2 continues the teammate with stderr as feedback.
 * `{ continue: false }` stops the teammate entirely.
 */
type TeammateIdleOutput = HookOutputBase;

//endregion

//region TaskCompleted

/**
 * Input for `TaskCompleted` hooks.
 * Fires when a task is being marked as completed.
 */
type TaskCompletedInput = HookInputBase & {
  hook_event_name: 'TaskCompleted';

  /**
   * Identifier of the task being completed.
   */
  task_id: string;

  /**
   * Title of the task.
   */
  task_subject: string;

  /**
   * Detailed description of the task.
   */
  task_description?: string;

  /**
   * Name of the teammate completing the task.
   */
  teammate_name?: string;

  /**
   * Name of the team.
   */
  team_name?: string;
};

/**
 * Output for `TaskCompleted` hooks.
 * Exit code 2 blocks completion with stderr as feedback.
 * `{ continue: false }` stops the teammate entirely.
 */
type TaskCompletedOutput = HookOutputBase;

//endregion

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
};
