/** Original runtime lifetime preserves partial retirement, captured work, and retained inspection. @module */
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { awaitCollectorResult } from './native-group-collector-fixture.ts';
import { createRuntimeLifetimeFixture } from './native-program-runtime-lifetime-fixture.ts';

await describe({ name: '', children: [
  //region Retirement publishes closure before callbacks and retains original partial progress.
  it({ name: 'closes before ordered retirement and never repeats already closed work', fn: async () => {
    const fixture = createRuntimeLifetimeFixture();
    assert.deepEqual(fixture.events, []);
    fixture.owner.retire();
    assert.equal(fixture.lifetime.closed, true);
    assert.deepEqual(fixture.events, ['7:retire', '2:retire']);
    fixture.owner.retire();
    assert.deepEqual(fixture.events, ['7:retire', '2:retire']);
  } }),
  ...[7, 2].map(function failingRetirement(ordinal) {
    return it({ name: `retains closure and partial retirement when group ${ordinal} throws`, fn: async () => {
      const fixture = createRuntimeLifetimeFixture();
      const entry = fixture.entry(ordinal);
      entry.state.throwAt = 'retire';
      try { 
        fixture.owner.retire(); 
        assert.fail('Original child retirement failure was discarded'); 
      }
      catch (error) { 
        assert.equal(error, entry.state.failure); 
      }
      assert.equal(fixture.lifetime.closed, true);
      assert.equal(fixture.entry(7).state.retired, 1);
      assert.equal(fixture.entry(2).state.retired, ordinal === 7 ? 0 : 1);
      const events = [...fixture.events];
      fixture.owner.retire();
      assert.deepEqual(fixture.events, events);
    } });
  }),
  it({ name: 'retires a group added by an original retirement callback in the same live traversal', fn: async () => {
    const fixture = createRuntimeLifetimeFixture();
    fixture.entry(7).state.onStep = function publishGroup(point): void { 
      if (point === 'retire') fixture.add(9); 
    };
    fixture.owner.retire();
    assert.deepEqual(fixture.events, ['7:retire', '2:retire', '9:retire']);
    assert.equal(fixture.entry(9).state.retired, 1);
  } }),
  //endregion
  //region Draining captures work before awaiting but inspects the current reached map afterward.
  it({ name: 'awaits captured original work and retains failures in observation order', fn: async () => {
    const fixture = createRuntimeLifetimeFixture();
    const first = Promise.withResolvers<unknown>();
    const second = Promise.withResolvers<unknown>();
    fixture.entry(7).state.work = first.promise;
    fixture.entry(2).state.work = second.promise;
    const pending = fixture.owner.drain();
    const settled = Promise.allSettled([pending]);
    assert.deepEqual(fixture.events, ['7:drain', '2:drain']);
    const rejected = Object.freeze({ original: 'captured drain failure' });
    second.reject(rejected);
    assert.equal(await Promise.race([pending, setImmediate('waiting')]), 'waiting');
    assert.deepEqual(fixture.marked, []);
    fixture.reached.delete(2);
    const added = fixture.add(9);
    const unawaited = Promise.withResolvers<unknown>();
    added.state.work = unawaited.promise;
    added.inspection.failed = true;
    const retained = Object.freeze({ original: 'newly reached retained failure' });
    added.inspection.failure = retained;
    first.resolve('original completed work');
    assert.deepEqual(await awaitCollectorResult(settled), [{ status: 'rejected', reason: fixture.guards[0] }]);
    assert.deepEqual(fixture.marked, [{ program: fixture.program, error: rejected }, { program: fixture.program, error: retained }]);
    assert.equal(added.state.drained, 0);
    assert.equal(added.state.inspected, 1);
    assert.deepEqual(fixture.events, ['7:drain', '2:drain', 'mark', '7:inspect', '9:inspect', 'mark', 'inspect-program']);
    unawaited.resolve(undefined);
  } }),
  it({ name: 'preserves an earlier program guard ahead of newly retained opaque drain failures', fn: async () => {
    const fixture = createRuntimeLifetimeFixture();
    const earlier = new Error('original earlier guard');
    fixture.guards.push(earlier);
    const first = Promise.withResolvers<unknown>();
    const second = Promise.withResolvers<unknown>();
    fixture.entry(7).state.work = first.promise;
    fixture.entry(2).state.work = second.promise;
    const settled = Promise.allSettled([fixture.owner.drain()]);
    second.reject(null);
    first.reject(undefined);
    assert.deepEqual(await awaitCollectorResult(settled), [{ status: 'rejected', reason: earlier }]);
    assert.deepEqual(fixture.marked, [{ program: fixture.program, error: undefined }, { program: fixture.program, error: null }]);
  } }),
  it({ name: 'finishes successful original work without consulting live eligibility', fn: async () => {
    const fixture = createRuntimeLifetimeFixture();
    fixture.lifetime.closed = true;
    await awaitCollectorResult(fixture.owner.drain());
    assert.deepEqual(fixture.events, ['7:drain', '2:drain', '7:inspect', '2:inspect', 'inspect-program']);
    assert.deepEqual(fixture.marked, []);
  } }),
  //endregion
  //region Retained inspection freezes only new runtime containers while retaining original reader outputs.
  it({ name: 'freezes fresh insertion-ordered snapshots without freezing or cloning child inspection', fn: async () => {
    const fixture = createRuntimeLifetimeFixture();
    const first = fixture.owner.inspect();
    const second = fixture.owner.inspect();
    assert.notEqual(first, second);
    assert.notEqual(first.reachedGroups, second.reachedGroups);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.reachedGroups), true);
    assert.deepEqual(first.reachedGroups.map(function ordinal(group) { 
      return group.ordinal; 
    }), [7, 2]);
    for (const group of first.reachedGroups) {
      assert.equal(Object.isFrozen(group), true);
      assert.equal(group.collector, fixture.entry(group.ordinal).inspection);
      assert.equal(Object.isFrozen(group.collector), false);
    }
    fixture.reached.delete(7);
    fixture.add(9);
    fixture.lifetime.closed = true;
    const current = fixture.owner.inspect();
    assert.equal(first.closed, false);
    assert.equal(current.closed, true);
    assert.equal(current.retainedOnly, true);
    assert.deepEqual(current.reachedGroups.map(function ordinal(group) { 
      return group.ordinal; 
    }), [2, 9]);
    assert.equal(fixture.events.includes('inspect-program'), false);
    assert.deepEqual(fixture.marked, []);
  } }),
  //endregion
] });
