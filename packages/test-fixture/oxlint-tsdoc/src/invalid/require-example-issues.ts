// Fixture: exported functions without @example tags.
// Expected: tsdoc(require-example) violations.

/**
 * Directly exported function missing @example.
 *
 * @param a - first operand
 *
 * @param b - second operand
 *
 * @returns sum
 */
export function add(a: number, b: number,): number {
  return a + b;
}

/**
 * Specifier-exported function missing @example.
 *
 * @param name - greeting target
 *
 * @returns greeting string
 */
function greet(name: string,): string {
  return `Hello, ${name}!`;
}

/**
 * Exported default function missing @example.
 *
 * @param n - input number
 *
 * @returns negated value
 */
export default function negate(n: number,): number {
  return -n;
}

/**
 * Arrow function exported via const, missing @example.
 *
 * @param n - number to double
 *
 * @returns doubled value
 */
export const double = function doubleImpl(n: number,): number {
  return n + n;
};

/**
 * Arrow function exported via specifier, missing @example.
 *
 * @param s - input string
 *
 * @returns uppercased string
 */
const shout = function shoutImpl(s: string,): string {
  return s.toUpperCase();
};

export {
  greet,
  shout,
};
