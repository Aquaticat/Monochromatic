/**
 * Terminal Title pi extension entry point.
 *
 * Sets the terminal window/tab title to reflect the current agent activity:
 * tool executions, session lifecycle, and user prompts.
 *
 * Uses pi's `ctx.ui.setTitle()` API instead of raw OSC 0 escape sequences.
 * The title is composed by the title-builder module using a tool-name registry
 * with tense-aware formatting.
 *
 * @example
 * ```typescript
 * // Auto-discovered from ~/.pi/agent/extensions/terminal-title/index.ts
 * // or loaded via pi install / pi -e
 * pi -e ./packages/pi/terminal-title/src/index.ts
 * ```
 *
 * @module
 */

import type {
  AgentEndEvent,
  BeforeAgentStartEvent,
  ExtensionAPI,
  SessionShutdownEvent,
  SessionStartEvent,
} from '@earendil-works/pi-coding-agent';
import { titleForEvent, } from './title-builder.ts';

/** Minimal context shape needed by all event handlers (just `ui.setTitle()`). */
type TitleContext = {
  ui: {
    setTitle: (title: string,) => void;
  };
};

//region Event handlers

/**
 * Handle `tool_execution_start`: set title to present tense tool activity.
 *
 * @param event - tool execution start event with toolName and args
 *
 * @param ctx - extension context providing `ui.setTitle()`
 */
function handleToolExecutionStart(
  event: {
    toolName: string;
    args?: unknown;
  },
  ctx: TitleContext,
): void {
  /* oxlint-disable typescript/no-unsafe-type-assertion -- pi event args are typed as `any` */
  /** Event arguments coerced to a string-keyed record so the title builder can sample fields by name. */
  const args = (event.args ?? {}) as Record<string, unknown>;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  ctx.ui.setTitle(
    titleForEvent(
      'tool_execution_start',
      {
        toolName: event.toolName,
        args,
      },
    ),
  );
}

/**
 * Handle `tool_execution_end`: set title to past tense tool activity.
 *
 * @param event - tool execution end event with toolName
 *
 * @param ctx - extension context providing `ui.setTitle()`
 */
function handleToolExecutionEnd(
  event: {
    toolName: string;
  },
  ctx: TitleContext,
): void {
  ctx.ui.setTitle(
    titleForEvent(
      'tool_execution_end',
      {
        toolName: event.toolName,
      },
    ),
  );
}

/**
 * Handle `session_start`: set title to session reason.
 *
 * @param event - session start event with reason
 *
 * @param ctx - extension context providing `ui.setTitle()`
 */
function handleSessionStart(
  event: SessionStartEvent,
  ctx: TitleContext,
): void {
  ctx.ui.setTitle(
    titleForEvent(
      'session_start',
      {
        reason: event.reason,
      },
    ),
  );
}

/**
 * Handle `session_shutdown`: set title to session ended.
 *
 * @param _event - session shutdown event (reason available but not shown)
 *
 * @param ctx - extension context providing `ui.setTitle()`
 */
function handleSessionShutdown(
  _event: SessionShutdownEvent,
  ctx: TitleContext,
): void {
  ctx.ui.setTitle(
    titleForEvent(
      'session_shutdown',
      {},
    ),
  );
}

/**
 * Handle `agent_end`: set title to "Stopped".
 *
 * @param _event - agent end event (messages available but not shown)
 *
 * @param ctx - extension context providing `ui.setTitle()`
 */
function handleAgentEnd(
  _event: AgentEndEvent,
  ctx: TitleContext,
): void {
  ctx.ui.setTitle(
    titleForEvent(
      'agent_end',
      {},
    ),
  );
}

/**
 * Handle `before_agent_start`: set title to user prompt text.
 *
 * @param event - before agent start event with prompt text
 *
 * @param ctx - extension context providing `ui.setTitle()`
 */
function handleBeforeAgentStart(
  event: BeforeAgentStartEvent,
  ctx: TitleContext,
): void {
  ctx.ui.setTitle(
    titleForEvent(
      'before_agent_start',
      {
        prompt: event.prompt,
      },
    ),
  );
}

//endregion

//region Extension entry point

/**
 * Terminal Title pi extension.
 *
 * Subscribes to agent lifecycle events and updates the terminal window/tab
 * title to reflect the current activity.
 *
 * Handler types for `tool_execution_start` and `tool_execution_end` are
 * inferred by the `pi.on()` overload signatures; those event types are not
 * re-exported from the package's top-level index but are available via the
 * `on()` method's parameter types.
 *
 * @param pi - the pi extension API
 *
 * @example
 * ```typescript
 * // In ~/.pi/agent/settings.json:
 * { "packages": ["./packages/pi/terminal-title"] }
 * ```
 */
export default function terminalTitle(pi: ExtensionAPI,): void {
  pi.on(
    'tool_execution_start',
    handleToolExecutionStart,
  );
  pi.on(
    'tool_execution_end',
    handleToolExecutionEnd,
  );
  pi.on(
    'session_start',
    handleSessionStart,
  );
  pi.on(
    'session_shutdown',
    handleSessionShutdown,
  );
  pi.on(
    'agent_end',
    handleAgentEnd,
  );
  pi.on(
    'before_agent_start',
    handleBeforeAgentStart,
  );
}

//endregion
