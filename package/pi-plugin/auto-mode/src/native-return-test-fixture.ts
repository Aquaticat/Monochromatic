/**
 Disposable native return owners exercise the copied consumer without live sessions or providers.

 @module
 */
import type {
  NativeReturnConsumer,
  NativeReturnOwner,
  NativeReturnSlot
} from './native-return-fixture-types.ts';

//region The built runtime supplies every behavior under test

/**
 Tests declare only the generated consumer interface they exercise.
 */
type NativeReturnModule = {
  /**
   Generated consumer retains the copied source contract.
   */
  readonly createNativeReturnConsumer: (owner: NativeReturnOwner) => NativeReturnConsumer;
  /**
   Original native custody error identity.
   */
  readonly NativeReturnContractError: new(message: string) => Error;
  /**
   Original unsupported-binding error identity.
   */
  readonly UnsupportedScriptBindingError: new(kind: string) => Error;
};

/**
 Require the copied runtime's callable exports before using its declared interface.

 @param value - original built module namespace

 @returns assertion narrowing to the copied native consumer interface

 @throws Error when a required consumer export is absent
 */
function assertNativeReturnModule(value: unknown): asserts value is NativeReturnModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createNativeReturnConsumer' in value))
    || ((typeof value.createNativeReturnConsumer) !== 'function')
    || (!('NativeReturnContractError' in value))
    || ((typeof value.NativeReturnContractError) !== 'function')
    || (!('UnsupportedScriptBindingError' in value))
    || ((typeof value.UnsupportedScriptBindingError) !== 'function')) throw new Error('Built native return exports are unavailable');
}

/**
 This is the generated consumer selected by the real native judgment.
 */
const built: unknown = await import(new URL(
  '../dist/native/contract/integration/native-batch/generated/native-return-consumer.mjs',
  import.meta.url
).href);
assertNativeReturnModule(built);
/**
 Tests share checked built callables, never source implementations.
 */
export const nativeReturn: NativeReturnModule = built;

//endregion The built runtime supplies every behavior under test

//region Each fixture owns its own lifetime, member, slot, and outcome

/**
 Mutable fixture state allows explicit retirement and incomplete-member contrasts.
 */
type ReturnFixtureState = {
  /**
   Live eligibility can retire while native work is pending.
   */
  current: boolean;
  /**
   Member completion remains independent of native result shape.
   */
  returned: boolean;
  /**
   Native execution must happen once per original slot.
   */
  invocations: number;
  /**
   Currentness reads expose accidental checks during retained completion.
   */
  currentChecks: number;
  /**
   Member reads expose accidental checks on ordinary tool errors.
   */
  memberChecks: number;
};

/**
 Original fixture references remain available for identity and mutation controls.
 */
export type NativeReturnFixture = {
  /**
   Generated runtime consumer under test.
   */
  readonly consumer: NativeReturnConsumer;
  /**
   Original owner callbacks used to check bootstrap identity capture.
   */
  readonly owner: NativeReturnOwner;
  /**
   Original invocation metadata.
   */
  readonly call: {
    readonly id: string;
    readonly name: string
  };
  /**
   Original slot handle.
   */
  readonly handle: object;
  /**
   Mutable slot belongs to this fixture alone.
   */
  readonly slot: NativeReturnSlot;
  /**
   Exact outcome remains mutable to prove conversion is captured once.
   */
  readonly outcome: {
    readonly toolCall: {
      readonly id: string;
      readonly name: string
    };
    isError: boolean;
    result: {
      content: {
        type: string;
        text: string
      }[];
      structuredContent?: unknown
    }
  };
  /**
   Original native options verify forwarding by identity.
   */
  readonly options: object;
  /**
   Independent fixture lifetime and execution observations.
   */
  readonly state: ReturnFixtureState;
};

/**
 Construct an isolated owner with independent lifetime and prepared-member checks.

 @param runNative - optional original native outcome or failure producer

 @param structured - whether this original tool declares structured output

 @returns disposable original references and generated runtime consumer

 @example
 ```ts
 const fixture = nativeReturnFixture();
 ```
 */
export function nativeReturnFixture({
  runNative,
  structured = false
}: {
  readonly runNative?: NativeReturnOwner['runNative'];
  readonly structured?: boolean
} = {}): NativeReturnFixture {
  /**
   Each test begins with independent live eligibility and member completion.
   */
  const state: ReturnFixtureState = {
    current: true,
    returned: true,
    invocations: 0,
    currentChecks: 0,
    memberChecks: 0
  };
  /**
   Original call identity values match the original native outcome.
   */
  const call = {
    id: 'original-call',
    name: 'read'
  };
  /**
   Original member handle must survive without replacement.
   */
  const member = {};
  /**
   Only this original handle can resolve the fixture slot.
   */
  const handle = {};
  /**
   Native options are forwarded without cloning or interpretation.
   */
  const options = {};
  /**
   Slot storage belongs to this original owner.
   */
  const slot: NativeReturnSlot = {
    call,
    tool: {
      name: call.name,
      ...(structured ? { outputSchema: true } : {})
    },
    member
  };
  /**
   Mutable native output proves conversion is retained at the return boundary.
   */
  const outcome: NativeReturnFixture['outcome'] = {
    toolCall: call,
    isError: false,
    result: { content: [{
      type: 'text',
      text: 'original text'
    }] }
  };
  /**
   Fixed callbacks expose each original ownership boundary independently.
   */
  const owner: NativeReturnOwner = {
    runNative: function nativeRun(
      originalCall,
      originalOptions
    ): unknown {
      state.invocations++;
      if ((originalCall !== call) || (originalOptions !== options)) throw new Error('Native invocation lost original argument identity');
      return runNative ? runNative(
        originalCall,
        originalOptions
      ) : outcome;
    },
    getSlot: function originalSlot(originalHandle): NativeReturnSlot {
      if (originalHandle !== handle) throw new Error('Foreign native slot handle');
      return slot;
    },
    assertCurrent: function originalCurrent(): void {
      state.currentChecks++;
      if (!state.current) throw new Error('Original parent retired');
    },
    assertReturnedMember: function originalMember(original): void {
      state.memberChecks++;
      if ((original !== member) || (!state.returned)) throw new Error('Original member has not returned');
    },
  };
  return {
    consumer: nativeReturn.createNativeReturnConsumer(owner),
    owner,
    call,
    handle,
    slot,
    outcome,
    options,
    state
  };
}

/**
 Capture an expected original thrown value, including primitive and nullish failures.

 @param action - consumer operation expected to throw or reject

 @returns original caught value for identity assertions

 @throws Error when the expected failure does not occur

 @example
 ```ts
 const caught = await nativeReturnFailure(function fail() { throw new Error('expected'); });
 ```
 */
export async function nativeReturnFailure(action: () => unknown): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected native return failure did not occur');
}

//endregion Each fixture owns its own lifetime, member, slot, and outcome
