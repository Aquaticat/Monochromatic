/** Invalid native member association retains all enumerable issued outcomes through drain. @module */
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createDispatchFixture } from './native-group-dispatch-fixture.ts';

await describe({ name: '', children: [
  //region Association failure never discards returned native work or invents member binding.
  ...[undefined, null, false, 43, 'value', {}].map(function nonArray(returned) {
    return it({ name: `rejects non-array consumer return ${JSON.stringify(returned)}`, fn: async () => {
      const fixture = createDispatchFixture();
      fixture.control.returned = returned;
      fixture.owner.startDispatch();
      await fixture.state.work;
      assert.equal(fixture.failures.length, 1);
      const [failure] = fixture.failures;
      assert.ok(Error.isError(failure?.error,));
      assert.equal(failure.error.message, 'Complete group consumer returned a different member set');
      assert.equal(failure.at, 'group-dispatch');
      assert.deepEqual(fixture.retained, [{ error: fixture.failureToken, at: 'group-dispatch' }]);
      assert.equal(fixture.observations.length, 0);
      assert.equal(fixture.state.unboundPending, 0);
      assert.deepEqual(fixture.state.unboundOutcomes, []);
    } });
  }),
  it({ name: 'drains invalid sparse arrays including extra enumerable promises and exact rejection values', fn: async () => {
    const fixture = createDispatchFixture();
    const fulfilled = Object.freeze({ original: 'unassociated value' });
    const rejected = Object.freeze({ original: 'unassociated failure' });
    const pending = Promise.withResolvers<unknown>();
    const returned: unknown[] = [];
    returned.length = 2;
    returned[1] = fulfilled;
    Object.defineProperty(returned, 'extra', { enumerable: true, value: pending.promise });
    Object.defineProperty(returned, 'hidden', { enumerable: false, value: 'not an enumerable completion' });
    fixture.control.returned = returned;
    fixture.owner.startDispatch();
    await Promise.resolve();
    await setImmediate();
    assert.equal(fixture.failures.length, 1);
    assert.equal(fixture.state.unboundPending, 2);
    assert.equal(fixture.observations.length, 0);
    const marker = Object.freeze({ pending: true });
    assert.equal(await Promise.race([fixture.state.work, Promise.resolve(marker)]), marker);
    pending.reject(rejected);
    await fixture.state.work;
    assert.equal(fixture.state.unboundPending, 0);
    assert.deepEqual(fixture.state.unboundOutcomes, [
      { retainedOnly: true, sourceKey: '1', status: 'fulfilled', value: fulfilled },
      { retainedOnly: true, sourceKey: 'extra', status: 'rejected', reason: rejected },
    ]);
    assert.equal(Object.isFrozen(fixture.state.unboundOutcomes), true);
    for (const outcome of fixture.state.unboundOutcomes) assert.equal(Object.isFrozen(outcome), true);
    assert.equal(fixture.state.unboundOutcomes[0]?.value, fulfilled);
    assert.equal(fixture.state.unboundOutcomes[1]?.reason, rejected);
    assert.equal(fixture.control.currentCalls, 1);
  } }),
  ...[[], [undefined], [null, false, 'third']].map(function wrongLength(returned) {
    return it({ name: `retains every completion for wrong member count ${returned.length}`, fn: async () => {
      const fixture = createDispatchFixture();
      fixture.control.returned = returned;
      fixture.owner.startDispatch();
      await fixture.state.work;
      assert.equal(fixture.failures.length, 1);
      assert.equal(fixture.observations.length, 0);
      assert.deepEqual(fixture.state.unboundOutcomes, returned.map(function outcome(value, index) {
        return { retainedOnly: true, sourceKey: String(index), status: 'fulfilled', value };
      }));
    } });
  }),
  it({ name: 'rejects inherited array positions while skipping their values in retained enumeration', fn: async () => {
    const fixture = createDispatchFixture();
    const returned: unknown[] = [];
    returned.length = 2;
    returned[1] = 'own';
    Object.setPrototypeOf(returned, { 0: 'inherited' });
    fixture.control.returned = returned;
    fixture.owner.startDispatch();
    await fixture.state.work;
    assert.equal(fixture.failures.length, 1);
    assert.deepEqual(fixture.state.unboundOutcomes, [{ retainedOnly: true, sourceKey: '1', status: 'fulfilled', value: 'own' }]);
  } }),
  it({ name: 'keeps valid array member association despite unrelated enumerable properties', fn: async () => {
    const fixture = createDispatchFixture();
    const returned: unknown[] = [null, undefined];
    Object.defineProperty(returned, 'extra', { enumerable: true, value: 'unassociated extra' });
    fixture.control.returned = returned;
    fixture.owner.startDispatch();
    await fixture.state.work;
    assert.equal(fixture.observations.length, 2);
    assert.deepEqual(fixture.failures, []);
    assert.deepEqual(fixture.state.unboundOutcomes, []);
  } }),
  //endregion
] });
