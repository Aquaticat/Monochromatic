/**
 * Terminal title builder for pi events.
 *
 * Produces human-readable terminal tab titles from pi extension events
 * using the tool-title registry and tense-aware formatting.
 *
 * @module
 */

import {
  truncate,
} from './formatter-utils.ts';
import {
  TOOL_TITLES,
} from './tool-titles.ts';

/** Prefix prepended to every terminal title for visual identification. */
const TITLE_PREFIX = 'π';

/** Maximum total title length including prefix. */
const MAX_TITLE_LENGTH = 60;

/**
 * Union of pi extension events that this extension handles.
 *
 * Uses the `type` discriminant from pi's event system.
 */
type HandledEventType =
  | 'tool_execution_start'
  | 'tool_execution_end'
  | 'session_start'
  | 'session_shutdown'
  | 'agent_end'
  | 'before_agent_start';

/**
 * Builds a terminal title for a tool execution event.
 *
 * Looks up the tool name in the {@link TOOL_TITLES} registry. If found,
 * extracts a display value from the tool input and formats it with the
 * appropriate tense. Falls back to the tool name itself if not registered.
 *
 * For custom/MCP tools not in the registry, displays the raw tool name
 * with tense-appropriate wording.
 *
 * @param toolName - pi tool name (e.g. `"bash"`, `"read"`, or a custom name)
 *
 * @param args - tool input arguments as a record
 *
 * @param tense - `"pre"` for start, `"post"` for end
 *
 * @returns formatted title string (without prefix)
 *
 * @example
 * ```ts
 * titleForTool('bash', { command: 'npm test' }, 'pre') // 'npm test'
 * titleForTool('read', { path: '/home/user/index.ts' }, 'pre') // 'Reading index.ts'
 * titleForTool('mcp__weather', { city: 'Tokyo' }, 'pre') // 'Running mcp__weather'
 * ```
 */
function titleForTool(
  toolName: string,
  args: Record<string, unknown>,
  tense: 'pre' | 'post',
): string {
  const entry = TOOL_TITLES[toolName];
  if (entry !== undefined) {
    const value = entry.extract(args,);
    if (value !== undefined) {
      return entry.format(
        value,
        tense,
      );
    }
    return entry.fallback[tense];
  }

  // Custom/MCP tool fallback
  const verb = tense === 'pre' ? 'Running' : 'Ran';
  return `${verb} ${toolName}`;
}

/**
 * Maps event types to their title body strings.
 *
 * Each key matches a {@link HandledEventType}; the function produces
 * the body text (before prefix) for that event.
 */
const EVENT_BODY_BUILDERS: Record<HandledEventType, (data: EventData,) => string> = {
  tool_execution_start(data,) {
    return titleForTool(
      data.toolName ?? 'unknown',
      data.args ?? {},
      'pre',
    );
  },
  tool_execution_end(data,) {
    return titleForTool(
      data.toolName ?? 'unknown',
      data.args ?? {},
      'post',
    );
  },
  session_start(data,) {
    return `Session ${data.reason ?? 'started'}`;
  },
  session_shutdown() {
    return 'Session ended';
  },
  agent_end() {
    return 'Stopped';
  },
  before_agent_start(data,) {
    const prompt = data.prompt ?? '';
    return truncate(
      prompt,
      MAX_TITLE_LENGTH - TITLE_PREFIX.length - 1,
    );
  },
};

/** Data bag for event-specific fields passed to title builders. */
type EventData = {
  toolName?: string;
  args?: Record<string, unknown>;
  reason?: string;
  prompt?: string;
};

/**
 * Builds a terminal title from a pi extension event.
 *
 * Maps each handled event type to its title logic via a record lookup:
 * - `tool_execution_start` → look up tool, use `pre` tense
 * - `tool_execution_end` → look up tool, use `post` tense
 * - `session_start` → "Session \{reason\}"
 * - `session_shutdown` → "Session ended"
 * - `agent_end` → "Stopped"
 * - `before_agent_start` → user prompt text (truncated)
 *
 * @param eventType - the `type` field from the pi event
 *
 * @param data - event-specific data (toolName, args, reason, prompt, etc.)
 *
 * @returns final title string with prefix, truncated to {@link MAX_TITLE_LENGTH}
 *
 * @example
 * ```ts
 * titleForEvent('tool_execution_start', { toolName: 'bash', args: { command: 'npm test' } })
 * // '✳ npm test'
 *
 * titleForEvent('session_start', { reason: 'startup' })
 * // '✳ Session startup'
 * ```
 */
function titleForEvent(
  eventType: HandledEventType,
  data: EventData,
): string {
  const builder = EVENT_BODY_BUILDERS[eventType];
  const body = builder(data,);
  const title = `${TITLE_PREFIX} ${body}`;
  return truncate(
    title,
    MAX_TITLE_LENGTH,
  );
}

export {
  titleForEvent,
  titleForTool,
  MAX_TITLE_LENGTH,
  TITLE_PREFIX,
};

export type {
  EventData,
  HandledEventType,
};
