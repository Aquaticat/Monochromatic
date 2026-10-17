/**
 Retain native outcomes once while independently checking current script-value use.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { caughtValueText } from '@monochromatic-dev/module-caught-value/ts';
import { convertNativeOutcome } from './native-script-value.mjs';
import { NativeReturnContractError } from './native-return-errors.ts';
import { currentReturnConversion } from './native-return-access.ts';
import type {
  NativeReturnConsumer,
  NativeReturnEntry,
  NativeReturnInput,
  NativeReturnInspection,
  NativeReturnInvocation,
  NativeReturnOutcome,
  NativeReturnOwner,
} from './native-return-types.ts';

export {
  NativeReturnContractError,
  UnsupportedScriptBindingError
} from './native-return-errors.ts';

//region Return validation precedes original native conversion

/**
 Diagnostics identify transitions without serializing borrowed arguments or results.
 */
const l = tagged({ tag: 'auto-mode-native-return-consumer' });

/**
 Check native outcome shape before matching its reserved call and converting its result.

 @param value - untrusted return from the fixed native runner

 @returns whether the runner returned the supported native call and result shape
 */
function isNativeReturn(value: unknown): value is NativeReturnOutcome {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('toolCall' in value))
    || (value.toolCall === null)
    || ((typeof value.toolCall) !== 'object')
    || (!('id' in value.toolCall))
    || (!('name' in value.toolCall))
    || ((typeof value.toolCall
      .id) !== 'string')
    || ((typeof value.toolCall
      .name) !== 'string')
    || (!('isError' in value))
    || ((typeof value.isError) !== 'boolean')
    || (!('result' in value))
    || (value.result === null)
    || ((typeof value.result) !== 'object')) return false;
  return true;
}

//endregion Return validation precedes original native conversion

//region Native completion captures conversion without introducing another asynchronous boundary

/**
 Retain and convert the original native return in the settlement continuation.

 @param invocation - original slot-owned execution record

 @param outcome - original native result before any later queued mutation

 @returns original validated native outcome

 @mutates invocation - records original outcome, terminal state, conversion count, and captured conversion

 @throws NativeReturnContractError when the native return shape or call association is invalid
 */
function retainNativeReturn({
  invocation,
  outcome
}: {
  readonly invocation: NativeReturnInvocation;
  readonly outcome: unknown;
}): NativeReturnOutcome {
  /**
   Captured state transitions have their own diagnostic boundary.
   */
  const rl = tagged({
    tag: retainNativeReturn.name,
    l
  });
  if ((!isNativeReturn(outcome)) || (outcome.toolCall
    .id
    !== invocation.call
    .id)
    || (outcome.toolCall
      .name
      !== invocation.call
      .name)) {
    /**
     Invalid returns remain inspectable without claiming native conversion succeeded.
     */
    const error = new NativeReturnContractError('Native pipeline returned an outcome for a different call or shape');
    invocation.state = 'invalid-return';
    invocation.failure = error;
    throw error;
  }
  invocation.outcome = outcome;
  invocation.state = 'returned';
  invocation.conversionCount++;
  try {
    /**
     Original native conversion runs synchronously before another microtask can alter the result.
     */
    const value: unknown = convertNativeOutcome({
      tool: invocation.tool,
      outcome
    });
    invocation.conversion = (typeof value) === 'string'
      ? Object.freeze({
        status: 'string',
        value,
        bytes: Buffer.byteLength(value)
      })
      : Object.freeze({
        status: 'unsupported',
        kind: value === null ? 'null' : typeof value
      });
  } catch (error) {
    invocation.conversion = Object.freeze({
      status: 'threw',
      error,
      messageAtCapture: caughtValueText(error)
    });
  }
  rl.debug(`retained native return with conversion ${invocation.conversion
    .status}`);
  return outcome;
}

//endregion Native completion captures conversion without introducing another asynchronous boundary

//region Original slots retain invocation state independently of live script access

/**
 Bind terminal-safe owner callbacks once for an original reached group.

 @param owner - fixed runner, original slot reader, and independent live-use guards

 @returns original invocation, script-value, and retained-inspection operations

 @throws NativeReturnContractError when owner callbacks are absent or an invocation violates custody

 @example
 ```ts
 const consumer = createNativeReturnConsumer({ runNative, getSlot, assertCurrent, assertReturnedMember });
 ```
 */
