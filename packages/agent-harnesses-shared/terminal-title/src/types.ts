/**
 * Shared terminal title types and sentinel values.
 *
 * @module
 */

//region Tool title shapes

/**
 * Tool title tense used by agent harnesses around a tool call lifecycle.
 *
 * `pre` describes work while it is running.
 * `post` describes work after it completes.
 *
 * @example
 * ```ts
 * const tense: ToolTitleTense = 'pre';
 * ```
 */
type ToolTitleTense = 'pre' | 'post';

/**
 * Read-only tool input bag sampled by title extractors.
 *
 * Tool schemas differ across harnesses and custom tool providers,
 * so shared extractors treat inputs as unknown string-keyed records.
 *
 * @example
 * ```ts
 * const args: ToolArgs = { path: '/tmp/example.ts' };
 * ```
 */
type ToolArgs = Readonly<Record<string, unknown>>;

/**
 * Labels used by tense-aware formatters.
 *
 * @example
 * ```ts
 * const labels: TenseLabels = { pre: 'Reading', post: 'Read' };
 * ```
 */
type TenseLabels = {
  /**
   * Label used while work is running.
   */
  readonly pre: string;

  /**
   * Label used after work completes.
   */
  readonly post: string;
};

/**
 * Sentinel returned when an extractor cannot find display text.
 *
 * A unique symbol keeps an empty string distinct from absence.
 * Consumers compare by identity and then use the entry fallback text.
 *
 * @example
 * ```ts
 * if (entry.extract(args) === FIELD_ABSENT) {
 *   return entry.fallback.pre;
 * }
 * ```
 */
const FIELD_ABSENT: unique symbol = Symbol('terminal-title/display-field-string-is-absent',);

/**
 * Compatibility alias for older pi terminal-title terminology.
 *
 * New shared code should prefer {@link FIELD_ABSENT}.
 *
 * @example
 * ```ts
 * NO_STRING_FIELD === FIELD_ABSENT;
 * ```
 */
const NO_STRING_FIELD: typeof FIELD_ABSENT = FIELD_ABSENT;

/**
 * Sentinel returned when a registry has no entry for a tool name.
 *
 * @example
 * ```ts
 * if (lookupToolTitleEntry({ registry, toolName }) === TOOL_TITLE_ENTRY_ABSENT) {
 *   return toolName;
 * }
 * ```
 */
const TOOL_TITLE_ENTRY_ABSENT: unique symbol = Symbol(
  'terminal-title/tool-title-entry-absent-from-registry',
);

/**
 * Formatter entry for one known tool.
 *
 * The extractor reads a display-relevant string from tool input.
 * The formatter applies tense-specific wording.
 * The fallback supplies text when the extractor returns {@link FIELD_ABSENT}.
 *
 * @example
 * ```ts
 * const entry: ToolTitleEntry = {
 *   extract: field('path'),
 *   format: pathFormat({ pre: 'Reading', post: 'Read' }),
 *   fallback: { pre: 'Reading file', post: 'Read file' },
 * };
 * ```
 */
type ToolTitleEntry = {
  /**
   * Extracts display text from raw tool input.
   */
  readonly extract: (input: ToolArgs,) => string | typeof FIELD_ABSENT;

  /**
   * Formats extracted display text for requested tense.
   */
  readonly format: (
    value: string,
    tense: ToolTitleTense,
  ) => string;

  /**
   * Text used when extraction returns {@link FIELD_ABSENT}.
   */
  readonly fallback: TenseLabels;
};

/**
 * Registry mapping host tool names to formatter entries.
 *
 * @example
 * ```ts
 * const registry: ToolTitleRegistry = { Bash: bashEntry };
 * ```
 */
type ToolTitleRegistry = Readonly<Record<string, ToolTitleEntry>>;

/**
 * Callback used when a host sees a tool that is not in its registry.
 *
 * pi uses tense-aware generic text,
 * while Claude Code preserves the raw unknown tool name.
 *
 * @example
 * ```ts
 * const fallback: UnknownToolTitleFormatter = ({ toolName }) => toolName;
 * ```
 */
type UnknownToolTitleFormatter = (
  input: Readonly<{
    /**
     * Host-specific tool name from the event.
     */
    toolName: string;

    /**
     * Tool input arguments supplied with the event.
     */
    args: ToolArgs;

    /**
     * Tense requested by the host event.
     */
    tense: ToolTitleTense;
  }>,
) => string;

//endregion Tool title shapes

export {
  FIELD_ABSENT,
  NO_STRING_FIELD,
  TOOL_TITLE_ENTRY_ABSENT,
};

export type {
  TenseLabels,
  ToolArgs,
  ToolTitleEntry,
  ToolTitleRegistry,
  ToolTitleTense,
  UnknownToolTitleFormatter,
};
