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

/**
 * Immutable empty tool-argument record used when pi omits event arguments.
 */
const EMPTY_TOOL_ARGS: Readonly<Record<string, unknown>> = Object.freeze({},);

/**
 * Minimal context shape needed by all event handlers (just `ui.setTitle()`).
 */
type TitleContext = {
  readonly ui: {
    readonly setTitle: (title: string,) => void;
  };
};

/**
 * Minimal tool execution start event shape used by this extension.
 */
type ToolExecutionStartEvent = {
  readonly toolCallId?: string;
  readonly toolName: string;
  readonly args?: unknown;
};

/**
 * Minimal tool execution end event shape used by this extension.
 */
type ToolExecutionEndEvent = {
  readonly toolCallId?: string;
  readonly toolName: string;
  readonly args?: unknown;
};

//region Tool argument helpers

/**
 * Checks whether unknown pi event args are a string-keyed object.
 *
 * @param value - because pi event args arrive from extension events without specific types
 *
 * @returns whether value can be read as tool arguments
 *
 * @example
 * ```ts
 * isToolArgs({ command: 'ls -l' });
 * ```
 */
function isToolArgs(value: unknown,): value is Readonly<Record<string, unknown>> {
  return value !== null
    && (typeof value) === 'object'
    && !Array.isArray(value,);
}

/**
 * Converts unknown pi event args into a read-only argument record.
 *
 * @param args - because pi may omit args on completion events
 *
 * @returns tool arguments, or an empty record when absent or non-object
 *
 * @example
 * ```ts
 * toolArgsFromUnknown({ command: 'ls -l' });
 * ```
 */
function toolArgsFromUnknown(args: unknown,): Readonly<Record<string, unknown>> {
  if (isToolArgs(args,))
    return args;
  return EMPTY_TOOL_ARGS;
}

//endregion Tool argument helpers

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
  /**
   * Tool arguments captured at start time. Pi completion events expose result
   * metadata but not original args, so terminal titles need this per-call cache
   * to show details such as `ls -l` after completion.
   */
  const toolArgsByCallId = new Map<string, Readonly<Record<string, unknown>>>();

  pi.on(
    'tool_execution_start',
    function handleToolExecutionStart(
      event: Readonly<ToolExecutionStartEvent>,
      ctx: TitleContext,
    ) {
      /**
       * Event arguments normalized to a string-keyed record so the title builder can sample fields by name.
       */
      const args = toolArgsFromUnknown(event.args,);
      if (event.toolCallId !== undefined) {
        toolArgsByCallId.set(
          event.toolCallId,
          args,
        );
      }
      ctx.ui
        .setTitle(
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
      event: Readonly<ToolExecutionEndEvent>,
      ctx: TitleContext,
    ) {
      /**
       * Original args recovered from the start event because pi's end event omits them.
       */
      const cachedArgs = event.toolCallId === undefined
        ? undefined
        : toolArgsByCallId.get(event.toolCallId,);
      /**
       * Completion args when present, otherwise cached start args, otherwise empty fallback.
       */
      const args = event.args === undefined
        ? cachedArgs
          ?? EMPTY_TOOL_ARGS
        : toolArgsFromUnknown(event.args,);
      if (event.toolCallId !== undefined)
        toolArgsByCallId.delete(event.toolCallId,);
      ctx.ui
        .setTitle(
        titleForEvent({
          eventType: 'tool_execution_end',
          data: {
            toolName: event.toolName,
            args,
          },
        },),
      );
    },
  );
  pi.on(
    'session_start',
    function handleSessionStart(
      event: Readonly<Pick<SessionStartEvent, 'reason'>>,
      ctx: TitleContext,
    ) {
      ctx.ui
        .setTitle(
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
      _event: Readonly<Pick<SessionShutdownEvent, 'type'>>,
      ctx: TitleContext,
    ) {
      ctx.ui
        .setTitle(
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
      _event: Readonly<Pick<AgentEndEvent, 'type'>>,
      ctx: TitleContext,
    ) {
      ctx.ui
        .setTitle(
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
      event: Readonly<Pick<BeforeAgentStartEvent, 'prompt'>>,
      ctx: TitleContext,
    ) {
      ctx.ui
        .setTitle(
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
