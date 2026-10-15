/**
 Independent built consumers observe original native member lifecycle ownership. @module
 */
import { PreparedBatchContractError } from './native-input-seal-fixture.ts';

/**
 Independent SDK options expose borrowed values and synchronous forwarding callbacks.
 */
export type NativeOptions = Readonly<{
  tools: unknown;
  assistantMessage: unknown;
  context: unknown;
  signal: unknown;
  afterToolCall: unknown;
  onUpdate?: (partial: unknown) => unknown;
  beforeToolCall: (hook: unknown) => unknown;
}>;
/**
 Original preparation observes member progress and owns early turn release.
 */
export type NativePreparation = Readonly<{
  hook: unknown;
  call: unknown;
  memberState: {
    entered: boolean;
    preparationReleased: boolean
  };
  releasePreparation: () => void;
}>;
/**
 Fixture callbacks are independent of the implementation's declarations.
 */
type LifecycleControl = {
  wait: (ordinal: number) => unknown;
  start: (call: unknown) => unknown;
  finish: (result: unknown) => unknown;
  native: (
    call: unknown,
    options: NativeOptions
  ) => unknown;
  prepare: (input: NativePreparation) => unknown;
  releasePreparation: (ordinal: number) => unknown;
  releaseExecution: (ordinal: number) => unknown;
};
/**
 Consumer state records original object identities and callback order.
 */
type LifecycleFixture = Readonly<{
  call: object;
  result: object;
  hook: object;
  identities: Readonly<{
    executableTools: readonly object[];
    assistantMessage: object;
    context: object;
    signal: object;
    after: object
  }>;
  events: string[];
  failures: unknown[];
  blockReasons: string[];
  preparations: NativePreparation[];
  options: NativeOptions[];
  control: LifecycleControl;
  run: (overrides?: Readonly<Record<string, unknown>>) => Promise<unknown>;
}>;
/**
 Opaque invocation permits malformed native boundary probes without importing source contracts.
 */
type LifecycleModule = Readonly<{ runPreparedLifecycle: (input: Readonly<Record<string, unknown>>) => Promise<unknown> }>;
/**
 Verify the rebuilt native export before consumer invocation.

 @param value - rebuilt native module namespace

 @returns narrowed independent native lifecycle contract

 @throws Error when the native lifecycle export is absent
 */
function assertLifecycleModule(value: unknown): asserts value is LifecycleModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('runPreparedLifecycle' in value))
    || ((typeof value.runPreparedLifecycle) !== 'function')) throw new Error('Built prepared lifecycle export is unavailable');
}
/**
 Consumer loads only the rebuilt native artifact.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/prepared-lifecycle.ts',
  import.meta.url
).href);
assertLifecycleModule(loaded);
/**
 Explicit narrowing remains available to fixture function declarations.
 */
const lifecycle: LifecycleModule = loaded;

//region Disposable fixture capabilities preserve independently observable original ownership.
/**
 Create an independently controlled native member lifecycle.

 @returns original identities, event observations, and borrowed callback controls

 @example createLifecycleFixture();
 */
export function createLifecycleFixture(): LifecycleFixture {
  /**
   Original declared call stays separate from prepared hook input.
   */
  const call = {
    type: 'toolCall',
    id: 'one',
    name: 'tool',
    arguments: {}
  };
  /**
   Native result remains opaque and unfrozen.
   */
  const result = { original: 'result' };
  /**
   Original native preparation receives this exact hook identity.
   */
  const hook = { args: {} };
  /**
   Independent capabilities retain their original borrowed identities.
   */
  const identities = {
    executableTools: [{}],
    assistantMessage: {},
    context: {},
    signal: {},
    after: {}
  };
  /**
   Ordered observations remain local to this disposable consumer.
   */
  const events: string[] = [];
  /**
   Shared failure storage retains opaque thrown identities.
   */
  const failures: unknown[] = [];
  /**
   Complete-group block reasons remain independently observable.
   */
  const blockReasons: string[] = [];
  /**
   Original preparation inputs reveal retained closure ownership.
   */
  const preparations: NativePreparation[] = [];
  /**
   Native SDK options retain their original property presence and identities.
   */
  const options: NativeOptions[] = [];
  /**
   Fixture callbacks independently control every fallible lifecycle boundary.
   */
  const control: LifecycleControl = {
    wait() { 
      return undefined; 
    },
    start() { 
      return undefined; 
    },
    finish() { 
      return undefined; 
    },
    async native(
      _call,
      nativeOptions
    ) { 
      await nativeOptions.beforeToolCall(hook);
    return result; 
    },
    prepare(input) { 
      input.memberState
        .entered = true;
    input.releasePreparation();
    return undefined; 
    },
    releasePreparation() { 
      return undefined; 
    },
    releaseExecution() { 
      return undefined; 
    },
  };
  /**
   Invoke built lifecycle with disposable overrides and original callbacks.

   @param overrides - deliberately independent native boundary substitutions

   @returns original lifecycle outcome
   */
  function run(overrides: Readonly<Record<string, unknown>> = {}): Promise<unknown> {
    /**
     A noninitial member exposes accidental ordinal resets.
     */
    const declaredOrdinal = 3;
    return lifecycle.runPreparedLifecycle({
      call,
      ordinalByID: new Map([[
        'one',
        declaredOrdinal
      ]]),
      ...identities,
      failures,
      PreparedBatchContractError,
      waitForPreparation(ordinal: number) { 
        events.push(`wait:${ordinal}`);
      return control.wait(ordinal); 
      },
      releaseNextPreparation(ordinal: number) { 
        events.push(`release-preparation:${ordinal}`);
      return control.releasePreparation(ordinal); 
      },
      releaseNextExecution(ordinal: number) { 
        events.push(`release-execution:${ordinal}`);
      return control.releaseExecution(ordinal); 
      },
      onStart(input: unknown) { 
        events.push('start');
      return control.start(input); 
      },
      onFinish(input: unknown) { 
        events.push('finish');
      return control.finish(input); 
      },
      runToolCall(
        input: unknown,
        nativeOptions: NativeOptions
      ) { 
        events.push('native');
      options.push(nativeOptions);
      return control.native(
        input,
        nativeOptions
      ); 
      },
      prepareNativeMember(input: NativePreparation) { 
        events.push('prepare');
      preparations.push(input);
      return control.prepare(input); 
      },
      block(reason: string) { 
        events.push('block');
      blockReasons.push(reason); 
      },
      ...overrides,
    });
  }
  return {
    call,
    result,
    hook,
    identities,
    events,
    failures,
    blockReasons,
    preparations,
    options,
    control,
    run
  };
}
//endregion
