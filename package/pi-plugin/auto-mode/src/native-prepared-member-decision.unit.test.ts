/**
 Original group decision validation preserves property reads and admission races. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { PreparedBatchContractError } from './native-input-seal-fixture.ts';
import { createMemberFixture } from './native-prepared-member-fixture.ts';

await describe({ name: 'original prepared member decisions', children: [
  //region Original assessment admission rejects malformed decisions before publication.
  ...[undefined, null, false, 0, '', function callable() {}, {}, { block: 'false' },
    { block: true }, { block: true, reason: '' }, { block: true, reason: false }, { block: true, reason: 0 },
  ].map(function invalidAssessment(assessed, ordinal) {
    return it({ name: `retains invalid original assessment ${ordinal}`, fn: async function invalid() {
      const fixture = createMemberFixture();
      fixture.control.assess = function original() { return assessed; };
      assert.deepEqual(await fixture.run(), { block: true, reason: 'Complete group preparation or assessment failed' });
      const [failure] = fixture.failures;
      assert.ok(failure instanceof PreparedBatchContractError);
      assert.equal(failure.message, 'Combined assessment returned an invalid decision');
      assert.equal(fixture.events.includes('resolve'), false);
      assert.equal(fixture.batchState.assessmentStarted, true);
      assert.equal(fixture.snapshots.length, 1);
    } });
  }),
  it({ name: 'preserves nonempty whitespace reasons and copies only original blocking fields', fn: async function blockDecision() {
    const fixture = createMemberFixture();
    const assessed = { block: true, reason: ' ', extra: 'ignored' };
    fixture.control.assess = function original() { return assessed; };
    const selected = await fixture.run();
    assert.deepEqual(selected, { block: true, reason: ' ' });
    assert.equal(selected, fixture.batchState.decision);
    assert.notEqual(selected, assessed);
    assert.ok(Object.isFrozen(selected));
    assert.equal(Object.isFrozen(assessed), false);
  } }),
  it({ name: 'never observes a reason for a nonblocking assessment', fn: async function unusedReason() {
    const fixture = createMemberFixture();
    const failure: unknown = Object.freeze({ reason: 'unused reason getter' });
    fixture.control.assess = function original() { return { block: false, get reason() { throw failure; } }; };
    assert.equal(await fixture.run(), undefined);
    assert.deepEqual(fixture.failures, []);
  } }),
  it({ name: 'preserves inherited decision fields without adding property-existence probes', fn: async function inheritedDecision() {
    const prototype = { block: false };
    const inherited: unknown = Object.create(prototype);
    const value = new Proxy({ block: false }, { has() { throw new Error('Unexpected property existence probe'); } });
    await Promise.all([inherited, value].map(async function originalDecision(assessed) {
      const current = createMemberFixture();
      current.control.assess = function original() { return assessed; };
      assert.equal(await current.run(), undefined);
      assert.deepEqual(current.failures, []);
    }));
  } }),
  it({ name: 'preserves repeated original blocking and reason getter order', fn: async function decisionReadOrder() {
    const fixture = createMemberFixture();
    const reads: string[] = [];
    fixture.control.assess = function original() {
      return { get block() { reads.push('block');
      return true; }, get reason() { reads.push('reason');
      return 'original'; } };
    };
    assert.deepEqual(await fixture.run(), { block: true, reason: 'original' });
    assert.deepEqual(reads, ['block', 'block', 'reason', 'reason', 'block', 'reason']);
  } }),
  it({ name: 'preserves a changed blocking getter between validation and decision copying', fn: async function changedDecision() {
    const fixture = createMemberFixture();
    const values: unknown[] = [false, false, 'changed truthy value'];
    fixture.control.assess = function original() {
      return { get block() { return values.shift(); }, reason: { original: 'late unvalidated reason' } };
    };
    assert.deepEqual(await fixture.run(), { block: true, reason: { original: 'late unvalidated reason' } });
    assert.deepEqual(fixture.failures, []);
    assert.deepEqual(values, []);
  } }),
  it({ name: 'retains a falsy reason observed after its original string validation', fn: async function changedReason() {
    const fixture = createMemberFixture();
    const values: unknown[] = ['valid first read', false];
    fixture.control.assess = function original() {
      return { block: true, get reason() { return values.shift(); } };
    };
    await fixture.run();
    const [failure] = fixture.failures;
    assert.ok(failure instanceof PreparedBatchContractError);
    assert.deepEqual(values, []);
  } }),
  it({ name: 'validates an assessment even after its callback selects another original decision', fn: async function invalidAfterDecision() {
    const fixture = createMemberFixture();
    fixture.control.assess = function original() { fixture.block('original cancellation');
    return null; };
    assert.deepEqual(await fixture.run(), { block: true, reason: 'Complete group preparation or assessment failed' });
    const [failure] = fixture.failures;
    assert.ok(failure instanceof PreparedBatchContractError);
    assert.deepEqual(fixture.batchState.decision, { block: true, reason: 'original cancellation' });
    assert.deepEqual(fixture.blockReasons, ['original cancellation', 'Complete group preparation or assessment failed']);
  } }),
  it({ name: 'retains original decision getter failure identity', fn: async function decisionGetterFailure() {
    const fixture = createMemberFixture();
    const failure: unknown = Object.freeze({ reason: 'original decision getter' });
    fixture.control.assess = function original() { return { get block() { throw failure; } }; };
    await fixture.run();
    assert.equal(fixture.failures[0], failure);
    assert.equal(fixture.failures.length, 1);
  } }),
  //endregion
] });
