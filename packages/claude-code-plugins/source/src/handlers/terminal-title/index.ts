import type {
  HookInput,
  PostToolUseInput,
  PreToolUseInput,
} from '@monochromatic-dev/claude-code-plugins-hook-types/ts';
import {
  formatToolTitle,
  prefixedTitle,
  shortPath,
} from '@monochromatic-dev/module-terminal-title/ts';
import type { ReadonlyDeep, } from 'type-fest';
import { open, } from 'node:fs/promises';

import {
  NO_STDOUT,
  type WriterOutput,
} from '../../runtime/handler-runtime.ts';
import { TOOL_TITLES, } from './tool-titles.ts';

/**
 * Maximum length for the title string before truncation.
 */
const MAX_TITLE_LENGTH = 60;

/**
 * Prefix prepended to every terminal title to identify Claude Code activity.
 */
const TITLE_PREFIX = '✳';

/**
 * Builds a human-readable title string from a tool-use event by looking up the
 * tool in {@link TOOL_TITLES} and applying the matching formatter with the
 * appropriate tense.
 *
 * @param event - PreToolUse or PostToolUse hook event payload
 *
 * @returns descriptive title like "Reading index.ts" (pre) or "Read index.ts" (post)
 */
function titleForTool(event: ReadonlyDeep<PreToolUseInput | PostToolUseInput>,): string {
  /**
   * Tool name and input pulled from the hook event for downstream formatting.
   */
  const {
    tool_name: toolName,
    tool_input: input,
  } = event;
  /**
   * `pre` for PreToolUse, `post` for PostToolUse; picks the verb form of the title.
   */
  const tense = event.hook_event_name
    === 'PreToolUse' ? 'pre' : 'post';
  return formatToolTitle({
    registry: TOOL_TITLES,
    toolName,
    args: input,
    tense,
    unknownToolTitle: ({ toolName: unknownToolName, },) => unknownToolName,
  },);
}

/**
 * Builds a human-readable title string from any hook event. Tool events delegate
 * to {@link titleForTool}; other events produce static or field-based titles.
 *
 * @param hookEvent - parsed hook event payload
 *
 * @returns short descriptive title for the terminal tab
 */
function titleForEvent(hookEvent: ReadonlyDeep<HookInput>,): string {
  if ((hookEvent.hook_event_name
    === 'PreToolUse')
    || (hookEvent.hook_event_name
      === 'PostToolUse'))
  {
    return titleForTool(hookEvent,);
  }
  if (hookEvent.hook_event_name
    === 'PermissionRequest')
    return `Permission: ${hookEvent.tool_name}`;
  if (hookEvent.hook_event_name
    === 'PostToolUseFailure')
    return `Failed: ${hookEvent.tool_name}`;
  if (hookEvent.hook_event_name
    === 'SessionStart')
    return `Session ${hookEvent.source}`;
  if (hookEvent.hook_event_name
    === 'InstructionsLoaded')
    return `Loaded ${shortPath(hookEvent.file_path,)}`;
  if (hookEvent.hook_event_name
    === 'UserPromptSubmit')
    return hookEvent.prompt;
  if (hookEvent.hook_event_name
    === 'Notification')
    return hookEvent.title
      ?? hookEvent
      .message;
  if (hookEvent.hook_event_name
    === 'SubagentStart')
    return `Subagent: ${hookEvent.agent_type}`;
  if (hookEvent.hook_event_name
    === 'SubagentStop')
    return `Subagent done: ${hookEvent.agent_type}`;
  if (hookEvent.hook_event_name
    === 'TeammateIdle')
    return `Idle: ${hookEvent.teammate_name}`;
  if (hookEvent.hook_event_name
    === 'TaskCompleted')
    return `Task done: ${hookEvent.task_subject}`;
  if (hookEvent.hook_event_name
    === 'ConfigChange')
    return `Config: ${hookEvent.source}`;
  if (hookEvent.hook_event_name
    === 'WorktreeCreate')
    return `Worktree: ${hookEvent.name}`;
  if (hookEvent.hook_event_name
    === 'WorktreeRemove')
    return `Worktree removed`;
  if (hookEvent.hook_event_name
    === 'PreCompact')
    return `Compacting (${hookEvent.trigger})`;
  if (hookEvent.hook_event_name
    === 'Stop')
    return 'Stopped';
  /* hookEvent.hook_event_name === 'SessionEnd' */
  return 'Session ended';
}

/**
 * Writes an OSC 0 escape sequence to `/dev/tty` to set the terminal tab title.
 * Fails silently if `/dev/tty` is unavailable (sandbox or non-interactive).
 *
 * @param title - title string to display in the terminal tab
 */
async function setTerminalTitle(title: string,): Promise<void> {
  try {
    /**
     * Write-mode file handle for `/dev/tty`; closed by async disposal on scope exit.
     */
    await using tty = await open(
      '/dev/tty',
      'w',
    );
    await tty.write(`]0;${title}`,);
  }
  catch (_error: unknown) {
    /* /dev/tty unavailable: running inside sandbox or non-interactive context. */
  }
}

/**
 * Output is `void`: the terminal-title handler writes its OSC sequence to
 * `/dev/tty` and emits no stdout. The runtime invokes {@link terminalTitleWriter}
 * which returns an empty string.
 */
type TerminalTitleOutput = void;

/**
 * Builds the title from any hook event via {@link titleForEvent}, truncates
 * it to {@link MAX_TITLE_LENGTH}, and writes the OSC 0 escape sequence via
 * {@link setTerminalTitle} to `/dev/tty`. Side-effecting; returns nothing.
 *
 * @param event - parsed {@link HookInput} event from Claude Code
 *
 * @returns nothing; title is set as a side effect via `/dev/tty`
 *
 * @example
 * ```ts
 * terminalTitleHandler({ hook_event_name: 'PreToolUse', tool_name: 'Read', ... });
 * ```
 */
async function terminalTitleHandler(event: ReadonlyDeep<HookInput>,): Promise<TerminalTitleOutput> {
  /**
   * Title text derived from the event before prefixing and truncation.
   */
  const title = titleForEvent(event,);
  await setTerminalTitle(prefixedTitle({
    prefix: TITLE_PREFIX,
    body: title,
    maxLength: MAX_TITLE_LENGTH,
  },),);
}

/**
 * Parses raw stdin as a {@link HookInput} (any of the union members; narrowed at
 * dispatch time inside the handler).
 *
 * Input is trusted; it comes from Claude Code's hook dispatch system.
 *
 * @param raw - JSON payload from Claude Code stdin
 *
 * @returns parsed hook event union
 *
 * @example
 * ```ts
 * const event = terminalTitleParser(await text(process.stdin));
 * ```
 */
function terminalTitleParser(raw: string,): HookInput {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted JSON contract from Claude Code hook system
  return JSON.parse(raw,) as HookInput;
}

/**
 * Returns {@link NO_STDOUT}; the legacy hook produced no stdout, and the
 * runtime shell treats the sentinel as intentional silence.
 *
 * @param _output - ignored {@link TerminalTitleOutput} handler result (title is set as a side effect)
 *
 * @returns sentinel instructing the runtime to emit no stdout bytes
 *
 * @example
 * ```ts
 * terminalTitleWriter(); // NO_STDOUT
 * ```
 */
function terminalTitleWriter(_output: TerminalTitleOutput,): WriterOutput {
  return NO_STDOUT;
}

export type { TerminalTitleOutput, };

export {
  terminalTitleHandler,
  terminalTitleParser,
  terminalTitleWriter,
};
