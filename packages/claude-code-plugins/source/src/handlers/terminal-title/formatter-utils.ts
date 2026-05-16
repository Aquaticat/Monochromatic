/**
 * Formatting utilities for tool title display.
 *
 * Provides string truncation, path shortening, field extraction, and tense-aware
 * formatter builders used by the tool-title registry.
 *
 * @module
 */

import type {
  GenericToolInput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';
import { basename, } from 'node:path';

/** Maximum length for pattern and query strings displayed in the title. */
const MAX_PATTERN_LENGTH = 30;

/**
 * Tense-specific labels for a tool title. `pre` is shown during execution
 * (PreToolUse), `post` after completion (PostToolUse).
 */
type TenseLabels = {
  pre: string;
  post: string;
};

/**
 * Formatter entry for a known tool. `extract` pulls a display-relevant string
 * from `tool_input`; `format` turns it into a tense-appropriate title;
 * `fallback` provides tense-specific defaults when `extract` returns `undefined`.
 */
type ToolTitleEntry = {
  extract: (input: GenericToolInput,) => string | undefined;
  format: (
    value: string,
    tense: 'pre' | 'post',
  ) => string;
  fallback: TenseLabels;
};

/**
 * Truncates a string to specified maximum length, appending an ellipsis
 * if truncated.
 *
 * @param value - string to truncate
 *
 * @param maxLength - maximum allowed length including ellipsis
 *
 * @returns truncated string or original if within limit
 *
 * @example
 * ```typescript
 * truncate({ value: 'hello world', maxLength: 8 }); // 'hello w…'
 * truncate({ value: 'short', maxLength: 10 }); // 'short'
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
 * Extracts filename from a path, or returns the path if no separator is found.
 *
 * @param filePath - absolute or relative file path
 *
 * @returns last filename portion
 *
 * @example
 * ```ts
 * shortPath('/repo/src/index.ts'); // 'index.ts'
 * ```
 */
function shortPath(filePath: string,): string {
  return basename(filePath,);
}

/**
 * Extracts string field from untyped tool input.
 *
 * @param input - tool input record
 *
 * @param key - property name to extract
 *
 * @returns string value or `undefined` if absent or non-string
 *
 * @example
 * ```typescript
 * stringField({ input: { file_path: '/x.ts' }, key: 'file_path' }); // '/x.ts'
 * stringField({ input: { count: 3 }, key: 'count' }); // undefined
 * ```
 */
function stringField(
  {
    input,
    key,
  }: {
    input: GenericToolInput;
    key: string;
  },
): string | undefined {
  /** Property value read from the tool input; non-string shapes fall through to `undefined`. */
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
 * @returns extractor function compatible with `ToolTitleEntry.extract`
 *
 * @example
 * ```ts
 * const get = field('command');
 * get({ command: 'ls' }); // 'ls'
 * ```
 */
function field(key: string,): (input: GenericToolInput,) => string | undefined {
  return function extractField(input: GenericToolInput,) {
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
 * const fmt = pathFormat({ pre: 'Reading', post: 'Read' });
 * fmt('/repo/x.ts', 'pre'); // 'Reading x.ts'
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
 * const fmt = quotedFormat({ pre: 'Searching', post: 'Searched' });
 * fmt('TODO', 'pre'); // 'Searching "TODO"'
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

/** Wrapper commands stripped together with the following argument token. */
const COMMAND_NOISE_WRAPPERS: ReadonlySet<string> = new Set([
  'timeout',
  'env',
  'nice',
  'nohup',
],);

/**
 * Whether `c` is ASCII whitespace as recognised by the shell-prefix stripper
 * (space or tab; tools rarely insert other whitespace at the command boundary).
 *
 * @param c - one-character string to inspect
 *
 * @returns whether `c` is a space or tab
 *
 * @example
 * ```ts
 * isShellWs(' ');  // true
 * isShellWs('a');  // false
 * ```
 */
function isShellWs(c: string,): boolean {
  return (c === ' ') || (c === '\t');
}

/**
 * Strips leading noise from a shell command: env-var assignments
 * (`FOO=bar`) and wrapper commands (`timeout 10`, `env`, `nice`, `nohup`)
 * with their argument token. Repeats until no more strippable prefix is
 * found at the cursor.
 *
 * Mirrors the original regex `/^(?:(?!-)\S+=\S*\s+|(?:timeout|env|nice|nohup)\s+\S+\s+)*\/`. Returns
 * the original string when the cursor still points at unstrippable input;
 * never throws.
 *
 * @param command - full bash command string
 *
 * @returns command with all matching noise prefixes removed
 *
 * @example
 * ```ts
 * stripCommandNoise('NODE_ENV=prod env timeout 5 ls -la');
 * // => '5 ls -la' (matches the legacy regex; `5` is treated as the timeout arg,
 * //               so the next pass sees `5` as the new leading token which is
 * //               not strippable)
 * ```
 */
function stripCommandNoise(command: string,): string {
  /**
   * Walks `command` forward to the first character that is NOT a strippable
   * prefix, returning the slice from that position to the end.
   *
   * @param idx - candidate scan offset (starts at 0)
   *
   * @returns slice of `command` after every matched prefix
   *
   * @example
   * ```ts
   * stripFrom(0); // '5 ls -la' for 'NODE_ENV=prod env timeout 5 ls -la'
   * ```
   */
  function stripFrom(idx: number,): string {
    if (idx >= command.length)
      return '';
    /**
     * Locates the exclusive end of the token starting at `at` (first whitespace).
     *
     * @param at - candidate scan offset
     *
     * @returns first whitespace index, or `command.length`
     *
     * @example
     * ```ts
     * findTokenEnd(0); // 13 for 'NODE_ENV=prod ...'
     * ```
     */
    function findTokenEnd(at: number,): number {
      if (at >= command.length)
        return at;
      if (isShellWs(command.charAt(at,),))
        return at;
      return findTokenEnd(at + 1,);
    }
    /**
     * Skips whitespace from `at`.
     *
     * @param at - candidate scan offset
     *
     * @returns first non-whitespace index, or `command.length`
     *
     * @example
     * ```ts
     * skipWs(13); // 14 for 'NODE_ENV=prod foo'
     * ```
     */
    function skipWs(at: number,): number {
      if (at >= command.length)
        return at;
      if (!isShellWs(command.charAt(at,),))
        return at;
      return skipWs(at + 1,);
    }
    /** Exclusive end of the candidate first token. */
    const tokenEnd = findTokenEnd(idx,);
    if (tokenEnd === idx)
      return command.slice(idx,);
    /** Position past the token's trailing whitespace; must advance for a match. */
    const afterTokenWs = skipWs(tokenEnd,);
    if (afterTokenWs === tokenEnd)
      return command.slice(idx,);
    /** Candidate first token. */
    const token = command.slice(
      idx,
      tokenEnd,
    );
    if ((!token.startsWith('-',)) && token.includes('=',))
      return stripFrom(afterTokenWs,);
    if (COMMAND_NOISE_WRAPPERS.has(token,)) {
      /** Exclusive end of the wrapper's argument token. */
      const argEnd = findTokenEnd(afterTokenWs,);
      if (argEnd === afterTokenWs)
        return command.slice(idx,);
      /** Position past the argument's trailing whitespace; required for the match. */
      const afterArgWs = skipWs(argEnd,);
      if (afterArgWs === argEnd)
        return command.slice(idx,);
      return stripFrom(afterArgWs,);
    }
    return command.slice(idx,);
  }
  return stripFrom(0,);
}

/**
 * Extracts first meaningful token from a bash command for display.
 *
 * @param command - full bash command string
 *
 * @returns shortened command representation
 *
 * @example
 * ```ts
 * shortCommand('NODE_ENV=prod env timeout 5 ls -la'); // '5 ls -la'
 * ```
 */
function shortCommand(command: string,): string {
  return stripCommandNoise(command,);
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
