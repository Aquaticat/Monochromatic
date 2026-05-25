/**
 * CLI argv helpers for reconstructing pi's `--models` scope.
 *
 * @module
 */

//region Public API

/** Options for parsing `--models` from argv. */
export type ParseArgvModelsOptions = {
  /** Process arguments excluding or including executable prefix. */
  readonly argv: readonly string[];
};

/**
 * Parse pi's `--models` argument from an argv array.
 *
 * Supports `--models value` and `--models=value`, matching the documented comma-separated format.
 *
 * @param options - argv to inspect
 *
 * @returns cleaned patterns, or `undefined` when `--models` is absent
 *
 * @example
 * ```typescript
 * parseArgvModelPatterns({ argv: ['--models', 'claude-*,gpt-*'] });
 * ```
 */
export function parseArgvModelPatterns(
  options: ParseArgvModelsOptions,
): string[] | undefined {
  /** Inline `--models=value` argument, if present. */
  const inline = options.argv
    .find(function isInlineModelsArg(arg,) {
    return arg.startsWith('--models=',);
  },);
  if (inline !== undefined)
    return splitPatterns(inline.slice('--models='.length,),);

  /** Index of `--models` when supplied as a separate argument. */
  const modelsIndex = options.argv
    .indexOf('--models',);
  if (modelsIndex === (-1))
    return undefined;

  /** Value following `--models`. */
  const value = options.argv[modelsIndex + 1];
  if (value === undefined)
    return [];
  return splitPatterns(value,);
}

//endregion Public API

//region Internal helpers

/**
 * Split a comma-separated model pattern string.
 *
 * @param value - comma-separated model pattern string
 *
 * @returns cleaned model patterns
 */
function splitPatterns(
  value: string,
): string[] {
  return value
    .split(',',)
    .map(function trimPattern(pattern,) {
      return pattern.trim();
    },)
    .filter(function keepPattern(pattern,) {
      return pattern !== '';
    },);
}

//endregion Internal helpers
