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
    function handleToolExecutionStart(
      event: {
        toolName: string;
        args?: unknown;
      },
      ctx: TitleContext,
    ) {
      /* oxlint-disable typescript/no-unsafe-type-assertion -- pi event args are typed as `any` */
      /** Event arguments coerced to a string-keyed record so the title builder can sample fields by name. */
      const args = (event.args ?? {}) as Record<string, unknown>;
      /* oxlint-enable typescript/no-unsafe-type-assertion */
      ctx.ui.setTitle(
        titleForEvent({
          eventType: 'tool_execution_start',
          data: {
            toolName: event.toolName,
            args,
          },
        },),
      );
    },
  );
  pi.on(
    'tool_execution_end',
    function handleToolExecutionEnd(
      event: {
        toolName: string;
      },
      ctx: TitleContext,
    ) {
      ctx.ui.setTitle(
        titleForEvent({
          eventType: 'tool_execution_end',
          data: {
            toolName: event.toolName,
          },
        },),
      );
    },
  );
  pi.on(
    'session_start',
    function handleSessionStart(
      event: SessionStartEvent,
      ctx: TitleContext,
    ) {
      ctx.ui.setTitle(
        titleForEvent({
          eventType: 'session_start',
          data: {
            reason: event.reason,
          },
        },),
      );
    },
  );
  pi.on(
    'session_shutdown',
    function handleSessionShutdown(
      _event: SessionShutdownEvent,
      ctx: TitleContext,
    ) {
      ctx.ui.setTitle(
        titleForEvent({
          eventType: 'session_shutdown',
          data: {},
        },),
      );
    },
  );
  pi.on(
    'agent_end',
    function handleAgentEnd(
      _event: AgentEndEvent,
      ctx: TitleContext,
    ) {
      ctx.ui.setTitle(
        titleForEvent({
          eventType: 'agent_end',
          data: {},
        },),
      );
    },
  );
  pi.on(
    'before_agent_start',
    function handleBeforeAgentStart(
      event: BeforeAgentStartEvent,
      ctx: TitleContext,
    ) {
      ctx.ui.setTitle(
        titleForEvent({
          eventType: 'before_agent_start',
          data: {
            prompt: event.prompt,
          },
        },),
      );
    },
  );
}

//endregion
