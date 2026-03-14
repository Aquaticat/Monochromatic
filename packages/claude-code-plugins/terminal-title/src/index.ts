#!/usr/bin/env bun

/**
 * Claude Code hook that sets the terminal tab title to reflect current activity.
 *
 * Reads hook event JSON from stdin and writes an OSC 0 escape sequence to `/dev/tty`.
 * Compatible with Ptyxis, Konsole, Wezterm, and Ghostty.
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
  GenericToolInput,
  HookInput,
  PostToolUseInput,
  PreToolUseInput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';
import {
  readStdin,
} from '@monochromatic-dev/claude-code-plugins-hook-utils';

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
 * Matches leading noise in shell commands: env-var assignments (`KEY=val`)
 * and wrapper commands (`timeout 10`, `env`, `nice`, `nohup`) with their argument.
 * Anchored at start; repeats to strip stacked prefixes like `env timeout 10`.
 */
const COMMAND_NOISE_RE = /^(?:(?!-)\S+=\S*\s+|(?:timeout|env|nice|nohup)\s+\S+\s+)*/;

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
  return command.replace(COMMAND_NOISE_RE, '');
}

/**
 * Extracts a string field from untyped tool input, returning `undefined` if absent or non-string.
 *
 * @param input - Tool input record.
 *
 * @param key - Property name to extract.
 *
 * @returns String value or `undefined`.
 *
 * @example
 * ```ts
 * stringField({ file_path: '/src/index.ts' }, 'file_path') // '/src/index.ts'
 * stringField({ count: 5 }, 'file_path') // undefined
 * ```
 */
