/**
 * Shared terminal title formatting helpers for agent harness integrations.
 *
 * Host-specific packages keep event mapping,
 * tool-name registries,
 * prefixes,
 * and terminal side effects.
 * This package owns reusable title formatting primitives.
 *
 * @example
 * ```ts
 * import {
 *   field,
 *   formatToolTitle,
 *   pathFormat,
 *   prefixedTitle,
 * } from '@monochromatic-dev/module-terminal-title';
 * ```
 *
 * @packageDocumentation
 */

//region Types

export {
  FIELD_ABSENT,
  NO_STRING_FIELD,
  TOOL_TITLE_ENTRY_ABSENT,
} from './types.ts';
export type {
  TenseLabels,
  ToolArgs,
  ToolTitleEntry,
  ToolTitleRegistry,
  ToolTitleTense,
  UnknownToolTitleFormatter,
} from './types.ts';

//endregion Types

//region Output boundary

export {
  GHOSTTY_IGNORED_TITLE_UTF8_BYTES,
  MAX_TERMINAL_TITLE_UTF8_BYTES,
  terminalTitleUtf8ByteLength,
  truncateTerminalTitlePayload,
} from './boundary.ts';

//endregion Output boundary

//region Formatting

export {
  field,
  MAX_PATTERN_LENGTH,
  pathFormat,
  quotedFormat,
  shortPath,
  stringField,
  truncate,
} from './formatters.ts';

//endregion Formatting

//region Commands

export {
  shortCommand,
  stripCommandNoise,
} from './command.ts';

//endregion Commands

//region Titles

export {
  formatToolTitle,
  lookupToolTitleEntry,
  prefixedTitle,
} from './title.ts';

//endregion Titles
