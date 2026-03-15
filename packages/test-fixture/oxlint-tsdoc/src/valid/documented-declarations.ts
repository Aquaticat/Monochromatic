// Fixture: documentable declarations with valid TSDoc.
// Expected: zero tsdoc rule violations.

/**
 * Adds two numbers.
 *
 * @param a - first operand
 *
 * @param b - second operand
 *
 * @returns sum of a and b
 */
function add(a: number, b: number,): number {
  return a + b;
}

/** Logs a message. */
function log(): void {}

/** Available directions. */
type Direction = 'up' | 'down' | 'left' | 'right';

/** Configuration shape. */
type Config = {
  /** Enables verbose logging. */
  debug: boolean;
};

/** Status codes. */
enum Status {
  /** Request succeeded. */
  Ok = 200,
  /** Resource not found. */
  NotFound = 404,
}

/** Maximum retry attempts. */
const MAX_RETRIES = 3;

export {
  add,
  type Config,
  type Direction,
  log,
  MAX_RETRIES,
  Status,
};
