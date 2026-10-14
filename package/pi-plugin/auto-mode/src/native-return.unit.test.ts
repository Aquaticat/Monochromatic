/**
 Generated native return consumers retain outcomes independently of live script access.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { nativeReturn, nativeReturnFailure, nativeReturnFixture } from './native-return-test-fixture.ts';

//region Original outcomes retain conversion and ownership

await describe({ name: '', children: [
  it({ name: 'captures conversion once and preserves original invocation and outcome identity', fn: async function originalReturn() {
    /** Fixture references distinguish original native data from equal copies. */
    const fixture = nativeReturnFixture();
    expect(fixture.consumer.inspect(fixture.handle)).toEqual({ retainedOnly: true, state: 'uninvoked', identity: undefined, conversionCount: 0, conversion: undefined, failure: undefined });
    /** The generated consumer forwards both original argument objects. */
    const outcome = await fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
    expect(outcome).toBe(fixture.outcome);
    fixture.outcome.result.content = [{ type: 'text', text: 'later mutation' }];
    expect(fixture.consumer.valueFor({ slot: fixture.handle, outcome })).toBe('original text');
    expect(fixture.consumer.valueFor({ slot: fixture.handle, outcome })).toBe('original text');
    expect(fixture.consumer.inspect(fixture.handle)).toMatchObject({ state: 'returned', conversionCount: 1, conversion: { status: 'string', value: 'original text', bytes: 13 } });
    expect(
      Object.isFrozen(fixture.consumer.inspect(fixture.handle)),
    ).toBe(true);
    expect(fixture.state.invocations).toBe(1);
    /** A second reservation must fail without executing native work again. */
    const repeated = await nativeReturnFailure(function repeat() {
      return fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
    });
    expect(repeated).toBeInstanceOf(nativeReturn.NativeReturnContractError);
    expect(fixture.state.invocations).toBe(1);
  } }),
  it({ name: 'retains a completed result after parent retirement without checking current use', fn: async function retiredReturn() {
    /** A native operation can remain in flight while its parent retires. */
    const deferred = Promise.withResolvers<unknown>();
    /** The pending producer supplies no result before explicit completion. */
    const fixture = nativeReturnFixture({ runNative: function pending() {
      return deferred.promise;
    } });
    /** Invocation reserves the original slot synchronously. */
    const pending = fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
    expect(fixture.consumer.inspect(fixture.handle).state).toBe('running');
    fixture.state.current = false;
    deferred.resolve(fixture.outcome);
    expect(await pending).toBe(fixture.outcome);
    expect(fixture.state.currentChecks).toBe(1);
    expect(fixture.consumer.inspect(fixture.handle).conversionCount).toBe(1);
    /** Retention supplies no permission to use the result after retirement. */
    const rejected = await nativeReturnFailure(function staleValue() {
      return fixture.consumer.valueFor({ slot: fixture.handle, outcome: fixture.outcome });
    });
    expect(rejected).toHaveProperty('name', 'NativeScriptValueGuardError');
    expect(fixture.state.memberChecks).toBe(0);
  } }),
  it({ name: 'captures native conversion before a later queued result mutation', fn: async function nativeCompletionOrder() {
    /** Original native completion is independently controlled by this fixture. */
    const deferred = Promise.withResolvers<unknown>();
    /** The consumer must convert in its first continuation after native settlement. */
    const fixture = nativeReturnFixture({ runNative: function pendingNative() {
      return deferred.promise;
    } });
    /** Native settlement queues the consumer before the later mutation. */
    const pending = fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
    deferred.resolve(fixture.outcome);
    queueMicrotask(function mutateAfterNativeSettlement() {
      fixture.outcome.result.content = [{ type: 'text', text: 'later queued mutation' }];
    });
    await pending;
    expect(fixture.consumer.valueFor({ slot: fixture.handle, outcome: fixture.outcome })).toBe('original text');
  } }),
  it({ name: 'rejects copied outcomes and incomplete prepared members independently', fn: async function originalMembership() {
    /** The positive control uses the same original return as both rejection controls. */
    const fixture = nativeReturnFixture();
    await fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
    expect(fixture.consumer.valueFor({ slot: fixture.handle, outcome: fixture.outcome })).toBe('original text');
    /** Equal field values cannot replace the original native return. */
    const copied = await nativeReturnFailure(function copiedReturn() {
      return fixture.consumer.valueFor({ slot: fixture.handle, outcome: { ...fixture.outcome } });
    });
    expect(copied).toHaveProperty('name', 'NativeScriptValueGuardError');
    fixture.state.returned = false;
    /** Native result shape does not establish prepared-member completion. */
    const incomplete = await nativeReturnFailure(function incompleteMember() {
      return fixture.consumer.valueFor({ slot: fixture.handle, outcome: fixture.outcome });
    });
    expect(incomplete).toHaveProperty('name', 'NativeScriptValueGuardError');
  } }),
  ...[false, true].map(function nativeFailureMode(asynchronous) { return it({ name: `retains original ${asynchronous ? 'asynchronous' : 'synchronous'} native failure`, fn: async function nativeFailure() {
    /** Original thrown errors must survive unchanged in retained evidence. */
    const failure = new Error('original native failure');
    /** Both synchronous and awaited failures reserve their original invocation. */
    const fixture = nativeReturnFixture({ runNative: asynchronous ? async function reject() {
      throw failure;
    } : function fail() {
      throw failure;
    } });
    expect(await nativeReturnFailure(function invoke() {
      return fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
    })).toBe(failure);
    expect(fixture.consumer.inspect(fixture.handle)).toMatchObject({ state: 'threw', failure, conversionCount: 0 });
  } }); }),
  it({ name: 'keeps ordinary native conversion failures outside the script guard', fn: async function ordinaryToolFailure() {
    /** Native failure text is captured before later result mutation. */
    const fixture = nativeReturnFixture();
    fixture.outcome.isError = true;
    await fixture.consumer.invoke({ slot: fixture.handle, call: fixture.call, options: fixture.options });
    fixture.state.returned = false;
    /** An ordinary tool failure does not consult the successful-member guard. */
    const failure = await nativeReturnFailure(function nativeErrorValue() {
      return fixture.consumer.valueFor({ slot: fixture.handle, outcome: fixture.outcome });
    });
    expect(failure).toHaveProperty('name', 'Error');
    expect(failure).toHaveProperty('message', 'original text');
    expect(fixture.state.memberChecks).toBe(0);
    expect(fixture.consumer.inspect(fixture.handle)).toMatchObject({ conversionCount: 1, conversion: { status: 'threw', error: failure, messageAtCapture: 'original text' } });
  } }),
] });

//endregion Original outcomes retain conversion and ownership
