/** Built native completion owner preserves exact retention before delivery and original cleanup effects. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createCompletionFixture } from './native-group-completion-fixture.ts';

//region Every native outcome remains observable regardless of current transport delivery state.
await describe({ name: '', children: [
  ...['pending', 'unarrived', 'fulfilled', 'rejected', 'cancelled'].map(function deliveryState(state) {
    return describe({ name: state, children: ['fulfilled', 'rejected'].map(function originalOutcome(status) {
      return it({ name: `retains original ${status} outcome before conditional delivery`, fn: async function retainOutcome() {
        /** Each state/result combination owns its original cancellation and records. */
        const f = createCompletionFixture();
        f.record.state = state;
        assert.equal(f.events.length, 0);
        assert.equal(Object.isFrozen(f.owner), false);
        assert.deepEqual(Reflect.ownKeys(f.owner), ['detach', 'observeCompletion']);
        /** Original native value remains the same object through retention and delivery. */
        const value = Object.freeze({ original: status });
        /** Both fulfilled and rejected promises are observed by the original operation immediately. */
        const completion = Promise.withResolvers<unknown>();
        /** Observe the native ticket before its independently selected outcome settles. */
        const observation = f.owner.observeCompletion({ record: f.record, completion: completion.promise });
        if (status === 'fulfilled') completion.resolve(value);
        else completion.reject(value);
        await observation;
        assert.deepEqual(f.record.completion, status === 'fulfilled' ? { status, value } : { status, reason: value });
        assert.equal(Object.isFrozen(f.record.completion), true);
        assert.ok(f.record.completion !== undefined);
        assert.equal(f.record.completion.status === 'fulfilled' ? f.record.completion.value : f.record.completion.reason, value);
        assert.equal(f.record.state, state === 'pending' ? status : state);
        assert.equal(f.record.removeAbort, undefined);
        assert.equal(f.state.phase, 'dispatching');
        assert.deepEqual(f.events, state === 'pending' ? [`first.${status === 'fulfilled' ? 'resolve' : 'reject'}`, 'first.remove'] : ['first.remove']);
        assert.deepEqual(f.deliveries, state === 'pending' ? [value] : []);
        if (state === 'pending') assert.equal(f.deliveries[0], value);
        f.events.length = 0;
        /** Immediate native values remain accepted and settle the remaining declared member. */
        await f.owner.observeCompletion({ record: f.other, completion: undefined });
        assert.deepEqual(f.other.completion, { status: 'fulfilled', value: undefined });
        assert.deepEqual(f.events, ['second.resolve', 'second.remove']);
        assert.equal(f.state.phase, 'settled');
        f.controller.abort();
        assert.equal(f.events.at(-1), 'independent-abort');
        assert.equal(f.events.includes('parent-abort'), false);
      } });
    }) });
  }),
  ...['closed', 'failed'].map(function terminalState(terminal) {
    return it({ name: `retains eventual outcomes without replacing ${terminal} group state`, fn: async function retainedTerminal() {
      /** Transport closure and native completion observation remain separate lifetimes. */
      const f = createCompletionFixture();
      if (terminal === 'closed') f.state.closed = true;
      else f.state.primary = f.failure;
      f.state.phase = 'failed';
      f.record.state = 'cancelled';
      f.other.state = 'rejected';
      await f.owner.observeCompletion({ record: f.record, completion: 'first result' });
      await f.owner.observeCompletion({ record: f.other, completion: Promise.reject(f.failure) });
      assert.deepEqual(f.deliveries, []);
      assert.equal(f.state.phase, 'failed');
      assert.deepEqual(f.events, ['first.remove', 'second.remove']);
      assert.deepEqual(f.other.completion, { status: 'rejected', reason: f.failure });
      f.controller.abort();
      assert.equal(f.events.includes('parent-abort'), false);
      assert.equal(f.events.at(-1), 'independent-abort');
    } });
  }),
  it({ name: 'detaches original listeners in declaration order and remains idempotent', fn: async function directDetach() {
    /** Detachment does not synthesize any native completion or delivery. */
    const f = createCompletionFixture();
    f.owner.detach();
    f.owner.detach();
    assert.deepEqual(f.events, ['first.remove', 'second.remove']);
    assert.equal(f.record.removeAbort, undefined);
    assert.equal(f.other.removeAbort, undefined);
    assert.equal(f.record.completion, undefined);
    assert.equal(f.state.phase, 'dispatching');
    f.controller.abort();
    assert.equal(f.events.includes('parent-abort'), false);
    assert.equal(f.events.at(-1), 'independent-abort');
  } }),
] });
//endregion
