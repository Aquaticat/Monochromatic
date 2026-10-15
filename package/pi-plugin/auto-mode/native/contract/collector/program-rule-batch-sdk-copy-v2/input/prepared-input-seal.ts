/** Prepared input sealing preserves original bounded traversal and partial-freeze behavior. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';

/** Sealing diagnostics avoid logging original arguments or property values. */
const l = tagged({ tag: 'auto-mode-prepared-input-seal' });

//region Original iterative validation freezes each visited container before visiting its children.
/** Seal the original non-aliased input tree after native preparation finishes.
 @param input - original prepared argument tree

 @param PreparedBatchContractError - original dispatcher contract error constructor

 @returns original argument identity after bounded validation and freezing

 @throws Error when original tree, descriptor, prototype, or size requirements fail

 @example sealPreparedInput({ input, PreparedBatchContractError });
 */
export function sealPreparedInput({
  input,
  PreparedBatchContractError,
}: Readonly<{
  input: unknown;
  PreparedBatchContractError: new (message: string) => Error;
}>): unknown {
  /** Original sealing boundary labels traversal without exposing source values. */
  const sl = tagged({ tag: sealPreparedInput.name, l });
  sl.debug('sealing original prepared argument tree');
  /** Last-in first-out traversal retains original child and descriptor observation order. */
  const pending: unknown[] = [input];
  /** Every object may occur only once, including aliases without cycles. */
  const seen = new Set<object>();
  while (pending.length > 0) {
    /** Original primitive values need no traversal or freezing. */
    const value = pending.pop();
    if ((value === null) || (value === undefined) || ((typeof value) === 'string') || ((typeof value) === 'boolean')) continue;
    if (((typeof value) === 'number') && Number.isFinite(value)) continue;
    if (((typeof value) !== 'object') || seen.has(value)) throw new PreparedBatchContractError('Prepared input must be a non-aliased JSON-like tree');
    seen.add(value);
    if (seen.size > 10_000) throw new PreparedBatchContractError('Prepared input exceeds the declared tree bound');
    /** Original prototype identity separates plain objects and arrays from other objects. */
    const prototype: unknown = Object.getPrototypeOf(value);
    if (Array.isArray(value) ? prototype !== Array.prototype : (prototype !== Object.prototype) && (prototype !== null)) throw new PreparedBatchContractError('Prepared input has an unsupported prototype');
    if (Array.isArray(value) && (Reflect.ownKeys(value).length !== (value.length + 1))) throw new PreparedBatchContractError('Prepared input array is sparse or has extra properties');
    for (const key of Reflect.ownKeys(value)) {
      if ((typeof key) !== 'string') throw new PreparedBatchContractError('Prepared input has a symbol key');
      /** Descriptor inspection never invokes an ordinary accessor body. */
      const property = Object.getOwnPropertyDescriptor(value, key);
      if ((property === undefined) || (!Object.hasOwn(property, 'value'))) throw new PreparedBatchContractError('Prepared input has an accessor');
      if ((!property.enumerable) && (!(Array.isArray(value) && (key === 'length')))) throw new PreparedBatchContractError('Prepared input has hidden properties');
      /** Opaque descriptor values remain unvalidated until their original traversal turn. */
      const child: unknown = property.value;
      pending.push(child);
    }
    Object.freeze(value);
  }
  sl.debug('completed original prepared argument sealing');
  return input;
}
//endregion
