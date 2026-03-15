#!/usr/bin/env bun

/**
 * Claude Code hook that sets the terminal tab title to reflect current activity.
 *
 * Reads hook event JSON from stdin and writes an OSC 0 escape sequence to `/dev/tty`.
 * Compatible with Ptyxis, Konsole, Wezterm, and Ghostty.
 */

import type {
  HookInput,
  PostToolUseInput,
  PreToolUseInput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';
import { readStdin, } from '@monochromatic-dev/claude-code-plugins-hook-utils';
import {
  closeSync,
  openSync,
  writeSync,
} from 'node:fs';
import { basename, } from 'node:path';

import {
  TOOL_TITLES,
  truncate,
} from './tool-titles.ts';

export {};

//region Constants

/**
 * Maximum length for the title string before truncation, preventing overly long terminal titles.
 */
const MAX_TITLE_LENGTH = 60;

/**
 * Prefix prepended to every terminal title to identify Claude Code activity.
 */
const TITLE_PREFIX = '\u2733';

//endregion

//region Title extraction

/**
 * Builds a human-readable title string from a PreToolUse or PostToolUse event.
 * Looks up the tool in {@link TOOL_TITLES} and applies the matching formatter with the appropriate tense.
 *
 * @param event - PreToolUse or PostToolUse hook event payload.
 *
 * @returns Descriptive title like "Reading index.ts" (pre) or "Read index.ts" (post).
 *
 * @example
 * ```ts
 * titleForTool({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: '/src/index.ts' } })
 * // 'Writing index.ts'
 * titleForTool({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: '/src/index.ts' } })
 * // 'Wrote index.ts'
 * ```
 */
function titleForTool(event: PreToolUseInput | PostToolUseInput,): string {
  const { tool_name: toolName, tool_input: input, } = event;
  const tense = event.hook_event_name === 'PreToolUse' ? 'pre' : 'post';
  const entry = TOOL_TITLES[toolName];
  if (entry === undefined)
    return toolName;
  const value = entry.extract(input,);
  if (value === undefined)
    return entry.fallback[tense];
  return entry.format(value, tense,);
}

/**
 * Extracts the filename from a path, or returns the path if no separator is found.
 *
 * @param filePath - Absolute or relative file path.
 *
 * @returns Just the filename portion.
 */
function shortPath(filePath: string,): string {
  return basename(filePath,);
}

//endregion

//region Terminal output

/**
 * Writes an OSC 0 escape sequence to `/dev/tty` to set the terminal tab title.
 * Fails silently if `/dev/tty` is unavailable (e.g. inside a sandbox).
 *
 * @param title - Title string to display in the terminal tab.
 *
 * @example
 * ```ts
 * setTerminalTitle('Claude: Reading index.ts')
 * ```
 */
function setTerminalTitle(title: string,): void {
  try {
    const fd = openSync('/dev/tty', 'w',);
    using _cleanup = { [Symbol.dispose](): void {
      closeSync(fd,);
    }, };
    writeSync(fd, `\u001B]0;${title}\u0007`,);
  }
  catch {
    /* /dev/tty unavailable — running inside sandbox or non-interactive context. */
  }
}

//endregion

//region Main

/** Raw JSON string read from stdin containing the hook event payload. */
const raw = await readStdin();

/**
 * Parsed hook event, narrowed by `hook_event_name`.
 *
 * Input is trusted -- it comes from Claude Code's hook dispatch system.
 */
/* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted input from Claude Code hook system */
const event = JSON.parse(raw,) as HookInput;

/**
 * Builds a human-readable title string from any hook event.
 * Tool events delegate to {@link titleForTool}; other events produce static or field-based titles.
 *
 * @param hookEvent - Parsed hook event payload.
 *
 * @returns Short descriptive title for the terminal tab.
 *
 * @example
 * ```ts
 * titleForEvent({ hook_event_name: 'SessionStart', source: 'startup', ... }) // 'Session started'
 * titleForEvent({ hook_event_name: 'Stop', ... }) // 'Stopped'
 * ```
 */
function titleForEvent(hookEvent: HookInput,): string {
  if (hookEvent.hook_event_name === 'PreToolUse'
    || hookEvent.hook_event_name === 'PostToolUse')
  {
    return titleForTool(hookEvent,);
  }
  if (hookEvent.hook_event_name === 'PermissionRequest')
    return `Permission: ${hookEvent.tool_name}`;
  if (hookEvent.hook_event_name === 'PostToolUseFailure')
    return `Failed: ${hookEvent.tool_name}`;
  if (hookEvent.hook_event_name === 'SessionStart')
    return `Session ${hookEvent.source}`;
  if (hookEvent.hook_event_name === 'InstructionsLoaded')
    return `Loaded ${shortPath(hookEvent.file_path,)}`;
  if (hookEvent.hook_event_name === 'UserPromptSubmit')
    return hookEvent.prompt;
  if (hookEvent.hook_event_name === 'Notification')
    return hookEvent.title ?? hookEvent.message;
  if (hookEvent.hook_event_name === 'SubagentStart')
    return `Subagent: ${hookEvent.agent_type}`;
  if (hookEvent.hook_event_name === 'SubagentStop')
    return `Subagent done: ${hookEvent.agent_type}`;
  if (hookEvent.hook_event_name === 'TeammateIdle')
    return `Idle: ${hookEvent.teammate_name}`;
  if (hookEvent.hook_event_name === 'TaskCompleted')
    return `Task done: ${hookEvent.task_subject}`;
  if (hookEvent.hook_event_name === 'ConfigChange')
    return `Config: ${hookEvent.source}`;
  if (hookEvent.hook_event_name === 'WorktreeCreate')
    return `Worktree: ${hookEvent.name}`;
  if (hookEvent.hook_event_name === 'WorktreeRemove')
    return `Worktree removed`;
  if (hookEvent.hook_event_name === 'PreCompact')
    return `Compacting (${hookEvent.trigger})`;
  if (hookEvent.hook_event_name === 'Stop')
    return 'Stopped';
  /* hookEvent.hook_event_name === 'SessionEnd' */
  return 'Session ended';
}

/** Human-readable title derived from the hook event. */
const title = titleForEvent(event,);
setTerminalTitle(truncate(`${TITLE_PREFIX} ${title}`, MAX_TITLE_LENGTH,),);

//endregion
