/**
 * Shared registry lookup and prefixed title construction.
 *
 * @module
 */

import { truncate, } from './formatters.ts';
import {
  FIELD_ABSENT,
  TOOL_TITLE_ENTRY_ABSENT,
  type ToolArgs,
  type ToolTitleEntry,
  type ToolTitleRegistry,
  type ToolTitleTense,
  type UnknownToolTitleFormatter,
} from './types.ts';

//region Registry lookup

/**
 * Looks up formatter entry for a tool name.
 *
 * @param registry - because each host owns its own tool-name vocabulary
 *
 * @param toolName - because event adapters pass host-specific tool names
 *
 * @returns matching formatter entry,
 * or {@link TOOL_TITLE_ENTRY_ABSENT} for unknown tools
 *
 * @example
 * ```ts
 * lookupToolTitleEntry({ registry: TOOL_TITLES, toolName: 'Read' });
 * ```
 */
function lookupToolTitleEntry(
  {
    registry,
    toolName,
  }: Readonly<{
    registry: ToolTitleRegistry;
    toolName: string;
  }>,
): ToolTitleEntry | typeof TOOL_TITLE_ENTRY_ABSENT {
  /**
   * Registry value for requested tool name,
   * or JavaScript `undefined` before conversion to the domain sentinel.
   */
  const entry = registry[toolName];
  if (entry === undefined)
    return TOOL_TITLE_ENTRY_ABSENT;
  return entry;
}

/**
 * Formats a tool title using host registry and unknown-tool fallback.
 *
 * @param registry - because known tool names differ by harness
 *
 * @param toolName - because event adapters extract tool identity from host events
 *
 * @param args - because formatters sample display fields from tool input
 *
 * @param tense - because pre and post events use different wording
 *
 * @param unknownToolTitle - because hosts intentionally differ for unknown tools
 *
 * @returns formatted title body without host prefix
 *
 * @example
 * ```ts
 * formatToolTitle({
 *   registry: TOOL_TITLES,
 *   toolName: 'Read',
 *   args: { file_path: '/tmp/a.ts' },
 *   tense: 'pre',
 *   unknownToolTitle: ({ toolName }) => toolName,
 * });
 * ```
 */
function formatToolTitle(
  {
    registry,
    toolName,
    args,
    tense,
    unknownToolTitle,
  }: Readonly<{
    registry: ToolTitleRegistry;
    toolName: string;
    args: ToolArgs;
    tense: ToolTitleTense;
    unknownToolTitle: UnknownToolTitleFormatter;
  }>,
): string {
  /**
   * Formatter registered for the host tool name.
   */
  const entry = lookupToolTitleEntry({
    registry,
    toolName,
  },);
  if (entry === TOOL_TITLE_ENTRY_ABSENT)
    return unknownToolTitle({
      toolName,
      args,
      tense,
    },);

  /**
   * Display value extracted from tool input.
   */
  const value = entry.extract(args,);
  if (value === FIELD_ABSENT)
    return entry.fallback[tense];
  return entry.format(
    value,
    tense,
  );
}

//endregion Registry lookup

//region Title construction

/**
 * Adds host prefix and enforces maximum terminal title length.
 *
 * @param prefix - because each host has its own visual marker
 *
 * @param body - because event adapters produce host-specific title body text
 *
 * @param maxLength - because terminal title length budget is host policy
 *
 * @returns prefixed and truncated terminal title
 *
 * @example
 * ```ts
 * prefixedTitle({ prefix: 'π', body: 'Reading index.ts', maxLength: 60 });
 * // 'π Reading index.ts'
 * ```
 */
function prefixedTitle(
  {
    prefix,
    body,
    maxLength,
  }: Readonly<{
    prefix: string;
    body: string;
    maxLength: number;
  }>,
): string {
  return truncate({
    value: `${prefix} ${body}`,
    maxLength,
  },);
}

//endregion Title construction

export {
  formatToolTitle,
  lookupToolTitleEntry,
  prefixedTitle,
};
