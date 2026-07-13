/**
 * Terminal title entry builders.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed';

import { terminalTitleCommand, } from './command.ts';
import {
  lifecycleValueTitle,
  missingValueFallback,
} from './entry-format.ts';
import { terminalTitlePath, } from './path.ts';
import type {
  FieldToolTitleEntry,
  TenseLabels,
  ToolTitleEntry,
  ToolTitleFieldFormatInput,
  WholeInputToolTitleEntry,
} from './types.ts';

//region Generic entry builders

/**
 * Builds a static lifecycle title entry.
 *
 * @param title - because some tools carry no display-relevant input
 *
 * @returns static title entry
 *
 * @example
 * ```ts
 * staticTitleEntry({ pre: 'Listing tasks', post: 'Listed tasks' });
 * ```
 */
function staticTitleEntry(title: TenseLabels,): ToolTitleEntry {
  return {
    kind: 'static',
    title,
  };
}

/**
 * Builds a field-based title entry.
 *
 * @param field - because host tool inputs use different field names
 *
 * @param fallback - because field may be absent or non-string
 *
 * @param format - because each entry owns its field display semantics
 *
 * @returns field title entry
 *
 * @example
 * ```ts
 * fieldTitleEntry({
 *   field: 'path',
 *   fallback: { pre: 'Reading file', post: 'Read file' },
 *   format: ({ value }) => value,
 * });
 * ```
 */
function fieldTitleEntry(
  {
    field,
    fallback,
    format,
  }: ForeignBorrowed<Readonly<{
    field: string;
    fallback: TenseLabels;
    format: (input: ToolTitleFieldFormatInput,) => string;
  }>>,
): FieldToolTitleEntry {
  return {
    kind: 'field',
    field,
    fallback,
    format,
  };
}

/**
 * Builds a whole-input title entry.
 *
 * @param fallback - because formatter may decline unrecognized input shapes
 *
 * @param format - because some tools need nested input extraction
 *
 * @returns whole-input title entry
 *
 * @example
 * ```ts
 * inputTitleEntry({
 *   fallback: { pre: 'Asking question', post: 'Asked question' },
 *   format: ({ input }) => String(input.question),
 * });
 * ```
 */
function inputTitleEntry(
  {
    fallback,
    format,
  }: ForeignBorrowed<Readonly<{
    fallback: TenseLabels;
    format: WholeInputToolTitleEntry['format'];
  }>>,
): WholeInputToolTitleEntry {
  return {
    kind: 'input',
    fallback,
    format,
  };
}

//endregion Generic entry builders

//region Specialized entry builders

/**
 * Builds a smart path title entry.
 *
 * @param field - because hosts use different path field names
 *
 * @param labels - because path title verbs differ by tool
 *
 * @param noun - because fallback text should name the missing object kind
 *
 * @returns field title entry for file-like paths
 *
 * @example
 * ```ts
 * pathTitleEntry({ field: 'file_path', labels: { pre: 'Reading', post: 'Read' }, noun: 'file' });
 * ```
 */
function pathTitleEntry(
  {
    field,
    labels,
    noun,
  }: Readonly<{
    field: string;
    labels: TenseLabels;
    noun: string;
  }>,
): FieldToolTitleEntry {
  return fieldTitleEntry({
    field,
    fallback: missingValueFallback({
      labels,
      noun,
    },),
    format({
      value,
      tense,
      context,
    },): string {
      return lifecycleValueTitle({
        labels,
        value: context.cwd === undefined
          ? terminalTitlePath({ filePath: value, },)
          : terminalTitlePath({
            filePath: value,
            cwd: context.cwd,
          },),
        tense,
      },);
    },
  },);
}

/**
 * Builds a raw text field title entry.
 *
 * @param field - because hosts use different value field names
 *
 * @param labels - because text title verbs differ by tool
 *
 * @param fallback - because field may be missing
 *
 * @returns field title entry for text values
 *
 * @example
 * ```ts
 * textTitleEntry({ field: 'query', labels: { pre: 'Searching', post: 'Searched' }, fallback: { pre: 'Searching', post: 'Searched' } });
 * ```
 */
function textTitleEntry(
  {
    field,
    labels,
    fallback,
  }: Readonly<{
    field: string;
    labels: TenseLabels;
    fallback: TenseLabels;
  }>,
): FieldToolTitleEntry {
  return fieldTitleEntry({
    field,
    fallback,
    format({
      value,
      tense,
    },): string {
      return lifecycleValueTitle({
        labels,
        value,
        tense,
      },);
    },
  },);
}

/**
 * Builds a shell command title entry.
 *
 * @param field - because command tools use host-specific input field names
 *
 * @returns field title entry for shell commands
 *
 * @example
 * ```ts
 * shellCommandTitleEntry({ field: 'command' });
 * ```
 */
function shellCommandTitleEntry(
  {
    field,
  }: Readonly<{
    field: string;
  }>,
): FieldToolTitleEntry {
  /**
   * Lifecycle labels for command execution.
   */
  const labels: TenseLabels = {
    pre: 'Running',
    post: 'Ran',
  };
  return fieldTitleEntry({
    field,
    fallback: missingValueFallback({
      labels,
      noun: 'command',
    },),
    format({
      value,
      tense,
    },): string {
      return lifecycleValueTitle({
        labels,
        value: terminalTitleCommand(value,),
        tense,
      },);
    },
  },);
}

//endregion Specialized entry builders

export {
  fieldTitleEntry,
  inputTitleEntry,
  pathTitleEntry,
  shellCommandTitleEntry,
  staticTitleEntry,
  textTitleEntry,
};
