/**
 Original native members preserve input ownership and complete-group admission. @module
 */
import assert from 'node:assert/strict';
import { setImmediate as immediate } from 'node:timers/promises';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createMemberFixture } from './native-prepared-member-fixture.ts';

await describe({ name: 'original prepared member values', children: [
  //region Original input sealing and assessment retain exact native identities.
  it({ name: 'seals native arguments and independent snapshots before original complete-group assessment', fn: async function permission() {
    const fixture = createMemberFixture();
    const original = fixture.hook.args;
    fixture.control.prepare = function prepared(hook) {
      assert.equal(hook, fixture.hook);
      assert.equal(fixture.memberState.entered, true);
      return undefined;
    };
    fixture.control.assess = function assess(input) {
      assert.equal(input.signal, fixture.signal);
      assert.equal(input.members, fixture.snapshots[0]);
      assert.equal(fixture.batchState.assessmentStarted, true);
      return { block: false, ignored: true };
    };
    const running = fixture.run();
    const result = await Promise.race([running, immediate('pending')]);
    fixture.gate.resolve({ block: false });
    await running;
    assert.equal(result, undefined);
    const member = fixture.ready.get('one');
    assert.ok(member);
    assert.equal(member.id, 'one');
    assert.equal(member.name, 'tool');
    assert.equal(member.groupExecutionMode, 'parallel');
    assert.deepEqual(member.input, original);
    assert.notEqual(member.input, original);
    assert.ok(Object.isFrozen(original));
    assert.ok(Object.isFrozen(member));
    assert.ok(Object.isFrozen(member.input));
    assert.deepEqual(fixture.snapshots, [[member]]);
    assert.ok(Object.isFrozen(fixture.snapshots[0]));
    assert.deepEqual(fixture.batchState.decision, { block: false });
    assert.ok(Object.isFrozen(fixture.batchState.decision));
    assert.deepEqual(fixture.failures, []);
    assert.deepEqual(fixture.events, ['active:prepare-entry', 'prepare', 'active:input-prepared', 'seal', 'seal', 'release', 'assess', 'active:assessment-returned', 'resolve', 'active:member-release']);
  } }),
  it({ name: 'preserves changed native arguments and the original sequential execution mode', fn: async function sequential() {
    const fixture = createMemberFixture();
    const replacement = { changed: true };
    fixture.control.prepare = function replace() { 
      fixture.hook.args = replacement; 
    };
    await fixture.run({ serial: true });
    assert.ok(Object.isFrozen(replacement));
    assert.deepEqual(fixture.ready.get('one'), { groupExecutionMode: 'sequential', id: 'one', name: 'tool', input: replacement });
  } }),
  it({ name: 'waits for the complete declared group and orders its manifest independently of insertion', fn: async function completeGroup() {
    const fixture = createMemberFixture();
    const second = { type: 'toolCall', id: 'two', name: 'other', arguments: {} };
    fixture.scheduled.push(second);
    const earlier = fixture.run({ call: second, hook: { args: { member: 'second' } }, memberState: { entered: false } });
    assert.equal(await Promise.race([earlier, immediate('pending')]), 'pending');
    assert.deepEqual([...fixture.ready.keys()], ['two']);
    assert.equal(fixture.batchState.assessmentStarted, false);
    assert.deepEqual(fixture.snapshots, []);
    const last = fixture.run();
    assert.deepEqual(await Promise.all([earlier, last]), [undefined, undefined]);
    assert.deepEqual([...fixture.ready.keys()], ['two', 'one']);
    assert.deepEqual(fixture.snapshots, [[fixture.ready.get('one'), fixture.ready.get('two')]]);
    assert.equal(fixture.assessments.length, 1);
  } }),
  it({ name: 'awaits native preparation before reading or sealing its argument slot', fn: async function preparationWait() {
    const fixture = createMemberFixture();
    const preparation = Promise.withResolvers<unknown>();
    fixture.control.prepare = function pending() { 
      return preparation.promise; 
    };
    const running = fixture.run();
    assert.equal(await Promise.race([running, immediate('pending')]), 'pending');
    assert.equal(fixture.memberState.entered, true);
    assert.equal(fixture.ready.size, 0);
    assert.deepEqual(fixture.events, ['active:prepare-entry', 'prepare']);
    preparation.resolve(undefined);
    assert.equal(await running, undefined);
  } }),
  it({ name: 'awaits assessment and preserves a blocking decision selected while it was pending', fn: async function decisionRace() {
    const fixture = createMemberFixture();
    const assessment = Promise.withResolvers<unknown>();
    fixture.control.assess = function pending() { 
      return assessment.promise; 
    };
    const running = fixture.run();
    assert.equal(await Promise.race([running, immediate('pending')]), 'pending');
    assert.equal(fixture.batchState.assessmentStarted, true);
    assert.equal(fixture.snapshots.length, 1);
    fixture.block('original cancellation');
    const selected = fixture.batchState.decision;
    assessment.resolve({ block: false });
    assert.equal(await running, selected);
    assert.equal(fixture.events.includes('resolve'), false);
    assert.equal(fixture.batchState.decision, selected);
  } }),
  it({ name: 'does not await synchronous currentness or preparation-release return values', fn: async function synchronousCallbacks() {
    const fixture = createMemberFixture();
    const pending = Promise.withResolvers<unknown>();
    fixture.control.active = function active() { 
      return pending.promise; 
    };
    fixture.control.release = function release() { 
      return pending.promise; 
    };
    assert.equal(await Promise.race([fixture.run(), immediate('pending')]), undefined);
    pending.resolve(undefined);
  } }),
  //endregion
  //region Existing admission and original preparation truthiness remain observable.
  ...[undefined, null, false, 0, '', 42, 'native result'].map(function nonblocking(prepared, ordinal) {
    return it({ name: `preserves original nonblocking preparation value ${ordinal}`, fn: async function nativeAbsence() {
      const fixture = createMemberFixture();
      fixture.control.prepare = function original() { 
        return prepared; 
      };
      assert.equal(await fixture.run(), undefined);
      assert.deepEqual(fixture.failures, []);
    } });
  }),
  it({ name: 'retains an existing gate decision without assessing again', fn: async function existingDecision() {
    const fixture = createMemberFixture();
    const selected = Object.freeze({ block: 'original truthy value', reason: { opaque: true } });
    fixture.batchState.decision = selected;
    fixture.gate.resolve(selected);
    assert.equal(await fixture.run(), selected);
    assert.deepEqual(fixture.assessments, []);
    assert.deepEqual(fixture.snapshots, []);
    assert.equal(fixture.batchState.assessmentStarted, false);
  } }),
  it({ name: 'does not start another assessment after the original started flag is set', fn: async function existingAssessment() {
    const fixture = createMemberFixture();
    fixture.batchState.assessmentStarted = true;
    fixture.gate.resolve({ block: false });
    assert.equal(await fixture.run(), undefined);
    assert.deepEqual(fixture.assessments, []);
    assert.deepEqual(fixture.snapshots, []);
    assert.equal(fixture.batchState.decision, undefined);
  } }),
  ...[undefined, null, false, 0, '', Number.NaN, { opaque: 'original reason' }].map(function originalReason(reason, ordinal) {
    return it({ name: `preserves original preparation block reason ${ordinal}`, fn: async function blockedPreparation() {
      const fixture = createMemberFixture();
      fixture.control.prepare = function blocked() { 
        return { block: 'truthy', reason }; 
      };
      const result = await fixture.run();
      assert.equal(result, fixture.batchState.decision);
      assert.deepEqual(fixture.blockReasons, [ordinal === 6 ? reason : 'A member preparation blocked this complete group']);
      assert.deepEqual(fixture.events, ['active:prepare-entry', 'prepare', 'block']);
      assert.equal(fixture.ready.size, 0);
      assert.deepEqual(fixture.assessments, []);
    } });
  }),
  //endregion
] });
