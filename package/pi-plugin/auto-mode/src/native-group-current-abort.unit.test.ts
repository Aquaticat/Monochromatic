/** Original cancellation observation distinguishes active signals, complete results, and closed transport. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createCurrentFixture } from './native-group-current-fixture.ts';

//region Cancellation checks preserve original listener guards and signal provenance.
await describe({ name: '', children: [
  it({ name: 'checks the supplied member signal and preserves cancellation-recorder failures', fn: async function memberCancellation() {
    /** The checked signal need not be the enclosing parent signal. */
    const f = createCurrentFixture();
    /** Independently controlled native signal proves the actual input is observed. */
    const member = new AbortController();
    f.owner.checkAbort({ observed: member.signal, at: 'member boundary' });
    assert.equal(f.events.length, 0);
    member.abort('native');
    assert.throws(function check() { 
      f.owner.checkAbort({ observed: member.signal, at: 'member boundary' }); 
    }, function same(error: unknown) { 
      return error === f.abortedToken; 
    });
    assert.equal(f.aborted[0]?.observed, member.signal);
    assert.equal(f.aborted[0]?.at, 'member boundary');
    f.state.failAt = 'abort';
    assert.throws(function check() { 
      f.owner.checkAbort({ observed: member.signal, at: 'again' }); 
    }, function same(error: unknown) { 
      return error === f.state.failure; 
    });
  } }),
  ...['closed', 'settled', 'complete', 'empty', 'partial', 'failed', 'active'].map(function listenerCases(mode) {
    return it({ name: `retains original parent listener behavior for ${mode} group`, fn: async function parent() {
      /** Listener invocation itself does not add a new signal-aborted requirement. */
      const f = createCurrentFixture();
      if (mode === 'closed') f.state.closed = true;
      if (mode === 'settled') f.state.phase = 'settled';
      if (mode === 'failed') {
        f.state.phase = 'failed';
        f.state.primary = f.recordedToken;
      }
      if (mode === 'complete') for (const record of f.records) record.completion = null;
      if (mode === 'empty') f.records.length = 0;
      if (mode === 'partial') {
        /** Partial observation remains an unfinished original native group. */
        const [first] = f.records;
        assert.ok(first);
        first.completion = Object.freeze({ status: 'fulfilled', value: 'original' });
      }
      f.owner.onParentAbort();
      if (['closed', 'settled', 'complete', 'empty'].includes(mode)) assert.equal(f.events.length, 0);
      else {
        assert.deepEqual(f.events, ['abort']);
        assert.equal(f.aborted[0]?.observed, f.controller.signal);
        assert.equal(f.aborted[0]?.at, 'original-cancellation');
      }
    } });
  }),
] });
//endregion
