/** Built judgment lifecycle preserves synchronous exclusion and canonical evidence admission. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createLifecycleFixture } from './native-lifecycle-fixture.ts';
import { captureBudgetRejection } from './native-judgment-budget-fixture.ts';

//region Operation exclusion returns original values and always releases the shared guard.
await describe({ name: '', children: [
  it({ name: 'constructs lazily and releases synchronous exclusion after return and failure', fn: async function excludesReentry() {
    /** No lazy capability is read during lifecycle construction. */
    const f = createLifecycleFixture();
    assert.deepEqual(f.events, []);
    assert.deepEqual(f.owner.state, { operating: false, assessing: false, finished: false, closeFailed: false });
    /** Exact callback result crosses the operation boundary unchanged. */
    const result = Object.freeze({ original: true });
    assert.equal(f.owner.operation(function originalResult() {
      assert.equal(f.owner.state.operating, true);
      assert.throws(function reenter() { 
        f.owner.operation(function nested() { 
        return result; 
      }); 
      },
        { name: 'JudgmentConstructionError', message: 'Judgment operations cannot reenter through callbacks' });
      return result;
    }), result);
    assert.equal(f.owner.state.operating, false);
    /** An original thrown value must survive cleanup without replacement. */
    const failure = new Error('operation failed');
    assert.throws(function failedOperation() { 
      f.owner.operation(function fail() { 
      throw failure; 
    }); 
    }, failure);
    assert.equal(f.owner.state.operating, false);
    assert.equal(f.owner.operation(function recovered() { 
      return result; 
    }), result);
  } }),
  it({ name: 'checks readiness before issue and never adopts selection-only membership', fn: async function ownsIssuedMembership() {
    /** Readiness failure must not consume original claim issuance. */
    const f = createLifecycleFixture();
    /** Exact readiness failure is returned before selection is consulted. */
    const failure = new Error('not ready');
    f.state.failures.set('ready', failure);
    assert.throws(function prematureIssue() { 
      f.owner.issue([f.claim]); 
    }, failure);
    assert.deepEqual(f.events, ['ready']);
    f.state.failures.clear();
    /** Bypassing lifecycle issuance creates a real selection batch without judgment membership. */
    const foreign = f.selection.issue([f.claim]);
    f.events.length = 0;
    assert.throws(function foreignEvidence() { 
      f.owner.captureBatchEvidence(foreign); 
    },
      { name: 'JudgmentConstructionError', message: 'Question batch is not owned by this judgment' });
    /** The asynchronous boundary must reject the same foreign membership. */
    const rejected = await captureBudgetRejection(f.owner.assess(foreign));
    assert.ok(Error.isError(rejected));
    assert.equal(rejected.message, 'Question batch is not owned by this judgment');
    assert.equal(f.owner.state.operating, false);
    assert.equal(f.owner.state.assessing, false);
    assert.deepEqual(f.events, []);
  } }),
  it({ name: 'authenticates complete batch evidence before checking binding currentness', fn: async function capturesCanonicalEvidence() {
    /** Real original selection retains both claim and batch evidence identities. */
    const f = createLifecycleFixture();
    /** Lifecycle membership is published after original selection issuance. */
    const batch = f.owner.issue([f.claim]);
    assert.deepEqual(f.events, ['ready', 'selection']);
    f.events.length = 0;
    assert.throws(function incompleteBatch() { 
      f.owner.captureBatchEvidence(batch); 
    },
      { name: 'QuestionSelectionError', message: 'Original batch has no complete usable relation evidence' });
    assert.deepEqual(f.events, ['selection']);
    await f.owner.assess(batch);
    f.events.length = 0;
    /** Captured arrays and member records must be the original canonical values. */
    const evidence = f.owner.captureBatchEvidence(batch);
    assert.equal(evidence, f.selection.captureBatchEvidence(batch));
    assert.deepEqual(f.events, ['selection', 'segment:readBatchEvidence:enter', 'selection', 'segment:readBatchEvidence:exit']);
    f.events.length = 0;
    f.owner.assertBatchEvidence(evidence);
    assert.deepEqual(f.events, ['selection', 'dependencies']);
    f.events.length = 0;
    assert.throws(function copiedEvidence() { 
      f.owner.assertBatchEvidence([...evidence]); 
    },
      { name: 'QuestionSelectionError', message: 'Relation evidence is not an original captured batch from this judgment' });
    assert.deepEqual(f.events, ['selection']);
    f.events.length = 0;
    /** Claim capture still crosses readiness before reading original selection. */
    const claimEvidence = f.owner.captureClaimEvidence(f.claim);
    assert.equal(claimEvidence, evidence[0]);
    assert.deepEqual(f.events, ['ready', 'selection']);
    f.events.length = 0;
    f.owner.assertClaimEvidence({ claim: f.claim, evidence: claimEvidence });
    assert.deepEqual(f.events, ['selection', 'dependencies']);
    f.events.length = 0;
    assert.throws(function copiedClaim() { 
      f.owner.assertClaimEvidence({ claim: f.claim, evidence: { ...claimEvidence } }); 
    },
      { name: 'QuestionSelectionError', message: 'Relation evidence is not the canonical record for this original claim' });
    assert.deepEqual(f.events, ['selection']);
    /** Valid identity must not bypass a later dependency failure. */
    const stale = new Error('dependency retired');
    f.state.failures.set('dependencies', stale);
    assert.throws(function staleBatch() { 
      f.owner.assertBatchEvidence(evidence); 
    }, stale);
    assert.throws(function staleClaim() { 
      f.owner.assertClaimEvidence({ claim: f.claim, evidence: claimEvidence }); 
    }, stale);
    f.state.failures.set('ready', stale);
    f.events.length = 0;
    assert.throws(function staleCapture() { 
      f.owner.captureClaimEvidence(f.claim); 
    }, stale);
    assert.deepEqual(f.events, ['ready']);
  } }),
] });
//endregion
