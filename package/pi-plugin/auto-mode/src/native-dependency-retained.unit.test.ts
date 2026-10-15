/** Built dependency release distinguishes terminal failure from retained freshness. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createDependencyFixture } from './native-dependency-fixture.ts';

//region Terminal evidence never regains live eligibility while retained dependencies stay observable.
await describe({ name: '', children: [
  it({ name: 'preserves closure failure precedence and exact original causes', fn: async function terminalPrecedence() {
    /** Multiple terminal flags expose the original diagnostic precedence. */
    const f = createDependencyFixture();
    /** Finalization failure remains distinct from preparation failure. */
    const finalizationFailure = new Error('original closure failed');
    /** Preparation failure remains available after removing the closure flag. */
    const preparationFailure = new Error('original preparation failed');
    f.preparation.closeFailed = true;
    f.preparation.finalRecord = { failure: finalizationFailure };
    f.preparation.preparationFailed = true;
    f.preparation.preparationFailure = preparationFailure;
    f.preparation.finished = true;
    assert.throws(function failedClosure() { 
      f.owner.active(); 
    }, { message: 'Judgment finalization failed permanently', cause: finalizationFailure });
    assert.throws(function releaseFailedClosure() { 
      f.owner.assertDependenciesCurrent(); 
    }, { message: 'Failed finalization cannot release dependencies' });
    f.preparation.closeFailed = false;
    assert.throws(function failedPreparation() { 
      f.owner.active(); 
    }, { message: 'Judgment preparation failed permanently', cause: preparationFailure });
    assert.throws(function releaseFailedPreparation() { 
      f.owner.assertDependenciesCurrent(); 
    }, { message: 'Judgment has no prepared dependency handle' });
    f.preparation.preparationFailed = false;
    assert.throws(function finishedJudgment() { 
      f.owner.active(); 
    }, { message: 'Judgment evidence collection is finished' });
    f.preparation.finished = false;
    f.preparation.prepared = false;
    assert.throws(function releaseUnprepared() { 
      f.owner.assertDependenciesCurrent(); 
    }, { message: 'Judgment has no prepared dependency handle' });
    assert.ok(f.events.every(function onlyState(point) { 
      return point === 'state'; 
    }));
  } }),
  it({ name: 'retains original request and program checks after the decision deadline', fn: async function retainedAfterDeadline() {
    /** Completed judgments do not reuse the expired decision clock for dependency release. */
    const f = createDependencyFixture();
    f.preparation.finished = true;
    f.clock.at = 5_000;
    f.state.failures.set('checkpoint', new Error('retained release must not checkpoint'));
    f.state.failures.set('finalize', new Error('retained release must not finalize live dependencies'));
    assert.equal(f.owner.assertDependenciesCurrent(), f.retainedProjection);
    assert.deepEqual(f.events, ['state', 'state', 'request', 'state', 'retained', 'program:z', 'program:a']);
    assert.equal(f.retainedHandles[0], f.handle);
    assert.equal(f.finalizeHandles.length, 0);
  } }),
  ...['request', 'retained', 'program:z', 'program:a'].map(function retainedFailure(point) {
    return it({ name: `permanently retires retained dependency release after ${point} failure`, fn: async function retainsFailure() {
      /** A completed decision can still lose original mechanical freshness. */
      const f = createDependencyFixture();
      f.preparation.finished = true;
      /** Exact original failure becomes the permanent eligibility cause. */
      const failure = new Error(`retained ${point} failed`);
      f.state.failures.set(point, failure);
      assert.throws(function failedRetained() { 
        f.owner.assertDependenciesCurrent(); 
      }, function same(error: unknown) { 
        return error === failure; 
      });
      f.state.failures.clear();
      f.events.length = 0;
      assert.throws(function repeatRetained() { 
        f.owner.assertDependenciesCurrent(); 
      }, { message: 'Original relation evidence lost dependency eligibility', cause: failure });
      assert.deepEqual(f.events, []);
    } });
  }),
  it({ name: 'rejects original request replacement after evidence closure', fn: async function rejectsRetainedReplacement() {
    /** Retained release still authenticates the original request identity. */
    const f = createDependencyFixture();
    f.preparation.finished = true;
    f.state.currentRequest = Object.freeze({});
    assert.throws(function replacedRetainedRequest() { 
      f.owner.assertDependenciesCurrent(); 
    }, { message: 'Enclosing request observation changed' });
    assert.deepEqual(f.events, ['state', 'state', 'request']);
  } }),
  ...['deadline', 'cancellation'].map(function lifetimeFailure(kind) {
    return it({ name: `retains actual built budget ${kind} failure for live authentication`, fn: async function retiresLifetime() {
      /** Actual original budget decides its own lifetime failure category. */
      const f = createDependencyFixture();
      if (kind === 'deadline') f.clock.at = 5_000;
      else f.controller.abort(new Error('original cancellation'));
      assert.throws(function expiredActive() { 
        f.owner.active(); 
      }, { name: kind === 'deadline' ? 'JudgmentDeadlineError' : 'JudgmentCancelledError' });
      assert.deepEqual(f.events, ['state', 'checkpoint']);
      f.events.length = 0;
      assert.throws(function retiredActive() { 
        f.owner.active(); 
      }, { message: 'Original relation evidence lost dependency eligibility' });
      assert.deepEqual(f.events, []);
    } });
  }),
] });
//endregion
