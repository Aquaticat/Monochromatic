/**
 * Domain-specific absence sentinels for terminal title engine.
 *
 * @module
 */

//region Absence sentinels

/**
 * Sentinel returned when a registry does not own requested tool entry.
 *
 * @example
 * ```ts
 * TOOL_TITLE_ENTRY_MISSING;
 * ```
 */
const TOOL_TITLE_ENTRY_MISSING: unique symbol = Symbol(
  'terminal-title/requested tool name has no registry entry',
);

/**
 * Sentinel returned when a field entry cannot read a string value.
 *
 * @example
 * ```ts
 * TOOL_TITLE_FIELD_MISSING;
 * ```
 */
const TOOL_TITLE_FIELD_MISSING: unique symbol = Symbol(
  'terminal-title/requested input field is not a string',
);

/**
 * Sentinel returned when a whole-input formatter cannot produce title text.
 *
 * @example
 * ```ts
 * TOOL_TITLE_TEXT_MISSING;
 * ```
 */
const TOOL_TITLE_TEXT_MISSING: unique symbol = Symbol(
  'terminal-title/whole input formatter produced no title text',
);

//endregion Absence sentinels

export {
  TOOL_TITLE_ENTRY_MISSING,
  TOOL_TITLE_FIELD_MISSING,
  TOOL_TITLE_TEXT_MISSING,
};
