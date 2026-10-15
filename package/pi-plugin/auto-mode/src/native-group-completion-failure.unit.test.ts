/** Original completion callback failures retain their identity and existing cleanup order. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createCompletionFixture } from './native-group-completion-fixture.ts';

//region Delivery and listener failures remain distinct original completion observations.
await describe({ name: '', children: [
  it({ name: 'retains original resolving-ticket failure after its fulfilled state was published', fn: async function resolveFailure() {
    /** A delivery callback can throw after receiving the exact original native value. */
    const f = createCompletionFixture();
    f.state.failAt = 'first.resolve';
    await f.owner.observeCompletion({ record: f.record, completion: 'original value' });
    assert.equal(f.record.state, 'fulfilled');
    assert.deepEqual(f.record.completion, { status: 'rejected', reason: f.failure });
    assert.deepEqual(f.events, ['first.resolve', 'first.remove']);
    assert.deepEqual(f.deliveries, ['original value']);
  } }),
  it({ name: 'propagates original rejecting-ticket failure after cleanup while retaining native rejection', fn: async function rejectFailure() {
    /** Delivery failure must not replace the already retained original native rejection. */
    const f = createCompletionFixture();
    f.state.failAt = 'first.reject';
    /** Original native rejection differs from the failing ticket callback. */
    const original = Object.freeze({ original: 'rejection' });
    try {
      await f.owner.observeCompletion({ record: f.record, completion: Promise.reject(original) });
      assert.fail('Original rejecting-ticket failure was discarded');
    } catch (error) { assert.equal(error, f.failure); }
    assert.deepEqual(f.record.completion, { status: 'rejected', reason: original });
    assert.equal(f.record.state, 'rejected');
    assert.deepEqual(f.events, ['first.reject', 'first.remove']);
    assert.equal(f.record.removeAbort, undefined);
  } }),
  it({ name: 'propagates original observation cleanup failure without clearing its listener or settling the group', fn: async function cleanupFailure() {
    /** Cleanup failure follows completed retention and pending delivery. */
    const f = createCompletionFixture();
    f.state.failAt = 'first.remove';
    /** The failing cleanup remains available for later explicit detachment. */
    const originalRemove = f.record.removeAbort;
    try {
      await f.owner.observeCompletion({ record: f.record, completion: 'original value' });
      assert.fail('Original completion cleanup failure was discarded');
    } catch (error) { assert.equal(error, f.failure); }
    assert.deepEqual(f.record.completion, { status: 'fulfilled', value: 'original value' });
    assert.equal(f.record.removeAbort, originalRemove);
    assert.equal(f.state.phase, 'dispatching');
    assert.deepEqual(f.events, ['first.resolve', 'first.remove']);
    delete f.state.failAt;
    f.owner.detach();
    assert.equal(f.record.removeAbort, undefined);
    assert.equal(f.other.removeAbort, undefined);
  } }),
  it({ name: 'stops direct detachment at the original failing member and preserves later listeners', fn: async function detachFailure() {
    /** Parent listener is removed before the failing original member cleanup runs. */
    const f = createCompletionFixture();
    f.state.failAt = 'first.remove';
    /** Later member cleanup cannot run through the earlier original failure. */
    const otherRemove = f.other.removeAbort;
    assert.throws(function detach() { f.owner.detach(); }, function same(error: unknown) { return error === f.failure; });
    assert.deepEqual(f.events, ['first.remove']);
    assert.equal(f.other.removeAbort, otherRemove);
    f.controller.abort();
    assert.equal(f.events.includes('parent-abort'), false);
    assert.equal(f.events.at(-1), 'independent-abort');
  } }),
] });
//endregion
