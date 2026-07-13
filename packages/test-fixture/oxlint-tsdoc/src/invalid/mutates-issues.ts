// Fixture: mutation-contract documentation violations.
// Expected violations:
//   tsdoc(check-mutates): missing target, missing description, unknown target, and duplicate target

/**
 * Mutates without naming target.
 *
 * @param value - Caller-owned state.
 *
 * @mutates - Changes caller-owned state.
 */
function missingTarget(value: { count: number; },): void {
  value.count++;
}

/**
 * Mutates without rationale.
 *
 * @param value - Caller-owned state.
 *
 * @mutates value
 */
function missingDescription(value: { count: number; },): void {
  value.count++;
}

/**
 * Names nonexistent target.
 *
 * @param value - Caller-owned state.
 *
 * @mutates other - Changes caller-owned state.
 */
function unknownTarget(value: { count: number; },): void {
  value.count++;
}

/**
 * Names one target twice.
 *
 * @param value - Caller-owned state.
 *
 * @mutates value - Changes caller-owned state.
 *
 * @mutates value - Changes it again.
 */
function duplicateTarget(value: { count: number; },): void {
  value.count++;
}

export {};
