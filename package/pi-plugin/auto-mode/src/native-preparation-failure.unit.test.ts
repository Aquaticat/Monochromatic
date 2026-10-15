/** Original preparation failures retain their values and prevent premature member publication. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createPreparationFixture } from './native-preparation-fixture.ts';

//region Failure boundaries retain exact original values without publishing incomplete members.
await describe({ name: '', children: [
  it({ name: 'preserves active preflight failure without recording a started preparation', fn: async function rejectsBeforeStart() {
    /** An inactive lifetime fails before the transient preparation flag is acquired. */
    const f = createPreparationFixture();
    /** Original preflight failure is observed by identity. */
    const failure = new Error('inactive preflight');
    f.state.failures.set('active:1', failure);
    assert.throws(function inactivePreparation() {
      f.owner.prepare(f.members);
    }, failure);
    assert.equal(f.owner.state.preparationFailed, false);
    assert.equal(f.owner.state.preparationFailure, undefined);
    assert.equal(f.owner.state.preparing, false);
    assert.equal(f.owner.state.prepared, false);
    assert.equal(f.byMember.size, 0);
    assert.deepEqual(f.events, ['active:1']);
    f.state.failures.clear();
    f.owner.prepare(f.members);
    assert.equal(f.owner.state.prepared, true);
  } }),
  ...['seal:1', 'publishSources:1', 'prepareDependencies:1', 'active:2', 'finalizeDependencies:1', 'checkpoint:1', 'sources:1', 'sources:2', 'checkpoint:2', 'checkpoint:3', 'active:3', 'checkpoint:4'].map(function failureBoundary(point) {
    return it({ name: `retains original preparation failure before member publication at ${point}`, fn: async function failsPreparation() {
      /** Every injected failure gets an independent native preparation lifetime. */
      const f = createPreparationFixture();
      /** Failure identity distinguishes original propagation from a replacement diagnostic. */
      const failure = new Error(point);
      f.state.failures.set(point, failure);
      assert.throws(function failedPreparation() {
        f.owner.prepare(f.members);
      }, failure);
      assert.equal(f.owner.state.preparationFailed, true);
      assert.equal(f.owner.state.preparationFailure, failure);
      assert.equal(f.owner.state.preparing, false);
      assert.equal(f.owner.state.prepared, false);
      assert.equal(f.owner.state.handle, undefined);
      assert.equal(f.byMember.size, 0);
      if (point === 'active:3' || point === 'checkpoint:4') assert.equal(f.owner.knownSelection(), f.owner.state.selection);
      else assert.throws(function noOriginalSelection() {
        f.owner.knownSelection();
      }, { name: 'JudgmentConstructionError', message: 'Judgment question selection was not prepared' });
      /** Original dependency owner can reject every subsequent attempt using retained failure state. */
      const retired = new Error('original preparation is permanently unavailable');
      f.state.failures.clear();
      f.state.failures.set('active', retired);
      assert.throws(function retiredPreparation() {
        f.owner.prepare(f.members);
      }, retired);
      assert.equal(f.owner.state.preparationFailure, failure);
      assert.equal(f.byMember.size, 0);
    } });
  }),
  it({ name: 'retains exact validation failure before source sealing or dependencies', fn: async function rejectsIncompleteGroup() {
    /** An incomplete member group must not begin external source or dependency work. */
    const f = createPreparationFixture();
    assert.throws(function incompleteGroup() {
      f.owner.prepare(Object.freeze([f.members[0]]));
    }, { name: 'JudgmentConstructionError', message: 'Prepared group differs from complete declared membership' });
    assert.equal(f.owner.state.preparationFailed, true);
    assert.equal(f.owner.state.preparing, false);
    assert.ok(Error.isError(f.owner.state.preparationFailure));
    assert.equal(f.owner.state.preparationFailure.message, 'Prepared group differs from complete declared membership');
    assert.deepEqual(f.events, ['active:1']);
    assert.equal(f.byMember.size, 0);
  } }),
  it({ name: 'rejects a replaced source receipt before publishing sealed sources', fn: async function rejectsForeignReceipt() {
    /** Equal request content cannot replace the original receipt identity. */
    const f = createPreparationFixture();
    /** Preserve the original source identity to detect premature replacement. */
    const original = f.state.sources;
    f.state.sealRequest = Object.freeze({ ...f.receipt });
    assert.throws(function foreignSourceReceipt() {
      f.owner.prepare(f.members);
    }, { name: 'JudgmentConstructionError', message: 'Prepared sources lost their original request receipt' });
    assert.equal(f.state.sources, original);
    assert.deepEqual(f.events, ['active:1', 'seal:1']);
    assert.equal(f.owner.state.preparationFailed, true);
    assert.equal(f.owner.state.preparing, false);
    assert.equal(f.byMember.size, 0);
  } }),
] });
//endregion
