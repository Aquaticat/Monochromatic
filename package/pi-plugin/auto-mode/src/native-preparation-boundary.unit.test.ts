/** Built preparation preserves original policy admission, selection failures, and final cancellation boundaries. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createPreparationFixture } from './native-preparation-fixture.ts';

//region Original policy completeness remains independent from semantic authority.
await describe({ name: '', children: [
  ...[undefined, null, false, 0, '', 'plain policy', {}, { content: 'unfrozen' }, Object.freeze({}), Object.freeze({ content: 7 })].map(function invalidPolicy(policy, ordinal) {
    return it({ name: `rejects incomplete original mandatory policy ${ordinal} before selection publication`, fn: async function rejectsPolicy() {
      /** Policy admission happens after original source sealing and dependency finalization. */
      const f = createPreparationFixture();
      f.state.sealedSources = Object.freeze({ mandatoryPolicy: policy, governingSources: Object.freeze([]) });
      assert.throws(function incompletePolicy() {
        f.owner.prepare(f.members);
      }, { name: 'JudgmentConstructionError', message: 'Original request lacks complete owned mandatory policy' });
      assert.equal(f.owner.state.preparationFailed, true);
      assert.equal(f.owner.state.preparing, false);
      assert.equal(f.owner.state.selection, undefined);
      assert.equal(f.byMember.size, 0);
      assert.deepEqual(f.events, ['active:1', 'seal:1', 'publishSources:1', 'prepareDependencies:1', 'active:2', 'finalizeDependencies:1', 'checkpoint:1', 'sources:1']);
    } });
  }),
  it({ name: 'retains original empty-content and callable-policy admission without new shape restrictions', fn: async function retainsOriginalPolicyProfile() {
    /** Original completeness tests string content without adding semantic interpretation. */
    const empty = createPreparationFixture();
    empty.state.sealedSources = Object.freeze({ mandatoryPolicy: Object.freeze({ content: '' }), governingSources: Object.freeze([]) });
    empty.owner.prepare(empty.members);
    assert.equal(empty.owner.state.prepared, true);
    /** A frozen callable with string content satisfies the same original check. */
    function policy(): void {
      throw new Error('Policy value must not be invoked');
    }
    Object.defineProperty(policy, 'content', { value: 'callable policy content', enumerable: true });
    Object.freeze(policy);
    /** Independent native preparation must preserve the original accepted value. */
    const callable = createPreparationFixture();
    callable.state.sealedSources = Object.freeze({ mandatoryPolicy: policy, governingSources: Object.freeze([]) });
    callable.owner.prepare(callable.members);
    assert.equal(callable.owner.state.prepared, true);
    assert.equal(callable.state.sources.mandatoryPolicy, policy);
  } }),
  it({ name: 'retains original policy getter failure after dependency finalization', fn: async function retainsPolicyFailure() {
    /** Source accessors are observed only at the original completeness boundary. */
    const f = createPreparationFixture();
    /** Exact accessor failure must remain available to retained inspection. */
    const failure = new Error('original policy getter failed');
    f.state.sealedSources = Object.freeze({ mandatoryPolicy: Object.freeze({ get content() { throw failure; } }) });
    assert.throws(function failedPolicyRead() {
      f.owner.prepare(f.members);
    }, failure);
    assert.equal(f.owner.state.preparationFailure, failure);
    assert.equal(f.owner.state.preparing, false);
    assert.equal(f.byMember.size, 0);
    assert.equal(f.state.counts.get('finalizeDependencies'), 1);
    assert.equal(f.state.counts.get('checkpoint'), 1);
  } }),
  it({ name: 'retains real selection construction failure without publishing members or selection', fn: async function retainsCatalogFailure() {
    /** Invalid catalog bytes reach the actual built selection constructor. */
    const f = createPreparationFixture({ catalog: '{broken' });
    assert.throws(function failedSelection() {
      f.owner.prepare(f.members);
    }, { name: 'QuestionSelectionError' });
    assert.equal(f.owner.state.preparationFailed, true);
    assert.equal(f.owner.state.preparing, false);
    assert.equal(f.owner.state.prepared, false);
    assert.equal(f.owner.state.selection, undefined);
    assert.equal(f.owner.state.handle, undefined);
    assert.equal(f.byMember.size, 0);
    assert.equal(f.state.counts.get('active'), 2);
    assert.equal(f.state.counts.get('checkpoint'), 2);
    assert.ok(Error.isError(f.owner.state.preparationFailure));
    assert.equal(f.owner.state.preparationFailure.name, 'QuestionSelectionError');
  } }),
  ...['deadline', 'cancellation'].map(function finalLifetimeBoundary(kind) {
    return it({ name: `blocks publication on original final ${kind} after selection construction`, fn: async function rejectsLateRetirement() {
      /** Real budget behavior, rather than a synthetic callback error, gates final publication. */
      const f = createPreparationFixture();
      /** Cancellation lineage retains an independently identifiable original reason. */
      const reason = new Error('original cancellation reason');
      f.state.onStep = function retireBeforePublication(point) {
        if (point !== 'checkpoint:4') return;
        if (kind === 'deadline') f.clock.at = 5_000;
        else f.controller.abort(reason);
      };
      assert.throws(function retiredPublication() {
        f.owner.prepare(f.members);
      }, { name: kind === 'deadline' ? 'JudgmentDeadlineError' : 'JudgmentCancelledError' });
      assert.equal(f.owner.state.preparationFailed, true);
      assert.equal(f.owner.state.preparing, false);
      assert.equal(f.owner.state.prepared, false);
      assert.equal(f.byMember.size, 0);
      assert.equal(f.owner.state.handle, undefined);
      assert.equal(f.owner.knownSelection(), f.owner.state.selection);
      assert.equal(f.budget.diagnostics().retired, true);
      assert.ok(Error.isError(f.owner.state.preparationFailure));
      if (kind === 'cancellation') assert.equal(f.owner.state.preparationFailure.cause, reason);
    } });
  }),
] });
//endregion
