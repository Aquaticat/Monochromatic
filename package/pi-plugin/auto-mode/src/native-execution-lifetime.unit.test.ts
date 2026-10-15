/**
 Built native execution consumers distinguish child entry from already-active child lifetime. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createExecutionFixture, type ExecutionFixtureRecord } from './native-execution-fixture.ts';

await describe({
  name: 'original execution lifetime',
  children: [
    //region Immediate parent liveness is required at child entry, not throughout active child execution.
    it({
      name: 'retains active child origin after parent return while rejecting a new native entry',
      fn: async () => {
        /** Independent root closes its evidence before any original execution is reserved. */
        const f = createExecutionFixture();
        f.state.finished = true;
        /** Original parent token is retained by every direct child. */
        const parent = f.owner.beginExecution(f.member);
        /** Child cancellation remains independent of original parent cancellation. */
        const childController = new AbortController();
        /** Opaque child occurrence is distinct from its parent and prepared content. */
        const child = Object.freeze({});
        /** Original child record carries immediate-parent identity and its own effective signal. */
        const record: ExecutionFixtureRecord = {
          parent,
          effectiveSignal: childController.signal,
          prepared: Object.freeze({ id: 'child', name: 'read', input: Object.freeze({ path: 'child.txt' }) })
        };
        f.bindings.set(child, record);
        f.byMember.set('child', child);
        /** Real child reservation and native entry occur while the original parent remains active. */
        const token = f.owner.beginExecution(child);
        /** Child origin retains its own prepared data and effective cancellation. */
        const origin = f.owner.executionEntryFor(token);
        assert.equal(origin.member, child);
        assert.equal(origin.prepared, record.prepared);
        assert.equal(origin.signal, childController.signal);
        f.owner.finishExecution(parent);
        f.events.length = 0;
        assert.equal(f.owner.executionFor(token), origin);
        assert.deepEqual(f.events, ['dependencies']);
        assert.throws(() => f.owner.assertExecutionEntry(token), { name: 'JudgmentConstructionError', message: 'Immediate parent execution has returned before child entry' });
        assert.throws(() => f.owner.executionEntryFor(token), { name: 'JudgmentConstructionError', message: 'Immediate parent execution has returned before child entry' });
        assert.throws(() => f.owner.parentCurrent(record), { name: 'JudgmentConstructionError', message: 'Immediate parent execution has returned before child entry' });
        f.owner.finishExecution(token);
        assert.deepEqual(f.owner.inspectExecution(token), { retainedOnly: true, state: 'returned' });
      }
    }),
    it({
      name: 'rejects returned and foreign parents before reservation without publishing child execution',
      fn: async () => {
        /** Independent root supplies a valid parent that can be retired before child entry. */
        const f = createExecutionFixture();
        f.state.finished = true;
        /** Original parent is authenticated even after its terminal return. */
        const parent = f.owner.beginExecution(f.member);
        f.owner.finishExecution(parent);
        /** New child remains unentered while its original parent has already returned. */
        const child = Object.freeze({});
        /** Prepared record uses the original root signal solely to isolate parent lifetime checks. */
        const record: ExecutionFixtureRecord = { parent, prepared: f.record.prepared, effectiveSignal: f.controller.signal };
        f.bindings.set(child, record);
        f.events.length = 0;
        assert.throws(() => f.owner.beginExecution(child), { name: 'JudgmentConstructionError', message: 'Immediate parent execution has returned before child entry' });
        assert.equal(record.execution, undefined);
        assert.deepEqual(f.events, ['closure', 'dependencies']);
        /** Foreign parent occurrence cannot acquire ownership through copied child metadata. */
        const foreign: ExecutionFixtureRecord = { ...record, parent: Object.freeze({}) };
        f.bindings.set(child, foreign);
        assert.throws(() => f.owner.beginExecution(child), { name: 'JudgmentConstructionError', message: 'Execution occurrence is not owned by this judgment' });
        assert.equal(foreign.execution, undefined);
      }
    }),
    //endregion
    //region Cancellation and failed origin capture cannot publish an execution occurrence.
    it({
      name: 'preserves original cancellation before root reservation',
      fn: async () => {
        /** A closed judgment still requires its effective execution signal to remain live. */
        const f = createExecutionFixture();
        f.state.finished = true;
        /** Exact abort reason must propagate without allocating a visible occurrence. */
        const failure = new Error('original signal canceled');
        f.controller.abort(failure);
        assert.throws(() => f.owner.beginExecution(f.member), failure);
        assert.equal(f.record.execution, undefined);
        assert.deepEqual(f.events, ['closure', 'dependencies']);
      }
    }),
    it({
      name: 'does not publish when original judgment identity capture throws and permits a later valid reservation',
      fn: async () => {
        /** Origin capture is independently controlled without modifying production custody. */
        const f = createExecutionFixture();
        f.state.finished = true;
        /** Exact capture failure reaches the caller before the record is published. */
        const failure = new Error('origin unavailable');
        f.state.judgmentFailure = failure;
        assert.throws(() => f.owner.beginExecution(f.member), failure);
        assert.equal(f.record.execution, undefined);
        delete f.state.judgmentFailure;
        /** Successful later capture reserves the same original member exactly once. */
        const token = f.owner.beginExecution(f.member);
        assert.equal(f.owner.knownExecution(token).execution?.token, token);
        assert.equal(f.owner.executionFor(token).judgment, f.judgment);
      }
    }),
    it({
      name: 'keeps child-specific cancellation independent of the active parent signal',
      fn: async () => {
        /** Root is active while a separately canceled child attempts its first reservation. */
        const f = createExecutionFixture();
        f.state.finished = true;
        /** Original parent remains eligible throughout this child cancellation probe. */
        const parent = f.owner.beginExecution(f.member);
        /** Child signal differs from the live parent signal. */
        const controller = new AbortController();
        /** Exact child cancellation reason must win after parent authentication succeeds. */
        const failure = new Error('child canceled');
        controller.abort(failure);
        /** Opaque child occurrence is prepared but has never entered. */
        const child = Object.freeze({});
        /** Independent cancellation is carried by the original child record. */
        const record: ExecutionFixtureRecord = { parent, prepared: f.record.prepared, effectiveSignal: controller.signal };
        f.bindings.set(child, record);
        assert.throws(() => f.owner.beginExecution(child), failure);
        assert.equal(record.execution, undefined);
        assert.equal(f.owner.inspectExecution(parent).state, 'active');
        assert.equal(f.owner.executionFor(parent).signal, f.controller.signal);
      }
    })
    //endregion
  ]
});
