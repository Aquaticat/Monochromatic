//region Stable error identities retain native Error message and cause construction.
/** Failure of original judgment lifetime or transport accounting. */
export class JudgmentBudgetError extends Error {
  /** Diagnostic identity remains stable when the implementation is renamed. */
  name = 'JudgmentBudgetError';
}

/** Original preparation-inclusive decision deadline expired. */
export class JudgmentDeadlineError extends JudgmentBudgetError {
  /** Distinguish deadline expiry from other budget failures. */
  name = 'JudgmentDeadlineError';
}

/** Original judgment cancellation prevents another attempt. */
export class JudgmentCancelledError extends JudgmentBudgetError {
  /** Preserve the cancellation classification through aggregate failures. */
  name = 'JudgmentCancelledError';
}

/** Original client-attempt allowance has been consumed. */
export class JudgmentAttemptLimitError extends JudgmentBudgetError {
  /** Distinguish attempt exhaustion from an elapsed deadline. */
  name = 'JudgmentAttemptLimitError';
}
//endregion
