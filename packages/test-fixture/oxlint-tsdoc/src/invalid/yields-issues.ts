// Fixture: yield documentation violations.
// Expected violations:
//   tsdoc(require-yields): missing @yields on generator
//   tsdoc(require-yields-check): @yields on non-generator

/**
 * Generates numbers.
 */
function* missingYields(): Generator<number> {
  yield 1;
}

/**
 * Not a generator.
 *
 * @yields nothing
 */
function yieldsOnNonGenerator(): void {}

export {};
