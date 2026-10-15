/** Original failure occurrences retain identity, publication order, and boundary propagation. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createFailureFixture } from './native-group-failure-fixture.ts';

//region Every phase and opaque caught value retains original failure semantics.
await describe({ name: '', children: [
  ...['collecting', 'dispatching', 'failed', 'settled'].flatMap(function phaseCases(phase) {
    return [false, true].map(function closedCases(closed) {
      return it({ name: `retains history in ${phase} with closed ${String(closed)}`, fn: async function retain() {
        /** Construction itself performs no delivery, recording, or cancellation. */
        const f = createFailureFixture();
        assert.equal(f.failures.length, 0);
        assert.equal(f.events.length, 0);
        assert.equal(f.state.primary, undefined);
        assert.equal(f.controller.signal.aborted, false);
        f.state.phase = phase;
        f.state.closed = closed;
        /** Failure value identity is independent of the internal token. */
        const original = Object.freeze({ failure: 'original' });
        /** Original occurrence is appended even when delivery is already closed. */
        const token = f.owner.recordFailure({ error: original, at: 'first boundary' });
        assert.ok(token instanceof Error);
        assert.equal(token.message, 'Declared group failure already recorded');
        assert.equal(token.occurrence, f.failures[0]);
        assert.deepEqual(token.occurrence, { identity: {}, ordinal: 0, at: 'first boundary', error: original });
        assert.equal(token.occurrence.error, original);
        assert.equal(Object.isFrozen(token.occurrence), true);
        assert.equal(Object.isFrozen(token.occurrence.identity), true);
        if ((!closed) && (phase !== 'settled')) {
          assert.equal(f.state.primary, token);
          assert.equal(f.state.phase, 'failed');
          assert.deepEqual(f.events, ['reject', 'abort']);
          assert.equal(f.controller.signal.reason, original);
        } else {
          assert.equal(f.state.primary, undefined);
          assert.equal(f.state.phase, phase);
          assert.equal(f.events.length, 0);
          assert.equal(f.controller.signal.aborted, false);
        }
      } });
    });
  }),
  ...[undefined, null, 'original primitive', 17, Object.freeze({ original: true })].map(function opaqueCases(original) {
    return it({ name: `retains repeated opaque ${String(original)} occurrences independently`, fn: async function repeated() {
      /** Every new observation appends even when its value equals an earlier observation. */
      const f = createFailureFixture();
      /** First occurrence controls group cancellation and pending delivery. */
      const first = f.owner.recordFailure({ error: original, at: 'first' });
      /** Repeated value is a distinct failure occurrence, not duplicate delivery. */
      const second = f.owner.recordFailure({ error: original, at: 'second' });
      assert.notEqual(first, second);
      assert.notEqual(first.occurrence.identity, second.occurrence.identity);
      assert.equal(first.occurrence.error, original);
      assert.equal(second.occurrence.error, original);
      assert.equal(second.occurrence.ordinal, 1);
      assert.equal(second.occurrence.at, 'second');
      assert.equal(f.failures.length, 2);
      assert.equal(f.state.primary, first);
      assert.deepEqual(f.rejected, [original]);
      assert.deepEqual(f.events, ['reject', 'abort']);
    } });
  }),
  it({ name: 'retains own and foreign recorded tokens without appending or cancellation', fn: async function boundary() {
    /** Distinct helpers still share the original internal token category. */
    const first = createFailureFixture();
    /** Foreign ownership must not add an unsupported rejection boundary. */
    const other = createFailureFixture();
    /** Original token carries the original occurrence across helper boundaries. */
    const token = first.owner.recordFailure({ error: 'original', at: 'original' });
    assert.equal(first.owner.retainBoundaryFailure({ error: token, at: 'own replay' }), token);
    assert.equal(other.owner.retainBoundaryFailure({ error: token, at: 'foreign replay' }), token);
    assert.equal(first.failures.length, 1);
    assert.equal(other.failures.length, 0);
    assert.equal(other.events.length, 0);
    /** Unwrapped original values represent new observations on every arrival. */
    const raw = other.owner.retainBoundaryFailure({ error: 'original', at: 'raw' });
    assert.equal(raw.occurrence.error, 'original');
    assert.equal(raw.occurrence.at, 'raw');
    assert.notEqual(raw, token);
    assert.equal(other.owner.retainBoundaryFailure({ error: 'original', at: 'again' }).occurrence.ordinal, 1);
  } }),
  it({ name: 'retains published primary and history when pending rejection throws', fn: async function callbackFailure() {
    /** Callback failure leaves native cancellation untouched after primary publication. */
    const f = createFailureFixture();
    f.state.failReject = true;
    assert.throws(function fail() { f.owner.recordFailure({ error: 'original', at: 'first' }); }, function same(error: unknown) { return error === f.callbackFailure; });
    assert.equal(f.failures.length, 1);
    assert.equal(f.state.primary?.occurrence, f.failures[0]);
    assert.equal(f.state.phase, 'failed');
    assert.equal(f.controller.signal.aborted, false);
    assert.deepEqual(f.events, ['reject']);
    /** Subsequent observations append without repeating the failed delivery callback. */
    const later = f.owner.recordFailure({ error: 'later', at: 'second' });
    assert.equal(later.occurrence.ordinal, 1);
    assert.equal(f.state.primary?.occurrence, f.failures[0]);
    assert.deepEqual(f.events, ['reject']);
  } }),
] });
//endregion
