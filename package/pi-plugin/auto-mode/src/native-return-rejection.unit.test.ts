/**
 Generated native return consumers reject foreign custody and unsupported result bindings.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { nativeReturn, nativeReturnFailure, nativeReturnFixture } from './native-return-test-fixture.ts';

//region Reservation and native return shape remain independent requirements

await describe({
  name: '',
  children: [
    ...['runNative', 'getSlot', 'assertCurrent', 'assertReturnedMember'].map(function missingOwner(key) {
      return it({
        name: `rejects missing fixed owner callback ${key}`,
        fn: async function missingCallback() {
          /** A malformed bootstrap must fail before any native operation starts. */
          const fixture = nativeReturnFixture();
          Reflect.set(fixture.owner, key, undefined);
          expect(function bindIncompleteOwner() {
            nativeReturn.createNativeReturnConsumer(fixture.owner);
          }).toThrow(nativeReturn.NativeReturnContractError);
          expect(fixture.state.invocations).toBe(0);
        },
      });
    }),
    it({
      name: 'keeps fixed callbacks when the borrowed bootstrap object is later edited',
      fn: async function fixedCallbacks() {
        /** Existing consumer captured callable identity at bootstrap. */
        const fixture = nativeReturnFixture();
        for (const key of ['runNative', 'getSlot', 'assertCurrent', 'assertReturnedMember']) Reflect.set(fixture.owner, key, undefined);
        await fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
        expect(fixture.consumer.valueFor({ slot: fixture.handle, outcome: fixture.outcome })).toBe('original text');
      },
    }),
    it({
      name: 'rejects synchronous reentry and releases the entry lock before native settlement',
      fn: async function entryLifetime() {
        /** Every reentrant rejection is observed immediately to avoid unhandled rejections. */
        const nested: Promise<unknown>[] = [];
        /** Original native execution invokes the consumer recursively before returning. */
        const fixture = nativeReturnFixture({ runNative: function reenter() {
          nested.push(nativeReturnFailure(function recursiveInvocation() {
            return fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
          }));
          return fixture.outcome;
        } });
        await fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
        expect(nested.length).toBe(1);
        expect(await nested[0]).toHaveProperty('message', 'Native result consumer cannot reenter through synchronous callbacks');
        /** A later call reaches the slot reservation guard, proving the entry lock was released. */
        const repeated = await nativeReturnFailure(function laterInvocation() {
          return fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
        });
        expect(repeated).toHaveProperty('message', 'Native slot already reserved its invocation');
      },
    }),
    ...['id', 'name'].map(function callIdentity(field) {
      return it({
        name: `rejects changed invocation ${field} before native execution`,
        fn: async function foreignCall() {
          /** Wrong call metadata must not reserve or execute the original slot. */
          const fixture = nativeReturnFixture();
          /** Only one original identity field is changed in each contrast. */
          const call = { ...fixture.call, [field]: 'foreign' };
          expect(await nativeReturnFailure(function mismatchedCall() {
            return fixture.consumer.invoke({ slot: fixture.handle, call, options: fixture.options });
          })).toBeInstanceOf(nativeReturn.NativeReturnContractError);
          expect(fixture.state.invocations).toBe(0);
          expect(fixture.consumer.inspect(fixture.handle).state).toBe('uninvoked');
          await fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
          expect(fixture.consumer.valueFor({ slot: fixture.handle, outcome: fixture.outcome })).toBe('original text');
        },
      });
    }),
    ...[
      null,
      undefined,
      false,
      {},
      { toolCall: null },
      { toolCall: 'call' },
      { toolCall: {} },
      { toolCall: { id: 'original-call' } },
      { toolCall: { id: 0, name: 'read' } },
      { toolCall: { id: 'original-call', name: 0 } },
      { toolCall: { id: 'foreign', name: 'read' }, isError: false, result: {} },
      { toolCall: { id: 'original-call', name: 'foreign' }, isError: false, result: {} },
      { toolCall: { id: 'original-call', name: 'read' }, result: {} },
      { toolCall: { id: 'original-call', name: 'read' }, isError: 'false', result: {} },
      { toolCall: { id: 'original-call', name: 'read' }, isError: false },
      { toolCall: { id: 'original-call', name: 'read' }, isError: false, result: null },
      { toolCall: { id: 'original-call', name: 'read' }, isError: false, result: 'text' },
    ].map(function invalidReturn(outcome, index) {
      return it({
        name: `retains invalid native return ${index} without converting it`,
        fn: async function malformedReturn() {
          /** Each malformed return still originated from the reserved native call. */
          const fixture = nativeReturnFixture({ runNative: function originalNativeCall() {
            return outcome;
          } });
          /** Return-shape rejection retains the same failure in terminal inspection. */
          const failure = await nativeReturnFailure(function invoke() {
            return fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
          });
          expect(failure).toBeInstanceOf(nativeReturn.NativeReturnContractError);
          expect(fixture.consumer.inspect(fixture.handle)).toMatchObject({ state: 'invalid-return', failure, conversionCount: 0 });
          expect(fixture.state.invocations).toBe(1);
        },
      });
    }),

    //endregion Reservation and native return shape remain independent requirements

    //region Supported text counts bytes and ordinary captured failures retain their identity

    ...[null, 0, false, {}, [], Symbol('unsupported native structured result')].map(function unsupportedValue(value, index) {
      return it({
        name: `retains unsupported structured result ${index} without releasing it as text`,
        fn: async function unsupportedModality() {
          /** Structured output remains available for retained inspection. */
          const fixture = nativeReturnFixture({ structured: true });
          fixture.outcome.result.structuredContent = value;
          await fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
          expect(fixture.consumer.inspect(fixture.handle)).toMatchObject({ state: 'returned', conversionCount: 1, conversion: { status: 'unsupported', kind: value === null ? 'null' : typeof value } });
          expect(await nativeReturnFailure(function unsupportedBinding() {
            return fixture.consumer.valueFor({ slot: fixture.handle, outcome: fixture.outcome });
          })).toHaveProperty('name', 'NativeScriptValueGuardError');
          expect(fixture.state.memberChecks).toBe(0);
        },
      });
    }),
    it({
      name: 'accepts the original UTF-8 byte bound and rejects the first oversized multibyte string',
      fn: async function byteBound() {
        /** Each character occupies two UTF-8 bytes but one JavaScript code unit. */
        const exact = 'é'.repeat(32_768);
        /** Separate original slots provide allowed and rejected boundary controls. */
        const allowed = nativeReturnFixture({ structured: true });
        allowed.outcome.result.structuredContent = exact;
        await allowed.consumer.invoke({ slot: allowed.handle, call: allowed.call, options: allowed.options });
        expect(allowed.consumer.valueFor({ slot: allowed.handle, outcome: allowed.outcome })).toBe(exact);
        /** The same string with another multibyte character exceeds the byte bound. */
        const rejected = nativeReturnFixture({ structured: true });
        rejected.outcome.result.structuredContent = `${exact}é`;
        await rejected.consumer.invoke({ slot: rejected.handle, call: rejected.call, options: rejected.options });
        expect(await nativeReturnFailure(function oversizedBinding() {
          return rejected.consumer.valueFor({ slot: rejected.handle, outcome: rejected.outcome });
        })).toHaveProperty('name', 'NativeScriptValueGuardError');
        expect(rejected.state.memberChecks).toBe(0);
      },
    }),
    ...[undefined, null, false, 0, 'original conversion failure'].map(function caughtValue(error: unknown, index) {
      return it({
        name: `retains ordinary conversion throw ${index} without guard wrapping`,
        fn: async function originalConversionFailure() {
          /** Native conversion may fail while reading its original result. */
          const fixture = nativeReturnFixture({ structured: true });
          Object.defineProperty(fixture.outcome.result, 'structuredContent', { get: function nativeFailure() {
            throw error;
          } });
          await fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
          expect(await nativeReturnFailure(function ordinaryFailure() {
            return fixture.consumer.valueFor({ slot: fixture.handle, outcome: fixture.outcome });
          })).toBe(error);
          expect(fixture.consumer.inspect(fixture.handle)).toMatchObject({ conversionCount: 1, conversion: { status: 'threw', error, messageAtCapture: String(error) } });
          expect(fixture.state.memberChecks).toBe(0);
        },
      });
    }),

    //endregion Supported text counts bytes and ordinary captured failures retain their identity
  ],
});
