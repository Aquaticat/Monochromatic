/** Built original queue publishes immediately and releases only through its acquired disposer. @module */
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { scopeModule } from './native-program-scope-fixture.ts';

//region Original queue sequencing preserves pending publication, disposal, and preceding failures.
await describe({ name: '', children: [
  ...[false, true].map(function completionCase(failed) {
    return it({ name: `releases original successor after ${failed ? 'exceptional' : 'normal'} scope exit`, fn: async function queueRelease() {
      /** Initial queue is held by an independently controlled original predecessor. */
      const previous = Promise.withResolvers<void>();
      /** Every fixture owns its shared native queue tail. */
      const runner = { queueTail: previous.promise };
      /** First acquisition publishes before the original predecessor settles. */
      const pendingFirst = scopeModule.acquireProgramQueue(runner);
      /** First turn becomes the exact predecessor for the next acquisition. */
      const firstTail = runner.queueTail;
      assert.notEqual(firstTail, previous.promise);
      assert.equal(await Promise.race([pendingFirst, setImmediate('blocked')]), 'blocked');
      previous.resolve();
      /** Original disposer remains the sole release path after acquisition. */
      const first = await pendingFirst;
      /** Successor is queued before either normal or exceptional cleanup. */
      const pendingSecond = scopeModule.acquireProgramQueue(runner);
      /** Tail publication must not wait for the acquired first turn's disposal. */
      const secondTail = runner.queueTail;
      assert.notEqual(secondTail, firstTail);
      assert.equal(await Promise.race([pendingSecond, setImmediate('blocked')]), 'blocked');
      /** Original dispatch error retains identity while using releases the turn. */
      const failure = new Error('Original dispatch failed after acquisition');
      try {
        using turn = first;
        if (failed) throw failure;
      } catch (error) {
        assert.equal(error, failure);
        assert.equal(failed, true);
      }
      /** A missing disposer fails promptly instead of leaving this verification pending. */
      const second = await Promise.race([pendingSecond, setImmediate('missing-release')]);
      assert.notEqual(second, 'missing-release');
      assert.ok(typeof second !== 'string');
      assert.equal(await firstTail, undefined);
      first[Symbol.dispose]();
      assert.equal(await Promise.race([secondTail, setImmediate('blocked')]), 'blocked');
      second[Symbol.dispose]();
      assert.equal(await secondTail, undefined);
    } });
  }),
  it({ name: 'retains predecessor rejection after publishing the unresolved original successor', fn: async function rejectedPredecessor() {
    /** Controlled predecessor permits attaching the original acquisition before rejection. */
    const previous = Promise.withResolvers<void>();
    /** Rejection does not replace or settle the newly published original turn. */
    const runner = { queueTail: previous.promise };
    /** Exact original failure is observed through the returned acquisition. */
    const failure = new Error('Original predecessor failed');
    /** Acquisition publishes synchronously even though its await later rejects. */
    const pending = scopeModule.acquireProgramQueue(runner);
    assert.notEqual(runner.queueTail, previous.promise);
    previous.reject(failure);
    try {
      await pending;
      assert.fail('Original queue predecessor rejection was discarded');
    } catch (error) {
      assert.equal(error, failure);
    }
    assert.equal(await Promise.race([runner.queueTail, setImmediate('still-pending')]), 'still-pending');
  } }),
] });
//endregion
