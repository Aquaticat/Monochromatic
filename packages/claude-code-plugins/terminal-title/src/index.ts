#!/usr/bin/env bun

/**
 * Claude Code hook that sets the terminal tab title to reflect current activity.
 *
 * Reads hook event JSON from stdin and writes an OSC 0 escape sequence to `/dev/tty`.
 * Compatible with Ptyxis, Konsole, Wezterm, and Ghostty.
 *
 * @example
 * ```jsonc
 * // .claude/settings.local.json
 * {
 *   "hooks": {
 *     "PostToolUse": [{ "type": "command", "command": "bun packages/claude-code-plugins/cc-terminal-title/src/hook.ts" }],
 *     "Stop": [{ "type": "command", "command": "bun packages/claude-code-plugins/cc-terminal-title/src/hook.ts" }]
 *   }
 * }
 * ```
 */

import {
  openSync,
  writeSync,
  closeSync,
} from 'node:fs';
import {
  basename,
} from 'node:path';
import type {
  HookInput,
  PostToolUseInput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';

export {}

//region Constants

/**
 * Maximum length for the title string before truncation, preventing overly long terminal titles.
 */
const MAX_TITLE_LENGTH = 60;

/**
 * Maximum length for pattern and query strings displayed in the title.
 */
const MAX_PATTERN_LENGTH = 30;

/**
 * Prefix prepended to every terminal title to identify Claude Code activity.
 */
const TITLE_PREFIX = '\u2733';

//endregion

//region Title extraction

/**
 * Truncates a string to the specified maximum length, appending an ellipsis if truncated.
 *
 * @param value - String to truncate.
 *
 * @param maxLength - Maximum allowed length including the ellipsis.
 *
 * @returns Truncated string or original if within limit.
 *
 * @example
 * ```ts
 * truncate('a very long string', 10) // 'a very lo…'
 * ```
 */
function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}\u2026`;
}

/**
 * Extracts the filename from a path, or returns the path if no separator is found.
 *
 * @param filePath - Absolute or relative file path.
 *
 * @returns Just the filename portion.
 *
 * @example
 * ```ts
 * shortPath('/var/home/user/project/src/index.ts') // 'index.ts'
 * ```
 */
function shortPath(filePath: string): string {
  return basename(filePath);
}

/**
 * Extracts first meaningful token from a bash command for display.
 * Strips environment variable assignments and common prefixes to show the actual command.
 *
 * @param command - Full bash command string.
 *
 * @returns Shortened command representation.
 *
 * @example
 * ```ts
 * shortCommand('ENV=1 git status --porcelain') // 'git status --porcelain'
 * shortCommand('timeout 10 bun test') // 'bun test'
 * ```
 */
function shortCommand(command: string): string {
  /** Prefixes that add no meaningful context to the title. */
  const NOISE_PREFIXES = new Set(['timeout', 'env', 'nice', 'nohup']);

  const parts = command.split(' ');
  /** Index of the first token that represents the actual command. */
  let startIndex = 0;

  for (const part of parts) {
    /* Skip environment variable assignments like KEY=value. */
    if (part.includes('=') && !part.startsWith('-')) {
      startIndex++;
      continue;
    }
    /* Skip noise prefixes and their argument (e.g. `timeout 10`). */
    if (NOISE_PREFIXES.has(part)) {
      startIndex++;
      /* Skip the next token too since it's the argument to the prefix. */
      const nextPart = parts[startIndex];
      if (nextPart !== undefined && !nextPart.startsWith('-')) {
        startIndex++;
      }
      continue;
    }
    break;
  }

  return parts.slice(startIndex).join(' ');
}

/**
 * Builds a human-readable title string from a PostToolUse event.
 * Extracts the most relevant context from `tool_input` depending on the tool type.
 *
 * @param event - PostToolUse hook event payload.
 *
 * @returns Descriptive title like "Reading index.ts" or "Running git status".
 *
 * @example
 * ```ts
 * titleForTool({ tool_name: 'Read', tool_input: { file_path: '/src/index.ts' } })
 * // 'Reading index.ts'
 * ```
 */
function titleForTool(event: PostToolUseInput): string {
  const { tool_name: toolName, tool_input: input } = event;

  if (toolName === 'Bash') {
    const { command } = input;
    if (typeof command === 'string') {
      return shortCommand(command);
    }
    return 'Running command';
  }

  if (toolName === 'Read') {
    const { file_path: filePath } = input;
    if (typeof filePath === 'string') {
      return `Reading ${shortPath(filePath)}`;
    }
    return 'Reading file';
  }

  if (toolName === 'Edit') {
    const { file_path: filePath } = input;
    if (typeof filePath === 'string') {
      return `Editing ${shortPath(filePath)}`;
    }
    return 'Editing file';
  }

  if (toolName === 'Write') {
    const { file_path: filePath } = input;
    if (typeof filePath === 'string') {
      return `Writing ${shortPath(filePath)}`;
    }
    return 'Writing file';
  }

  if (toolName === 'Grep') {
    const { pattern } = input;
    if (typeof pattern === 'string') {
      return `Searching "${truncate(pattern, MAX_PATTERN_LENGTH)}"`;
    }
    return 'Searching';
  }

  if (toolName === 'Glob') {
    const { pattern } = input;
    if (typeof pattern === 'string') {
      return `Finding ${truncate(pattern, MAX_PATTERN_LENGTH)}`;
    }
    return 'Finding files';
  }

  if (toolName === 'Agent') {
    const { description } = input;
    if (typeof description === 'string') {
      return `Agent: ${description}`;
    }
    return 'Agent working';
  }

  if (toolName === 'WebSearch') {
    const { query } = input;
    if (typeof query === 'string') {
      return `Searching "${truncate(query, MAX_PATTERN_LENGTH)}"`;
    }
    return 'Web search';
  }

  if (toolName === 'WebFetch') {
    const { url } = input;
    if (typeof url === 'string') {
      try {
        return `Fetching ${new URL(url).hostname}`;
      } catch {
        return `Fetching URL`;
      }
    }
    return 'Fetching URL';
  }

  return toolName;
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
function setTerminalTitle(title: string): void {
  try {
    const fd = openSync('/dev/tty', 'w');
    using _cleanup = { [Symbol.dispose](): void { closeSync(fd); } };
    writeSync(fd, `\u001B]0;${title}\u0007`);
  } catch {
    /* /dev/tty unavailable — running inside sandbox or non-interactive context. */
  }
}

//endregion

//region Main

/**
 * Reads the full contents of stdin as a string.
 *
 * @returns Resolved stdin text.
 */
async function readStdin(): Promise<string> {
  const chunks: string[] = [];
  const decoder = new TextDecoder();
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(decoder.decode(chunk, { stream: true, }));
  }
  chunks.push(decoder.decode());
  return chunks.join('');
}

/** Raw JSON string read from stdin containing the hook event payload. */
const raw = await readStdin();

/**
 * Parsed hook event, narrowed by `hook_event_name`.
 *
 * Input is trusted -- it comes from Claude Code's hook dispatch system.
 */
/* eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- trusted input from Claude Code hook system */
const event = JSON.parse(raw) as HookInput;

if (event.hook_event_name === 'PostToolUse') {
  /** Human-readable description of the tool action for the terminal title. */
  const detail = titleForTool(event);
  setTerminalTitle(truncate(`${TITLE_PREFIX} ${detail}`, MAX_TITLE_LENGTH));
} else if (event.hook_event_name === 'Stop') {
  setTerminalTitle(`${TITLE_PREFIX} Stopped`);
} else if (event.hook_event_name === 'UserPromptSubmit') {
  setTerminalTitle(`${TITLE_PREFIX} ${event.prompt}`);
} else {
  setTerminalTitle(TITLE_PREFIX);
}

//endregion
