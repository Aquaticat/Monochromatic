/**
 * Custom error classes for the key-helper daemon, so callers can distinguish
 * failure kinds by type rather than by string matching (PP4).
 *
 * @module
 */

/**
 * Base class for every error the daemon throws, letting a single `instanceof`
 * check catch all daemon-originated failures.
 *
 * @example
 * ```ts
 * try { ... } catch (e) { if (e instanceof KeyHelperError) { ... } }
 * ```
 */
export class KeyHelperError extends Error {
  /**
   * @param message - Human-readable description of what failed and why
   */
  constructor(message: string) {
    super(message);
    this.name = 'KeyHelperError';
  }
}

/**
 * Thrown when a key token in a combo string has no evdev key code mapping, so
 * the injection cannot be built and must not be sent half-formed.
 *
 * @example
 * ```ts
 * throw new UnknownKeyError('hyper');
 * ```
 */
export class UnknownKeyError extends KeyHelperError {
  /**
   * @param key - Offending token that was not found in the evdev key table
   */
  constructor(key: string) {
    super(`unknown key: ${key}`);
    this.name = 'UnknownKeyError';
  }
}