export function createNativeReturnConsumer(owner: NativeReturnOwner): NativeReturnConsumer {
  /**
   Group diagnostics retain the original binding boundary.
   */
  const rl = tagged({
    tag: createNativeReturnConsumer.name,
    l
  });
  /**
   Captured callable identities cannot be replaced through later owner mutation.
   */
  const {
    runNative,
    getSlot,
    assertCurrent,
    assertReturnedMember
  } = owner;
  if ([
    runNative,
    getSlot,
    assertCurrent,
    assertReturnedMember
  ].some(function isAbsent(value) { return (typeof value) !== 'function'; })) throw new NativeReturnContractError('Fixed native pipeline and original slot/currentness readers are required');
  /**
   Guard readers use the same fixed callable identities.
   */
  const fixedOwner = Object.freeze({
    runNative,
    getSlot,
    assertCurrent,
    assertReturnedMember
  });
  /**
   Reentrancy state belongs to this consumer, never its caller.
   */
  const entry = { active: false };
  rl.debug('binding original native return owner');

  /**
   Reserve native work while excluding synchronous callback reentry.

   @param slot - original slot whose invocation is being reserved

   @param call - original native invocation forwarded unchanged

   @param options - original invocation options forwarded unchanged

   @returns reserved invocation and initiated native work
   */
  function reserve({
    slot: handle,
    call,
    options,
    start = true
  }: NativeReturnInput & Readonly<{ start?: boolean }>): {
    readonly invocation: NativeReturnInvocation;
    readonly pending: unknown
  } {
    if (entry.active) throw new NativeReturnContractError('Native result consumer cannot reenter through synchronous callbacks');
    entry.active = true;
    /**
     This lexical scope ends before invoke awaits the native operation.
     */
    using reservation = {
      [Symbol.dispose]: function releaseEntry(): void {
        entry.active = false;
      }
    };
    assertCurrent();
    /**
     The original owner resolves this slot without manufacturing replacement state.
     */
    const slot = getSlot(handle);
    if (slot.native !== undefined) throw new NativeReturnContractError('Native slot already reserved its invocation');
    if ((call.id
      !== slot.call
      .id) || (call.name
        !== slot.call
        .name)) throw new NativeReturnContractError('Native call differs from its owned group slot');
    /**
     Reservation survives both synchronous and asynchronous native failures.
     */
    const usesStructuredOutput = Boolean(slot.tool
      .outputSchema);
    /**
     Original call and conversion selection remain fixed through native completion.
     */
    const invocation: NativeReturnInvocation = {
      identity: Object.freeze({}),
      state: 'running',
      call: Object.freeze({
        id: call.id,
        name: call.name
      }),
      tool: Object.freeze({
        name: slot.call
          .name,
        ...(usesStructuredOutput ? { outputSchema: true } : {})
      }),
      conversionCount: 0,
    };
    slot.native = invocation;
    try {
      return {
        invocation,
        pending: start ? runNative(
          call,
          options
        ) : undefined
      };
    }
    catch (error) {
      invocation.state = 'threw';
      invocation.failure = error;
      throw error;
    }
  }

  /** Reserve the actual call before preparation while permitting terminal capture after parent return. */
  function open(input: NativeReturnInput): NativeReturnEntry {
    const ol = tagged({ tag: open.name, l: rl });
    ol.debug('reserving original call for native preparation');
    const { invocation } = reserve({ ...input, start: false });
    function complete(outcome: unknown): NativeReturnOutcome {
      tagged({ tag: complete.name, l: ol }).debug('retaining original native phase completion');
      if (invocation.state !== 'running') throw new NativeReturnContractError('Native call already has a terminal outcome');
      return retainNativeReturn({ invocation, outcome });
    }
    function fail(error: unknown): void {
      tagged({ tag: fail.name, l: ol }).debug('retaining native phase failure');
      tagged({ tag: fail.name, l: ol }).debug(error);
      if (invocation.state === 'running') { invocation.state = 'threw'; invocation.failure = error; }
    }
    return Object.freeze({ complete, fail });
  }

  /**
   Retain an initiated operation's completion without consulting live-use readers.

   @param input - original slot, call, and native options

   @returns exact native outcome after capturing its conversion once

   @throws NativeReturnContractError when reservation, identity, or return shape is invalid
   */
  async function invoke(input: NativeReturnInput): Promise<NativeReturnOutcome> {
    /**
     Native lifecycle logs omit captured result values.
     */
    const il = tagged({
      tag: invoke.name,
      l: rl
    });
    /**
     The synchronous reservation ends before awaiting native work.
     */
    const {
      invocation,
      pending
    } = reserve(input);
    il.debug('reserved original native invocation');
    try {
      /**
       Retain completion directly after the original native await, even if the parent retired.
       */
      const outcome: unknown = await pending;
      return retainNativeReturn({
        invocation,
        outcome
      });
    } catch (error) {
      if (invocation.state === 'running') {
        invocation.state = 'threw';
        invocation.failure = error;
      }
      throw error;
    }
  }

  /**
   Read the original converted value while current ownership and member completion hold.

   @param slot - original slot whose completed outcome is being consumed

   @param outcome - exact retained native return, never an equal copied object

   @returns supported original string within the existing byte bound

   @throws NativeScriptValueGuardError when live use or supported binding checks fail
   */
  function valueFor({
    slot: handle,
    outcome
  }: {
    readonly slot: object;
    readonly outcome: unknown
  }): string {
    /**
     Ordinary native failures remain outside the code-owned guard boundary.
     */
    const conversion = currentReturnConversion({
      owner: fixedOwner,
      handle,
      outcome
    });
    if (conversion.status === 'threw') throw conversion.error;
    return conversion.value;
  }

  /**
   Inspect retained terminal evidence without checking live eligibility.

   @param handle - original slot whose retained state is requested

   @returns immutable view of retained state, never current-use authority
   */
  function inspect(handle: object): NativeReturnInspection {
    /**
     Original state remains inspectable after parent retirement.
     */
    const invocation = getSlot(handle)
      .native;
    return Object.freeze({
      retainedOnly: true,
      state: invocation?.state ?? 'uninvoked',
      identity: invocation?.identity,
      conversionCount: invocation?.conversionCount ?? 0,
      conversion: invocation?.conversion,
      failure: invocation?.failure
    });
  }
  return Object.freeze({
    open,
    invoke,
    valueFor,
    inspect
  });
}

//endregion Original slots retain invocation state independently of live script access
