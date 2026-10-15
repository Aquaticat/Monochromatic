/**
 Prepared native wrappers borrow original execution ownership and queue turns. @module
 */

/**
 Original positional native execution arguments retain their exact opaque payload identities.
 */
export type PreparedExecutionArguments = [toolCallId: string, params: unknown, signal: unknown, onUpdate: unknown];

/**
 Context establishment remains owned by the original native execution helper.
 */
export type PreparedOwnedExecution = Readonly<{
  judgment: unknown;
  tool: object;
  args: PreparedExecutionArguments;
}>;

/**
 Wrapped native tools retain spread metadata and replace only their public execution callback.
 */
export type PreparedExecutableTool = Readonly<{
  execute: (...args: PreparedExecutionArguments) => Promise<unknown>;
}>;

/**
 Borrowed mutable failure state is shared with the original complete-group dispatcher.
 */
export type PreparedExecutableInput = Readonly<{
  tools: readonly object[];
  ordinalByID: ReadonlyMap<string, number>;
  serial: boolean;
  waitForTurn: (ordinal: number) => unknown;
  active: (stage: string) => unknown;
  failures: unknown[];
  batchState: { executionGuardFailed: boolean };
  executionJudgment: unknown;
  executeWithOwnedContext: (input: PreparedOwnedExecution) => unknown;
  NativeExecutionGuardError: abstract new (...args: never[]) => Error;
  PreparedBatchContractError: new (message: string) => Error;
}>;
