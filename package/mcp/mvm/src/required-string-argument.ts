/**
 * Required MCP string argument validation.
 *
 * @module
 */

/**
 * Narrows required MCP tool argument to string without object coercion.
 *
 * @param value - Runtime argument value validated against string schema.
 *
 * @returns Validated primitive string.
 *
 * @throws When caller bypasses MCP schema validation with non-string value.
 *
 * @example
 * ```ts
 * requiredStringArgument('vm-name');
 * ```
 */
export function requiredStringArgument(value: unknown,): string {
  if ((typeof value) === 'string')
    return value;

  throw new TypeError('Required MCP tool argument must be a string.',);
}
