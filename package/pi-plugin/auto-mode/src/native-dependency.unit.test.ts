/** Built original dependency checks preserve observation order and permanent eligibility failure. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createDependencyFixture } from './native-dependency-fixture.ts';

//region Current request authentication precedes complete membership and live dependency release.
await describe({ name: '', children: [
  it({ name: 'constructs lazily and authenticates original request before prepared programs', fn: async function checksActive() {
    /** Factory creation must not observe callbacks or retain a binding segment. */
    const f = createDependencyFixture();
    assert.deepEqual(f.events, []);
    assert.ok(Object.isFrozen(f.owner));
    assert.equal(f.owner.isBindingSegmentActive(), false);
    f.owner.active();
    assert.deepEqual(f.events, ['state', 'checkpoint', 'request', 'program:z', 'program:a']);
    f.events.length = 0;
    f.owner.ready();
    assert.deepEqual(f.events, ['state', 'checkpoint', 'request', 'program:z', 'program:a', 'state', 'state', 'finalize', 'checkpoint', 'program:z', 'program:a']);
    assert.equal(f.finalizeHandles[0], f.handle);
    f.events.length = 0;
    assert.equal(f.owner.assertDependenciesCurrent(), f.liveProjection);
    assert.deepEqual(f.events, ['state', 'state', 'state', 'checkpoint', 'request', 'program:z', 'program:a', 'state', 'finalize', 'program:z', 'program:a']);
  } }),
  it({ name: 'preserves original dependency values including undefined and checks programs afterward', fn: async function preservesValues() {
    /** Values are independent of mechanical freshness results. */
    const f = createDependencyFixture();
    for (const value of [undefined, null, false, 0, Object.freeze({})]) {
      f.events.length = 0;
      assert.equal(f.owner.dependencyCheck(function readOriginal() { f.events.push('read'); return value; }), value);
      assert.deepEqual(f.events, ['read', 'program:z', 'program:a']);
    }
  } }),
  ...['checkpoint', 'request', 'program:z', 'program:a'].map(function failingObservation(point) {
    return it({ name: `retains first active dependency failure at ${point}`, fn: async function retainsFirst() {
      /** Original callback failure permanently retires live eligibility. */
      const f = createDependencyFixture();
      /** Later failures must not replace this original cause. */
      const first = new Error(`original ${point} failure`);
      f.state.failures.set(point, first);
      assert.throws(function failedActive() { f.owner.active(); }, function same(error: unknown) { return error === first; });
      f.state.failures.clear();
      /** Raw dependency checking retains its original unguarded callback behavior. */
      const second = new Error('later observation failure');
      assert.throws(function laterDependencyFailure() {
        f.owner.dependencyCheck(function failLater() { throw second; });
      }, function same(error: unknown) { return error === second; });
      for (const operation of [f.owner.active, f.owner.ready, f.owner.assertDependenciesCurrent]) {
        f.events.length = 0;
        assert.throws(operation, { name: 'JudgmentConstructionError', message: 'Original relation evidence lost dependency eligibility', cause: first });
        assert.deepEqual(f.events, []);
      }
    } });
  }),
  it({ name: 'rejects a replaced original request and retains that first eligibility failure', fn: async function rejectsReplacement() {
    /** Equal-looking foreign request identity must fail before prepared program callbacks. */
    const f = createDependencyFixture();
    f.state.currentRequest = Object.freeze({});
    assert.throws(function replacedRequest() { f.owner.active(); }, { name: 'JudgmentConstructionError', message: 'Enclosing request observation changed' });
    assert.deepEqual(f.events, ['state', 'checkpoint', 'request']);
    f.state.currentRequest = f.receipt;
    f.events.length = 0;
    assert.throws(function restoredRequest() { f.owner.ready(); }, { message: 'Original relation evidence lost dependency eligibility' });
    assert.deepEqual(f.events, []);
  } }),
  it({ name: 'keeps incomplete membership and direct state-read failures outside retained eligibility', fn: async function preservesBoundary() {
    /** Membership can become available after its original readiness refusal. */
    const f = createDependencyFixture();
    f.preparation.prepared = false;
    assert.throws(function incompleteMembership() { f.owner.ready(); }, { message: 'Complete final prepared membership is unavailable' });
    assert.equal(f.events.includes('finalize'), false);
    f.preparation.prepared = true;
    f.owner.ready();
    /** Direct state reads precede the dependency retention boundary. */
    const failure = new Error('state reader failed');
    f.state.failures.set('state', failure);
    assert.throws(function failedState() { f.owner.active(); }, function same(error: unknown) { return error === failure; });
    f.state.failures.clear();
    f.owner.active();
  } }),
  ...['finalize', 'checkpoint'].map(function readinessFailure(point) {
    return it({ name: `retains original readiness failure at ${point}`, fn: async function retainsReadyFailure() {
      /** The second checkpoint follows dependency finalization. */
      const f = createDependencyFixture();
      /** Original failure remains the later permanent eligibility cause. */
      const failure = new Error(`ready ${point} failed`);
      f.state.onStep = function failAfterEntry(current) {
        if (current === 'finalize') f.state.failures.set(point, failure);
      };
      assert.throws(function failedReady() { f.owner.ready(); }, function same(error: unknown) { return error === failure; });
      delete f.state.onStep;
      f.state.failures.clear();
      assert.throws(function retiredReady() { f.owner.ready(); }, { message: 'Original relation evidence lost dependency eligibility', cause: failure });
    } });
  }),
] });
//endregion
