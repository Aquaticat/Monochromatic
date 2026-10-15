/**
 Independent built consumer contract for prepared completion and original error metadata. @module
 */

/**
 Opaque inputs keep original malformed-runtime observations independently testable.
 */
type CompletionInput = Readonly<{
  batchState?: unknown;
  failures?: unknown;
  settled?: unknown;
  snapshots?: unknown;
}>;
/**
 Consumers observe the original output envelope without implementation declarations.
 */
type CompletionResult = Readonly<{
  decision: unknown;
  assessmentCount: number;
  members: readonly unknown[];
  outcomes: readonly unknown[];
}>;
/**
 Original error diagnostics preserve native outcome and decision identities.
 */
type ExecutionError = Error & Readonly<{
  diagnosticRecord: Readonly<{
    outcomes: unknown;
    assessmentDecision: unknown
  }>;
}>;
/**
 Original constructor signatures remain independent from the new typed helper.
 */
type DispatcherModule = Readonly<{
  PreparedBatchContractError: new (message: string) => Error;
  PreparedBatchExecutionError: new (
    message: string,
    input: unknown
  ) => ExecutionError;
}>;
/**
 Built completion receives the original dispatcher constructors.
 */
type CompletionModule = Readonly<{
  completePreparedBatch: (input: CompletionInput & DispatcherModule) => CompletionResult;
}>;

/**
 Check the rebuilt completion export before invoking the independent consumer.

 @param value - built completion namespace

 @returns narrowed completion contract

 @throws Error when the built completion export is absent
 */
function assertCompletionModule(value: unknown): asserts value is CompletionModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('completePreparedBatch' in value))
    || ((typeof value.completePreparedBatch) !== 'function')) throw new Error('Built prepared completion export is unavailable');
}
/**
 Check the original error constructors without implementation declarations.

 @param value - built dispatcher namespace

 @returns narrowed original constructor contract

 @throws Error when either original error constructor is absent
 */
function assertDispatcherModule(value: unknown): asserts value is DispatcherModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('PreparedBatchContractError' in value))
    || ((typeof value.PreparedBatchContractError) !== 'function')
    || (!('PreparedBatchExecutionError' in value))
    || ((typeof value.PreparedBatchExecutionError) !== 'function')) throw new Error('Built prepared dispatcher errors are unavailable');
}
/**
 Completion is consumed only from the rebuilt native artifact.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/prepared-completion.ts',
  import.meta.url
).href);
assertCompletionModule(loaded);
/**
 Explicit contract preserves callable narrowing across the consumer wrapper.
 */
const completion: CompletionModule = loaded;
/**
 Dispatcher independently supplies both original error constructors.
 */
const dispatcher: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/prepared-dispatch.mjs',
  import.meta.url
).href);
assertDispatcherModule(dispatcher);
/**
 Original contract error identity remains available to consumer assertions.
 */
export const PreparedBatchContractError: DispatcherModule['PreparedBatchContractError'] = dispatcher.PreparedBatchContractError;
/**
 Original execution error identity and metadata remain available to consumer assertions.
 */
export const PreparedBatchExecutionError: DispatcherModule['PreparedBatchExecutionError'] = dispatcher.PreparedBatchExecutionError;

/**
 Complete a disposable native result using original constructors and fresh defaults.

 @param input - original completion state overrides

 @returns original frozen completion envelope

 @throws Error for original absent admission or retained failures

 @example complete();
 */
export function complete(input: CompletionInput = {}): CompletionResult {
  return completion.completePreparedBatch({
    batchState: { decision: { block: false } },
    failures: [],
    settled: [],
    snapshots: [],
    ...input,
    PreparedBatchContractError,
    PreparedBatchExecutionError,
  });
}
