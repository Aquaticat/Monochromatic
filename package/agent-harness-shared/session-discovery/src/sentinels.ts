/**
 * Session discovery sentinel values.
 *
 * @module
 */

/**
 * Sentinel returned when no calling agent session mapping can be resolved.
 *
 * @example
 * ```ts
 * if (mapping === SESSION_NOT_FOUND) throw new Error('missing session');
 * ```
 */
const SESSION_NOT_FOUND: unique symbol = Symbol('agent-harnesses/session-not-found',);

export { SESSION_NOT_FOUND, };
