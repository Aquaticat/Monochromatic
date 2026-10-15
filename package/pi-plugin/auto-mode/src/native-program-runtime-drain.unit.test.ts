/** Original drain callback failures preserve exact escape boundaries and partial observations. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { awaitCollectorResult } from './native-group-collector-fixture.ts';
import { createRuntimeLifetimeFixture } from './native-program-runtime-lifetime-fixture.ts';

await describe({ name: '', children: [
  //region Synchronous invocation, inspection, and judgment failures retain their original escape boundaries.
  it({ name: 'propagates synchronous child drain failure before retaining asynchronous outcomes', fn: async () => {
    const fixture = createRuntimeLifetimeFixture();
    const child = fixture.entry(2);
    child.state.throwAt = 'drain';
    const result = await awaitCollectorResult(Promise.allSettled([fixture.owner.drain()]));
    assert.deepEqual(result, [{ status: 'rejected', reason: child.state.failure }]);
    assert.deepEqual(fixture.events, ['7:drain', '2:drain']);
    assert.deepEqual(fixture.marked, []);
  } }),
  it({ name: 'propagates child inspection failure without marking it or inspecting later groups', fn: async () => {
    const fixture = createRuntimeLifetimeFixture();
    const child = fixture.entry(7);
    child.state.throwAt = 'inspect';
    const result = await awaitCollectorResult(Promise.allSettled([fixture.owner.drain()]));
    assert.deepEqual(result, [{ status: 'rejected', reason: child.state.failure }]);
    assert.deepEqual(fixture.events, ['7:drain', '2:drain', '7:inspect']);
    assert.deepEqual(fixture.marked, []);
  } }),
  ...['mark', 'inspect-program'].map(function judgmentFailure(point) {
    return it({ name: `preserves original ${point} callback failure after reached work has drained`, fn: async () => {
      const fixture = createRuntimeLifetimeFixture();
      fixture.entry(7).inspection.failed = true;
      fixture.entry(7).inspection.failure = 'original retained child failure';
      fixture.control.throwAt = point;
      const result = await awaitCollectorResult(Promise.allSettled([fixture.owner.drain()]));
      assert.deepEqual(result, [{ status: 'rejected', reason: fixture.control.failure }]);
      assert.deepEqual(fixture.marked, [{ program: fixture.program, error: 'original retained child failure' }]);
      assert.equal(fixture.entry(2).state.inspected, point === 'mark' ? 0 : 1);
    } });
  }),
  it({ name: 'stops rejected-work retention at the first failing judgment callback after all work settles', fn: async () => {
    const fixture = createRuntimeLifetimeFixture();
    const first = Promise.withResolvers<unknown>();
    const second = Promise.withResolvers<unknown>();
    fixture.entry(7).state.work = first.promise;
    fixture.entry(2).state.work = second.promise;
    fixture.control.throwAt = 'mark';
    const settled = Promise.allSettled([fixture.owner.drain()]);
    first.reject('first original drain rejection');
    second.reject('second original drain rejection');
    assert.deepEqual(await awaitCollectorResult(settled), [{ status: 'rejected', reason: fixture.control.failure }]);
    assert.deepEqual(fixture.marked, [{ program: fixture.program, error: 'first original drain rejection' }]);
    assert.deepEqual(fixture.events, ['7:drain', '2:drain', 'mark']);
  } }),
  //endregion
] });
