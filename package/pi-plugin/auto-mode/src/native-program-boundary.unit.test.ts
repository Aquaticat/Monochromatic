/**
 Built original program boundaries verify prepublication dependency checks, complete groups, and byte limits. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createFixtureProgramOwner, createProgramOwnerFixture } from './native-program-owner-fixture.ts';
import { createProgramGroupFixture } from './native-program-group-fixture.ts';

await describe({
  name: '',
  children: [
    //region Construction preserves original unbound views and publication timing through callback failures.
    ...['returned', 'dependencies', 'cancelled'].map(function openingPreflight(kind) {
      return it({
        name: `rejects ${kind} parent entry before reserving a program`,
        fn: async function originalOpeningPreflight() {
          const fixture = createProgramOwnerFixture();
          fixture.owner.bindPreparedProgram({ member: fixture.member, declaration: fixture.declaration, assertCurrent: fixture.assertCurrent });
          const parentToken = fixture.begin();
          const failure = new Error('original opening preflight failed');
          assert.ok(fixture.record.execution);
          if (kind === 'returned') fixture.record.execution.state = 'returned';
          if (kind === 'dependencies') fixture.state.dependencyFailure = failure;
          if (kind === 'cancelled') fixture.parent.abort(failure);
          assert.throws(function rejectOriginalOpening() { fixture.owner.openProgram({ parentToken, toolNames: ['read', 'write'] }); }, function originalFailure(error) { return kind === 'returned' ? (Error.isError(error)) && (error.message === 'Program parent execution has returned') : error === failure; });
          assert.equal(fixture.record.program, undefined);
        },
      });
    }),
    it({
      name: 'rejects inspection for an original child and reserves failure for nonarray runtime callables',
      fn: async function originalRootAndCallableAdmission() {
        const fixture = createProgramOwnerFixture();
        const child = Object.freeze({});
        fixture.bindings.set(child, { ...fixture.record, parent: Object.freeze({}) });
        assert.throws(function inspectChildSource() { fixture.owner.bindPreparedProgram({ member: child, declaration: fixture.declaration, assertCurrent: fixture.assertCurrent }); }, { message: 'Prepared program inspection requires an unentered original root member' });
        fixture.owner.bindPreparedProgram({ member: fixture.member, declaration: fixture.declaration, assertCurrent: fixture.assertCurrent });
        assert.throws(function rejectNonarrayCallables() { fixture.owner.openProgram({ parentToken: fixture.begin(), toolNames: {} }); }, { message: 'Runtime callables differ from the original prepared program' });
        assert.equal(fixture.record.program?.status, 'failed');
      },
    }),
    it({
      name: 'retains unbound opening and unreached views during original judgment capture',
      fn: async function originalOpeningViews() {
        const fixture = createProgramOwnerFixture();
        const observations: unknown[] = [];
        function readJudgment(): object {
          const program = fixture.record.program?.handle;
          const group = fixture.record.program?.groups[0]?.handle;
          assert.ok(program);
          assert.ok(group);
          observations.push(owner.programFor(program), owner.reachedGroupFor(group), owner.inspectProgram(program).status);
          return fixture.judgment;
        }
        const owner = createFixtureProgramOwner({ ...fixture.input, readJudgment });
        owner.bindPreparedProgram({ member: fixture.member, declaration: fixture.declaration, assertCurrent: fixture.assertCurrent });
        const program = owner.openProgram({ parentToken: fixture.begin(), toolNames: ['read', 'write'] });
        assert.deepEqual(observations, [undefined, undefined, 'opening']);
        assert.equal(owner.programFor(program).judgment, fixture.judgment);
      },
    }),
    it({
      name: 'rejects second readiness failure before prepared inspection publication',
      fn: async function finalPreparedReadiness() {
        const fixture = createProgramOwnerFixture();
        const failure = new Error('original second readiness check failed');
        assert.throws(function failedPreparedPublication() { fixture.owner.bindPreparedProgram({ member: fixture.member, declaration: fixture.declaration, assertCurrent: function retireOriginalReadiness() { fixture.state.readyFailure = failure; } }); }, function exactFailure(error) { return error === failure; });
        assert.equal(fixture.record.preparedProgram, undefined);
        assert.deepEqual(fixture.events, ['member', 'ready', 'dependency-check', 'ready']);
      },
    }),
    it({
      name: 'retains original judgment-capture failure after group reservation without publishing an open view',
      fn: async function failedJudgmentCapture() {
        const fixture = createProgramOwnerFixture();
        const failure = new Error('original judgment capture failed');
        fixture.state.judgmentFailure = failure;
        assert.throws(function failedOriginalOpening() { fixture.open(); }, function exactFailure(error) { return error === failure; });
        const program = fixture.record.program?.handle;
        assert.ok(program);
        const inspection = fixture.owner.inspectProgram(program);
        assert.equal(inspection.status, 'failed');
        assert.equal(inspection.failure, failure);
        assert.equal(inspection.declaration, fixture.declaration);
        assert.deepEqual(inspection.groups.map(function retainedState(group) { return group.state; }), ['unreached', 'unreached']);
      },
    }),
    it({
      name: 'rechecks original dependencies after call metadata capture and before native slot publication',
      fn: async function finalCallDependencies() {
        const fixture = createProgramOwnerFixture();
        const group = createProgramGroupFixture({ fixture, program: fixture.open() });
        const failure = new Error('original call dependency changed');
        const [call] = group.calls;
        assert.ok(call);
        const tools = [{ name: call.name, get outputSchema() { fixture.state.dependencyFailure = failure;
        return undefined; } }];
        assert.throws(function changedCallDependency() { fixture.owner.bindProgramCalls({ group: group.reached.handle, calls: group.calls, tools, runNative: function originalNative() { throw new Error('Unreached original native runner'); } }); }, function exactFailure(error) { return error === failure; });
        const inspection = fixture.owner.inspectReachedGroup(group.reached.handle);
        assert.equal(inspection.state, 'failed');
        assert.equal(inspection.failure, failure);
        assert.deepEqual(inspection.nativeReturns, []);
      },
    }),
    it({
      name: 'rechecks original dependencies after final serialization and before child publication',
      fn: async function finalChildDependencies() {
        const fixture = createProgramOwnerFixture();
        const group = createProgramGroupFixture({ fixture, program: fixture.open() });
        group.bind();
        const failure = new Error('original final child dependency changed');
        const [member] = group.members;
        assert.ok(member);
        const members = Object.freeze([Object.freeze({ ...member, toJSON() { fixture.state.dependencyFailure = failure;
        return member; } })]);
        assert.throws(function changedFinalDependency() { fixture.owner.prepareReachedMembers({ group: group.reached.handle, members, nativeSignals: group.signals }); }, function exactFailure(error) { return error === failure; });
        const inspection = fixture.owner.inspectReachedGroup(group.reached.handle);
        assert.equal(inspection.state, 'failed');
        assert.deepEqual(inspection.members, []);
        assert.equal(fixture.childGroups.length, 0);
      },
    }),
    //endregion
    //region Complete successor groups retain original call uniqueness and materialized byte limits.
    it({
      name: 'rejects duplicate native call identifiers across a complete successor group',
      fn: async function duplicateNativeCalls() {
        const fixture = createProgramOwnerFixture();
        const program = fixture.open();
        const producer = createProgramGroupFixture({ fixture, program });
        producer.bind();
        producer.prepare();
        await producer.invoke();
        producer.value();
        const successor = createProgramGroupFixture({ fixture, program, ordinal: 1 });
        const [first, second] = successor.calls;
        assert.ok(first);
        assert.ok(second);
        const calls = [first, { ...second, id: first.id }];
        assert.throws(function duplicateCallIdentity() { fixture.owner.bindProgramCalls({ group: successor.reached.handle, calls, tools: successor.tools, runNative: function originalNative() { throw new Error('Unreached original native runner'); } }); }, { message: 'Native call binding differs from original reached member' });
        assert.deepEqual(fixture.owner.inspectReachedGroup(successor.reached.handle).nativeReturns, []);
      },
    }),
    it({
      name: 'rejects oversized materialized arguments before a successor view is published',
      fn: async function reachedArgumentBound() {
        const calls = Array.from({ length: 32 }, function originalSuccessor() { return 'tools.write({ text: result })'; });
        const fixture = createProgramOwnerFixture({ source: `const result = await tools.read({ path: "source.txt" }); return await Promise.all([${calls.join(',')}]);` });
        const program = fixture.open();
        const producer = createProgramGroupFixture({ fixture, program });
        producer.bind();
        producer.prepare();
        const [outcome] = producer.outcomes;
        assert.ok(outcome);
        outcome.result.content = [{ type: 'text', text: 'x'.repeat(65_536) }];
        await producer.invoke();
        assert.equal(producer.value().length, 65_536);
        assert.throws(function oversizedSuccessorArguments() { fixture.owner.reachProgramGroup({ program, ordinal: 1 }); }, { message: 'Reached group argument data exceeds one MiB' });
        const inspection = fixture.owner.inspectProgram(program);
        assert.equal(inspection.groups[1]?.state, 'unreached');
        assert.equal(fixture.childGroups.length, 1);
      },
    }),
    it({
      name: 'retains empty native text as a supported producer value',
      fn: async function emptyOriginalText() {
        const fixture = createProgramOwnerFixture();
        const program = fixture.open();
        const group = createProgramGroupFixture({ fixture, program });
        group.bind();
        group.prepare();
        const [outcome] = group.outcomes;
        assert.ok(outcome);
        outcome.result.content = [];
        await group.invoke();
        assert.equal(group.value(), '');
        const successor = fixture.owner.reachProgramGroup({ program, ordinal: 1 });
        assert.deepEqual(successor.members.map(function emptyArguments(member) { return member.args; }), [{ text: '' }, { path: '' }]);
        assert.deepEqual(fixture.owner.inspectProgram(program).guardFailures, []);
      },
    }),
    //endregion
  ],
});
