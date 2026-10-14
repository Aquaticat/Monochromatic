/**
 Retain native outcomes once while independently checking current script-value use.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { scriptValueGuard } from './script-value-guard.ts';
import { toScriptValue } from './native-script-value.mjs';
import { NativeReturnContractError, UnsupportedScriptBindingError } from './native-return-errors.ts';
import type {
  NativeReturnCall,
  NativeReturnConversion,
  NativeReturnInvocation,
  NativeReturnOutcome,
  NativeReturnOwner,
  NativeReturnSlot,
} from './native-return-types.ts';

export { NativeReturnContractError, UnsupportedScriptBindingError } from './native-return-errors.ts';

//region Return validation precedes original native conversion

/** Diagnostics identify transitions without serializing borrowed arguments or results. */
const l = tagged({ tag: 'auto-mode-native-return-consumer' });

/**
 Check native outcome identity and required result fields before conversion.

 @param value - untrusted return from the fixed native runner

 @param call - originally reserved call snapshot

 @returns whether the runner returned the reserved native call's supported shape
 */
function isNativeReturn({ value, call }: { readonly value: unknown; readonly call: NativeReturnCall }): value is NativeReturnOutcome {
  if ((value === null) || ((typeof value) !== 'object') || !('toolCall' in value)
    || (value.toolCall === null) || ((typeof value.toolCall) !== 'object')
    || !('id' in value.toolCall) || !('name' in value.toolCall)
    || (value.toolCall.id !== call.id) || (value.toolCall.name !== call.name)
    || !('isError' in value) || ((typeof value.isError) !== 'boolean')
    || !('result' in value) || (value.result === null) || ((typeof value.result) !== 'object')) return false;
  return true;
}

//endregion Return validation precedes original native conversion

//region Original slots retain invocation state independently of live script access

/**
 Bind terminal-safe owner callbacks once for an original reached group.

 @param runNative - fixed native runner, invoked outside the owner's public-operation lock

 @param getSlot - original slot reader, available after parent retirement

 @param assertCurrent - current-use guard, excluded from completed-return retention

 @param assertReturnedMember - independent prepared-member completion guard

 @returns original invocation, script-value, and retained-inspection operations

 @throws NativeReturnContractError when owner callbacks are absent or an invocation violates custody

 @example
 ```ts
 const consumer = createNativeReturnConsumer({ runNative, getSlot, assertCurrent, assertReturnedMember });
 ```
 */
