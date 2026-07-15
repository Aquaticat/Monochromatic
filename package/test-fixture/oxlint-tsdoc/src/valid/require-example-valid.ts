// Fixture: exported functions with @example tags, and non-exported functions without.
// Expected: zero tsdoc(require-example) violations.

/**
 * Adds two numbers.
 *
 * @param a - first operand
 *
 * @param b - second operand
 *
 * @returns sum of a and b
 *
 * @example
 * ```ts
 * add(1, 2); // => 3
 * ```
 */
export function add(a: number, b: number,): number {
  return a + b;
}

/**
 * Multiplies two numbers.
 *
 * @param a - first operand
 *
 * @param b - second operand
 *
 * @returns product of a and b
 *
 * @example
 * ```ts
 * multiply(3, 4); // => 12
 * ```
 */
function multiply(a: number, b: number,): number {
  return a * b;
}

/**
 * Non-exported helper; no @example needed.
 *
 * @param value - input string
 *
 * @returns trimmed string
 */
function trim(value: string,): string {
  return value.trim();
}

/**
 * Internal function exempt from @example.
 *
 * @internal
 */
export function internalSetup(): void {}

/**
 * Inherited docs exempt from @example.
 *
 * {@inheritDoc multiply}
 */
export function wrappedMultiply(a: number, b: number,): number {
  return multiply(a, b,);
}

/**
 * Exported via specifier list with @example.
 *
 * @param name - greeting target
 *
 * @returns greeting string
 *
 * @example
 * ```ts
 * greet('World'); // => 'Hello, World!'
 * ```
 */
function greet(name: string,): string {
  return `Hello, ${name}!`;
}

/**
 * Arrow function assigned to const, exported with @example.
 *
 * @param n - number to double
 *
 * @returns doubled value
 *
 * @example
 * ```ts
 * double(5); // => 10
 * ```
 */
export const double = function doubleImpl(n: number,): number {
  return n + n;
};

export {
  greet,
  multiply,
};
