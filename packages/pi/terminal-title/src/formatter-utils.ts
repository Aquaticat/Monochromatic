/**
 * Formatting utilities for tool title display.
 *
 * Provides string truncation, path shortening, field extraction, and tense-aware
 * formatter builders used by the tool-title registry.
 *
 * @module
 */

import { basename, } from 'node:path';

/** Maximum length for pattern and query strings displayed in the title. */
const MAX_PATTERN_LENGTH = 30;

/**
 * Tense-specific labels for a tool title. `pre` is shown during execution
 * (`tool_execution_start`), `post` after completion (`tool_execution_end`).
 */
type TenseLabels = {
  pre: string;
  post: string;
};

/**
 * Formatter entry for a known tool. `extract` pulls a display-relevant string
 * from tool input; `format` turns it into a tense-appropriate title;
 * `fallback` provides tense-specific defaults when `extract` returns `undefined`.
 */
type ToolTitleEntry = {
  extract: (input: Record<string, unknown>,) => string | undefined;
  format: (
    value: string,
    tense: 'pre' | 'post',
  ) => string;
  fallback: TenseLabels;
};

/**
 * Truncates a string to the specified maximum length, appending an ellipsis
 * if truncated.
 *
 * @param value - string to truncate
 *
 * @param maxLength - maximum allowed length including the ellipsis
 *
 * @returns truncated string or original if within limit
 *
 * @example
 * ```ts
 * truncate({ value: 'a very long command string', maxLength: 10 }) // 'a very lo…'
 * truncate({ value: 'short', maxLength: 10 }) // 'short'
 * ```
 */
function truncate(
  {
    value,
    maxLength,
  }: {
    value: string;
    maxLength: number;
  },
): string {
  if (value.length <= maxLength)
    return value;
  return `${
    value.slice(
      0,
      maxLength - 1,
    )
  }…`;
}

/**
 * Extracts the filename from a path, or returns the path if no separator is found.
 *
 * @param filePath - absolute or relative file path
 *
 * @returns just the filename portion
 *
 * @example
 * ```ts
 * shortPath('/home/user/src/index.ts') // 'index.ts'
 * ```
 */
function shortPath(filePath: string,): string {
  return basename(filePath,);
}

/**
 * Extracts a string field from untyped tool input.
 *
 * @param input - tool input record
 *
 * @param key - property name to extract
 *
 * @returns string value or `undefined` if absent or non-string
 *
 * @example
 * ```ts
 * stringField({ input: { path: '/foo.ts' }, key: 'path' }) // '/foo.ts'
 * stringField({ input: { path: '/foo.ts' }, key: 'missing' }) // undefined
 * ```
 */
function stringField(
  {
    input,
    key,
  }: {
    input: Record<string, unknown>;
    key: string;
  },
): string | undefined {
  /** Raw value pulled out of `input` by key; only strings are accepted, anything else becomes `undefined`. */
  const value = input[key];
  if ((typeof value) === 'string')
    return value;
  return undefined;
}

/**
 * Creates an extractor that reads a named string field from tool input.
 *
 * @param key - property name to extract
 *
 * @returns extractor function compatible with {@link ToolTitleEntry.extract}
 *
 * @example
 * ```ts
 * const extractPath = field('path')
 * extractPath({ path: '/foo/bar.ts' }) // '/foo/bar.ts'
 * ```
 */
function field(key: string,): (input: Record<string, unknown>,) => string | undefined {
  return function extractField(input: Record<string, unknown>,) {
    return stringField({
      input,
      key,
    },);
  };
}

/**
 * Builds a tense-aware file path formatter.
 *
 * @param labels - present and past tense verbs
 *
 * @returns formatter producing titles like "Reading index.ts"
 *
 * @example
 * ```ts
 * const fmt = pathFormat({ pre: 'Reading', post: 'Read' })
 * fmt('/home/user/src/index.ts', 'pre') // 'Reading index.ts'
 * fmt('/home/user/src/index.ts', 'post') // 'Read index.ts'
 * ```
 */
function pathFormat(
  labels: TenseLabels,
): (
  value: string,
  tense: 'pre' | 'post',
) => string {
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
 * @param labels - present and past tense verbs
 *
 * @returns formatter producing titles like `Searching "pattern"`
 *
 * @example
 * ```ts
 * const fmt = quotedFormat({ pre: 'Searching', post: 'Searched' })
 * fmt('TODO', 'pre') // 'Searching "TODO"'
 * ```
 */
function quotedFormat(
  labels: TenseLabels,
): (
  value: string,
  tense: 'pre' | 'post',
) => string {
  return function formatQuoted(
    v: string,
    tense: 'pre' | 'post',
  ) {
    return `${labels[tense]} "${
      truncate({
        value: v,
        maxLength: MAX_PATTERN_LENGTH,
      },)
    }"`;
  };
}

/**
 * Matches leading noise in shell commands: env-var assignments and wrapper
 * commands (`timeout 10`, `env`, `nice`, `nohup`) with their argument.
 * Anchored at start; repeats to strip stacked prefixes like `env timeout 10`.
 */
const COMMAND_NOISE_RE = /^(?:(?!-)\S+=\S*\s+|(?:timeout|env|nice|nohup)\s+\S+\s+)*/;

/**
 * Extracts first meaningful token from a bash command for display.
 *
 * @param command - full bash command string
 *
 * @returns shortened command representation
 *
 * @example
 * ```ts
 * shortCommand('timeout 10 npm test') // 'npm test'
 * shortCommand('FOO=bar ls -la') // 'ls -la'
 * ```
 */
function shortCommand(command: string,): string {
  return command.replace(
    COMMAND_NOISE_RE,
    '',
  );
}

export type {
  TenseLabels,
  ToolTitleEntry,
};

export {
  field,
  MAX_PATTERN_LENGTH,
  pathFormat,
  quotedFormat,
  shortCommand,
  shortPath,
  stringField,
  truncate,
};
