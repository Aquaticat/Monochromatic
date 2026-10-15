/** Collector retirement preserves original callback ordering and failure boundaries. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createLifetimeFixture } from './native-group-lifetime-fixture.ts';

//region Retirement is distinct from draining and from retained native execution state.
await describe({ name: '', children: [
  ...['collecting', 'dispatching', 'settled', 'failed'].flatMap(function phases(phase) {
    return [false, true].map(function primaries(hasPrimary) {
      return it({ name: `retires original ${phase} group with primary ${String(hasPrimary)}`, fn: async function retire() {
        /** Construction must not invoke original callbacks or mutate lifetime state. */
        const f = createLifetimeFixture();
        assert.equal(f.events.length, 0);
        assert.equal(f.state.closed, false);
        f.state.phase = phase;
        if (hasPrimary) f.state.primary = { occurrence: Object.freeze({ identity: {}, ordinal: 0, at: 'original', error: 'original failure' }) };
        f.owner.retire();
        assert.equal(f.state.closed, true);
        assert.equal(f.state.phaseAtReturn, phase);
        assert.equal(f.controller.signal.aborted, true);
        assert.equal(f.controller.signal.reason, f.rejected[0]);
        if ((phase === 'collecting') && (!hasPrimary)) {
          assert.deepEqual(f.events, ['detach', 'record', 'reject', 'abort']);
          assert.equal(f.state.phase, 'failed');
          assert.equal(f.failures.length, 1);
        } else {
          assert.deepEqual(f.events, ['detach', 'reject', 'abort']);
          assert.equal(f.state.phase, phase);
          assert.equal(f.failures.length, 0);
        }
        /** A second retirement cannot repeat cleanup, rejection, or failure recording. */
        const previousEvents = [...f.events];
        f.owner.retire();
        assert.deepEqual(f.events, previousEvents);
        assert.equal(f.state.phaseAtReturn, phase);
      } });
    });
  }),
  ...['detach', 'record', 'reject'].map(function callbackCases(point) {
    return it({ name: `retains original retirement boundary when ${point} throws`, fn: async function failure() {
      /** Each callback can fail before later retirement state is published. */
      const f = createLifetimeFixture();
      f.state.failAt = point;
      assert.throws(function retire() {
        f.owner.retire();
      }, function same(error: unknown) {
        return error === f.callbackFailure;
      });
      assert.equal(f.controller.signal.aborted, false);
      assert.equal(f.state.closed, point === 'reject');
      assert.equal(f.state.phaseAtReturn, point === 'detach' ? undefined : 'collecting');
      assert.deepEqual(f.events, point === 'detach' ? ['detach'] : point === 'record' ? ['detach', 'record'] : ['detach', 'record', 'reject']);
      if (point === 'reject') {
        f.owner.retire();
        assert.deepEqual(f.events, ['detach', 'record', 'reject']);
        assert.equal(f.controller.signal.aborted, false);
      }
    } });
  }),
  it({ name: 'drains the work captured at invocation even if later dispatch publishes another ticket', fn: async function drain() {
    /** Pending work is controlled independently from the original lifetime owner. */
    const f = createLifetimeFixture();
    /** First work ticket belongs to this draining invocation. */
    const original = Promise.withResolvers<unknown>();
    /** Later dispatch work must not replace the already observed work ticket. */
    const later = Promise.withResolvers<unknown>();
    f.state.work = original.promise;
    /** Explicit observation exposes premature completion without a timing threshold. */
    const observation = { complete: false };
    async function observe(): Promise<void> {
      await f.owner.drain();
      observation.complete = true;
    }
    /** Attach before replacing work to preserve the original invocation boundary. */
    const draining = observe();
    f.state.work = later.promise;
    later.resolve('later');
    await later.promise;
    assert.equal(observation.complete, false);
    original.resolve('original');
    await draining;
    assert.equal(observation.complete, true);
    assert.equal(f.events.length, 0);
    assert.equal(f.state.closed, false);
  } }),
  it({ name: 'propagates exact original work rejection without retiring transport', fn: async function failedDrain() {
    /** Work failures may be opaque original values rather than Error objects. */
    const f = createLifetimeFixture();
    /** Attach the drain observer before rejecting the original ticket. */
    const work = Promise.withResolvers<unknown>();
    f.state.work = work.promise;
    /** This original value must cross the draining boundary unchanged. */
    const original = Object.freeze({ original: 'work failure' });
    /** Draining observes published work independently of transport retirement. */
    const draining = f.owner.drain();
    work.reject(original);
    try {
      await draining;
      assert.fail('Original work rejection was discarded');
    } catch (error) { 
      assert.equal(error, original); 
    }
    assert.equal(f.events.length, 0);
    assert.equal(f.state.closed, false);
  } }),
] });
//endregion
