/** Direct arrival consumers distinguish original callback obligations hidden by composed owners. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { awaitCollectorResult, originalCollectorAbortListener } from './native-group-collector-fixture.ts';
import { createArrivalOwnerFixture } from './native-group-arrival-owner-fixture.ts';

await describe({ name: '', children: [
  //region Failure retention and pending rejection remain independently observable callbacks.
  it({ name: 'rejects allocated transport after retention even when retention has no delivery side effect', fn: async () => {
    const fixture = createArrivalOwnerFixture();
    fixture.control.throwAt = 'dispatch';
    const result = await awaitCollectorResult(Promise.allSettled([fixture.owner.invoke({ record: fixture.record, args: {}, nativeSignal: fixture.native.signal })]));
    assert.deepEqual(result, [{ status: 'rejected', reason: fixture.control.failure }]);
    assert.deepEqual(fixture.events, ['current', 'checkAbort', 'current', 'dispatch', 'retain', 'reject']);
    assert.deepEqual(fixture.retained, [{ error: fixture.control.failure, at: 'member-entry' }]);
    assert.equal(fixture.record.state, 'rejected');
  } }),
  ...['retain', 'reject'].map(function failingCallback(point) {
    return it({ name: `preserves original ${point} callback failure after ticket allocation`, fn: async () => {
      const fixture = createArrivalOwnerFixture();
      const installation = new Error('original listener installation failed');
      Object.defineProperty(fixture.native.signal, 'addEventListener', { value(): never { 
        throw installation; 
      } });
      fixture.control.throwAt = point;
      fixture.control.failure = Object.freeze({ original: point });
      const result = await awaitCollectorResult(Promise.allSettled([fixture.owner.invoke({ record: fixture.record, args: {}, nativeSignal: fixture.native.signal })]));
      assert.deepEqual(result, [{ status: 'rejected', reason: fixture.control.failure }]);
      assert.equal(fixture.record.state, 'pending');
      assert.deepEqual(fixture.retained, [{ error: installation, at: 'member-entry' }]);
      assert.equal(fixture.events.includes('reject'), point === 'reject');
    } });
  }),
  ...['dispatching', 'settled', 'failed'].map(function originalPhase(phase) {
    return it({ name: `rejects previously unarrived member during ${phase}`, fn: async () => {
      const fixture = createArrivalOwnerFixture();
      fixture.state.phase = phase;
      const [result] = await awaitCollectorResult(Promise.allSettled([fixture.owner.invoke({ record: fixture.record, args: {}, nativeSignal: fixture.native.signal })]));
      assert.ok(result?.status === 'rejected');
      assert.ok(Error.isError(result.reason));
      assert.equal(result.reason.message, 'Declared member callback cannot be replayed');
      assert.equal(fixture.record.ticket, undefined);
      assert.deepEqual(fixture.events, ['current', 'retain']);
    } });
  }),
  ...['primary', 'closed'].map(function dispatchGuard(guard) {
    return it({ name: `withholds dispatch after currentness publishes ${guard}`, fn: async () => {
      const fixture = createArrivalOwnerFixture();
      fixture.control.current = function publishState(): void {
        if (guard === 'closed') fixture.state.closed = true;
        else fixture.state.primary = Object.freeze({ original: 'primary' });
      };
      const pending = fixture.owner.invoke({ record: fixture.record, args: {}, nativeSignal: fixture.native.signal });
      assert.equal(fixture.events.includes('dispatch'), false);
      assert.ok(fixture.record.ticket);
      fixture.record.ticket.resolve('independent completion');
      assert.equal(await awaitCollectorResult(pending), 'independent completion');
    } });
  }),
  it({ name: 'dispatches only after original ticket, arrival, and signal publication', fn: async () => {
    const fixture = createArrivalOwnerFixture();
    assert.equal(await awaitCollectorResult(fixture.owner.invoke({ record: fixture.record, args: {}, nativeSignal: fixture.native.signal })), 'original delivery');
    assert.equal(fixture.record.arrival, 'matched');
    assert.equal(fixture.record.state, 'pending');
    assert.ok(fixture.record.signal instanceof AbortSignal);
    assert.equal(fixture.state.checking, false);
    assert.deepEqual(fixture.events, ['current', 'checkAbort', 'current', 'dispatch']);
  } }),
  ...['settled', 'closed', 'null-completion'].map(function originalListenerGuard(guard) {
    return it({ name: `retains native listener guard for ${guard} independently of other terminal state`, fn: async () => {
      const fixture = createArrivalOwnerFixture();
      await awaitCollectorResult(fixture.owner.invoke({ record: fixture.record, args: {}, nativeSignal: fixture.native.signal }));
      const listener = originalCollectorAbortListener(fixture.native.signal);
      if (guard === 'settled') fixture.state.phase = 'settled';
      if (guard === 'closed') fixture.state.closed = true;
      if (guard === 'null-completion') fixture.record.completion = null;
      listener();
      assert.equal(fixture.events.includes('nativeAbort'), false);
    } });
  }),
  //endregion
] });
