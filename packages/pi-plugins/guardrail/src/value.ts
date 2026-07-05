/**
 * Shared value-shape helpers for pi guardrail.
 *
 * @module
 */

//region Object guards

/**
 * Returns whether value is a non-array object record.
 *
 * @param value - value to inspect
 *
 * @returns whether value can be treated as an object record
 *
 * @example
 * ```typescript
 * isRecord({ path: 'pnpm-lock.yaml' }); // true
 * ```
 */
function isRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return (value !== null)
    && ((typeof value) === 'object')
    && (!Array.isArray(value,));
}

//endregion Object guards

export { isRecord, };
