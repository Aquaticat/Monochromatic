/**
 Original selection checks lifetime and binding identity without hiding retained diagnostics. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createSelectionBinding, createSelectionFixture, selectionError } from './native-selection-fixture.ts';

//region Original callbacks cannot reenter, silently rebind, or publish after deadline failure.
await describe({
  name: '',
  children: [
    it({
      name: 'rejects resolver reentry and restores the lock after the original exception',
      fn: async function rejectsReentryAndRecovers() {
        /** Callback control is independent of the construction-time budget checks. */
        const control: { onResolve?: () => void } = {};
        /** Resolver callbacks run only after original selection construction. */
        const selection = createSelectionFixture({ resolveBinding(handle) { 
          control.onResolve?.();
        return handle; 
        } });
        /** One original occurrence survives a failed reentrant declaration. */
        const binding = createSelectionBinding();
        control.onResolve = function reenterSelection() { 
          selection.inspectClaim({}); 
        };
        assert.throws(function declareReentrantly() { 
          selection.declare({ definitionId: 'first', bindingHandle: binding }); 
        }, selectionError('Question binding operations cannot reenter'));
        delete control.onResolve;
        /** Successful retry proves scope cleanup restores owner access after throwing. */
        const claim = selection.declare({ definitionId: 'first', bindingHandle: binding });
        assert.equal(selection.inspectClaim(claim).issued, false);
        /** Resolver failures must preserve their original identity too. */
        const failure = new Error('original resolver failure');
        control.onResolve = function failOriginalResolution() { 
          throw failure; 
        };
        assert.throws(function failCurrentRead() { 
          selection.answerFor(claim); 
        }, function originalFailure(error) { 
          return error === failure; 
        });
        delete control.onResolve;
        assert.equal(selection.answerFor(claim).issued, false);
      },
    }),
    it({
      name: 'rejects a replacement resolver record even when its occurrence identity is reused',
      fn: async function preservesOriginalBindingRecord() {
        /** The resolver can change which record it returns for the same original handle. */
        const control = { binding: createSelectionBinding() };
        /** Original currentness compares record identity, not structural content. */
        const selection = createSelectionFixture({ resolveBinding() { 
          return control.binding; 
        } });
        /** Original handle is distinct from the returned occurrence record. */
        const handle = Object.freeze({});
        /** This declaration retains the exact first resolver record. */
        const claim = selection.declare({ definitionId: 'first', bindingHandle: handle });
        control.binding = Object.freeze({ ...control.binding });
        assert.throws(function redeclareChangedRecord() { 
          selection.declare({ definitionId: 'first', bindingHandle: handle }); 
        }, selectionError('Binding identity was reused for a different record'));
        assert.throws(function inspectChangedCurrentAnswer() { 
          selection.answerFor(claim); 
        }, selectionError('Claim binding changed; the original judgment must not silently rebind'));
        assert.throws(function issueChangedClaim() { 
          selection.issue([claim]); 
        }, selectionError('Claim binding changed; the original judgment must not silently rebind'));
        assert.deepEqual(selection.inspectClaim(claim), { retainedOnly: true, issued: false, answer: undefined });
      },
    }),
    ...[1, 2, 3].map(function budgetFailure(checkpoint) {
      return it({
        name: `keeps original claims unissued after issuance checkpoint ${checkpoint} fails`,
        fn: async function rejectsStalePublication() {
          /** Only issuance checkpoints are armed after original declaration. */
          const control = { armed: false, count: 0 };
          /** Exact original failure identity must survive the owner boundary. */
          const failure = new Error('original budget expired');
          /** Original budget remains current through construction and declaration. */
          const selection = createSelectionFixture({ checkpoint() {
            if (control.armed) {
              control.count += 1;
              if (control.count === checkpoint) throw failure;
            }
          } });
          /** One unissued original claim detects partial publication. */
          const claim = selection.declare({ definitionId: 'first', bindingHandle: createSelectionBinding() });
          control.armed = true;
          assert.throws(function failIssuanceBudget() { 
            selection.issue([claim]); 
          }, function originalFailure(error) { 
            return error === failure; 
          });
          assert.equal(selection.inspectClaim(claim).issued, false);
          control.armed = false;
          assert.equal(selection.requestFor(selection.issue([claim])).questions.length, 1);
        },
      });
    }),
    it({
      name: 'retains canonical evidence identity after dependencies and lifetime become stale',
      fn: async function separatesIdentityFromEligibility() {
        /** Original dependency and lifetime can independently become unavailable. */
        const control = { expired: false, binding: createSelectionBinding() };
        /** Original budget failure identifies the lifetime gate on current reads. */
        const failure = new Error('original judgment expired');
        /** Retained identity operations must not call either freshness capability. */
        const selection = createSelectionFixture({
          checkpoint() { 
            if (control.expired) throw failure; 
          },
          resolveBinding() { 
            return control.binding; 
          },
        });
        /** One original occurrence is selected and settled before expiry. */
        const claim = selection.declare({ definitionId: 'first', bindingHandle: Object.freeze({}) });
        /** Batch identity survives even after dispatch eligibility ends. */
        const batch = selection.issue([claim]);
        /** Successful settlement precedes original capture. */
        const record = selection.settle({ batch, answerText: '[{"id":"q0","status":"estimate","value":0.75}]' });
        /** Capture once while every original dependency is current. */
        const evidence = selection.captureEvidence(claim);
        /** Canonical complete membership is retained independently of source freshness. */
        const allEvidence = selection.captureBatchEvidence(batch);
        control.binding = Object.freeze({ ...control.binding });
        assert.throws(function captureChangedClaim() { 
          selection.captureEvidence(claim); 
        }, selectionError('Claim binding changed; the original judgment must not silently rebind'));
        assert.throws(function captureChangedBatch() { 
          selection.captureBatchEvidence(batch); 
        }, selectionError('Claim binding changed; the original judgment must not silently rebind'));
        assert.throws(function readChangedResult() { 
          selection.resultFor(batch); 
        }, selectionError('Claim binding changed; the original judgment must not silently rebind'));
        control.expired = true;
        selection.assertCapturableBatch(batch);
        selection.assertCapturedIdentity({ claim, evidence });
        selection.assertCapturedBatchIdentity(allEvidence);
        assert.equal(selection.inspectBatch(batch).record, record);
        assert.equal(selection.inspectClaim(claim).answer, record.answers[0]);
        assert.throws(function currentReadAfterExpiry() { 
          selection.answerFor(claim); 
        }, function originalFailure(error) { 
          return error === failure; 
        });
      },
    }),
    it({
      name: 'permits diagnostic discard after both original lifetime and binding become stale',
      fn: async function retainsStaleTransportFailure() {
        /** Original freshness capabilities become unavailable only after issuance. */
        const control = { stale: false };
        /** Original failure identity is retained through the late diagnostic path. */
        const failure = new Error('original transport ended');
        /** Neither freshness callback may be invoked during retained discard. */
        const selection = createSelectionFixture({
          checkpoint() { 
            if (control.stale) throw failure; 
          },
          resolveBinding(handle) { 
            if (control.stale) throw failure;
          return handle; 
          },
        });
        /** Original issued membership remains inspectable after lifetime expiry. */
        const claim = selection.declare({ definitionId: 'first', bindingHandle: createSelectionBinding() });
        /** Transport finalization retains this exact batch. */
        const batch = selection.issue([claim]);
        control.stale = true;
        /** Diagnostic discard must succeed without invoking stale callbacks. */
        const record = selection.discard({ batch, error: failure });
        assert.equal(record.failure, failure);
        assert.equal(record.discarded, true);
        assert.equal(selection.inspectBatch(batch).record, record);
        assert.equal(selection.inspectClaim(claim).answer, record.answers[0]);
      },
    }),
  ],
});
//endregion
