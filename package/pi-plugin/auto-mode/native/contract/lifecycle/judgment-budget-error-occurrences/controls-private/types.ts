/**
 Original judgment accounting and transport contracts.
 @module
 */

//region Typed boundaries expose original lifetime and attempt accounting only.
/** One actual transport invocation within the original judgment. */
export type JudgmentAttempt = {
  /** Original caller cancellation. */
  readonly signal: AbortSignal;
  /** Preparation-inclusive absolute deadline. */
  readonly deadlineAt: number;
  /** Judgment-wide client invocation ordinal. */
  readonly attempt: number;
};

/** Transport completion preserves its original response type. */
export type JudgmentOperation<Result> = (input: JudgmentAttempt) => Promise<Result>;

/** Retained attempt outcome carries no execution permission. */
export type JudgmentAttemptRecord = {
  /** Original invocation ordinal. */
  readonly attempt: number;
  /** Whether this invocation follows a classified transport failure. */
  readonly retry: boolean;
  /** Current retained outcome for this invocation. */
  readonly state: 'started' | 'failed' | 'discarded' | 'succeeded';
  /** Original failure value, when present. */
  readonly error?: unknown;
};

/** Immutable diagnostics never renew lifetime or replenish attempts. */
export type JudgmentBudgetSnapshot = {
  /** Original first clock reading. */
  readonly startedAt: number;
  /** Original absolute expiry. */
  readonly deadlineAt: number;
  /** Consumed client invocations. */
  readonly attempts: number;
  /** Whether the judgment's single retry has been used. */
  readonly retryUsed: boolean;
  /** Whether an original transport operation is pending. */
  readonly running: boolean;
  /** Whether evidence collection closed successfully. */
  readonly finished: boolean;
  /** Whether a boundary failure permanently retired this budget. */
  readonly retired: boolean;
  /** Original retained attempt records in invocation order. */
  readonly records: readonly JudgmentAttemptRecord[];
};

/** Fixed clock and transport dependencies come from original bootstrap code. */
export type JudgmentBudgetInput = {
  /** Original monotonic clock. */
  readonly now: () => number;
  /** Original caller cancellation. */
  readonly signal: AbortSignal;
  /** Fixed classification of actual transport failures. */
  readonly isRetryableTransportFailure: (error: unknown) => boolean;
};

/** Owned budget operations expose no renewal or reset capability. */
export type JudgmentBudget = {
  /** Recheck original lifetime and return remaining milliseconds. */
  readonly checkpoint: () => number;
  /** Run original transport under shared attempt and lifetime limits. */
  readonly dispatch: <Result>(operation: JudgmentOperation<Result>) => Promise<Result>;
  /** Close evidence collection after a final lifetime check. */
  readonly finish: () => JudgmentBudgetSnapshot;
  /** Inspect retained state without extending its lifetime. */
  readonly diagnostics: () => JudgmentBudgetSnapshot;
};
//endregion
