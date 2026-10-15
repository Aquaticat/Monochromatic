/**
 Original selection retains canonical claims, terminal answers, and captured evidence identity. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createSelectionBinding, createSelectionFixture, selectionError } from './native-selection-fixture.ts';

//region Original claims and evidence stay canonical throughout one complete batch lifetime.
await describe({
  name: '',
  children: [
    it({
      name: 'preserves canonical claim, request, answer, and evidence identities',
      fn: async function retainsOriginalIdentities() {
        /** Exact original projections remain observable through request and evidence. */
        const envelope = Object.freeze({ original: 'context' });
        /** The fixture owns every binding and its canonical identity. */
        const binding = createSelectionBinding(Object.freeze({ original: 'occurrence' }));
        /** One selection owns both predicates for this same original occurrence. */
        const selection = createSelectionFixture({ envelope });
        /** First predicate establishes one canonical claim. */
        const first = selection.declare({ definitionId: 'first', bindingHandle: binding });
        /** Distinct predicate must not reuse the first claim handle. */
        const second = selection.declare({ definitionId: 'second', bindingHandle: binding });
        assert.equal(Object.isFrozen(selection), true);
        assert.equal(Object.isFrozen(first), true);
        assert.notEqual(first, second);
        assert.equal(selection.declare({ definitionId: 'first', bindingHandle: binding }), first);
        assert.deepEqual(selection.inspectClaim(first), { retainedOnly: true, issued: false, answer: undefined });
        assert.deepEqual(selection.answerFor(first), { issued: false, answer: undefined, semanticQualification: 'not-established' });
        assert.throws(function captureUnissued() { selection.captureEvidence(first); }, selectionError('Claim has no usable terminal relation evidence'));
        assert.throws(function authenticateUncaptured() { selection.assertCapturedIdentity({ claim: first, evidence: {} }); }, selectionError('Relation evidence is not the canonical record for this original claim'));
        /** Reverse declaration order proves issue order is retained independently. */
        const batch = selection.issue([second, first]);
        /** Repeated request reads must return the original immutable request. */
        const request = selection.requestFor(batch);
        assert.equal(Object.isFrozen(batch), true);
        assert.equal(selection.requestFor(batch), request);
        assert.equal(request.envelope, envelope);
        assert.equal(Object.isFrozen(request), true);
        assert.equal(Object.isFrozen(request.questions), true);
        assert.deepEqual(request.questions.map(function membership(question) { return [question.id, question.definitionId]; }), [['q0', 'second'], ['q1', 'first']]);
        assert.ok(request.questions.every(function originalProjection(question) { return (question.binding === binding.projection) && Object.isFrozen(question); }));
        assert.deepEqual(selection.inspectBatch(batch), { retainedOnly: true, settled: false, record: undefined });
        assert.throws(function readUnsettled() { selection.resultFor(batch); }, selectionError('Question batch has no terminal response'));
        assert.throws(function captureIncomplete() { selection.captureBatchEvidence(batch); }, selectionError('Original batch has no complete usable relation evidence'));
        assert.throws(function assertIncomplete() { selection.assertCapturableBatch(batch); }, selectionError('Original batch has no complete usable relation evidence'));
        assert.throws(function issueAgain() { selection.issue([first]); }, selectionError('Claim was already issued; uncertainty cannot create another selection'));
        /** Both admitted answer forms remain unqualified evidence. */
        const record = selection.settle({ batch, model: 'fixture-model', answerText: JSON.stringify([
          { id: 'q0', status: 'estimate', value: 0.25 },
          { id: 'q1', status: 'unresolved', reason: 'uncertain original relation' },
        ]) });
        assert.equal(selection.resultFor(batch), record);
        assert.equal(selection.inspectBatch(batch).record, record);
        assert.equal(selection.answerFor(second).answer, record.answers[0]);
        assert.equal(selection.answerFor(first).answer, record.answers[1]);
        assert.equal(selection.declare({ definitionId: 'first', bindingHandle: binding }), first);
        assert.throws(function redispatchTerminal() { selection.requestFor(batch); }, selectionError('Question batch is terminal; it cannot be dispatched again'));
        selection.assertCapturableBatch(batch);
        /** Individual capture and batch capture must share the same original record. */
        const evidence = selection.captureEvidence(first);
        /** Complete batch membership cannot be borrowed from a caller array. */
        const allEvidence = selection.captureBatchEvidence(batch);
        assert.equal(Object.isFrozen(evidence), true);
        assert.equal(Object.isFrozen(allEvidence), true);
        assert.equal(selection.captureEvidence(first), evidence);
        assert.equal(selection.captureBatchEvidence(batch), allEvidence);
        assert.equal(allEvidence[1], evidence);
        assert.equal(evidence.answer, record.answers[1]);
        assert.equal(evidence.definition, request.questions[1]?.definition);
        assert.equal(evidence.binding, binding.projection);
        assert.equal(evidence.envelope, envelope);
        assert.equal(evidence.model, 'fixture-model');
        assert.equal(evidence.semanticQualification, 'not-established');
        assert.equal(evidence.instructionAuthority, 'not-established');
        assert.equal(evidence.permission, false);
        selection.assertCapturedIdentity({ claim: first, evidence });
        selection.assertCapturedBatchIdentity(allEvidence);
        assert.throws(function copiedClaimEvidence() { selection.assertCapturedIdentity({ claim: first, evidence: { ...evidence } }); }, selectionError('Relation evidence is not the canonical record for this original claim'));
        assert.throws(function copiedBatchEvidence() { selection.assertCapturedBatchIdentity([...allEvidence]); }, selectionError('Relation evidence is not an original captured batch from this judgment'));
        assert.throws(function foreignClaimEvidence() { selection.assertCapturedIdentity({ claim: second, evidence }); }, selectionError('Relation evidence is not the canonical record for this original claim'));
      },
    }),
    ...['malformed', 'discarded'].map(function terminalFailure(kind) {
      return it({
        name: `retains ${kind} diagnostics without usable claim or batch evidence`,
        fn: async function retainsTerminalFailure() {
          /** Each failure receives original unissued membership. */
          const selection = createSelectionFixture();
          /** The same original claim must be visible through every diagnostic path. */
          const claim = selection.declare({ definitionId: 'first', bindingHandle: createSelectionBinding() });
          /** Issuance precedes either transport failure or malformed settlement. */
          const batch = selection.issue([claim]);
          /** Original failure identity survives explicit discard. */
          const failure = new Error('original transport failed');
          /** Terminal behavior is exercised through the public consumer boundary. */
          const record = kind === 'malformed'
            ? selection.settle({ batch, answerText: 'invalid JSON' })
            : selection.discard({ batch, error: failure });
          assert.equal(record.malformed, kind === 'malformed');
          assert.equal(record.discarded, kind === 'discarded');
          if (kind === 'discarded') {
            assert.equal(record.failure, failure);
            assert.equal(Object.hasOwn(record, 'raw'), false);
          }
          assert.equal(selection.inspectClaim(claim).answer, record.answers[0]);
          assert.equal(selection.resultFor(batch), record);
          assert.throws(function captureFailedClaim() { selection.captureEvidence(claim); }, selectionError('Claim has no usable terminal relation evidence'));
          assert.throws(function captureFailedBatch() { selection.captureBatchEvidence(batch); }, selectionError('Original batch has no complete usable relation evidence'));
          assert.throws(function assertFailedBatch() { selection.assertCapturableBatch(batch); }, selectionError('Original batch has no complete usable relation evidence'));
          assert.throws(function discardAgain() { selection.discard({ batch, error: failure }); }, selectionError('Question batch already has a terminal response'));
          assert.throws(function settleAgain() { selection.settle({ batch, answerText: '[]' }); }, selectionError('Question batch already has a terminal response'));
        },
      });
    }),
    ...[null, undefined, 1, 'foreign', Object.freeze({}), Object.freeze([])].map(function foreignHandle(handle, index) {
      return it({
        name: `rejects foreign handle ${index} across original membership boundaries`,
        fn: async function rejectsForeignMembership() {
          /** A separate owner proves value shape cannot manufacture membership. */
          const selection = createSelectionFixture();
          assert.throws(function foreignClaim() { selection.answerFor(handle); }, selectionError('Claim handle is not owned by this judgment'));
          assert.throws(function foreignInspection() { selection.inspectClaim(handle); }, selectionError('Claim handle is not owned by this judgment'));
          assert.throws(function foreignBatch() { selection.requestFor(handle); }, selectionError('Question batch is not owned by this judgment'));
          assert.throws(function foreignBatchInspection() { selection.inspectBatch(handle); }, selectionError('Question batch is not owned by this judgment'));
          assert.throws(function foreignBatchCapture() { selection.assertCapturedBatchIdentity(handle); }, selectionError('Relation evidence is not an original captured batch from this judgment'));
        },
      });
    }),
    it({
      name: 'omits absent model attribution from canonical evidence',
      fn: async function omitsUnattributedModel() {
        /** No model attribution is supplied at the public settlement boundary. */
        const selection = createSelectionFixture();
        /** One original claim permits exact canonical capture. */
        const claim = selection.declare({ definitionId: 'first', bindingHandle: createSelectionBinding() });
        /** The original batch owns the resulting answer. */
        const batch = selection.issue([claim]);
        selection.settle({ batch, answerText: '[{"id":"q0","status":"estimate","value":0.5}]' });
        assert.equal(Object.hasOwn(selection.captureEvidence(claim), 'model'), false);
      },
    }),
  ],
});
//endregion
