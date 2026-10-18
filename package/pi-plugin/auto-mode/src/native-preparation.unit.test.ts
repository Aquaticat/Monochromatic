/** Built native preparation preserves source, dependency, selection, and complete publication identity. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createPreparationFixture } from './native-preparation-fixture.ts';

//region Complete original membership publishes only after source sealing and final lifetime checks.
await describe({ name: '', children: [
  it({ name: 'constructs lazily and shares native bindings through source and selection checks', fn: async function publishesOriginals() {
    /** Native preparation owns no published members or selection at construction. */
    const f = createPreparationFixture();
    assert.deepEqual(f.events, []);
    assert.deepEqual(f.owner.state, { prepared: false, preparing: false, preparationFailed: false });
    assert.throws(function selectionBeforePreparation() {
      f.owner.knownSelection();
    }, { name: 'JudgmentConstructionError', message: 'Judgment question selection was not prepared' });
    f.state.onStep = function beforePublication(point) {
      assert.equal(f.byMember.size, point === 'active:1' ? 0 : 2);
      assert.equal(f.owner.state.prepared, false);
      assert.equal(f.owner.state.handle, undefined);
    };
    f.owner.prepare(f.members);
    delete f.state.onStep;
    assert.deepEqual(f.events, ['active:1', 'seal:1', 'publishSources:1', 'prepareDependencies:1', 'active:2', 'finalizeDependencies:1', 'checkpoint:1', 'sources:1', 'sources:2', 'checkpoint:2', 'checkpoint:3', 'active:3', 'checkpoint:4']);
    assert.equal(f.owner.state.prepared, true);
    assert.equal(f.owner.state.preparing, false);
    assert.equal(f.owner.state.preparationFailed, false);
    assert.equal(f.owner.state.handle, f.handle);
    assert.equal(f.state.sources, f.state.sealedSources);
    assert.deepEqual([...f.byMember.keys()], ['first', 'second']);
    /** Native selection identity is the same value retained in preparation state. */
    const selection = f.owner.knownSelection();
    assert.equal(selection, f.owner.state.selection);
    assert.ok(Object.isFrozen(selection));
    /** Distinct original handles remain independently indexed by declaration order. */
    const handles = [...f.byMember.values()];
    assert.notEqual(handles[0], handles[1]);
    for (const [ordinal, member] of f.members.entries()) {
      /** Each indexed handle resolves to one original shared record. */
      const handle = f.byMember.get(member.id);
      assert.ok(handle !== undefined);
      assert.ok(Object.isFrozen(handle));
      /** Publication retains prepared data and original cancellation by reference. */
      const record = f.bindings.get(handle);
      assert.ok(record !== undefined);
      assert.equal(record.prepared, member);
      assert.equal(record.effectiveSignal, f.controller.signal);
      assert.equal(record.execution, undefined);
      assert.equal(record.parent, undefined);
      assert.equal(record.program, undefined);
      assert.ok(Object.isFrozen(record.binding));
      assert.ok(Object.isFrozen(record.binding.identity));
      assert.notEqual(record.binding.identity, handle);
      assert.ok(Object.isFrozen(record.binding.projection));
      assert.deepEqual(record.binding.projection, { memberOrdinal: ordinal });
      /** Actual built selection resolves the original published binding. */
      const claim = selection.declare({ definitionId: 'first', bindingHandle: handle });
      /** Issuance exposes immutable context without any semantic authority. */
      const batch = selection.issue([claim]);
      /** Native request preserves both original byte snapshots and source identities. */
      const request = selection.requestFor(batch);
      assert.equal(request.questions[0]?.binding, record.binding.projection);
      assert.deepEqual(request.envelope, {
        parentJSON: f.input.parentJSON,
        preparedJSON: JSON.stringify(f.members),
        requestBody: f.receipt.request.body,
        mandatoryPolicy: f.state.sealedSources.mandatoryPolicy,
        governingSources: f.state.sealedSources.governingSources,
        instructionAuthority: 'not-established',
        policyMaterial: undefined,
      });
      assert.ok(Object.isFrozen(request.envelope));
      assert.ok((request.envelope !== null) && ((typeof request.envelope) === 'object'));
      assert.ok(('requestBody' in request.envelope) && ('mandatoryPolicy' in request.envelope) && ('governingSources' in request.envelope));
      assert.equal(request.envelope.requestBody, f.receipt.request.body);
      assert.equal(request.envelope.mandatoryPolicy, f.state.sealedSources.mandatoryPolicy);
      assert.equal(request.envelope.governingSources, f.state.sealedSources.governingSources);
    }
  } }),
  ...[false, undefined, null, 0, ''].map(function legacySourceMarker(marker, ordinal) {
    return it({ name: `retains original unsealed source path for false marker ${ordinal}`, fn: async function retainsLegacySources() {
      /** Legacy observers retain their original source collection without a sealing callback. */
      const f = createPreparationFixture();
      /** Record identity before preparation so an equal replacement cannot satisfy the assertion. */
      const original = f.state.sources;
      f.observer.beginJudgmentSources = marker;
      f.owner.prepare(f.members);
      assert.equal(f.state.sources, original);
      assert.equal(f.state.counts.has('seal'), false);
      assert.equal(f.state.counts.has('publishSources'), false);
      assert.equal(f.owner.state.prepared, true);
      assert.equal(f.byMember.size, 2);
    } });
  }),
  it({ name: 'checks active lifetime before replacement and leaves successful membership unchanged', fn: async function refusesReplacement() {
    /** Successful preparation establishes the original irreversible membership. */
    const f = createPreparationFixture();
    f.owner.prepare(f.members);
    /** A later lifetime failure must precede the replacement diagnostic. */
    const failure = new Error('original lifetime ended');
    f.state.failures.set('active', failure);
    assert.throws(function inactiveReplacement() {
      f.owner.prepare(f.members);
    }, failure);
    f.state.failures.clear();
    assert.throws(function replaceMembership() {
      f.owner.prepare(f.members);
    }, { name: 'JudgmentConstructionError', message: 'Prepared judgment membership cannot be replaced or reentered' });
    assert.equal(f.owner.state.prepared, true);
    assert.equal(f.owner.state.preparing, false);
    assert.equal(f.owner.state.preparationFailed, false);
    assert.equal(f.owner.state.handle, f.handle);
    assert.equal(f.byMember.size, 2);
    assert.equal(f.state.counts.get('prepareDependencies'), 1);
  } }),
  it({ name: 'rejects callback reentry without poisoning an outer preparation that handles it', fn: async function excludesReentry() {
    /** Source sealing is a real callback boundary before publication. */
    const f = createPreparationFixture();
    f.state.onStep = function reenterAtSeal(point) {
      if (point !== 'seal:1') return;
      assert.equal(f.owner.state.preparing, true);
      assert.throws(function reenteredPreparation() {
        f.owner.prepare(f.members);
      }, { name: 'JudgmentConstructionError', message: 'Prepared judgment membership cannot be replaced or reentered' });
    };
    f.owner.prepare(f.members);
    assert.equal(f.owner.state.preparing, false);
    assert.equal(f.owner.state.preparationFailed, false);
    assert.equal(f.owner.state.prepared, true);
    assert.equal(f.byMember.size, 2);
  } }),
] });
//endregion
