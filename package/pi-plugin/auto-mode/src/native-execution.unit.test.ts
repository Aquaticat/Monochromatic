/**
 Built native execution consumers preserve identity, once-only reservation, and terminal inspection. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createExecutionFixture } from './native-execution-fixture.ts';

await describe({
  name: 'original native execution ownership',
  children: [
    //region Successful reservation retains identities without granting execution permission.
    it({
      name: 'constructs without live reads and retains original lookup and entry identities',
      fn: async () => {
        /** Independent consumer supplies all original identities and eligibility. */
        const f = createExecutionFixture();
        assert.deepEqual(f.events, []);
        assert.equal(f.owner.knownMember(f.member), f.record);
        assert.equal(f.owner.memberFor('root'), f.member);
        assert.deepEqual(f.events, ['dependencies']);
        f.state.finished = true;
        /** The real owner reserves one original occurrence. */
        const token = f.owner.beginExecution(f.member);
        assert.ok(Object.isFrozen(token));
        assert.equal(f.owner.knownExecution(token), f.record);
        assert.equal(f.owner.knownExecution(token).execution?.token, token);
        /** Current native entry returns exactly the origin retained in the shared record. */
        const origin = f.owner.executionEntryFor(token);
        assert.equal(origin, f.record.execution?.origin);
        assert.equal(f.owner.executionFor(token), origin);
        assert.ok(Object.isFrozen(origin));
        assert.deepEqual(Reflect.ownKeys(origin), ['judgment', 'response', 'stream', 'signal', 'member', 'prepared', 'permission']);
        assert.equal(origin.judgment, f.judgment);
        assert.equal(origin.response, f.response);
        assert.equal(origin.stream, f.stream);
        assert.equal(origin.signal, f.controller.signal);
        assert.equal(origin.member, f.member);
        assert.equal(origin.prepared, f.record.prepared);
        assert.equal(origin.permission, 'not-established');
        assert.deepEqual(f.events, ['dependencies', 'closure', 'dependencies', 'judgment', 'dependencies', 'dependencies']);
        assert.deepEqual(f.owner.inspectExecution(token), { retainedOnly: true, state: 'active' });
        assert.ok(Object.isFrozen(f.owner.inspectExecution(token)));
        f.owner.finishExecution(token);
        f.owner.finishExecution(token);
        assert.deepEqual(f.owner.inspectExecution(token), { retainedOnly: true, state: 'returned' });
        assert.equal(f.record.execution?.state, 'returned');
        assert.equal(f.owner.knownExecution(token), f.record);
      }
    }),
    //endregion
    //region Admission rejects foreign handles and preserves original check ordering.
    it({
      name: 'requires successful closure before reservation and preserves retry after preflight failure',
      fn: async () => {
        /** Independent closure flags reproduce open and permanently failed evidence. */
        const f = createExecutionFixture();
        assert.throws(() => f.owner.beginExecution(f.member), /successfully closed evidence/);
        assert.deepEqual(f.events, ['closure']);
        assert.equal(f.record.execution, undefined);
        f.state.finished = true;
        f.state.closeFailed = true;
        assert.throws(() => f.owner.beginExecution(f.member), /successfully closed evidence/);
        f.state.closeFailed = false;
        /** Original dependency failure must be returned unchanged before any reservation. */
        const failure = new Error('source retired');
        f.state.dependencyFailure = failure;
        assert.throws(() => f.owner.beginExecution(f.member), failure);
        assert.equal(f.record.execution, undefined);
        delete f.state.dependencyFailure;
        /** Successful recovery still reserves the same original prepared member. */
        const token = f.owner.beginExecution(f.member);
        f.state.dependencyFailure = failure;
        assert.throws(() => f.owner.beginExecution(f.member), /already reserved/);
        assert.equal(f.owner.knownExecution(token).execution?.token, token);
      }
    }),
    ...[undefined, null, 7, 'root', {}, Object.freeze({ id: 'root' })].map(function foreignOccurrence(foreign, ordinal) {
      return it({
        name: `rejects foreign membership and execution case ${String(ordinal)}`,
        fn: async () => {
          /** Each malformed value receives a fresh owner with no reserved occurrences. */
          const f = createExecutionFixture();
          assert.throws(() => f.owner.knownMember(foreign), /member handle is not owned/);
          assert.throws(() => f.owner.beginExecution(foreign), /member handle is not owned/);
          assert.throws(() => f.owner.knownExecution(foreign), /Execution occurrence is not owned/);
          assert.throws(() => f.owner.assertExecutionEntry(foreign), /Execution occurrence is not owned/);
          assert.throws(() => f.owner.executionEntryFor(foreign), /Execution occurrence is not owned/);
          assert.throws(() => f.owner.executionFor(foreign), /Execution occurrence is not owned/);
          assert.throws(() => f.owner.finishExecution(foreign), /Execution occurrence is not owned/);
          assert.throws(() => f.owner.inspectExecution(foreign), /Execution occurrence is not owned/);
          assert.deepEqual(f.events, []);
        }
      });
    }),
    it({
      name: 'checks dependencies before identifier lookup and preserves missing-member rejection',
      fn: async () => {
        /** Missing identifier must still cross the original dependency boundary first. */
        const f = createExecutionFixture();
        assert.throws(() => f.owner.memberFor('missing'), /not in the prepared native group/);
        /** Exact source failure takes precedence over absence of the identifier. */
        const failure = new Error('source unavailable');
        f.state.dependencyFailure = failure;
        assert.throws(() => f.owner.memberFor('missing'), failure);
        assert.deepEqual(f.events, ['dependencies', 'dependencies']);
      }
    }),
    //endregion
    //region Terminal operations preserve retained state after eligibility is lost.
    it({
      name: 'keeps retained inspection and terminal marking available after cancellation and source retirement',
      fn: async () => {
        /** Successful reservation precedes independent dependency and cancellation failures. */
        const f = createExecutionFixture();
        f.state.finished = true;
        /** Original occurrence is shared between entry and retained inspection. */
        const token = f.owner.beginExecution(f.member);
        /** Distinct failures expose dependency-before-cancellation ordering. */
        const retired = new Error('dependencies retired');
        /** Original cancellation reason must survive native origin checks unchanged. */
        const aborted = new Error('native cancellation');
        f.state.dependencyFailure = retired;
        f.controller.abort(aborted);
        assert.throws(() => f.owner.executionFor(token), retired);
        assert.throws(() => f.owner.executionEntryFor(token), retired);
        delete f.state.dependencyFailure;
        assert.throws(() => f.owner.executionFor(token), aborted);
        assert.throws(() => f.owner.executionEntryFor(token), aborted);
        f.state.dependencyFailure = retired;
        f.events.length = 0;
        f.owner.finishExecution(token);
        assert.deepEqual(f.owner.inspectExecution(token), { retainedOnly: true, state: 'returned' });
        assert.throws(() => f.owner.executionFor(token), /Parent execution occurrence has returned/);
        assert.throws(() => f.owner.executionEntryFor(token), /returned before native entry/);
        assert.throws(() => f.owner.assertExecutionEntry(token), /returned before native entry/);
        assert.deepEqual(f.events, []);
      }
    })
    //endregion
  ]
});