export function createNativeReturnConsumer({ runNative, getSlot, assertCurrent, assertReturnedMember }: NativeReturnOwner) {
  /** Group diagnostics retain the original binding boundary. */
  const rl = tagged({ tag: createNativeReturnConsumer.name, l });
  if ([runNative, getSlot, assertCurrent, assertReturnedMember].some(function isAbsent(value) { return (typeof value) !== 'function'; })) throw new NativeReturnContractError('Fixed native pipeline and original slot/currentness readers are required');
  rl.debug('binding original native return owner');
  /** Synchronous callbacks cannot reserve another invocation through this consumer. */
  let entering = false;

  /**
   Reserve the original slot before starting native work and retain its terminal return.

   @param slot - original owner-issued slot handle

   @param call - native invocation whose identity must match that slot

   @param options - original native invocation options, forwarded unchanged

   @returns exact native outcome after capturing its conversion once

   @throws NativeReturnContractError when reservation, identity, or return shape is invalid
   */
  async function invoke({ slot: handle, call, options }: { readonly slot: object; readonly call: NativeReturnCall; readonly options?: unknown }): Promise<NativeReturnOutcome> {
    /** Native lifecycle logs omit captured result values. */
    const il = tagged({ tag: invoke.name, l: rl });
    if (entering) throw new NativeReturnContractError('Native result consumer cannot reenter through synchronous callbacks');
    entering = true;
    /** Reservation survives both synchronous and asynchronous native failures. */
    let invocation: NativeReturnInvocation | undefined;
    /** Native runner may complete synchronously or asynchronously. */
    let pending: unknown;
    try {
      assertCurrent();
      /** The original owner resolves this slot without manufacturing replacement state. */
      const slot = getSlot(handle);
      if (slot.native !== undefined) throw new NativeReturnContractError('Native slot already reserved its invocation');
      if ((call.id !== slot.call.id) || (call.name !== slot.call.name)) throw new NativeReturnContractError('Native call differs from its owned group slot');
      invocation = {
        identity: Object.freeze({}),
        state: 'running',
        call: Object.freeze({ id: call.id, name: call.name }),
        tool: Object.freeze({ name: slot.call.name, ...(slot.tool.outputSchema ? { outputSchema: true } : {}) }),
        conversionCount: 0,
      };
      slot.native = invocation;
      il.debug('reserved original native invocation');
      pending = runNative(call, options);
    } catch (error) {
      if (invocation) { invocation.state = 'threw'; invocation.failure = error; }
      throw error;
    } finally { entering = false; }
    /** Native completion remains retainable even when current-use guards would now fail. */
    let outcome: unknown;
    try { outcome = await pending; } catch (error) {
      invocation.state = 'threw';
      invocation.failure = error;
      throw error;
    }
    if (!isNativeReturn({ value: outcome, call: invocation.call })) {
      /** Invalid return diagnostics remain inspectable beside the reserved occurrence. */
      const error = new NativeReturnContractError('Native pipeline returned an outcome for a different call or shape');
      invocation.state = 'invalid-return';
      invocation.failure = error;
      throw error;
    }
    invocation.outcome = outcome;
    invocation.state = 'returned';
    invocation.conversionCount++;
    try {
      /** Native conversion alone determines the original result value or ordinary tool failure. */
      const value: unknown = toScriptValue(invocation.tool, outcome);
      invocation.conversion = typeof value === 'string'
        ? Object.freeze({ status: 'string', value, bytes: Buffer.byteLength(value) })
        : Object.freeze({ status: 'unsupported', kind: value === null ? 'null' : typeof value });
    } catch (error) {
      invocation.conversion = Object.freeze({ status: 'threw', error, messageAtCapture: error instanceof Error ? error.message : String(error) });
    }
    il.debug(`retained native return with conversion ${invocation.conversion.status}`);
    return outcome;
  }

  /**
   Read the original converted value only while current ownership and member completion hold.

   @param slot - original slot whose completed outcome is being consumed

   @param outcome - exact retained native return, never an equal copied object

   @returns supported original string within the existing byte bound

   @throws NativeScriptValueGuardError when live use or supported binding checks fail
   */
  function valueFor({ slot: handle, outcome }: { readonly slot: object; readonly outcome: unknown }): string {
    /** Script access retains its separate diagnostic boundary. */
    const vl = tagged({ tag: valueFor.name, l: rl });
    /** Captured slot metadata identifies a rejected call without replacing its failure. */
    let slot: NativeReturnSlot | undefined;
    /** Conversion narrowing occurs within the code-owned guard boundary. */
    let conversion: NativeReturnConversion;
    try {
      assertCurrent();
      slot = getSlot(handle);
      /** Only this slot's exact native outcome can release its captured conversion. */
      const invocation = slot.native;
      if (!invocation || (invocation.state !== 'returned') || (invocation.outcome !== outcome) || (invocation.conversion === undefined)) throw new NativeReturnContractError('Script value requires the exact native return for this owned slot');
      conversion = invocation.conversion;
      if (conversion.status !== 'threw') {
        if (conversion.status === 'unsupported') throw new UnsupportedScriptBindingError(conversion.kind);
        if (conversion.bytes > 65_536) throw new UnsupportedScriptBindingError('an oversized string');
        assertReturnedMember(slot.member);
      }
    } catch (error) { throw scriptValueGuard({ error, ...(slot === undefined ? {} : { call: slot.call }) }); }
    // Ordinary native tool failures remain outside the code-owned guard boundary.
    if (conversion.status === 'threw') throw conversion.error;
    vl.debug('released original supported script value');
    return conversion.value;
  }

  /**
   Inspect retained terminal evidence without checking live eligibility.

   @param handle - original slot whose retained state is requested

   @returns immutable view of retained invocation state, never current-use authority
   */
  function inspect(handle: object) {
    /** Original state remains inspectable after parent retirement. */
    const invocation = getSlot(handle).native;
    return Object.freeze({ retainedOnly: true, state: invocation?.state ?? 'uninvoked', identity: invocation?.identity, conversionCount: invocation?.conversionCount ?? 0, conversion: invocation?.conversion, failure: invocation?.failure });
  }
  return Object.freeze({ invoke, valueFor, inspect });
}

//endregion Original slots retain invocation state independently of live script access
