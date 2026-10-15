/**
 Built original program groups verify native call admission, final member publication, and cancellation. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createProgramOwnerFixture } from './native-program-owner-fixture.ts';
import { createProgramGroupFixture } from './native-program-group-fixture.ts';

await describe({
  name: '',
  children: [
    //region Native call binding and final preparation preserve complete original group identity.
    it({
      name: 'publishes complete native slots and original prepared members once',
      fn: async function originalPreparedGroup() {
        const fixture = createProgramOwnerFixture();
        const program = fixture.open();
        const group = createProgramGroupFixture({ fixture, program });
        const slots = group.bind();
        assert.equal(Object.isFrozen(slots), true);
        assert.equal(fixture.owner.inspectReachedGroup(group.reached.handle).state, 'bound');
        assert.throws(function repeatedBinding() { 
          group.bind(); 
        }, { message: 'Reached group native calls cannot be rebound' });
        const members = group.prepare();
        assert.equal(Object.isFrozen(members), true);
        const [member] = members;
        assert.ok(member);
        assert.equal(Object.isFrozen(member), true);
        const record = fixture.bindings.get(member);
        assert.ok(record);
        assert.equal(record.prepared, group.members[0]);
        assert.equal(record.parent, fixture.record.execution?.token);
        assert.equal(record.execution, undefined);
        assert.equal(record.effectiveSignal.aborted, false);
        assert.equal(fixture.childGroups.length, 1);
        assert.equal(record.group, fixture.childGroups[0]);
        const inspection = fixture.owner.inspectReachedGroup(group.reached.handle);
        assert.deepEqual(inspection.members, [{ id: group.members[0]?.id, state: 'unentered' }]);
        assert.equal(inspection.nativeReturns[0]?.state, 'uninvoked');
        assert.equal(inspection.state, 'prepared');
        assert.throws(function repeatedPreparation() { 
          group.prepare(); 
        }, { message: 'Reached group cannot be prepared again' });
      },
    }),
    ...['calls-array', 'calls-length', 'tools-array', 'tools-length', 'runner', 'call-null', 'call-type', 'call-id', 'call-name', 'tool-name', 'arguments'].map(function nativeAdmission(kind) {
      return it({
        name: `rejects ${kind} before publishing native slots and retains the failed group`,
        fn: async function failedNativeBinding() {
          const fixture = createProgramOwnerFixture();
          const group = createProgramGroupFixture({ fixture, program: fixture.open() });
          const [call] = group.calls;
          assert.ok(call);
          const input: Record<string, unknown> = { group: group.reached.handle, calls: group.calls, tools: group.tools, runNative: function originalNative() { 
            throw new Error('Unreached native runner'); 
          } };
          if (kind === 'calls-array') input.calls = {};
          if (kind === 'calls-length') input.calls = [];
          if (kind === 'tools-array') input.tools = {};
          if (kind === 'tools-length') input.tools = [];
          if (kind === 'runner') input.runNative = undefined;
          if (kind === 'call-null') input.calls = [null];
          if (kind === 'call-type') input.calls = [{ ...call, type: 'text' }];
          if (kind === 'call-id') input.calls = [{ ...call, id: '' }];
          if (kind === 'call-name') input.calls = [{ ...call, name: 'write' }];
          if (kind === 'tool-name') input.tools = [{ name: 'write' }];
          if (kind === 'arguments') input.calls = [{ ...call, arguments: { path: 'changed.txt' } }];
          assert.throws(function rejectOriginalCall() { 
            fixture.owner.bindProgramCalls(input); 
          }, { name: 'JudgmentConstructionError' });
          const inspection = fixture.owner.inspectReachedGroup(group.reached.handle);
          assert.equal(inspection.state, 'failed');
          assert.deepEqual(inspection.nativeReturns, []);
          assert.equal(fixture.childGroups.length, 0);
          assert.throws(function retryFailedBinding() { 
            group.bind(); 
          }, { message: 'Reached group failed permanently', cause: inspection.failure });
        },
      });
    }),
    ...['members-array', 'members-unfrozen', 'members-length', 'signals-array', 'signals-length', 'member-null', 'member-unfrozen', 'member-id', 'member-name', 'input-unfrozen', 'input-changed', 'input-nonfinite', 'signal-type'].map(function childAdmission(kind) {
      return it({
        name: `rejects ${kind} before publishing prepared child members`,
        fn: async function failedChildPreparation() {
          const fixture = createProgramOwnerFixture();
          const group = createProgramGroupFixture({ fixture, program: fixture.open() });
          group.bind();
          const [member] = group.members;
          assert.ok(member);
          const input: Record<string, unknown> = { group: group.reached.handle, members: group.members, nativeSignals: group.signals };
          if (kind === 'members-array') input.members = {};
          if (kind === 'members-unfrozen') input.members = [...group.members];
          if (kind === 'members-length') input.members = Object.freeze([]);
          if (kind === 'signals-array') input.nativeSignals = {};
          if (kind === 'signals-length') input.nativeSignals = [];
          if (kind === 'member-null') input.members = Object.freeze([null]);
          if (kind === 'member-unfrozen') input.members = Object.freeze([{ ...member }]);
          if (kind === 'member-id') input.members = Object.freeze([Object.freeze({ ...member, id: 'changed' })]);
          if (kind === 'member-name') input.members = Object.freeze([Object.freeze({ ...member, name: 'changed' })]);
          if (kind === 'input-unfrozen') input.members = Object.freeze([Object.freeze({ ...member, input: { ...member.input } })]);
          if (kind === 'input-changed') input.members = Object.freeze([Object.freeze({ ...member, input: Object.freeze({ path: 'changed.txt' }) })]);
          if (kind === 'input-nonfinite') input.members = Object.freeze([Object.freeze({ ...member, input: Object.freeze({ value: Number.NaN }) })]);
          if (kind === 'signal-type') input.nativeSignals = [{}];
          assert.throws(function rejectOriginalMember() { 
            fixture.owner.prepareReachedMembers(input); 
          }, { name: 'JudgmentConstructionError' });
          const inspection = fixture.owner.inspectReachedGroup(group.reached.handle);
          assert.equal(inspection.state, 'failed');
          assert.deepEqual(inspection.members, []);
          assert.equal(inspection.nativeReturns[0]?.state, 'uninvoked');
          assert.equal(fixture.childGroups.length, 0);
          assert.throws(function retryFailedPreparation() { 
            group.prepare(); 
          }, { message: 'Reached group failed permanently', cause: inspection.failure });
        },
      });
    }),
    //endregion
    //region Cancellation and group storage limits preserve original failure publication timing.
    ...['judgment', 'parent', 'native'].map(function cancellationSource(kind) {
      return it({
        name: `retains original ${kind} cancellation before final preparation`,
        fn: async function cancelledChildPreparation() {
          const fixture = createProgramOwnerFixture();
          const group = createProgramGroupFixture({ fixture, program: fixture.open() });
          group.bind();
          const controller = kind === 'judgment' ? fixture.controller : kind === 'parent' ? fixture.parent : group.controllers[0];
          assert.ok(controller);
          const failure = new Error('original cancellation reason');
          controller.abort(failure);
          assert.throws(function prepareCancelledGroup() { 
            group.prepare(); 
          }, function exactFailure(error) { 
            return error === failure; 
          });
          assert.equal(fixture.owner.inspectReachedGroup(group.reached.handle).state, kind === 'parent' ? 'bound' : 'failed');
          assert.equal(fixture.childGroups.length, 0);
        },
      });
    }),
    it({
      name: 'rejects oversized final member storage before child publication',
      fn: async function finalGroupByteBound() {
        const fixture = createProgramOwnerFixture();
        const group = createProgramGroupFixture({ fixture, program: fixture.open() });
        group.bind();
        const [member] = group.members;
        assert.ok(member);
        const members = Object.freeze([Object.freeze({ ...member, retainedMetadata: 'x'.repeat(1_048_576) })]);
        assert.throws(function oversizedFinalGroup() { 
          fixture.owner.prepareReachedMembers({ group: group.reached.handle, members, nativeSignals: group.signals }); 
        }, { message: 'Final reached group exceeds one MiB' });
        assert.equal(fixture.owner.inspectReachedGroup(group.reached.handle).state, 'failed');
        assert.equal(fixture.childGroups.length, 0);
      },
    }),
    //endregion
  ],
});
