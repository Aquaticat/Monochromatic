/**
 Built original programs retain exact native outcomes, producer receipts, and distinct result-guard failures. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createProgramOwnerFixture } from './native-program-owner-fixture.ts';
import { createProgramGroupFixture } from './native-program-group-fixture.ts';
import { nativeReturnFailure } from './native-return-test-fixture.ts';

await describe({
  name: '',
  children: [
    //region Original producer receipts materialize complete successor groups without replacing converted values.
    it({
      name: 'retains exact native outcomes and original producer text through successor preparation',
      fn: async function originalProducerAndSuccessor() {
        const fixture = createProgramOwnerFixture();
        const program = fixture.open();
        const producer = createProgramGroupFixture({ fixture, program });
        producer.bind();
        producer.prepare();
        const outcome = await producer.invoke();
        assert.equal(outcome, producer.outcomes[0]);
        assert.deepEqual(producer.invocations, [{ call: producer.calls[0], options: producer.options }]);
        assert.equal(fixture.owner.inspectProgram(program).producerValueReady, false);
        assert.equal(producer.value(), 'original producer text');
        assert.equal(producer.value(), 'original producer text');
        const original = producer.outcomes[0];
        assert.ok(original);
        original.result.content = [{ type: 'text', text: 'later native mutation' }];
        assert.equal(producer.value(), 'original producer text');
        assert.equal(fixture.owner.inspectProgram(program).producerValueReady, true);
        const successor = createProgramGroupFixture({ fixture, program, ordinal: 1 });
        assert.deepEqual(successor.reached.members.map(function originalArguments(member) { return member.args; }), [{ text: 'original producer text' }, { path: 'original producer text' }]);
        const slots = successor.bind();
        assert.equal(slots.length, 2);
        successor.prepare();
        await Promise.all([successor.invoke(0), successor.invoke(1)]);
        assert.equal(successor.value(0), 'original producer text');
        assert.equal(successor.value(1), 'original producer text');
        assert.equal(fixture.childGroups.length, 2);
        const inspection = fixture.owner.inspectProgram(program);
        assert.equal(inspection.producerValueReady, true);
        assert.deepEqual(inspection.guardFailures, []);
        assert.deepEqual(inspection.groups.map(function originalConversions(group) { return group.nativeReturns.map(function count(value) { return value.conversionCount; }); }), [[1], [1, 1]]);
      },
    }),
    it({
      name: 'permits original native callbacks to prepare and return children during invocation',
      fn: async function originalNativePreparation() {
        const fixture = createProgramOwnerFixture();
        const program = fixture.open();
        const group = createProgramGroupFixture({ fixture, program });
        group.bind({ runNative: function prepareFromNative(call, options) {
          assert.equal(call, group.calls[0]);
          assert.equal(options, group.options);
          group.prepare();
          group.markReturned();
          return group.outcomes[0];
        } });
        assert.equal(await group.invoke(), group.outcomes[0]);
        assert.equal(group.value(), 'original producer text');
        assert.equal(fixture.owner.inspectReachedGroup(group.reached.handle).state, 'prepared');
      },
    }),
    it({
      name: 'retains native completion after parent retirement and rejects later live value use',
      fn: async function originalPendingCompletion() {
        const fixture = createProgramOwnerFixture();
        const program = fixture.open();
        const group = createProgramGroupFixture({ fixture, program });
        const deferred = Promise.withResolvers<unknown>();
        group.bind({ runNative: function originalPending() { return deferred.promise; } });
        group.prepare();
        group.markReturned();
        const pending = group.invoke();
        assert.ok(fixture.record.execution);
        fixture.record.execution.state = 'returned';
        deferred.resolve(group.outcomes[0]);
        assert.equal(await pending, group.outcomes[0]);
        assert.equal(fixture.owner.inspectReachedGroup(group.reached.handle).nativeReturns[0]?.state, 'returned');
        assert.throws(function retiredValue() { group.value(); }, { name: 'NativeScriptValueGuardError' });
        assert.equal(fixture.owner.inspectProgram(program).guardFailures.length, 1);
      },
    }),
    //endregion
    //region Guard failures remain distinct from ordinary native errors and survive original retirement.
    it({
      name: 'retains first guard identity, deduplicates exact occurrences, and records distinct later guards',
      fn: async function originalGuardHistory() {
        const fixture = createProgramOwnerFixture();
        const program = fixture.open();
        const first = fixture.owner.markProgramGuard({ program, error: new Error('first original result failure') });
        assert.equal(fixture.owner.markProgramGuard({ program, error: first }), first);
        const second = fixture.owner.markProgramGuard({ program, error: new Error('second original result failure') });
        assert.notEqual(second, first);
        assert.throws(function guardedProgram() { fixture.owner.programFor(program); }, function originalFirstGuard(error) { return error === first; });
        const inspection = fixture.owner.inspectProgram(program);
        assert.equal(inspection.status, 'open');
        assert.deepEqual(inspection.guardFailures, [first, second]);
        assert.equal(Object.isFrozen(inspection.guardFailures), true);
      },
    }),
    it({
      name: 'rejects absent fixed consumers without manufacturing sticky program guards',
      fn: async function missingNativeConsumer() {
        const fixture = createProgramOwnerFixture();
        const program = fixture.open();
        const group = createProgramGroupFixture({ fixture, program });
        const failure = await nativeReturnFailure(function invokeUnboundGroup() { return fixture.owner.invokeProgramNative({ group: group.reached.handle, slot: {}, call: {} }); });
        assert.ok(Error.isError(failure,));
        assert.equal(failure.message, 'Reached group has no fixed native consumer');
        assert.throws(function unboundValue() { fixture.owner.scriptValueFor({ group: group.reached.handle, slot: {}, outcome: {} }); }, { name: 'NativeScriptValueGuardError' });
        assert.throws(function foreignValue() { fixture.owner.scriptValueFor({ group: {}, slot: {}, outcome: {} }); }, { name: 'NativeScriptValueGuardError' });
        assert.deepEqual(fixture.owner.inspectProgram(program).guardFailures, []);
        group.bind();
        group.prepare();
        await group.invoke();
        assert.equal(group.value(), 'original producer text');
      },
    }),
    ...['copied-outcome', 'foreign-slot', 'unreturned-member', 'unsupported-value', 'oversized-value'].map(function valueAdmission(kind) {
      return it({
        name: `retains ${kind} rejection as the original program guard`,
        fn: async function rejectedOriginalValue() {
          const fixture = createProgramOwnerFixture();
          const program = fixture.open();
          const group = createProgramGroupFixture({ fixture, program, structured: kind === 'unsupported-value' });
          const slots = group.bind();
          const members = group.prepare();
          const outcome = group.outcomes[0];
          assert.ok(outcome);
          if (kind === 'unsupported-value') outcome.result.structuredContent = {};
          if (kind === 'oversized-value') outcome.result.content = [{ type: 'text', text: 'x'.repeat(65_537) }];
          await group.invoke();
          if (kind === 'unreturned-member') {
            const [member] = members;
            assert.ok(member);
            const record = fixture.bindings.get(member);
            assert.ok(record?.execution);
            record.execution.state = 'active';
          }
          assert.throws(function rejectOriginalValue() { fixture.owner.scriptValueFor({ group: group.reached.handle, slot: kind === 'foreign-slot' ? {} : slots[0], outcome: kind === 'copied-outcome' ? { ...outcome } : outcome }); }, { name: 'NativeScriptValueGuardError' });
          const inspection = fixture.owner.inspectProgram(program);
          assert.equal(inspection.guardFailures.length, 1);
          assert.equal(inspection.producerValueReady, false);
          assert.throws(function retainGuardOnLaterUse() { fixture.owner.programFor(program); }, function sameGuard(error) { return error === inspection.guardFailures[0]; });
        },
      });
    }),
    it({
      name: 'preserves ordinary native conversion failures without latching a program guard',
      fn: async function ordinaryNativeFailure() {
        const fixture = createProgramOwnerFixture();
        const program = fixture.open();
        const group = createProgramGroupFixture({ fixture, program });
        group.bind();
        group.prepare();
        const outcome = group.outcomes[0];
        assert.ok(outcome);
        outcome.isError = true;
        await group.invoke();
        const first = await nativeReturnFailure(function originalFailure() { return group.value(); });
        const second = await nativeReturnFailure(function repeatedFailure() { return group.value(); });
        assert.equal(first, second);
        assert.ok(Error.isError(first,));
        assert.notEqual(first.name, 'NativeScriptValueGuardError');
        assert.deepEqual(fixture.owner.inspectProgram(program).guardFailures, []);
        assert.equal(fixture.owner.programFor(program).declaration, fixture.declaration);
      },
    }),
    it({
      name: 'captures original operation failure after native conversion as a sticky program guard',
      fn: async function failedProducerPublication() {
        const fixture = createProgramOwnerFixture();
        const program = fixture.open();
        const group = createProgramGroupFixture({ fixture, program });
        group.bind();
        group.prepare();
        await group.invoke();
        fixture.state.operationFailure = { callback: 'readGuardedScriptValue', error: new Error('original publication boundary failed') };
        assert.throws(function failedPublicationBoundary() { group.value(); }, { name: 'NativeScriptValueGuardError' });
        const inspection = fixture.owner.inspectProgram(program);
        assert.equal(inspection.producerValueReady, false);
        assert.equal(inspection.guardFailures.length, 1);
        assert.ok(fixture.events.includes('operation:markConversionFailure'));
      },
    }),
    //endregion
  ],
});
