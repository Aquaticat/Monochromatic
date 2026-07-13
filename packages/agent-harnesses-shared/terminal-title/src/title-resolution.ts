/**
 * Terminal title registry lookup and known-entry resolution.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed';

import {
  TOOL_TITLE_ENTRY_MISSING,
  TOOL_TITLE_FIELD_MISSING,
  TOOL_TITLE_TEXT_MISSING,
} from './sentinels.ts';
import type {
  ToolTitleContext,
  ToolTitleEntry,
  ToolTitleInput,
  ToolTitleRegistry,
  ToolTitleTense,
} from './types.ts';

//region Registry lookup

/**
 * Looks up formatter entry for exact own tool name.
 *
 * @param registry - because each host owns its tool-name vocabulary
 *
 * @param toolName - because event adapters pass host-specific tool names
 *
 * @returns matching own registry entry or undefined
 *
 * @mutates registry - `Object.hasOwn` may invoke proxy `getOwnPropertyDescriptor` traps
 *
 * @example
 * ```ts
 * lookupToolTitleEntry({ registry, toolName: 'Read' });
 * ```
 */
function lookupToolTitleEntry(
  {
    registry,
    toolName,
  }: ForeignBorrowed<Readonly<{
    registry: ToolTitleRegistry;
    toolName: string;
  }>>,
): ToolTitleEntry | typeof TOOL_TITLE_ENTRY_MISSING {
  if (!Object.hasOwn(
    registry,
    toolName,
  ))
    return TOOL_TITLE_ENTRY_MISSING;
  return registry[toolName] ?? TOOL_TITLE_ENTRY_MISSING;
}

//endregion Registry lookup

//region Field extraction

/**
 * Extracts a string field from raw tool input.
 *
 * @param input - because tool payloads arrive as untyped records
 *
 * @param field - because field entries name one display-relevant value
 *
 * @returns string field value or undefined
 *
 * @example
 * ```ts
 * stringField({ input: { path: 'a.ts' }, field: 'path' });
 * // 'a.ts'
 * ```
 */
function stringField(
  {
    input,
    field,
  }: Readonly<{
    input: ToolTitleInput;
    field: string;
  }>,
): string | typeof TOOL_TITLE_FIELD_MISSING {
  /**
   * Candidate field value.
   */
  const value = input[field];
  if ((typeof value) === 'string')
    return value;
  return TOOL_TITLE_FIELD_MISSING;
}

//endregion Field extraction

//region Entry resolution

/**
 * Formats a known entry for requested lifecycle tense.
 *
 * @param entry - because registry lookup already found matching tool entry
 *
 * @param input - because entries can inspect tool payloads
 *
 * @param tense - because lifecycle verbs differ around tool execution
 *
 * @param context - because hosts may provide cwd or related formatting context
 *
 * @returns title body for known tool
 *
 * @example
 * ```ts
 * formatKnownToolTitle({ entry, input: {}, tense: 'pre', context: {} });
 * ```
 */
function formatKnownToolTitle(
  {
    entry,
    input,
    tense,
    context,
  }: Readonly<{
    entry: ToolTitleEntry;
    input: ToolTitleInput;
    tense: ToolTitleTense;
    context: ToolTitleContext;
  }>,
): string {
  if (entry.kind === 'static')
    return entry.title[tense];
  if (entry.kind === 'field') {
    /**
     * Extracted string field value.
     */
    const value = stringField({
      input,
      field: entry.field,
    },);
    if (((typeof value) === 'symbol') && (value === TOOL_TITLE_FIELD_MISSING))
      return entry.fallback[tense];
    return entry.format({
      value,
      input,
      tense,
      context,
    },);
  }
  /**
   * Whole-input formatter result.
   */
  const formatted = entry.format({
    input,
    tense,
    context,
  },);
  if (((typeof formatted) === 'symbol') && (formatted === TOOL_TITLE_TEXT_MISSING))
    return entry.fallback[tense];
  return formatted;
}

//endregion Entry resolution

export {
  formatKnownToolTitle,
  lookupToolTitleEntry,
  stringField,
};
