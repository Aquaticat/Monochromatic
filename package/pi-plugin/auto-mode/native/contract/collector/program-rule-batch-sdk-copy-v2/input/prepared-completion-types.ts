/**
 Original prepared completion retains native outcome and failure identities. @module
 */

/**
 Native settlements expose their original branch payload without an unsafe rejection reason.
 */
export type PreparedNativeOutcome = Readonly<{
  status: 'fulfilled';
  value: unknown;
  reason?: never;
}> | Readonly<{
  status: 'rejected';
  reason: unknown;
  value?: never;
}>;

/**
 Original execution errors retain complete outcomes and the selected admission decision.
 */
export type PreparedExecutionFailure = Readonly<{
  failures: readonly unknown[];
  outcomes: readonly PreparedNativeOutcome[];
  assessmentDecision: unknown;
}>;

/**
 Completion observes the original mutable decision owner after every native member settles.
 */
export type PreparedCompletionInput = Readonly<{
  batchState: Readonly<{ decision?: unknown }>;
  failures: readonly unknown[];
  settled: readonly PreparedNativeOutcome[];
  snapshots: readonly (readonly unknown[])[];
  PreparedBatchContractError: new (message: string) => Error;
  PreparedBatchExecutionError: new (message: string, input: PreparedExecutionFailure) => Error;
}>;

/**
 Completion freezes its public envelope and outcome list while retaining original member snapshots.
 */
export type PreparedCompletion = Readonly<{
  decision: unknown;
  assessmentCount: number;
  members: readonly unknown[];
  outcomes: readonly unknown[];
}>;
