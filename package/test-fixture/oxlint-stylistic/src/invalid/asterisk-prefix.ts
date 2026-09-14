// Fixture: starred TSDoc for require-asterisk-prefix in never mode.
// Expected: one violation for every prefixed body line, including blank lines.

/**
 * Starred description.
 *
 * **Leading bold** remains literal content.
 *
 * *through* remains literal content.
 *
 * @example
 * ```ts
 * readValue();
 * ```
 */
function readValue(): string {
  return 'value';
}

/**
 * Nested declaration.
 */
const nested = {
  /**
   * Nested property description.
   */
  value: true,
};

export {
  nested,
  readValue,
};
