// Fixture: parameter documentation violations.
// Expected violations:
//   tsdoc(check-param-names): mismatched param name
//   tsdoc(require-param): missing @param tags
//   tsdoc(require-param-description): @param without description

/**
 * @param x - wrong name
 */
function mismatchedParam(value: string,): void {}

/**
 * Adds numbers.
 */
function missingAllParams(a: number, b: number,): void {}

/**
 * @param a - first
 */
function missingSecondParam(a: number, b: number,): void {}

/**
 * @param name
 */
function paramWithoutDescription(name: string,): void {}

export {};
