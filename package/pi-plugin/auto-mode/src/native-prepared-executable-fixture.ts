/**
 Independent native wrapper consumers borrow original guard and contract constructors. @module
 */
import { PreparedBatchContractError } from './native-prepared-completion-fixture.ts';

/**
 Native execution preserves the original judgment, definition, and mutable positional argument list.
 */
type OwnedInput = Readonly<{
  judgment: unknown;
  tool: unknown;
  args: unknown[]
}>;
/**
 Built wrapper metadata remains inspectable while native inputs remain opaque.
 */
type ExecutableTool = Readonly<Record<PropertyKey, unknown>> & Readonly<{
  execute: (
    id: string,
    params?: unknown,
    signal?: unknown,
    onUpdate?: unknown
  ) => Promise<unknown>;
}>;
/**
 Disposable native callbacks can fail independently of shared group state.
 */
type ExecutableControl = {
  active: () => unknown;
  waitForTurn: (ordinal: number) => unknown;
  execute: (input: OwnedInput) => unknown;
};
/**
 Independent fixtures expose only the native identities and observations asserted by consumers.
 */
type ExecutableFixture = Readonly<{
  original: Readonly<{ name: string; label: string }>;
  judgment: unknown;
  events: string[];
  invocations: OwnedInput[];
  failures: unknown[];
  batchState: { executionGuardFailed: boolean };
  control: ExecutableControl;
  wrap: (overrides?: Readonly<Record<string, unknown>>) => readonly ExecutableTool[];
}>;
/**
 The independent consumer accepts runtime probes without importing implementation declarations.
 */
type ExecutableModule = Readonly<{
  wrapPreparedTools: (input: Readonly<Record<string, unknown>>) => readonly ExecutableTool[];
}>;
/**
 Original context failures retain the native guard constructor and aggregate cause list.
 */
type GuardModule = Readonly<{
  NativeExecutionGuardError: new (input: Readonly<{
    errors: readonly unknown[];
    phase: string;
    toolCallId: string;
    toolName: string
  }>) => AggregateError;
}>;

/**
 Check the built wrapper before observing native lifecycle behavior.

 @param value - rebuilt wrapper namespace

 @returns narrowed independent wrapper contract

 @throws Error when the wrapper export is absent
 */
function assertExecutableModule(value: unknown): asserts value is ExecutableModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('wrapPreparedTools' in value))
    || ((typeof value.wrapPreparedTools) !== 'function')) throw new Error('Built prepared executable wrapper is unavailable');
}
/**
 Check original guard ownership without importing its implementation declarations.

 @param value - original native execution namespace

 @returns narrowed original guard constructor

 @throws Error when the original native guard constructor is absent
 */
function assertGuardModule(value: unknown): asserts value is GuardModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('NativeExecutionGuardError' in value))
    || ((typeof value.NativeExecutionGuardError) !== 'function')) throw new Error('Built native execution guard is unavailable');
}
/**
 Wrapper behavior is consumed from the rebuilt native artifact.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/prepared-executable.ts',
  import.meta.url
).href);
assertExecutableModule(loaded);
/**
 Explicit contract preserves narrowed callable ownership across fixture construction.
 */
const executable: ExecutableModule = loaded;
/**
 Guard identity comes from the original native execution owner.
 */
const guard: unknown = await import(new URL(
  '../dist/native/contract/lifecycle/execution-context-carrier/execute.mjs',
  import.meta.url
).href);
assertGuardModule(guard);
/**
 Original guard constructor remains available to consumer assertions.
 */
export const NativeExecutionGuardError: GuardModule['NativeExecutionGuardError'] = guard.NativeExecutionGuardError;

/**
 Construct disposable original native guard metadata for failure classification.

 @returns original native guard instance

 @example createGuard();
 */
export function createGuard(): AggregateError {
  return new NativeExecutionGuardError({
    errors: ['original native failure'],
    phase: 'entry',
    toolCallId: 'one',
    toolName: 'tool'
  });
}

/**
 Bind disposable wrapper inputs and retain each original native observation.

 @returns wrapper factory, mutable callback controls, and original shared lifecycle records

 @example createExecutableFixture();
 */
export function createExecutableFixture(): ExecutableFixture {
  /**
   Original tool metadata is copied while native execution receives this exact object.
   */
  const original = {
    name: 'tool',
    label: 'original tool'
  };
  /**
   Judgment identity remains opaque to the wrapping boundary.
   */
  const judgment = Object.freeze({ original: 'judgment' });
  /**
   Recorded lifecycle ordering contains no global mutable state.
   */
  const events: string[] = [];
  /**
   Original native argument tuples remain observable by identity.
   */
  const invocations: OwnedInput[] = [];
  /**
   Retained failures remain shared with the complete-group dispatcher.
   */
  const failures: unknown[] = [];
  /**
   Original guard state prevents later wrapper execution after a context failure.
   */
  const batchState = { executionGuardFailed: false };
  /**
   Native callback controls remain replaceable without global mocks.
   */
  const control: ExecutableControl = {
    active() { return undefined; },
    waitForTurn() { return undefined; },
    execute() { return 'native result'; },
  };
  /**
   Create wrapper snapshots with original callbacks and explicit disposable overrides.

   @param overrides - original group input replacements

   @returns independently consumed native wrappers
   */
  function wrap(overrides: Readonly<Record<string, unknown>> = {}): readonly ExecutableTool[] {
    return executable.wrapPreparedTools({
      tools: [original],
      ordinalByID: new Map([
        [
          'one',
          0
        ],
        [
          'two',
          1
        ]
      ]),
      serial: false,
      waitForTurn(ordinal: number) {
        events.push(`turn:${ordinal}`);
        return control.waitForTurn(ordinal);
      },
      active(stage: string) {
        events.push(stage);
        return control.active();
      },
      executeWithOwnedContext(input: OwnedInput) {
        events.push('execute');
        invocations.push(input);
        return control.execute(input);
      },
      failures,
      batchState,
      executionJudgment: judgment,
      ...overrides,
      NativeExecutionGuardError,
      PreparedBatchContractError,
    });
  }
  return {
    original,
    judgment,
    events,
    invocations,
    failures,
    batchState,
    control,
    wrap
  };
}
