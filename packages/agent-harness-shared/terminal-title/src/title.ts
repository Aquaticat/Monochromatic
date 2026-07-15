/**
 * Terminal title engine.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { TOOL_TITLE_ENTRY_MISSING, } from './sentinels.ts';
import {
  formatKnownToolTitle,
  lookupToolTitleEntry,
} from './title-resolution.ts';
import type {
  ToolTitleContext,
  ToolTitleInput,
  ToolTitleRegistry,
  ToolTitleTense,
  UnknownToolTitleFormatter,
} from './types.ts';

//region Unknown tools

/**
 * Generic unknown-tool fallback using lifecycle verbs.
 *
 * @param toolName - because raw unknown tool identity should remain visible
 *
 * @param tense - because running and completed unknown tools need distinct wording
 *
 * @returns generic unknown-tool title body
 *
 * @example
 * ```ts
 * genericUnknownToolTitle({ toolName: 'mcp__weather', input: {}, tense: 'pre', context: {} });
 * // 'Running mcp__weather'
 * ```
 */
function genericUnknownToolTitle(
  {
    toolName,
    tense,
  }: Parameters<UnknownToolTitleFormatter>[0],
): string {
  return `${tense === 'pre' ? 'Running' : 'Ran'} ${toolName}`;
}

//endregion Unknown tools

//region Tool title API

/**
 * Formats a tool title using host registry and unknown-tool fallback.
 *
 * @param registry - because known tool names differ by harness
 *
 * @param toolName - because event adapters extract tool identity from host events
 *
 * @param input - because formatters sample display fields from tool payloads
 *
 * @param tense - because pre and post events use different wording
 *
 * @param context - because hosts may supply cwd or related formatting context
 *
 * @param unknownToolTitle - because hosts may override generic unknown-tool behavior
 *
 * @returns formatted title body without host prefix
 *
 * @mutates registry - `lookupToolTitleEntry` delegates `Object.hasOwn` and may invoke proxy traps
 *
 * @example
 * ```ts
 * buildToolTitle({ registry, toolName: 'Read', input: { path: 'a.ts' }, tense: 'pre' });
 * ```
 */
function buildToolTitle(
  {
    registry,
    toolName,
    input,
    tense,
    context = {},
    unknownToolTitle = genericUnknownToolTitle,
  }: ForeignBorrowed<Readonly<{
    registry: ToolTitleRegistry;
    toolName: string;
    input: ToolTitleInput;
    tense: ToolTitleTense;
    context?: ToolTitleContext;
    unknownToolTitle?: UnknownToolTitleFormatter;
  }>>,
): string {
  /**
   * Formatter registered for the host tool name.
   */
  const entry = lookupToolTitleEntry({
    registry,
    toolName,
  },);
  if (((typeof entry) === 'symbol') && (entry === TOOL_TITLE_ENTRY_MISSING)) {
    return unknownToolTitle({
      toolName,
      input,
      tense,
      context,
    },);
  }
  return formatKnownToolTitle({
    entry,
    input,
    tense,
    context,
  },);
}

//endregion Tool title API

//region Prefixing API

/**
 * Adds host prefix to terminal title body.
 *
 * @param prefix - because each host has its own visual marker
 *
 * @param body - because event adapters produce host-specific title body text
 *
 * @returns prefixed terminal title text before output-boundary sanitizing
 *
 * @example
 * ```ts
 * buildTerminalTitle({ prefix: 'π', body: 'Reading src/index.ts' });
 * // 'π Reading src/index.ts'
 * ```
 */
function buildTerminalTitle(
  {
    prefix,
    body,
  }: Readonly<{
    prefix: string;
    body: string;
  }>,
): string {
  /**
   * Body text without leading or trailing whitespace.
   */
  const cleanBody = body.trim();
  if (cleanBody.length === 0)
    return prefix;
  return `${prefix} ${cleanBody}`;
}

/**
 * Formats and prefixes a tool title in one call.
 *
 * @param prefix - because host identity belongs at title front
 *
 * @param registry - because known tool names differ by harness
 *
 * @param toolName - because event adapters extract tool identity from host events
 *
 * @param input - because title entries inspect tool payloads
 *
 * @param tense - because tool lifecycle selects title voice
 *
 * @param context - because host adapters may provide cwd
 *
 * @param unknownToolTitle - because unknown-tool behavior can be customized
 *
 * @returns prefixed terminal title text before output-boundary sanitizing
 *
 * @mutates registry - `buildToolTitle` delegates `Object.hasOwn` and may invoke proxy traps
 *
 * @example
 * ```ts
 * buildToolTerminalTitle({ prefix: 'π', registry, toolName: 'bash', input: { command: 'npm test' }, tense: 'pre' });
 * ```
 */
function buildToolTerminalTitle(
  {
    prefix,
    registry,
    toolName,
    input,
    tense,
    context,
    unknownToolTitle,
  }: ForeignBorrowed<Readonly<{
    prefix: string;
    registry: ToolTitleRegistry;
    toolName: string;
    input: ToolTitleInput;
    tense: ToolTitleTense;
    context?: ToolTitleContext;
    unknownToolTitle?: UnknownToolTitleFormatter;
  }>>,
): string {
  /**
   * Optional arguments only included when present to satisfy exact optional property types.
   */
  const optionalBuildArgs = {
    ...(context === undefined ? {} : { context, }),
    ...(unknownToolTitle === undefined ? {} : { unknownToolTitle, }),
  };
  return buildTerminalTitle({
    prefix,
    body: buildToolTitle({
      registry,
      toolName,
      input,
      tense,
      ...optionalBuildArgs,
    },),
  },);
}

//endregion Prefixing API

export {
  buildTerminalTitle,
  buildToolTerminalTitle,
  buildToolTitle,
  genericUnknownToolTitle,
};
