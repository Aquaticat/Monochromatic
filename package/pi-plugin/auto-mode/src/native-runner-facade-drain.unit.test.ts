/** Aggregate draining retains original native work and exact failure ordering. @module */
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createRunnerFacadeFixture } from './native-runner-facade-fixture.ts';

await describe({ name: '', children: [
  //region Original work is retained independently from member transport completion.
  it({ name: 'waits for both runtime drainage and retained execution after native tickets settle', fn: async () => {
    const fixture = createRunnerFacadeFixture();
    const native = Promise.withResolvers<void>();
    const runtime = Promise.withResolvers<void>();
    fixture.control.execution = function execute() { 
      return native.promise; 
    };
    fixture.control.drain = function drain() { 
      return runtime.promise; 
    };
    const run = fixture.create();
    await Promise.all(fixture.runtimeInput().dispatchGroup({ handle: {} }));
    const draining = run.drain();
    assert.equal(await Promise.race([draining, setImmediate('pending')]), 'pending');
    runtime.resolve();
    assert.equal(await Promise.race([draining, setImmediate('pending')]), 'pending');
    native.resolve();
    await draining;
    assert.equal(fixture.steps.at(-1), 'drain');
  } }),
  ...[undefined, null, Object.freeze({ original: 'opaque failure' })].map(function opaqueFailure(failure) {
    return it({ name: `retains ${String(failure)} execution failure and rejects every original ticket on repeated drains`, fn: async () => {
      const fixture = createRunnerFacadeFixture();
      fixture.control.failure = failure;
      fixture.control.failAt = 'execute';
      const run = fixture.create();
      const promises = fixture.runtimeInput().dispatchGroup({ handle: {} });
      assert.equal(promises[0], fixture.bound.tickets[0]?.promise);
      assert.deepEqual(fixture.steps.slice(-4), ['bind', 'execute', 'reject:0', 'reject:1']);
      /** Require aggregate identity and original retained values rather than diagnostic text. */
      function aggregate(error: unknown): boolean {
        assert.ok(error instanceof AggregateError);
        assert.equal(error.name, 'NativeExecutionGuardError');
        assert.deepEqual(error.errors, [failure]);
        assert.ok(('phase' in error) && (error.phase === 'validation'));
        assert.ok(error.message.includes('parent id'));
        assert.ok(error.message.includes('parent tool'));
        return true;
      }
      await assert.rejects(run.drain, aggregate);
      await assert.rejects(run.drain, aggregate);
      assert.deepEqual(fixture.observations.slice(-2), [['reject', 0, failure], ['reject', 1, failure]]);
    } });
  }),
  it({ name: 'keeps execution failure before runtime and ticket-rejection failures without deduplication', fn: async () => {
    const fixture = createRunnerFacadeFixture();
    const nativeFailure = Object.freeze({ original: 'native failure' });
    const rejectFailure = Object.freeze({ original: 'ticket rejection failure' });
    fixture.control.execution = async function execute() { 
      throw nativeFailure; 
    };
    fixture.control.drain = async function drain() { 
      throw nativeFailure; 
    };
    fixture.control.failAt = 'reject:0';
    fixture.control.failure = rejectFailure;
    const run = fixture.create();
    fixture.runtimeInput().dispatchGroup({ handle: {} });
    await assert.rejects(run.drain, function aggregate(error) {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [nativeFailure, nativeFailure, rejectFailure]);
      return true;
    });
    assert.equal(fixture.steps.includes('reject:1'), false);
  } }),
  it({ name: 'retains native work created synchronously by runtime drain before capturing work snapshot', fn: async () => {
    const fixture = createRunnerFacadeFixture();
    const native = Promise.withResolvers<void>();
    fixture.control.execution = function execute() { 
      return native.promise; 
    };
    const run = fixture.create();
    fixture.control.onStep = function duringDrain(point) { 
      if (point === 'drain') fixture.runtimeInput().dispatchGroup({ handle: {} }); 
    };
    const draining = run.drain();
    assert.equal(await Promise.race([draining, setImmediate('pending')]), 'pending');
    native.resolve();
    await draining;
    assert.deepEqual(fixture.steps.slice(-3), ['drain', 'bind', 'execute']);
  } }),
  it({ name: 'preserves synchronous runtime drain failure without aggregate wrapping', fn: async () => {
    const fixture = createRunnerFacadeFixture();
    const run = fixture.create();
    fixture.control.failAt = 'drain';
    await assert.rejects(run.drain, function original(error) { 
      return error === fixture.control.failure; 
    });
  } }),
  it({ name: 'captures current work once but reads all retained failures after captured work settles', fn: async () => {
    const fixture = createRunnerFacadeFixture();
    const first = Promise.withResolvers<void>();
    const late = Promise.withResolvers<void>();
    fixture.control.execution = function execute() { 
      return first.promise; 
    };
    const run = fixture.create();
    fixture.runtimeInput().dispatchGroup({ handle: {} });
    const draining = run.drain();
    fixture.control.execution = function executeLater() { 
      return late.promise; 
    };
    fixture.runtimeInput().dispatchGroup({ handle: {} });
    first.resolve();
    await draining;
    late.resolve();
    await run.drain();
  } }),
  //endregion
] });