function stringField(input: GenericToolInput, key: string): string | undefined {
  const value = input[key];
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

/**
 * Creates an extractor that reads a named string field from tool input.
 *
 * @param key - Property name to extract.
 *
 * @returns Extractor function compatible with {@link ToolTitleEntry.extract}.
 *
 * @example
 * ```ts
 * field('file_path')({ file_path: '/src/index.ts' }) // '/src/index.ts'
 * field('file_path')({ count: 5 }) // undefined
 * ```
 */
function field(key: string): (input: GenericToolInput) => string | undefined {
  return function extractField(input: GenericToolInput) {
    return stringField(input, key);
  };
}

/**
 * Tense-specific labels for a tool title.
 * `pre` is shown during execution (PreToolUse), `post` after completion (PostToolUse).
 */
type TenseLabels = {
  pre: string;
  post: string;
};

/**
 * Formatter entry for a known tool.
 * `extract` pulls a display-relevant string from `tool_input`; `format` turns it into a tense-appropriate title.
 * `fallback` provides tense-specific defaults when `extract` returns `undefined`.
 */
type ToolTitleEntry = {
  extract: (input: GenericToolInput) => string | undefined;
  format: (value: string, tense: 'pre' | 'post') => string;
  fallback: TenseLabels;
};

/**
 * Builds a tense-aware file path formatter.
 *
 * @param labels - Present and past tense verbs (e.g. `{ pre: 'Reading', post: 'Read' }`).
 *
 * @returns Formatter that produces titles like "Reading index.ts" or "Read index.ts".
 *
 * @example
 * ```ts
 * pathFormat({ pre: 'Editing', post: 'Edited' })('src/index.ts', 'pre') // 'Editing index.ts'
 * ```
 */
function pathFormat(labels: TenseLabels): (value: string, tense: 'pre' | 'post') => string {
  return function formatPath(v: string, tense: 'pre' | 'post') {
    return `${labels[tense]} ${shortPath(v)}`;
  };
}

/**
 * Builds a tense-aware pattern/query formatter with quoting and truncation.
 *
 * @param labels - Present and past tense verbs (e.g. `{ pre: 'Searching', post: 'Searched' }`).
 *
 * @returns Formatter that produces titles like `Searching "pattern"` or `Searched "pattern"`.
 *
 * @example
 * ```ts
 * quotedFormat({ pre: 'Searching', post: 'Searched' })('TODO', 'post') // 'Searched "TODO"'
 * ```
 */
function quotedFormat(labels: TenseLabels): (value: string, tense: 'pre' | 'post') => string {
  return function formatQuoted(v: string, tense: 'pre' | 'post') {
    return `${labels[tense]} "${truncate(v, MAX_PATTERN_LENGTH)}"`;
  };
}

/**
 * Maps tool names to their title formatting rules.
 * Each entry specifies how to extract a display string from `tool_input`, how to format it per tense, and fallbacks.
 *
 * @example
 * ```ts
 * TOOL_TITLES['Read']
 * // { extract: field('file_path'), format: pathFormat(...), fallback: { pre: 'Reading file', post: 'Read file' } }
 * ```
 */
const TOOL_TITLES: Record<string, ToolTitleEntry> = {
  Bash: {
    extract: field('command'),
    format(v) { return shortCommand(v); },
    fallback: { pre: 'Running command', post: 'Ran command' },
  },
  Read: { extract: field('file_path'), format: pathFormat({ pre: 'Reading', post: 'Read' }), fallback: { pre: 'Reading file', post: 'Read file' } },
  Edit: { extract: field('file_path'), format: pathFormat({ pre: 'Editing', post: 'Edited' }), fallback: { pre: 'Editing file', post: 'Edited file' } },
  Write: { extract: field('file_path'), format: pathFormat({ pre: 'Writing', post: 'Wrote' }), fallback: { pre: 'Writing file', post: 'Wrote file' } },
  Grep: { extract: field('pattern'), format: quotedFormat({ pre: 'Searching', post: 'Searched' }), fallback: { pre: 'Searching', post: 'Searched' } },
  Glob: { extract: field('pattern'), format: quotedFormat({ pre: 'Finding', post: 'Found' }), fallback: { pre: 'Finding files', post: 'Found files' } },
  Agent: {
    extract: field('description'),
    format(v, tense) { return `${tense === 'pre' ? 'Agent' : 'Agent done'}: ${v}`; },
    fallback: { pre: 'Agent working', post: 'Agent done' },
  },
  WebSearch: { extract: field('query'), format: quotedFormat({ pre: 'Searching', post: 'Searched' }), fallback: { pre: 'Web search', post: 'Web search done' } },
  AskUserQuestion: {
    extract(input): string | undefined {
      const {questions} = input;
      if (!Array.isArray(questions)) {
        return undefined;
      }
      /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- untyped tool_input; structure verified by Array.isArray guard */
      const [first] = questions as Record<string, unknown>[];
      if (first === undefined) {
        return undefined;
      }
      const {question} = first;
      if (typeof question === 'string') {
        return question;
      }
      return undefined;
    },
    format(v, tense) { return `${tense === 'pre' ? 'Asking' : 'Asked'}: ${truncate(v, MAX_PATTERN_LENGTH)}`; },
    fallback: { pre: 'Asking question', post: 'Asked question' },
  },
  WebFetch: {
    extract: field('url'),
    format(v, tense) {
      /** Verb prefix matching the hook tense. */
      const verb = tense === 'pre' ? 'Fetching' : 'Fetched';
      try {
        return `${verb} ${new URL(v).hostname}`;
      } catch {
        return `${verb} URL`;
      }
    },
    fallback: { pre: 'Fetching URL', post: 'Fetched URL' },
  },
  NotebookEdit: { extract: field('notebook_path'), format: pathFormat({ pre: 'Editing notebook', post: 'Edited notebook' }), fallback: { pre: 'Editing notebook', post: 'Edited notebook' } },
  LSP: {
    extract: field('operation'),
    format(v, tense) { return `${tense === 'pre' ? 'LSP' : 'LSP done'}: ${v}`; },
    fallback: { pre: 'LSP query', post: 'LSP done' },
  },
  Skill: {
    extract: field('skill'),
    format(v, tense) { return `${tense === 'pre' ? 'Skill' : 'Skill done'}: ${v}`; },
    fallback: { pre: 'Running skill', post: 'Ran skill' },
  },
  ToolSearch: {
    extract: field('query'),
    format(v, tense) { return `${tense === 'pre' ? 'Discovering' : 'Discovered'}: ${truncate(v, MAX_PATTERN_LENGTH)}`; },
    fallback: { pre: 'Discovering tools', post: 'Discovered tools' },
  },
  EnterPlanMode: {
    extract() { /* No extractable value */ },
    format() { return ''; },
    fallback: { pre: 'Entering plan mode', post: 'In plan mode' },
  },
  ExitPlanMode: {
    extract() { /* No extractable value */ },
    format() { return ''; },
    fallback: { pre: 'Exiting plan mode', post: 'Exited plan mode' },
  },
  EnterWorktree: {
    extract: field('name'),
    format(v, tense) { return `${tense === 'pre' ? 'Creating' : 'Created'} worktree: ${v}`; },
    fallback: { pre: 'Creating worktree', post: 'Created worktree' },
  },
  TaskCreate: {
    extract: field('subject'),
    format(v, tense) { return `${tense === 'pre' ? 'Creating' : 'Created'} task: ${truncate(v, MAX_PATTERN_LENGTH)}`; },
    fallback: { pre: 'Creating task', post: 'Created task' },
  },
  TaskGet: {
    extract: field('taskId'),
    format(v) { return `Task #${v}`; },
    fallback: { pre: 'Getting task', post: 'Got task' },
  },
  TaskList: {
    extract() { /* No extractable value */ },
    format() { return ''; },
    fallback: { pre: 'Listing tasks', post: 'Listed tasks' },
  },
  TaskOutput: {
    extract: field('task_id'),
    format(v, tense) { return `${tense === 'pre' ? 'Reading' : 'Read'} task output #${v}`; },
    fallback: { pre: 'Reading task output', post: 'Read task output' },
  },
  TaskStop: {
    extract: field('task_id'),
    format(v, tense) { return `${tense === 'pre' ? 'Stopping' : 'Stopped'} task #${v}`; },
    fallback: { pre: 'Stopping task', post: 'Stopped task' },
  },
  TaskUpdate: {
    extract: field('taskId'),
    format(v, tense) { return `${tense === 'pre' ? 'Updating' : 'Updated'} task #${v}`; },
    fallback: { pre: 'Updating task', post: 'Updated task' },
  },
  CronCreate: {
    extract: field('prompt'),
    format(v, tense) { return `${tense === 'pre' ? 'Scheduling' : 'Scheduled'}: ${truncate(v, MAX_PATTERN_LENGTH)}`; },
    fallback: { pre: 'Scheduling cron', post: 'Scheduled cron' },
  },
  CronDelete: {
    extract: field('id'),
    format(v, tense) { return `${tense === 'pre' ? 'Deleting' : 'Deleted'} cron #${v}`; },
    fallback: { pre: 'Deleting cron', post: 'Deleted cron' },
  },
  CronList: {
    extract() { /* No extractable value */ },
    format() { return ''; },
    fallback: { pre: 'Listing cron jobs', post: 'Listed cron jobs' },
  },
};

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
function titleForTool(event: PreToolUseInput | PostToolUseInput): string {
  const { tool_name: toolName, tool_input: input } = event;
  const tense = event.hook_event_name === 'PreToolUse' ? 'pre' : 'post';
  const entry = TOOL_TITLES[toolName];
  if (entry === undefined) {
    return toolName;
  }
  const value = entry.extract(input);
  if (value === undefined) {
    return entry.fallback[tense];
  }
  return entry.format(value, tense);
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

/** Raw JSON string read from stdin containing the hook event payload. */
const raw = await readStdin();

/**
 * Parsed hook event, narrowed by `hook_event_name`.
 *
 * Input is trusted -- it comes from Claude Code's hook dispatch system.
 */
/* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted input from Claude Code hook system */
const event = JSON.parse(raw) as HookInput;

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
function titleForEvent(hookEvent: HookInput): string {
  if (hookEvent.hook_event_name === 'PreToolUse' || hookEvent.hook_event_name === 'PostToolUse') {
    return titleForTool(hookEvent);
  }
  if (hookEvent.hook_event_name === 'PermissionRequest') {
    return `Permission: ${hookEvent.tool_name}`;
  }
  if (hookEvent.hook_event_name === 'PostToolUseFailure') {
    return `Failed: ${hookEvent.tool_name}`;
  }
  if (hookEvent.hook_event_name === 'SessionStart') {
    return `Session ${hookEvent.source}`;
  }
  if (hookEvent.hook_event_name === 'InstructionsLoaded') {
    return `Loaded ${shortPath(hookEvent.file_path)}`;
  }
  if (hookEvent.hook_event_name === 'UserPromptSubmit') {
    return hookEvent.prompt;
  }
  if (hookEvent.hook_event_name === 'Notification') {
    return hookEvent.title ?? hookEvent.message;
  }
  if (hookEvent.hook_event_name === 'SubagentStart') {
    return `Subagent: ${hookEvent.agent_type}`;
  }
  if (hookEvent.hook_event_name === 'SubagentStop') {
    return `Subagent done: ${hookEvent.agent_type}`;
  }
  if (hookEvent.hook_event_name === 'TeammateIdle') {
    return `Idle: ${hookEvent.teammate_name}`;
  }
  if (hookEvent.hook_event_name === 'TaskCompleted') {
    return `Task done: ${hookEvent.task_subject}`;
  }
  if (hookEvent.hook_event_name === 'ConfigChange') {
    return `Config: ${hookEvent.source}`;
  }
  if (hookEvent.hook_event_name === 'WorktreeCreate') {
    return `Worktree: ${hookEvent.name}`;
  }
  if (hookEvent.hook_event_name === 'WorktreeRemove') {
    return `Worktree removed`;
  }
  if (hookEvent.hook_event_name === 'PreCompact') {
    return `Compacting (${hookEvent.trigger})`;
  }
  if (hookEvent.hook_event_name === 'Stop') {
    return 'Stopped';
  }
  /* hookEvent.hook_event_name === 'SessionEnd' */
  return 'Session ended';
}

/** Human-readable title derived from the hook event. */
const title = titleForEvent(event);
setTerminalTitle(truncate(`${TITLE_PREFIX} ${title}`, MAX_TITLE_LENGTH));

//endregion
