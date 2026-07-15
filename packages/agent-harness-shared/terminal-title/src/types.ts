/**
 * Terminal title engine types.
 *
 * @module
 */

import type { TOOL_TITLE_TEXT_MISSING, } from './sentinels.ts';

//region Shared title shapes

/**
 * Tool title tense used around agent harness tool lifecycles.
 *
 * @example
 * ```ts
 * const tense: ToolTitleTense = 'pre';
 * ```
 */
type ToolTitleTense = 'pre' | 'post';

/**
 * Read-only tool input bag sampled by title entries.
 *
 * @example
 * ```ts
 * const input: ToolTitleInput = { path: '/tmp/example.ts' };
 * ```
 */
type ToolTitleInput = Readonly<Record<string, unknown>>;

/**
 * Labels used by lifecycle-aware title entries.
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
 * Context supplied by host adapters while formatting titles.
 *
 * @example
 * ```ts
 * const context: ToolTitleContext = { cwd: '/workspace' };
 * ```
 */
type ToolTitleContext = {
  /**
   * Current working directory for smart relative path titles when host exposes it.
   */
  readonly cwd?: string;
};

//endregion Shared title shapes

//region Entry formatter inputs

/**
 * Input passed to field-based title formatters.
 *
 * @example
 * ```ts
 * const input: ToolTitleFieldFormatInput = {
 *   context: {},
 *   input: {},
 *   tense: 'pre',
 *   value: 'index.ts',
 * };
 * ```
 */
type ToolTitleFieldFormatInput = {
  /**
   * Extracted field value.
   */
  readonly value: string;

  /**
   * Complete tool input for formatters needing additional context.
   */
  readonly input: ToolTitleInput;

  /**
   * Requested lifecycle tense.
   */
  readonly tense: ToolTitleTense;

  /**
   * Host-supplied title context.
   */
  readonly context: ToolTitleContext;
};

/**
 * Input passed to whole-input title formatters.
 *
 * @example
 * ```ts
 * const input: ToolTitleWholeInputFormatInput = {
 *   context: {},
 *   input: { questions: [] },
 *   tense: 'post',
 * };
 * ```
 */
type ToolTitleWholeInputFormatInput = {
  /**
   * Complete tool input for entry-specific extraction.
   */
  readonly input: ToolTitleInput;

  /**
   * Requested lifecycle tense.
   */
  readonly tense: ToolTitleTense;

  /**
   * Host-supplied title context.
   */
  readonly context: ToolTitleContext;
};

//endregion Entry formatter inputs

//region Entry model

/**
 * Tool title entry that always resolves to lifecycle labels.
 *
 * @example
 * ```ts
 * const entry: StaticToolTitleEntry = {
 *   kind: 'static',
 *   title: { pre: 'Listing tasks', post: 'Listed tasks' },
 * };
 * ```
 */
type StaticToolTitleEntry = {
  /**
   * Discriminant for static title entries.
   */
  readonly kind: 'static';

  /**
   * Lifecycle-specific title body.
   */
  readonly title: TenseLabels;
};

/**
 * Tool title entry that formats one named string field.
 *
 * @example
 * ```ts
 * const entry: FieldToolTitleEntry = {
 *   kind: 'field',
 *   field: 'path',
 *   fallback: { pre: 'Reading file', post: 'Read file' },
 *   format: ({ value }) => value,
 * };
 * ```
 */
type FieldToolTitleEntry = {
  /**
   * Discriminant for field-based title entries.
   */
  readonly kind: 'field';

  /**
   * String field read from raw tool input.
   */
  readonly field: string;

  /**
   * Lifecycle-specific fallback when field is absent or non-string.
   */
  readonly fallback: TenseLabels;

  /**
   * Formatter for extracted field text.
   */
  readonly format: (input: ToolTitleFieldFormatInput,) => string;
};

/**
 * Tool title entry that inspects complete tool input.
 *
 * @example
 * ```ts
 * const entry: WholeInputToolTitleEntry = {
 *   kind: 'input',
 *   fallback: { pre: 'Asking question', post: 'Asked question' },
 *   format: ({ input }) => String(input.question),
 * };
 * ```
 */
type WholeInputToolTitleEntry = {
  /**
   * Discriminant for whole-input title entries.
   */
  readonly kind: 'input';

  /**
   * Lifecycle-specific fallback when formatter cannot produce text.
   */
  readonly fallback: TenseLabels;

  /**
   * Formatter returning title text or sentinel to use fallback.
   */
  readonly format: (input: ToolTitleWholeInputFormatInput,) => string | typeof TOOL_TITLE_TEXT_MISSING;
};

/**
 * Terminal title entry for one known host tool.
 *
 * @example
 * ```ts
 * const entry: ToolTitleEntry = {
 *   kind: 'static',
 *   title: { pre: 'Stopping', post: 'Stopped' },
 * };
 * ```
 */
type ToolTitleEntry = StaticToolTitleEntry | FieldToolTitleEntry | WholeInputToolTitleEntry;

/**
 * Registry mapping host tool names to title entries.
 *
 * @example
 * ```ts
 * const registry: ToolTitleRegistry = { Bash: shellCommandTitleEntry({ field: 'command' }) };
 * ```
 */
type ToolTitleRegistry = Readonly<Record<string, ToolTitleEntry>>;

//endregion Entry model

//region Unknown tool fallback

/**
 * Callback used when a host sees a tool that is absent from its registry.
 *
 * @example
 * ```ts
 * const fallback: UnknownToolTitleFormatter = ({ toolName }) => toolName;
 * ```
 */
type UnknownToolTitleFormatter = (
  input: Readonly<{
    /**
     * Host-specific tool name from event payload.
     */
    toolName: string;

    /**
     * Tool input arguments supplied with event payload.
     */
    input: ToolTitleInput;

    /**
     * Tense requested by host event.
     */
    tense: ToolTitleTense;

    /**
     * Host-supplied title context.
     */
    context: ToolTitleContext;
  }>,
) => string;

//endregion Unknown tool fallback

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
};
