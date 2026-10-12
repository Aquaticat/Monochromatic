/**
 Structural validation for internal policy facts, not evidence admission.

 @module
 */
import { Buffer, } from 'node:buffer';
import { isProxy, } from 'node:util/types';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

//region Closed data shapes prevent implicit evaluation of caller properties

/**
 Unsupported internal policy input.
 */
export class InstructionResolutionInputError extends Error {
  override readonly name = 'InstructionResolutionInputError';
}

/**
 Shared clause and authorization-requirement bound.
 */
export const POLICY_FACT_LIMIT = 256;

/**
 Independent UTF-8 bound for program-local identities.
 */
const POLICY_ID_MAX_BYTES = 256;

/**
 Structural validation logger.
 */
const l = tagged({ tag: 'auto-mode-policy-data', },);

/**
 Copy selected own data properties without evaluating getters or proxy traps.
 Shape validity supplies no authority, coverage or semantic admission.

 @param input - internal record to validate
 
 @param fields - supported field names fixed by calling code
 
 @returns owned field values
 
 @throws {@link InstructionResolutionInputError} for unsupported record shapes
 */
export function readPolicyRecord(
  {
    input,
    fields,
  }: {
    readonly input: unknown;
    readonly fields: readonly string[]
  },
): Readonly<Record<string, unknown>> {
  const rl = tagged({
    tag: readPolicyRecord.name,
    l,
  },);
  rl.debug('validating internal policy record',);
  if ((input === null) || ((typeof input) !== 'object')
    || isProxy(input,)
    || (Object.getPrototypeOf(input,) !== Object.prototype))
    throw new InstructionResolutionInputError('Policy facts require an ordinary non-proxy record',);
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(input,)) {
    if (((typeof key) !== 'string') || (!fields.includes(key,)))
      throw new InstructionResolutionInputError('Policy record contains an unsupported field',);
    const field = Object.getOwnPropertyDescriptor(
      input,
      key,
    );
    if ((field?.enumerable !== true) || (!Object.hasOwn(
      field,
      'value',
    )))
      throw new InstructionResolutionInputError('Policy facts must use enumerable data properties',);
    const value: unknown = field.value;
    result[key] = value;
  }
  return Object.freeze(result,);
}

/**
 Capture bounded dense array entries without evaluating accessors.

 @param input - internal sequence to validate
 
 @returns owned entries requiring their separate fact validation
 
 @throws {@link InstructionResolutionInputError} for unsupported arrays
 */
export function readPolicyArray(input: unknown,): readonly unknown[] {
  const rl = tagged({
    tag: readPolicyArray.name,
    l,
  },);
  rl.debug('validating internal policy array',);
  if (isProxy(input,) || (!Array.isArray(input,))
    || (Object.getPrototypeOf(input,) !== Array.prototype)
    || (input.length > POLICY_FACT_LIMIT)
    || (Reflect.ownKeys(input,)
      .length
      !== (input.length
      + 1)))
    throw new InstructionResolutionInputError('Policy facts require a bounded dense non-proxy array',);
  const entries: unknown[] = [];
  for (let index = 0; index < input.length; index++) {
    const entry = Object.getOwnPropertyDescriptor(
      input,
      String(index,),
    );
    if ((entry?.enumerable !== true) || (!Object.hasOwn(
      entry,
      'value',
    )))
      throw new InstructionResolutionInputError('Policy array contains a missing or accessor-backed entry',);
    const value: unknown = entry.value;
    entries.push(value,);
  }
  return Object.freeze(entries,);
}

/**
 Validate bounded rule identity without treating identity as authority.

 @param input - program-local identifier
 
 @returns identifier within existing UTF-8 bound
 
 @throws {@link InstructionResolutionInputError} for missing or oversized identities
 */
export function readPolicyIdentity(input: unknown,): string {
  if (((typeof input) !== 'string') || (input.length === 0)
    || (Buffer.byteLength(input,) > POLICY_ID_MAX_BYTES))
    throw new InstructionResolutionInputError('Policy fact identity is missing or exceeds its bound',);
  return input;
}

//endregion Closed data shapes
