/**
 * Shared terminal title engine for agent harness integrations.
 *
 * Host-specific packages keep event mapping and side effects.
 * This package owns title entry semantics,
 * command and path display,
 * registry lookup,
 * prefix construction,
 * control sanitizing,
 * and terminal byte safety.
 *
 * @example
 * ```ts
 * import {
 *   buildToolTerminalTitle,
 *   pathTitleEntry,
 *   safeTerminalTitlePayload,
 * } from '@monochromatic-dev/agent-harness-shared-terminal-title';
 * ```
 *
 * @packageDocumentation
 */

//region Types

export {
  TOOL_TITLE_ENTRY_MISSING,
  TOOL_TITLE_FIELD_MISSING,
  TOOL_TITLE_TEXT_MISSING,
} from './sentinels.ts';
export type {
  FieldToolTitleEntry,
  StaticToolTitleEntry,
  TenseLabels,
  ToolTitleContext,
  ToolTitleEntry,
  ToolTitleFieldFormatInput,
  ToolTitleInput,
  ToolTitleRegistry,
  ToolTitleTense,
  ToolTitleWholeInputFormatInput,
  UnknownToolTitleFormatter,
  WholeInputToolTitleEntry,
} from './types.ts';

//endregion Types

//region Payload safety

export {
  GHOSTTY_IGNORED_TITLE_UTF8_BYTES,
  MAX_TERMINAL_TITLE_UTF8_BYTES,
} from './constants.ts';
export {
  safeTerminalTitlePayload,
  sanitizeTerminalTitleText,
  terminalTitleUtf8ByteLength,
} from './boundary.ts';

//endregion Payload safety

//region Formatting helpers

export { terminalTitleCommand, } from './command.ts';
export { terminalTitlePath, } from './path.ts';

//endregion Formatting helpers

//region Title entries

export {
  fieldTitleEntry,
  inputTitleEntry,
  pathTitleEntry,
  shellCommandTitleEntry,
  staticTitleEntry,
  textTitleEntry,
} from './entries.ts';

//endregion Title entries

//region Title engine

export {
  buildTerminalTitle,
  buildToolTerminalTitle,
  buildToolTitle,
  genericUnknownToolTitle,
} from './title.ts';
export {
  lookupToolTitleEntry,
  stringField,
} from './title-resolution.ts';

//endregion Title engine
