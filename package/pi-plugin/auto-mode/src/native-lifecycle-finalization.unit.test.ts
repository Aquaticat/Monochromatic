/** Built lifecycle closure retains original batch order, dependency identity, and permanent failure outcomes. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createLifecycleFixture } from './native-lifecycle-fixture.ts';
import { createSelectionBinding } from './native-selection-fixture.ts';

//region Successful closure retains evidence without policy, instruction authority, or human permission.
await describe({ name: '', children: [
  it({ name: 'closes mixed assessed and unassessed batches in original issuance order', fn: async function retainsClosure() {
    /** Native selection, budget, and dependency projection stay independently observable. */
    const f = createLifecycleFixture();
    /** First batch remains unassessed until finalization. */
    const first = f.owner.issue([f.claim]);
    /** Another original predicate establishes independent batch membership. */
    const secondClaim = f.selection.declare({ definitionId: 'second', bindingHandle: createSelectionBinding() });
    /** The later batch reaches successful terminal assessment first. */
    const second = f.owner.issue([secondClaim]);
    /** Its exact terminal result must survive final closure unchanged. */
    const assessed = await f.owner.assess(second);
    f.events.length = 0;
    /** Closure retains original dependencies and accounting alongside explicit qualifiers. */
    const closed = f.owner.finalize();
    assert.equal(closed, f.owner.state.finalRecord);
    assert.equal(closed.dependencies, f.dependencies);
    assert.equal(closed.parentJSON, '{"original":"parent"}');
    assert.equal(closed.status, 'evidence-closed');
    assert.equal(closed.evidenceOnly, true);
    assert.equal(closed.policyVerdict, 'not-established');
    assert.equal(closed.instructionAuthority, 'not-established');
    assert.equal(closed.humanPermission, false);
    assert.equal(closed.accounting.finished, true);
    assert.equal(closed.accounting.attempts, 1);
    assert.equal(f.owner.state.finished, true);
    assert.equal(f.owner.state.closeFailed, false);
    assert.ok(Object.isFrozen(closed));
    assert.ok(Object.isFrozen(closed.batches));
    assert.deepEqual(Reflect.ownKeys(closed), ['evidenceOnly', 'status', 'policyVerdict', 'instructionAuthority', 'humanPermission', 'dependencies', 'accounting', 'parentJSON', 'batches']);
    assert.equal(closed.batches[0], f.selection.resultFor(first));
    assert.equal(closed.batches[1], assessed);
    assert.equal(f.selection.resultFor(first).discarded, true);
    /** Unassessed batches retain the exact original closure diagnostic. */
    const failure = f.selection.resultFor(first).failure;
    assert.ok(Error.isError(failure));
    assert.equal(failure.message, 'Judgment closed before this question batch was dispatched');
    assert.deepEqual(f.events, ['selection', 'selection', 'selection', 'ready', 'segment:readIssuedBatchResults:enter', 'selection', 'selection', 'segment:readIssuedBatchResults:exit', 'dependencyHandle', 'finalizeDependencies', 'active', 'finish']);
    f.events.length = 0;
    assert.throws(function closeAgain() { f.owner.finalize(); },
      { name: 'JudgmentConstructionError', message: 'Judgment already has a finalization outcome' });
    assert.deepEqual(f.events, []);
  } }),
  it({ name: 'closes an empty original selection without dispatching transport', fn: async function closesEmpty() {
    /** Empty evidence still consumes original dependency closure and final accounting. */
    const f = createLifecycleFixture();
    /** No fabricated batch is needed to obtain the original terminal outcome. */
    const closed = f.owner.finalize();
    assert.deepEqual(closed.batches, []);
    assert.equal(closed.accounting.attempts, 0);
    assert.equal(closed.accounting.finished, true);
    assert.equal(f.attempts.length, 0);
    assert.equal(f.owner.state.finalRecord, closed);
  } }),
  ...['ready', 'segment:readIssuedBatchResults:enter', 'segment:readIssuedBatchResults:exit', 'dependencyHandle', 'finalizeDependencies', 'active', 'finish'].map(function closureBoundary(point) {
    return it({ name: `retains permanent original closure failure at ${point}`, fn: async function failsClosure() {
      /** Unassessed evidence must be discarded even when later readiness fails. */
      const f = createLifecycleFixture();
      /** Original issued membership remains in retained closure diagnostics. */
      const batch = f.owner.issue([f.claim]);
      /** Failure identity must be retained without an implicit retry path. */
      const failure = new Error(point);
      f.state.failures.set(point, failure);
      assert.throws(function failedClosure() { f.owner.finalize(); }, failure);
      assert.equal(f.owner.state.finished, false);
      assert.equal(f.owner.state.closeFailed, true);
      assert.equal(f.selection.resultFor(batch).discarded, true);
      /** Frozen retained diagnostics do not represent successfully closed evidence. */
      const retained = f.owner.state.finalRecord;
      assert.ok(retained !== undefined);
      assert.equal(retained.status, 'close-failed');
      assert.equal(retained.retainedOnly, true);
      assert.equal(retained.failure, failure);
      assert.equal(retained.accounting.finished, false);
      assert.deepEqual(retained.batches, [f.selection.inspectBatch(batch)]);
      assert.ok(Object.isFrozen(retained));
      assert.ok(Object.isFrozen(retained.batches));
      assert.deepEqual(Reflect.ownKeys(retained), ['retainedOnly', 'status', 'failure', 'accounting', 'batches']);
      assert.ok(f.events.indexOf('ready') > f.events.indexOf('selection'));
      f.state.failures.clear();
      f.events.length = 0;
      assert.throws(function retryClosure() { f.owner.finalize(); },
        { name: 'JudgmentConstructionError', message: 'Judgment already has a finalization outcome' });
      assert.equal(f.owner.state.finalRecord, retained);
      assert.deepEqual(f.events, []);
    } });
  }),
  ...['discard', 'resultFor'].map(function selectionFailure(method) {
    return it({ name: `retains selection ${method} failure during closure`, fn: async function retainsSelectionFailure() {
      /** Real selection retains inspection after a selected operation fails. */
      const f = createLifecycleFixture();
      /** Issued membership must survive the original closure failure. */
      const batch = f.owner.issue([f.claim]);
      /** The exact selection failure remains the final failure value. */
      const failure = new Error(method);
      f.state.selection = { ...f.selection, [method]: function fail() { throw failure; } };
      assert.throws(function failedClosure() { f.owner.finalize(); }, failure);
      assert.equal(f.owner.state.closeFailed, true);
      assert.equal(f.owner.state.finalRecord?.failure, failure);
      assert.deepEqual(f.owner.state.finalRecord?.batches, [f.selection.inspectBatch(batch)]);
    } });
  }),
  ...['diagnostics', 'inspectBatch'].map(function retentionBoundary(point) {
    return it({ name: `preserves original secondary ${point} failure and permanently closes retry`, fn: async function failsRetention() {
      /** Failed diagnostic retention must not turn the judgment back into an open lifetime. */
      const f = createLifecycleFixture();
      f.owner.issue([f.claim]);
      /** Primary closure failure is distinct from the secondary retained-state failure. */
      const primary = new Error('closure failed');
      /** Original secondary failure escapes exactly as in the original constructor. */
      const secondary = new Error(point);
      f.state.failures.set('ready', primary);
      if (point === 'diagnostics') f.state.failures.set(point, secondary);
      else {
        f.state.onStep = function failRetainedInspection(boundary) {
          if (boundary === 'ready') f.state.selection = { ...f.selection, inspectBatch: function fail() { throw secondary; } };
        };
      }
      assert.throws(function failedRetention() { f.owner.finalize(); }, secondary);
      assert.equal(f.owner.state.closeFailed, true);
      assert.equal(f.owner.state.finished, false);
      assert.equal(f.owner.state.finalRecord, undefined);
      f.events.length = 0;
      assert.throws(function retryAfterRetentionFailure() { f.owner.finalize(); },
        { name: 'JudgmentConstructionError', message: 'Judgment already has a finalization outcome' });
      assert.deepEqual(f.events, []);
    } });
  }),
] });
//endregion
