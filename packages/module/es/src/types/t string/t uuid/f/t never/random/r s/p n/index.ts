import { $ as positional, } from '../p p/index.ts';

/**
 * Generates cryptographically secure random UUIDs using the Web Crypto API.
 *
 * Named parameter version of the UUID generator for consistency with other utilities
 * in the library, even though crypto.randomUUID takes no parameters.
 *
 * @param _options - Empty object (no parameters needed, provided for API consistency)
 *
 * @returns Cryptographically secure random UUID v4 string
 *
 * @throws Error If crypto.randomUUID is not available in the environment
 *
 * @example Basic usage
 * ```ts
 * $({}); // 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
 * $({}); // '9c1b5f7a-3e8d-4f2b-b5e4-7a3c9d1e6f8a'
 * ```
 *
 * @example With variable
 * ```ts
 * const uuid = $({});
 * console.log(uuid); // 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
 * ```
 */
export function $(_options?: Record<string, never>,): string {
  return positional();
}
