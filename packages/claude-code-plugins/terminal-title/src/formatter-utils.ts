/**
 * Formatting utilities for tool title display.
 *
 * Provides string truncation, path shortening, field extraction,
 * and tense-aware formatter builders used by the tool title registry.
 *
 * @module
 */

import type {
  GenericToolInput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';
import { basename, } from 'node:path';

/**
 * Maximum length for pattern and query strings displayed in the title.
 */
export const MAX_PATTERN_LENGTH = 30;

/**
 * Tense-specific labels for a tool title.
 * `pre` is shown during execution (PreToolUse), `post` after completion (PostToolUse).
 */
export type TenseLabels = {
  pre: string;
  post: string;
};

/**
 * Formatter entry for a known tool.
 * `extract` pulls a display-relevant string from `tool_input`; `format` turns it into a tense-appropriate title.
 * `fallback` provides tense-specific defaults when `extract` returns `undefined`.
 */
export type ToolTitleEntry = {
  extract: (input: GenericToolInput,) => string | undefined;
  format: (value: string, tense: 'pre' | 'post',) => string;
  fallback: TenseLabels;
};

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
export function truncate(
  value: string,
  maxLength: number,
): string {
  if (value.length <= maxLength)
    return value;
  return `${value.slice(
    0,
    maxLength - 1,
  )}\u2026`;
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
export function shortPath(filePath: string,): string {
  return basename(filePath,);
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
export function stringField(
  input: GenericToolInput,
  key: string,
): string | undefined {
  const value = input[key];
  if (typeof value === 'string')
    return value;
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
export function field(key: string,): (input: GenericToolInput,) => string | undefined {
  return function extractField(input: GenericToolInput,) {
    return stringField(
      input,
      key,
    );
  };
}

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
export function pathFormat(
  labels: TenseLabels,
): (value: string, tense: 'pre' | 'post',) => string {
  return function formatPath(
    v: string,
    tense: 'pre' | 'post',
  ) {
    return `${labels[tense]} ${shortPath(v,)}`;
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
export function quotedFormat(
  labels: TenseLabels,
): (value: string, tense: 'pre' | 'post',) => string {
  return function formatQuoted(
    v: string,
    tense: 'pre' | 'post',
  ) {
    return `${labels[tense]} "${truncate(
      v,
      MAX_PATTERN_LENGTH,
    )}"`;
  };
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
export function shortCommand(command: string,): string {
  return command.replace(
    COMMAND_NOISE_RE,
    '',
  );
}
