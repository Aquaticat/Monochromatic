/**
 Aggregate arithmetic for original instruction-input receipts.

 @module
 */
import { isProxy, } from 'node:util/types';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

//region Counter validation remains separate from native receipt ownership

/**
 Unsupported receipt counters or aggregate arithmetic overflow.
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
  const rl = tagged({
    tag: readInputUsage.name,
    l,
  },);
  rl.debug('validating original input usage counters',);
  if ((input === null) || ((typeof input) !== 'object')
    || isProxy(input,)
    || (Object.getPrototypeOf(input,) !== Object.prototype)
    || (Reflect.ownKeys(input,)
      .length
      !== 2)) {
    rl.debug('input usage does not match the ordinary counter record profile',);
    throw new InputReceiptBudgetError('Native input usage requires its ordinary counter record',);
  }
  /**
   Inspect occurrence count without evaluating an accessor.
   */
  const count = Object.getOwnPropertyDescriptor(
    input,
    'count',
  );
  /**
   Inspect serialized-record size independently of the count descriptor.
   */
  const bytes = Object.getOwnPropertyDescriptor(
    input,
    'bytes',
  );
  if ((count === undefined) || (bytes === undefined)
    || (!Object.hasOwn(
      count,
      'value',
    ))
    || (!Object.hasOwn(
      bytes,
      'value',
    ))) {
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
  if (((typeof countValue) !== 'number') || (!Number.isSafeInteger(countValue,))
    || (countValue < 0)
    || ((typeof byteValue) !== 'number')
    || (!Number.isSafeInteger(byteValue,))
    || (byteValue < 0)) {
    rl.debug('input usage counters are not nonnegative safe integers',);
    throw new InputReceiptBudgetError('Native input usage is outside its counter profile',);
  }
  return {
    count: countValue,
    bytes: byteValue,
  };
}

/**
 Validate receipt accounting across resource and Session owners without a capture ceiling.
 The calling code owns the pair; each counter record remains untrusted until validated.
 This calculation establishes neither native ownership nor complete governing coverage.
 Source size and occurrence counts do not determine instruction eligibility.

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
  {
    resource,
    session,
  }: {
    readonly resource: unknown;
    readonly session: unknown
  },
): void {
  /**
   Attribute aggregate refusal separately from record-shape validation.
   */
  const rl = tagged({
    tag: assertOriginalInputBudget.name,
    l,
  },);
  rl.debug('checking shared original input receipt accounting',);
  /**
   Resource ownership remains the fixed reader's responsibility.
   */
  const resourceUsage = readInputUsage(resource,);
  /**
   Session usage joins the same aggregate without receiving another allowance.
   */
  const sessionUsage = readInputUsage(session,);
  if ((!Number.isSafeInteger(resourceUsage.count + sessionUsage.count,))
    || (!Number.isSafeInteger(resourceUsage.bytes + sessionUsage.bytes,))) {
    rl.debug('combined resource and Session counters exceed exact integer representation',);
    throw new InputReceiptBudgetError(
      'Combined resource and session receipt counters cannot be represented exactly',
    );
  }
  rl.debug('combined original input counters are valid; source ownership remains independent',);
}

//endregion Counter arithmetic
