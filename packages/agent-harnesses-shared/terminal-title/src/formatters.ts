/**
 * Shared terminal title formatter utilities.
 *
 * @module
 */

import { basename, } from 'node:path';

import {
  FIELD_ABSENT,
  type TenseLabels,
  type ToolArgs,
  type ToolTitleTense,
} from './types.ts';

//region Constants

/**
 * Maximum length for pattern and query strings displayed inside a title body.
 *
 * @example
 * ```ts
 * truncate({ value: 'x'.repeat(40), maxLength: MAX_PATTERN_LENGTH });
 * ```
 */
const MAX_PATTERN_LENGTH = 30;

//endregion Constants

//region Primitive formatters

/**
 * Truncates a string to specified maximum length,
 * appending an ellipsis when truncation is required.
 *
 * @param value - because terminal titles should stay compact
 * @param maxLength - because caller owns context-specific title budget
 *
 * @returns original string when it fits,
 * otherwise truncated text ending in an ellipsis
 *
 * @example
 * ```ts
 * truncate({ value: 'hello world', maxLength: 6 });
 * // 'hello…'
 * ```
 */
function truncate(
  {
    value,
    maxLength,
  }: Readonly<{
    value: string;
    maxLength: number;
  }>,
): string {
  if (value.length
    <= maxLength)
    return value;
  return `${
    value.slice(
      0,
      maxLength - 1,
    )
  }…`;
}

/**
 * Extracts the filename portion from a path.
 *
 * @param filePath - because titles need the most recognizable path segment
 *
 * @returns basename of absolute or relative path
 *
 * @example
 * ```ts
 * shortPath('/home/user/src/index.ts');
 * // 'index.ts'
 * ```
 */
function shortPath(filePath: string,): string {
  return basename(filePath,);
}

/**
 * Extracts a string field from untyped tool input.
 *
 * @param input - because tool inputs arrive through host event payloads
 * @param key - because each registry entry chooses one display-relevant field
 *
 * @returns field value when it is a string,
 * otherwise {@link FIELD_ABSENT}
 *
 * @example
 * ```ts
 * stringField({ input: { path: '/tmp/a.ts' }, key: 'path' });
 * // '/tmp/a.ts'
 * ```
 */
function stringField(
  {
    input,
    key,
  }: Readonly<{
    input: ToolArgs;
    key: string;
  }>,
): string | typeof FIELD_ABSENT {
  /**
   * Candidate field value read by key from the untyped input bag.
   */
  const value = input[key];
  if ((typeof value) === 'string')
    return value;
  return FIELD_ABSENT;
}

/**
 * Creates an extractor that reads one named string field from tool input.
 *
 * @param key - because registry entries should declare their display field once
 *
 * @returns extractor compatible with {@link import('./types.ts').ToolTitleEntry}
 *
 * @example
 * ```ts
 * const extractPath = field('path');
 * extractPath({ path: '/tmp/a.ts' });
 * // '/tmp/a.ts'
 * ```
 */
function field(key: string,): (input: ToolArgs,) => string | typeof FIELD_ABSENT {
  return (input: ToolArgs,): string | typeof FIELD_ABSENT => stringField({
    input,
    key,
  },);
}

/**
 * Builds a tense-aware path formatter.
 *
 * @param labels - because hosts choose present and past tense wording
 *
 * @returns formatter that combines tense label with {@link shortPath}
 *
 * @example
 * ```ts
 * const formatPath = pathFormat({ pre: 'Reading', post: 'Read' });
 * formatPath('/tmp/a.ts', 'pre');
 * // 'Reading a.ts'
 * ```
 */
function pathFormat(
  labels: TenseLabels,
): (
  value: string,
  tense: ToolTitleTense,
) => string {
  return (value: string, tense: ToolTitleTense,): string => `${labels[tense]} ${shortPath(value,)}`;
}

/**
 * Builds a tense-aware quoted pattern formatter.
 *
 * @param labels - because hosts choose present and past tense wording
 *
 * @returns formatter that truncates and quotes search text
 *
 * @example
 * ```ts
 * const formatQuery = quotedFormat({ pre: 'Searching', post: 'Searched' });
 * formatQuery('TODO', 'post');
 * // 'Searched "TODO"'
 * ```
 */
function quotedFormat(
  labels: TenseLabels,
): (
  value: string,
  tense: ToolTitleTense,
) => string {
  return (value: string, tense: ToolTitleTense,): string => `${labels[tense]} "${
    truncate({
      value,
      maxLength: MAX_PATTERN_LENGTH,
    },)
  }"`;
}

//endregion Primitive formatters

export {
  field,
  MAX_PATTERN_LENGTH,
  pathFormat,
  quotedFormat,
  shortPath,
  stringField,
  truncate,
};
