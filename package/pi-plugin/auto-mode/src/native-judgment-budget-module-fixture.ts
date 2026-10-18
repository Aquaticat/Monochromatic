/**
 Checked consumer interface for the copied native judgment budget artifact.
 @module
 */

//region Runtime imports reach copied native output without adding that output to the source project.
/**
 Original attempt fields visible to a transport consumer.
 */
type BudgetAttempt = {
  readonly runBundle: <Result>(operations: readonly ((input: {
    readonly signal: AbortSignal;
    readonly targetAt: number;
    readonly attempt: number;
  })=>Promise<Result>)[])=>Promise<readonly Result[]>;
  /**
   Original cancellation lineage.
   */
  readonly signal: AbortSignal;
  /**
   Original absolute deadline.
   */
  readonly targetAt: number;
  /**
   Original judgment-wide invocation ordinal.
   */
  readonly attempt: number;
};

/**
 Retained diagnostics asserted by the consumer suites.
 */
type BudgetSnapshot = {
  readonly bundles: number;
  readonly calls: number;
  /**
   Consumed transport attempts.
   */
  readonly attempts: number;
  /**
   Whether the single original retry was consumed.
   */
  readonly retryUsed: boolean;
  /**
   Whether transport remains pending.
   */
  readonly running: boolean;
  /**
   Whether evidence collection has closed.
   */
  readonly finished: boolean;
  /**
   Whether a boundary failure permanently retired evidence.
   */
  readonly retired: boolean;
  /**
   Original attempt states in invocation order.
   */
  readonly records: readonly {readonly state: string}[];
};

/**
 Consumer operations exercise the original copied budget.
 */
export type NativeBudget = {
  /**
   Require the original lifetime and read remaining milliseconds.
   */
  readonly checkpoint: () => number;
  /**
   Dispatch without replacing the response type.
   */
  readonly dispatch: <Result>(operation: (attempt: BudgetAttempt) => Promise<Result>) => Promise<Result>;
  /**
   Permanently close evidence collection.
   */
  readonly finish: () => BudgetSnapshot;
  /**
   Read original retained accounting.
   */
  readonly diagnostics: () => BudgetSnapshot;
};

/**
 Native error constructors preserve standard message and cause inputs.
 */
type BudgetErrorConstructor = {
  /**
   Original exported error identity.
   */
  readonly name: string;
  /**
   Construct a diagnostic without changing its original cause.
   */
  new(
    message: string,
    options?: ErrorOptions
  ): Error;
};

/**
 Expected callable exports of the copied native module.
 */
type NativeBudgetModule = {
  /**
   Bind original time, cancellation and transport classification.
   */
  readonly createJudgmentBudget: (input: {
    readonly now: () => number;
    readonly signal: AbortSignal;
    readonly isRetryableTransportFailure: (error: unknown) => boolean;
  }) => NativeBudget;
  /**
   Shared original budget failure category.
   */
  readonly JudgmentBudgetError: BudgetErrorConstructor;
  /**
   Original deadline failure category.
   */
  readonly JudgmentDeadlineError: BudgetErrorConstructor;
  /**
   Original cancellation failure category.
   */
  readonly JudgmentCancelledError: BudgetErrorConstructor;
  /**
   Original attempt exhaustion category.
   */
  readonly JudgmentAttemptLimitError: BudgetErrorConstructor;
};

/**
 Require copied artifact exports before any test invokes their consumer contract.

 @param value - copied native module namespace

 @returns assertion narrowing to the tested original callables

 @throws Error when an expected original callable is missing
 */
function assertBudgetModule(value: unknown): asserts value is NativeBudgetModule {
  if((value===null)
    ||((typeof value)!=='object')
    ||(!('createJudgmentBudget' in value))
    ||((typeof value.createJudgmentBudget)!=='function')
    ||(!('JudgmentBudgetError' in value))
    ||((typeof value.JudgmentBudgetError)!=='function')
    ||(!('JudgmentDeadlineError' in value))
    ||((typeof value.JudgmentDeadlineError)!=='function')
    ||(!('JudgmentCancelledError' in value))
    ||((typeof value.JudgmentCancelledError)!=='function')
    ||(!('JudgmentAttemptLimitError' in value))
    ||((typeof value.JudgmentAttemptLimitError)!=='function')) {
    throw new Error('Built native judgment budget exports are unavailable');
  }
}

/**
 Runtime imports use the same copied module loaded by original native judgments.
 */
const built: unknown=await import(new URL(
  '../dist/native/contract/lifecycle/judgment-budget-error-occurrences/controls-private/candidate.ts',
  import.meta.url
)
  .href);
assertBudgetModule(built);
/**
 Checked original callables remain fixed throughout the consumer suites.
 */
export const nativeBudget: NativeBudgetModule=built;
//endregion
