/**
 Original script-value access checks live eligibility independently of retained conversion.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { NativeReturnContractError, UnsupportedScriptBindingError } from './native-return-errors.ts';
import { scriptValueGuard } from './script-value-guard.ts';
import type { NativeReturnConversion, NativeReturnOwner, NativeReturnSlot } from './native-return-types.ts';

//region Live script access preserves original guard and native failure boundaries

/** Existing supported-string bound counts UTF-8 bytes rather than code units. */
const MAX_SCRIPT_VALUE_BYTES = 65_536;

/** Diagnostics never expose original result text. */
const l = tagged({ tag: 'auto-mode-native-return-access' });

/**
 Resolve current ownership before attaching a call to a result guard.

 @param owner - original fixed slot and currentness readers

 @param handle - original owner-issued slot handle

 @returns current original slot
 */
function currentSlot({ owner, handle }: { readonly owner: NativeReturnOwner; readonly handle: object }): NativeReturnSlot {
  try {
    owner.assertCurrent();
    return owner.getSlot(handle);
  } catch (error) { throw scriptValueGuard({ error }); }
}

/**
 Read the original conversion only after live ownership and member guards pass.

 @param owner - original owner whose currentness and member completion remain independent

 @param handle - original slot being consumed

 @param outcome - exact original native return

 @returns captured conversion, preserving ordinary native failures outside the guard boundary

 @throws NativeScriptValueGuardError when currentness, outcome identity, or supported modality fails

 @example
 ```ts
 const conversion = currentReturnConversion({ owner, handle, outcome });
 ```
 */
export function currentReturnConversion({ owner, handle, outcome }: {
  readonly owner: NativeReturnOwner;
  readonly handle: object;
  readonly outcome: unknown;
}): Exclude<NativeReturnConversion, { readonly status: 'unsupported' }> {
  /** Original live-access operation has its own diagnostic tag. */
  const rl = tagged({ tag: currentReturnConversion.name, l });
  /** Currentness failure has no captured slot metadata to attach. */
  const slot = currentSlot({ owner, handle });
  try {
    /** Exact native return membership remains independent of conversion shape. */
    const { native: invocation } = slot;
    if (!invocation || (invocation.state !== 'returned') || (invocation.outcome !== outcome) || (invocation.conversion === undefined)) throw new NativeReturnContractError('Script value requires the exact native return for this owned slot');
    /** Native conversion occurred once when its original outcome returned. */
    const { conversion } = invocation;
    if (conversion.status === 'threw') return conversion;
    if (conversion.status === 'unsupported') throw new UnsupportedScriptBindingError(conversion.kind);
    if (conversion.bytes > MAX_SCRIPT_VALUE_BYTES) throw new UnsupportedScriptBindingError('an oversized string');
    owner.assertReturnedMember(slot.member);
    rl.debug('released original supported script conversion');
    return conversion;
  } catch (error) { throw scriptValueGuard({ error, call: slot.call }); }
}

//endregion Live script access preserves original guard and native failure boundaries
