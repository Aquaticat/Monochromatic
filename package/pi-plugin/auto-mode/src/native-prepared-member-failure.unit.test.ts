/**
 Original preparation failures retain identity and complete-group blocking behavior. @module
 */
import assert from 'node:assert/strict';
import { setImmediate as immediate } from 'node:timers/promises';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { PreparedBatchContractError } from './native-input-seal-fixture.ts';
import { createMemberFixture } from './native-prepared-member-fixture.ts';

/**
 Original retained failures report a fresh fallback block without replacing the thrown cause.

 @param fixture - independent original lifecycle owner

 @param result - built native preparation outcome

 @param failure - original opaque failure identity
 */
function assertRetained({ fixture, result, failure }: Readonly<{
  fixture: ReturnType<typeof createMemberFixture>;
  result: unknown;
  failure: unknown;
}>): void {
  assert.deepEqual(result, { block: true, reason: 'Complete group preparation or assessment failed' });
  assert.deepEqual(fixture.failures, [failure]);
  assert.equal(fixture.failures[0], failure);
  assert.equal(fixture.blockReasons.at(-1), 'Complete group preparation or assessment failed');
  assert.equal(Object.isFrozen(result), false);
}

await describe({ name: 'original prepared member failure ownership', children: [
  //region Every original fallible boundary retains its own failure and original progress.
  ...['prepare-entry', 'input-prepared', 'assessment-returned', 'member-release'].map(function stageFailure(stage) {
    return it({ name: `retains original currentness failure at ${stage}`, fn: async function currentness() {
      const fixture = createMemberFixture();
      const failure: unknown = Object.freeze({ stage });
      fixture.control.active = function original(at) { 
        if (at === stage) throw failure; 
      };
      const result = await fixture.run();
      assertRetained({ fixture, result, failure });
      assert.equal(fixture.memberState.entered, true);
      if (stage === 'member-release') assert.deepEqual(fixture.batchState.decision, { block: false });
    } });
  }),
  ...[undefined, null, { original: 'preparation failure' }].map(function preparationFailure(failure, ordinal) {
    return it({ name: `retains opaque native preparation failure ${ordinal}`, fn: async function prepareFailure() {
      const fixture = createMemberFixture();
      const originalFailure: unknown = failure;
      fixture.control.prepare = async function rejectedPreparation() { 
        throw originalFailure; 
      };
      const result = await fixture.run();
      assertRetained({ fixture, result, failure });
      assert.equal(fixture.ready.size, 0);
      assert.deepEqual(fixture.events, ['active:prepare-entry', 'prepare', 'block']);
    } });
  }),
  it({ name: 'retains duplicate member admission before sealing original input', fn: async function duplicate() {
    const fixture = createMemberFixture();
    fixture.ready.set('one', { groupExecutionMode: 'parallel', id: 'one', name: 'tool', input: {} });
    const result = await fixture.run();
    const [failure] = fixture.failures;
    assert.ok(failure instanceof PreparedBatchContractError);
    assert.equal(failure.message, 'Member reached preparation twice');
    assertRetained({ fixture, result, failure });
    assert.equal(fixture.events.includes('seal'), false);
    assert.equal(fixture.events.includes('release'), false);
  } }),
  ...[1, 2].map(function sealingFailure(ordinal) {
    return it({ name: `retains original sealing failure at invocation ${ordinal}`, fn: async function sealFailure() {
      const fixture = createMemberFixture();
      const failure: unknown = Object.freeze({ ordinal });
      const counter = { count: 0 };
      fixture.control.seal = function original(input) {
        counter.count++;
        if (counter.count === ordinal) throw failure;
        return input;
      };
      const result = await fixture.run();
      assertRetained({ fixture, result, failure });
      assert.equal(counter.count, ordinal);
      assert.equal(fixture.ready.size, 0);
      assert.equal(fixture.events.includes('release'), false);
    } });
  }),
  it({ name: 'retains native cloning failure before publishing readiness', fn: async function cloneFailure() {
    const fixture = createMemberFixture();
    fixture.control.seal = function uncloneable() { 
      return function nativeValue() {}; 
    };
    const result = await fixture.run();
    const [failure] = fixture.failures;
    assert.ok(failure instanceof DOMException);
    assert.equal(failure.name, 'DataCloneError');
    assertRetained({ fixture, result, failure });
    assert.equal(fixture.ready.size, 0);
  } }),
  it({ name: 'retains release failure after readiness publication and before assessment', fn: async function releaseFailure() {
    const fixture = createMemberFixture();
    const failure: unknown = Object.freeze({ reason: 'original turn release' });
    fixture.control.release = function original() { 
      throw failure; 
    };
    const result = await fixture.run();
    assertRetained({ fixture, result, failure });
    assert.equal(fixture.ready.size, 1);
    assert.deepEqual(fixture.snapshots, []);
    assert.equal(fixture.batchState.assessmentStarted, false);
  } }),
  it({ name: 'retains asynchronous assessment failure after publishing its original manifest', fn: async function assessFailure() {
    const fixture = createMemberFixture();
    const failure: unknown = Object.freeze({ reason: 'original assessment' });
    fixture.control.assess = async function original() { 
      throw failure; 
    };
    const result = await fixture.run();
    assertRetained({ fixture, result, failure });
    assert.equal(fixture.ready.size, 1);
    assert.equal(fixture.snapshots.length, 1);
    assert.equal(fixture.batchState.assessmentStarted, true);
  } }),
  it({ name: 'retains gate rejection within the early preparation block path', fn: async function blockedGate() {
    const fixture = createMemberFixture();
    const failure: unknown = Object.freeze({ reason: 'original gate rejection' });
    fixture.control.prepare = function original() { 
      return { block: true, reason: 'native block' }; 
    };
    const running = fixture.run({ block(reason: unknown) { 
      fixture.blockReasons.push(reason); 
    } });
    await immediate();
    fixture.gate.reject(failure);
    await assert.doesNotReject(running);
    const result = await running;
    assertRetained({ fixture, result, failure });
    assert.deepEqual(fixture.blockReasons, ['native block', 'Complete group preparation or assessment failed']);
    assert.equal(fixture.ready.size, 0);
  } }),
  it({ name: 'retains shared gate rejection before the member-release currentness check', fn: async function selectedGate() {
    const fixture = createMemberFixture();
    const failure: unknown = Object.freeze({ reason: 'original selected gate' });
    fixture.batchState.assessmentStarted = true;
    const running = fixture.run();
    await immediate();
    fixture.gate.reject(failure);
    const result = await running;
    assertRetained({ fixture, result, failure });
    assert.equal(fixture.events.includes('active:member-release'), false);
  } }),
  //endregion
  //region Failure in entry publication or the retention owner itself still rejects native preparation.
  it({ name: 'rejects entry marker publication without retaining or blocking it', fn: async function entryPublication() {
    const fixture = createMemberFixture();
    const failure: unknown = Object.freeze({ reason: 'original marker setter' });
    await assert.rejects(fixture.run({ memberState: { get entered() { 
      return false; 
    }, set entered(_value: boolean) { 
      throw failure; 
    } } }), function original(error: unknown) {
      assert.equal(error, failure);
      return true;
    });
    assert.deepEqual(fixture.failures, []);
    assert.deepEqual(fixture.blockReasons, []);
    assert.deepEqual(fixture.events, []);
  } }),
  it({ name: 'retains the preparation cause before a blocking-owner failure rejects the member', fn: async function blockFailure() {
    const fixture = createMemberFixture();
    const original: unknown = Object.freeze({ reason: 'native preparation' });
    const later: unknown = Object.freeze({ reason: 'blocking owner' });
    fixture.control.prepare = function failed() { 
      throw original; 
    };
    await assert.rejects(fixture.run({ block() { 
      throw later; 
    } }), function same(error: unknown) {
      assert.equal(error, later);
      return true;
    });
    assert.deepEqual(fixture.failures, [original]);
  } }),
  it({ name: 'rejects retention-owner failure before attempting group blocking', fn: async function retentionFailure() {
    const fixture = createMemberFixture();
    const original: unknown = Object.freeze({ reason: 'native preparation' });
    const later: unknown = Object.freeze({ reason: 'retention owner' });
    fixture.control.prepare = function failed() { 
      throw original; 
    };
    await assert.rejects(fixture.run({ failures: { push(error: unknown) {
      assert.equal(error, original);
      throw later;
    } } }), function same(error: unknown) {
      assert.equal(error, later);
      return true;
    });
    assert.deepEqual(fixture.blockReasons, []);
  } }),
  //endregion
] });
