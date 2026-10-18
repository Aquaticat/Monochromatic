/**
 Built original program consumers verify declaration custody, reserved failure, and terminal inspection. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createFixtureProgramOwner, createProgramOwnerFixture, declareFixtureProgram } from './native-program-owner-fixture.ts';

await describe({
  name: '',
  children: [
    //region Original bootstrap and prepared inspection precede native parent execution.
    it({
      name: 'reads original bootstrap properties once without calling lazy capabilities',
      fn: async function originalBootstrap() {
        const { input, events } = createProgramOwnerFixture();
        const properties = ['readJudgment', 'response', 'stream', 'signal', 'knownMember', 'knownExecution', 'ready', 'dependencyCheck', 'assertDependenciesCurrent', 'parentCurrent', 'bindings', 'childGroups', 'operation'];
        const reads: string[] = [];
        const supplied: Record<string, unknown> = {};
        for (const property of properties) Object.defineProperty(supplied, property, { get() { 
          reads.push(property);
        return input[property]; 
        } });
        const owner = createFixtureProgramOwner(supplied);
        assert.equal(Object.isFrozen(owner), true);
        assert.deepEqual(Object.keys(owner), ['bindPreparedProgram', 'preparedProgramFor', 'openProgram', 'programFor', 'reachProgramGroup', 'reachedGroupFor', 'bindProgramCalls', 'prepareReachedMembers', 'scriptValueFor', 'markProgramGuard', 'inspectReachedGroup', 'inspectProgram']);
        assert.deepEqual(reads, properties);
        assert.deepEqual(events, []);
        assert.throws(function foreignProgram() { 
          owner.programFor({}); 
        }, { message: 'Program handle is not owned by this judgment' });
        assert.deepEqual(reads, properties);
      },
    }),
    it({
      name: 'retains absent inspection, original declaration identity, and prepared source without granting permission',
      fn: async function originalPreparedInspection() {
        const fixture = createProgramOwnerFixture();
        const { owner, member, declaration, record, assertCurrent, events } = fixture;
        assert.equal(owner.preparedProgramFor(member), undefined);
        const view = owner.bindPreparedProgram({ member, declaration, assertCurrent });
        assert.equal(view.member, member);
        assert.equal(view.prepared, record.prepared);
        assert.equal(view.declaration, declaration);
        assert.equal(view.permission, false);
        assert.equal(Object.isFrozen(view), true);
        assert.equal(owner.preparedProgramFor(member), view);
        assert.equal(record.preparedProgram?.assertCurrent, assertCurrent);
        assert.deepEqual(events, ['member', 'dependencies', 'parent', 'member', 'ready', 'dependency-check', 'tools', 'ready', 'member', 'dependencies', 'parent']);
        assert.throws(function repeatedInspection() { 
          owner.bindPreparedProgram({ member, declaration, assertCurrent }); 
        }, { message: 'Original prepared program inspection is already bound' });
      },
    }),
    it({
      name: 'rejects copied declarations, changed source, absent dependency readers, and entered members before publication',
      fn: async function originalInspectionAdmission() {
        const fixture = createProgramOwnerFixture();
        const { owner, member, declaration, assertCurrent, record } = fixture;
        assert.throws(function copiedDeclaration() { 
          owner.bindPreparedProgram({ member, declaration: { ...declaration }, assertCurrent }); 
        }, { name: 'ResultProgramProfileError' });
        const changed = declareFixtureProgram({ source: 'return await tools.read({ path: "changed.txt" });', toolNames: ['read'] });
        assert.throws(function changedSource() { 
          owner.bindPreparedProgram({ member, declaration: changed, assertCurrent }); 
        }, { message: 'Inspected program differs from the original prepared source' });
        assert.throws(function missingReader() { 
          owner.bindPreparedProgram({ member, declaration, assertCurrent: undefined }); 
        }, { message: 'Prepared program requires its original tool-dependency reader' });
        assert.equal(record.preparedProgram, undefined);
        fixture.begin();
        assert.throws(function enteredMember() { 
          owner.bindPreparedProgram({ member, declaration, assertCurrent }); 
        }, { message: 'Prepared program inspection requires an unentered original root member' });
      },
    }),
    ...['readyFailure', 'toolFailure'].map(function originalInspectionFailure(field) {
      return it({
        name: `retains exact ${field} without publishing a failed inspection`,
        fn: async function failedInspection() {
          const fixture = createProgramOwnerFixture();
          const failure = new Error('original inspection failure');
          if (field === 'readyFailure') fixture.state.readyFailure = failure;
          else fixture.state.toolFailure = failure;
          assert.throws(function inspectOriginalSource() { 
            fixture.owner.bindPreparedProgram({ member: fixture.member, declaration: fixture.declaration, assertCurrent: fixture.assertCurrent }); 
          }, function originalFailure(error) { 
            return error === failure; 
          });
          assert.equal(fixture.record.preparedProgram, undefined);
        },
      });
    }),
    //endregion
    //region Program opening reserves original ownership before declaration construction and retains terminal evidence.
    it({
      name: 'opens original parent and declaration identities and requires an owned producer before successors',
      fn: async function originalProgram() {
        const fixture = createProgramOwnerFixture();
        const program = fixture.open();
        const { owner, record, declaration, judgment, response, stream } = fixture;
        const view = owner.programFor(program);
        assert.equal(view.declaration, declaration);
        assert.equal(view.parent, record.execution?.token);
        assert.equal(view.judgment, judgment);
        assert.equal(view.response, response);
        assert.equal(view.stream, stream);
        assert.equal(view.permission, 'not-established');
        assert.equal(Object.isFrozen(view), true);
        assert.equal(Object.isFrozen(program), true);
        assert.throws(function repeatOpening() { 
          owner.openProgram({ parentToken: view.parent, toolNames: ['read', 'write'] }); 
        }, { message: 'Parent execution already reserved its program declaration' });
        assert.throws(function earlySuccessor() { 
          owner.reachProgramGroup({ program, ordinal: 1 }); 
        }, { message: 'Successor group requires the owned producer script value' });
        for (const ordinal of [-1, 2, 0.5, Number.NaN, '0']) assert.throws(function invalidGroupOrdinal() { 
          owner.reachProgramGroup({ program, ordinal }); 
        }, { message: 'Program group ordinal is outside original source' });
        const initial = owner.inspectProgram(program);
        assert.deepEqual(initial.groups.map(function originalState(group) { 
          return group.state; 
        }), ['unreached', 'unreached']);
        assert.equal(initial.producerValueReady, false);
        assert.equal(Object.hasOwn(initial, 'failure'), true);
        const reached = owner.reachProgramGroup({ program, ordinal: 0 });
        assert.equal(owner.reachProgramGroup({ program, ordinal: 0 }), reached);
        assert.equal(owner.reachedGroupFor(reached.handle), reached);
        assert.equal(reached.declaration, declaration);
        assert.deepEqual(reached.members[0]?.args, { path: 'source.txt' });
        assert.equal(Object.isFrozen(reached.members), true);
        assert.throws(function copiedProgram() { 
          owner.programFor({ ...program }); 
        }, { message: 'Program handle is not owned by this judgment' });
        assert.throws(function copiedGroup() { 
          owner.reachedGroupFor({ ...reached.handle }); 
        }, { message: 'Reached group handle is not owned by this judgment' });
      },
    }),
    ...['missing', 'callables'].map(function openingFailure(kind) {
      return it({
        name: `reserves a permanently failed program after ${kind} declaration admission`,
        fn: async function reservedProgramFailure() {
          const fixture = createProgramOwnerFixture();
          const { owner, record, member, declaration, assertCurrent } = fixture;
          if (kind === 'callables') owner.bindPreparedProgram({ member, declaration, assertCurrent });
          const parentToken = fixture.begin();
          const message = kind === 'missing' ? 'Native program requires its original declaration captured before policy review' : 'Runtime callables differ from the original prepared program';
          assert.throws(function failedOpening() { 
            owner.openProgram({ parentToken, toolNames: [] }); 
          }, { message });
          const program = record.program?.handle;
          assert.ok(program);
          const inspection = owner.inspectProgram(program);
          assert.equal(inspection.status, 'failed');
          assert.equal(inspection.failure, record.program?.failure);
          assert.equal(Object.hasOwn(inspection, 'declaration'), true);
          assert.throws(function retryFailedProgram() { 
            owner.programFor(program); 
          }, { message: 'Program declaration failed permanently', cause: inspection.failure });
          assert.throws(function reopenFailedProgram() { 
            owner.openProgram({ parentToken, toolNames: ['read', 'write'] }); 
          }, { message: 'Parent execution already reserved its program declaration' });
        },
      });
    }),
    it({
      name: 'keeps retained inspection available after parent return, dependency retirement, and cancellation',
      fn: async function retainedOriginalProgram() {
        const fixture = createProgramOwnerFixture();
        const program = fixture.open();
        const reached = fixture.owner.reachProgramGroup({ program, ordinal: 0 });
        assert.ok(fixture.record.execution);
        fixture.record.execution.state = 'returned';
        assert.throws(function returnedParent() { 
          fixture.owner.programFor(program); 
        }, { message: 'Program parent execution has returned' });
        fixture.state.dependencyFailure = new Error('original dependencies retired');
        fixture.parent.abort(new Error('original parent cancelled'));
        const count = fixture.events.length;
        assert.equal(fixture.owner.inspectProgram(program).status, 'open');
        assert.equal(fixture.owner.inspectReachedGroup(reached.handle).state, 'reached');
        assert.equal(fixture.events.length, count);
      },
    }),
    //endregion
  ],
});
