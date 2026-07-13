import { String, } from './readonly-external.fixture.js';

/**
 * Calls external same-named lookalike rather than ECMAScript global String.
 *
 * @param value - Value passed to unavailable external implementation.
 *
 * @returns external text.
 */
export function externalStringLookalikeEffect(value: unknown,): string {
  return String(value,);
}
