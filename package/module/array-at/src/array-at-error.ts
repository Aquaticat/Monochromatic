/**
 * Aggregated runtime error for `arrayAt` and safe-integer proof helpers.
 *
 * @module
 */

import type {
  NonEmptyRuntimeArrayAtDiagnostics,
  RuntimeArrayAtDiagnostic,
} from './diagnostic-types.ts';

/**
 * Construction options for aggregated array-access error.
 *
 * @example
 * ```ts
 * declare const options: ArrayAtErrorOptions;
 * const error = new ArrayAtError(options);
 * ```
 */
export type ArrayAtErrorOptions = {
  readonly diagnostics: NonEmptyRuntimeArrayAtDiagnostics;
  readonly index: number;
  readonly length: number | undefined;
};

/**
 * Error carrying every independently actionable runtime diagnostic.
 *
 * Diagnostic order is intentionally not part of the interface. `message` joins
 * diagnostic messages with newlines so ordinary logs retain all evidence.
 * Category-specific metadata lives on each diagnostic; common call context
 * remains available as `index` and `length`.
 *
 * @example
 * ```ts
 * try {
 *   arrayAt({ array: [], index: 1.5, });
 * }
 * catch (error) {
 *   if (error instanceof ArrayAtError)
 *     Object.values(error.diagnostics);
 * }
 * ```
 */
export class ArrayAtError extends Error {
  /**
   * Runtime diagnostics detected for one operation.
   *
   * @example
   * ```ts
   * const codes = error.diagnostics.map(({ code, }) => code);
   * ```
   */
  readonly diagnostics: readonly RuntimeArrayAtDiagnostic[];

  /**
   * Requested index.
   *
   * @example
   * ```ts
   * const requested = error.index;
   * ```
   */
  readonly index: number;

  /**
   * Array length when operation included an array.
   *
   * Safe-integer proof helpers set this to `undefined` because they validate a
   * number without array context.
   *
   * @example
   * ```ts
   * const available = error.length;
   * ```
   */
  readonly length: number | undefined;

  /**
   * Creates aggregated array-access error.
   *
   * @param options - Non-empty diagnostics and shared operation context
   *
   * @example
   * ```ts
   * const error = new ArrayAtError({
   *   diagnostics: [diagnostic],
   *   index: 1.5,
   *   length: undefined,
   * });
   * ```
   */
  constructor({
    diagnostics,
    index,
    length,
  }: ArrayAtErrorOptions) {
    const frozenDiagnostics = Object.freeze([...diagnostics]);
    super(frozenDiagnostics.map(({ message, }) => message).join('\n'));
    this.name = 'ArrayAtError';
    this.diagnostics = frozenDiagnostics;
    this.index = index;
    this.length = length;
  }
}
