/**
 Built-artifact controls for original receipt counter arithmetic.

 @module
 */
import {
  assertOriginalInputBudget,
  InputReceiptBudgetError,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';

await describe({
  name: assertOriginalInputBudget.name,
  children: [
    //region Inclusive limits do not multiply with the number of source owners

    it({
      name: 'accepts zero usage and the exact combined count and byte boundaries',
      fn: async function checkBoundaries() {
        expect(function empty() {
          assertOriginalInputBudget({
            resource: { count: 0, bytes: 0, }, session: { count: 0, bytes: 0, },
          },);
        },).not.toThrow();
        expect(function boundary() {
          assertOriginalInputBudget({
            resource: { count: 1, bytes: 1_048_576, },
            session: { count: 63, bytes: 3_145_728, },
          },);
        },).not.toThrow();
      },
    },),
    ...[
      { resource: { count: 32, bytes: 0, }, session: { count: 33, bytes: 0, }, },
      { resource: { count: 1, bytes: 1_048_576, }, session: { count: 1, bytes: 3_145_729, }, },
      { resource: { count: Number.MAX_SAFE_INTEGER, bytes: 0, }, session: { count: Number.MAX_SAFE_INTEGER, bytes: 0, }, },
    ].map(function excessiveUsage(input, index,) {
      return it({
        name: `rejects combined overflow ${index} even when independently supplied`,
        fn: async function checkOverflow() {
          expect(function combine() { assertOriginalInputBudget(input,); },).toThrow(InputReceiptBudgetError,);
        },
      },);
    },),

    //endregion Inclusive limits

    //region Closed usage records reject unsupported fields and numeric domains

    ...[
      undefined, null, [], Object.create(null,), {},
      { count: 0, }, { bytes: 0, }, { wrong: 0, bytes: 0, },
      { count: 0, bytes: 0, extra: 0, },
      { count: 0, bytes: 0, [Symbol('extra input usage field',)]: 0, },
      ...[-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, '0', undefined, null, true,]
        .flatMap(function invalidCounter(value,) {
          return [{ count: value, bytes: 0, }, { count: 0, bytes: value, },];
        },),
    ].map(function unsupportedUsage(usage, index,) {
      return it({
        name: `rejects unsupported usage record ${index} from either owner`,
        fn: async function checkUsage() {
          expect(function resource() {
            assertOriginalInputBudget({ resource: usage, session: { count: 0, bytes: 0, }, },);
          },).toThrow(InputReceiptBudgetError,);
          expect(function session() {
            assertOriginalInputBudget({ resource: { count: 0, bytes: 0, }, session: usage, },);
          },).toThrow(InputReceiptBudgetError,);
        },
      },);
    },),

    //endregion Closed records

    //region Positive controls establish absence of observation side effects

    it({
      name: 'rejects proxy records before reflection and proves the trap is observable',
      fn: async function checkProxy() {
        const traps: object[] = [];
        const usage = new Proxy({ count: 0, bytes: 0, }, {
          getPrototypeOf(target: object,): object {
            traps.push(target,);
            return Object.prototype;
          },
        },);
        expect(function resource() {
          assertOriginalInputBudget({ resource: usage, session: { count: 0, bytes: 0, }, },);
        },).toThrow(InputReceiptBudgetError,);
        expect(traps.length,).toBe(0,);
        Reflect.getPrototypeOf(usage,);
        expect(traps.length,).toBe(1,);
      },
    },),
    ...['count', 'bytes',].map(function accessorCounter(field,) {
      return it({
        name: `rejects the ${field} accessor without calling it`,
        fn: async function checkAccessor() {
          const reads: string[] = [];
          const usage = Object.defineProperty({ count: 0, bytes: 0, }, field, {
            enumerable: true,
            get() { reads.push(field,); return 0; },
          },);
          expect(function check() {
            assertOriginalInputBudget({ resource: usage, session: { count: 0, bytes: 0, }, },);
          },).toThrow(InputReceiptBudgetError,);
          expect(reads.length,).toBe(0,);
          Reflect.get(usage, field,);
          expect(reads.length,).toBe(1,);
        },
      },);
    },),
    it({
      name: 'retains ordinary non-enumerable data counters without freezing borrowed records',
      fn: async function checkBorrowedData() {
        const resource = Object.defineProperty({ count: 1, bytes: 2, }, 'count', { enumerable: false, },);
        const session = { count: 2, bytes: 3, };
        assertOriginalInputBudget({ resource, session, },);
        expect(Object.isFrozen(resource,),).toBe(false,);
        expect(Object.isFrozen(session,),).toBe(false,);
        expect(Object.getOwnPropertyDescriptor(resource, 'count',)?.enumerable,).toBe(false,);
        expect(session,).toEqual({ count: 2, bytes: 3, },);
        expect(new InputReceiptBudgetError('Fixture counter refusal',).name,).toBe('InputReceiptBudgetError',);
      },
    },),

    //endregion Observation side effects
  ],
},);
