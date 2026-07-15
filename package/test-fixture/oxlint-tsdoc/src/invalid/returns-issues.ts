// Fixture: return documentation violations.
// Expected violations:
//   tsdoc(require-returns): missing @returns on value-returning function
//   tsdoc(require-returns-check): @returns on void/never function
//   tsdoc(require-returns-description): @returns without description

/**
 * Gets a name.
 */
function missingReturns(): string {
  return 'name';
}

/**
 * Logs output.
 *
 * @returns nothing
 */
function returnsOnVoid(): void {}

/**
 * Throws unconditionally.
 *
 * @returns never
 */
function returnsOnNever(): never {
  throw new Error('fail',);
}

/**
 * Gets count.
 *
 * @returns
 */
function returnsWithoutDescription(): number {
  return 42;
}

export {};
