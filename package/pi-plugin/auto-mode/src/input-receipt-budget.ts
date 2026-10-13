/**
 Aggregate arithmetic for original instruction-input receipts.

 @module
 */
import { isProxy, } from 'node:util/types';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

//region Counter validation remains separate from native receipt ownership

/**
 Unsupported receipt counters or exceeded original aggregate budget.
 */
export class InputReceiptBudgetError extends Error {
  /**
   Diagnostic identity distinguishes source-budget refusal from policy resolution.
   */
  override readonly name = 'InputReceiptBudgetError';
}

/**
 Validated primitive counters copied from an original owner's usage record.
 */
type InputUsage = {
  /**
   Received occurrences, without equal-content deduplication.
   */
  readonly count: number;
  /**
   Serialized record bytes, including metadata and escaping.
   */
  readonly bytes: number;
};

/**
 Shared source occurrence bound across resource and Session owners.
 */
const INPUT_COUNT_LIMIT = 64;

/**
 Shared serialized-record bound, independent of per-source and resource limits.
 */
const INPUT_BYTE_LIMIT = 4_194_304;

/**
 Receipt-budget diagnostics never log input content.
 */
const l = tagged({ tag: 'auto-mode-input-receipt-budget', },);

/**
 Validate counter data without invoking getters or proxy traps.
 Non-enumerable data counters retain the original internal usage profile.

 @param input - usage record supplied by fixed native reader

 @returns owned primitive counters without source-authentication meaning

 @throws {@link InputReceiptBudgetError} for unsupported counter records
 */
function readInputUsage(input: unknown,): InputUsage {
  /**
   Keep counter-shape diagnostics within their validation boundary.
   */
  const rl = tagged({ tag: readInputUsage.name, l, },);
  rl.debug('validating original input usage counters',);
  if ((input === null) || (typeof input !== 'object') || isProxy(input,)
    || (Object.getPrototypeOf(input,) !== Object.prototype)
    || (Reflect.ownKeys(input,).length !== 2)) {
    rl.debug('input usage does not match the ordinary counter record profile',);
    throw new InputReceiptBudgetError('Native input usage requires its ordinary counter record',);
  }
  /**
   Inspect occurrence count without evaluating an accessor.
   */
  const count = Object.getOwnPropertyDescriptor(input, 'count',);
  /**
   Inspect serialized-record size independently of the count descriptor.
   */
  const bytes = Object.getOwnPropertyDescriptor(input, 'bytes',);
  if (count === undefined || bytes === undefined
    || !Object.hasOwn(count, 'value',) || !Object.hasOwn(bytes, 'value',)) {
    rl.debug('input usage is missing data counters',);
    throw new InputReceiptBudgetError('Native input usage is outside its counter profile',);
  }
  /**
   Descriptor shape does not establish a valid counter domain.
   */
  const countValue: unknown = count.value;
  /**
   Retain byte usage as untrusted until its numeric checks succeed.
   */
  const byteValue: unknown = bytes.value;
  if (typeof countValue !== 'number' || !Number.isSafeInteger(countValue,) || countValue < 0
    || typeof byteValue !== 'number' || !Number.isSafeInteger(byteValue,) || byteValue < 0) {
    rl.debug('input usage counters are not nonnegative safe integers',);
    throw new InputReceiptBudgetError('Native input usage is outside its counter profile',);
  }
  return { count: countValue, bytes: byteValue, };
}

/**
 Enforce original aggregate limits across resource and Session receipt owners.
 The calling code owns the pair; each counter record remains untrusted until validated.
 This calculation establishes neither native ownership nor complete governing coverage.
 Per-owner and per-source bounds remain independent obligations.

 @param resource - resource owner's serialized receipt usage

 @param session - Session owner's serialized receipt usage

 @throws {@link InputReceiptBudgetError} for unsupported counters or aggregate overflow

 @example
 ```ts
 assertOriginalInputBudget({
   resource: { count: 1, bytes: 1024 },
   session: { count: 2, bytes: 2048 },
 });
 ```
 */
export function assertOriginalInputBudget(
  { resource, session, }: { readonly resource: unknown; readonly session: unknown; },
): void {
  /**
   Attribute aggregate refusal separately from record-shape validation.
   */
  const rl = tagged({ tag: assertOriginalInputBudget.name, l, },);
  rl.debug('checking shared original input receipt limits',);
  /**
   Resource ownership remains the fixed reader's responsibility.
   */
  const resourceUsage = readInputUsage(resource,);
  /**
   Session usage joins the same aggregate without receiving another allowance.
   */
  const sessionUsage = readInputUsage(session,);
  if (resourceUsage.count + sessionUsage.count > INPUT_COUNT_LIMIT
    || resourceUsage.bytes + sessionUsage.bytes > INPUT_BYTE_LIMIT) {
    rl.debug('combined resource and Session receipts exceed the original aggregate budget',);
    throw new InputReceiptBudgetError(
      'Combined original resource and session receipts exceed the shared 64-input or four-MiB budget',
    );
  }
  rl.debug('combined original input counters fit the aggregate budget; source ownership remains independent',);
}

//endregion Counter arithmetic
