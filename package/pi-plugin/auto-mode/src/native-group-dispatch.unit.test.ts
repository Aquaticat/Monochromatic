/** Original dispatch publication and complete member association reach independent consumers. @module */
import assert from 'node:assert/strict';
import { wait } from '@monochromatic-dev/module-async-time/ts';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createDispatchFixture, throwDispatchFixtureValue } from './native-group-dispatch-fixture.ts';

await describe({ name: '', children: [
  //region Work publication and successful association preserve original identities and callback order.
  it({ name: 'publishes drainable work before currentness and freezes original dispatch associations', fn: async () => {
    const fixture = createDispatchFixture();
    const outcomes = [Object.freeze({ original: 'first' }), undefined];
    fixture.control.returned = outcomes;
    fixture.control.current = function inspectPublishedWork(): void {
      assert.notEqual(fixture.state.work, fixture.originalWork);
    };
    fixture.control.consume = function inspectDispatch(): unknown {
      assert.notEqual(fixture.state.work, fixture.originalWork);
      return outcomes;
    };
    assert.deepEqual(fixture.events, []);
    fixture.owner.startDispatch();
    await fixture.state.work;
    assert.deepEqual(fixture.events, ['current', 'consumer', 'observe', 'observe', 'current']);
    assert.equal(fixture.calls.length, 1);
    const [call] = fixture.calls;
    assert.ok(call);
    assert.equal(Object.isFrozen(call), true);
    assert.equal(Object.isFrozen(call.members), true);
    for (const [index, member] of call.members.entries()) {
      const record = fixture.records[index];
      assert.ok(record);
      assert.equal(Object.isFrozen(member), true);
      assert.equal(member.handle, record.handle);
      assert.equal(member.declaration, record.member);
      assert.equal(member.signal, record.signal);
      assert.equal(fixture.observations[index]?.record, record);
      assert.equal(fixture.observations[index]?.completion, outcomes[index]);
    }
    assert.deepEqual(fixture.failures, []);
    assert.deepEqual(fixture.retained, []);
  } }),
  it({ name: 'drains every original observation after transport closure', fn: async () => {
    const fixture = createDispatchFixture();
    const pending = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    fixture.state.closed = true;
    fixture.control.observe = async function waitForCompletion(): Promise<void> {
      entered.resolve();
      await pending.promise;
    };
    fixture.owner.startDispatch();
    await entered.promise;
    await wait(1);
    assert.equal(fixture.observations.length, 2);
    const marker = Object.freeze({ pending: true });
    assert.equal(await Promise.race([fixture.state.work, Promise.resolve(marker)]), marker);
    pending.resolve();
    await fixture.state.work;
    assert.equal(fixture.control.currentCalls, 1);
  } }),
  it({ name: 'retains tail currentness failure after starting all observations', fn: async () => {
    const fixture = createDispatchFixture();
    const failure = Object.freeze({ original: 'tail failure' });
    fixture.control.current = function failAtTail(): void {
      if (fixture.control.currentCalls === 2) throwDispatchFixtureValue(failure);
    };
    fixture.owner.startDispatch();
    await fixture.state.work;
    assert.deepEqual(fixture.retained, [{ error: failure, at: 'group-consumer-tail' }]);
    assert.equal(fixture.observations.length, 2);
  } }),
  it({ name: 'waits for all observation rejections without replacing original consumer outcomes', fn: async () => {
    const fixture = createDispatchFixture();
    const rejected = Object.freeze({ original: 'observer rejection' });
    fixture.control.observe = async function failObservation(): Promise<void> { 
      throwDispatchFixtureValue(rejected);
    };
    fixture.owner.startDispatch();
    await fixture.state.work;
    assert.equal(fixture.observations.length, 2);
    assert.deepEqual(fixture.retained, []);
  } }),
  //endregion
  //region Original guard and failure boundaries preserve opaque caught values and cleanup.
  it({ name: 'rejects incomplete arrival before publishing native dispatch', fn: async () => {
    const fixture = createDispatchFixture();
    const [record] = fixture.records;
    assert.ok(record);
    record.arrival = 'unarrived';
    fixture.owner.startDispatch();
    await fixture.state.work;
    assert.equal(fixture.calls.length, 0);
    assert.equal(fixture.state.dispatches, 0);
    const [failure] = fixture.retained;
    assert.ok(Error.isError(failure?.error,));
    assert.equal(failure.error.message, 'Declared member set is incomplete');
    assert.equal(failure.at, 'group-dispatch');
  } }),
  it({ name: 'retains initial currentness failure without native dispatch', fn: async () => {
    const fixture = createDispatchFixture();
    fixture.control.current = function rejectCurrentness(): void { 
      throwDispatchFixtureValue(undefined);
    };
    fixture.owner.startDispatch();
    await fixture.state.work;
    assert.deepEqual(fixture.retained, [{ error: undefined, at: 'group-dispatch' }]);
    assert.equal(fixture.calls.length, 0);
  } }),
  ...[undefined, null, 'failure', 73, Object.freeze({ original: 'consumer failure' })].map(function consumerFailure(error) {
    return it({ name: `retains opaque consumer failure ${JSON.stringify(error)}`, fn: async () => {
      const fixture = createDispatchFixture();
      fixture.control.consume = function failConsumer(): never { 
        throwDispatchFixtureValue(error);
      };
      fixture.owner.startDispatch();
      await fixture.state.work;
      assert.deepEqual(fixture.failures, [{ error, at: 'group-consumer' }]);
      assert.deepEqual(fixture.retained, [{ error: fixture.failureToken, at: 'group-dispatch' }]);
      assert.equal(fixture.observations.length, 0);
    } });
  }),
  it({ name: 'resolves published work after dispatcher boundary retention fails', fn: async () => {
    const fixture = createDispatchFixture();
    const failure = Object.freeze({ original: 'retention failure' });
    fixture.control.current = function failCurrent(): never { 
      throwDispatchFixtureValue(null);
    };
    fixture.control.retain = function failFirstRetention(input): void {
      if (input.at === 'group-dispatch') throwDispatchFixtureValue(failure);
    };
    fixture.owner.startDispatch();
    await fixture.state.work;
    assert.deepEqual(fixture.retained, [{ error: null, at: 'group-dispatch' }, { error: failure, at: 'dispatcher-completion' }]);
  } }),
  it({ name: 'observes an empty complete group and still checks original tail currentness', fn: async () => {
    const fixture = createDispatchFixture();
    fixture.records.length = 0;
    fixture.control.returned = [];
    fixture.owner.startDispatch();
    await fixture.state.work;
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.observations.length, 0);
    assert.equal(fixture.control.currentCalls, 2);
    assert.deepEqual(fixture.retained, []);
  } }),
  //endregion
] });
