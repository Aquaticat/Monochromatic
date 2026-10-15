/**
 Independent built consumer contract for original prepared call scheduling. @module
 */

/**
 Runtime admission deliberately accepts opaque values for malformed caller probes.
 */
type ScheduleInput = Readonly<{
  calls?: unknown;
  tools?: unknown;
  executionJudgment?: unknown;
  executionMode?: unknown;
}>;
/**
 Consumer snapshots expose only the observations asserted by these fixtures.
 */
type ScheduleResult = Readonly<{
  scheduled: readonly Readonly<{
    type: string;
    id: string;
    name: string;
    arguments: unknown
  }>[];
  serial: boolean;
}>;
/**
 Independent callable boundary does not import implementation types.
 */
type ScheduleModule = Readonly<{
  schedulePreparedCalls: (input: ScheduleInput & Readonly<{
    PreparedBatchContractError: new (message: string) => Error;
  }>) => ScheduleResult;
}>;
/**
 Original dispatcher owns the contract error identity.
 */
type DispatcherModule = Readonly<{ PreparedBatchContractError: new (message: string) => Error }>;

/** Check the built callable before binding the independent consumer.
 @param value - built schedule namespace
 *
 @throws Error when the built export is absent
 */
function assertScheduleModule(value: unknown): asserts value is ScheduleModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('schedulePreparedCalls' in value))
    || ((typeof value.schedulePreparedCalls) !== 'function')) throw new Error('Built prepared scheduling export is unavailable');
}
/** Check the original error constructor without implementation declarations.
 @param value - built dispatcher namespace
 *
 @throws Error when the original constructor is absent
 */
function assertDispatcherModule(value: unknown): asserts value is DispatcherModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('PreparedBatchContractError' in value))
    || ((typeof value.PreparedBatchContractError) !== 'function')) throw new Error('Built prepared dispatcher error is unavailable');
}
/**
 Scheduling is consumed from the rebuilt native artifact.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/prepared-schedule.ts',
  import.meta.url
).href);
assertScheduleModule(loaded);
/**
 Explicit contract preserves narrowing across the exported wrapper.
 */
const scheduling: ScheduleModule = loaded;
/**
 Error identity is independently loaded through the dispatcher.
 */
const dispatcher: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/prepared-dispatch.mjs',
  import.meta.url
).href);
assertDispatcherModule(dispatcher);
/**
 Original constructor is retained for consumer assertions.
 */
export const PreparedBatchContractError: new (message: string) => Error = dispatcher.PreparedBatchContractError;

/** Unused capabilities must never run during scheduling.
 @throws Error if scheduling invokes an execution capability
 */
export function unexpectedExecution(): never {
  throw new Error('Scheduling invoked an execution capability');
}
/** Build independent valid judgment support without any implementation import.
 @returns fresh judgment capabilities that must remain uninvoked
 */
export function judgment(): Record<string, unknown> {
  return {
    memberFor: unexpectedExecution,
    beginExecution: unexpectedExecution,
    executionFor: unexpectedExecution,
    finishExecution: unexpectedExecution
  };
}
/** Invoke the built scheduler using fresh defaults and explicit malformed overrides.
 @param input - disposable caller overrides
 *
 @returns original scheduled snapshots and queue selection
 *
 @throws Error for original admission or observation failures
 */
export function schedule(input: ScheduleInput = {}): ScheduleResult {
  return scheduling.schedulePreparedCalls({
    calls: [{
      type: 'toolCall',
      id: 'one',
      name: 'tool',
      arguments: { value: true }
    }],
    tools: [{
      name: 'tool',
      createExecutionContext: unexpectedExecution
    }],
    executionJudgment: judgment(),
    ...input,
    PreparedBatchContractError,
  });
}
