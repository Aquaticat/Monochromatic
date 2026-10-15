/**
 Complete response admission preserves original terminal evidence and lifetime failures. @module
 */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createSettlementFixture } from './native-settlement-fixture.ts';

/** Different answer forms verify exact membership and all-or-nothing publication. */
const validText = JSON.stringify([
  { id: 'q0', status: 'estimate', value: 0.25 },
  { id: 'q1', status: 'unresolved', reason: 'original uncertainty' },
]);

//region Complete answers retain identities, frozen records, and optional model presence.

await describe({
  name: '',
  children: [
    it({
      name: 'publishes all answers only after the second budget checkpoint',
      fn: async function retainsOriginalAnswers() {
        /** Count checks while observing the original owner record before publication. */
        const checks = { count: 0 };
        /** Budget callbacks inspect the exact claims the production function will update. */
        const fixture = createSettlementFixture({ checkpoint() {
          checks.count += 1;
          assert.ok(fixture.batch.selected.every(function unanswered(claim) {
            return claim.answer === undefined;
          }));
        } });
        /** Serving attribution is retained only for a completely admitted response. */
        const record = fixture.settle({ batch: fixture.handle, answerText: validText, model: 'serving-model' });
        assert.equal(checks.count, 2);
        assert.equal(fixture.batch.record, record);
        assert.equal(fixture.batch.settled, true);
        assert.equal(record.raw, validText);
        assert.equal(record.model, 'serving-model');
        assert.equal(record.failure, undefined);
        assert.equal(Object.hasOwn(record, 'failure'), true);
        assert.equal(record.malformed, false);
        assert.equal(record.discarded, false);
        assert.equal(record.semanticQualification, 'not-established');
        assert.equal(record.instructionAuthority, 'not-established');
        assert.deepEqual(record.answers, [{ status: 'estimate', value: 0.25 }, { status: 'unresolved', reason: 'original uncertainty' }]);
        assert.equal(Object.isFrozen(record), true);
        assert.equal(Object.isFrozen(record.answers), true);
        for (const [index, claim] of fixture.batch.selected.entries()) {
          assert.equal(claim.answer, record.answers[index]);
          assert.equal(Object.isFrozen(claim.answer), true);
          assert.equal(claim.model, 'serving-model');
        }
        assert.throws(function settleTwice() {
          fixture.settle({ batch: fixture.handle, answerText: validText });
        }, function terminalBatch(error) {
          return (Error.isError(error,)) && (error.message === 'Question batch already has a terminal response');
        });
        assert.equal(fixture.batch.record, record);
      },
    }),
    it({
      name: 'retains original choice values and omits absent model attribution',
      fn: async function retainsChoiceDistribution() {
        /** This claim's pinned alternatives determine the admitted probability keys. */
        const fixture = createSettlementFixture({ definitions: [{ type: 'choice', criteria: { yes: 'holds', no: 'does not hold' } }] });
        /** Unequal probabilities detect accidental normalization or selected-value replacement. */
        const record = fixture.settle({ batch: fixture.handle, answerText: JSON.stringify([
          { id: 'q0', status: 'estimate', value: { choice: 'yes', probabilities: { yes: 0.75, no: 0.25 } } },
        ]) });
        assert.deepEqual(record.answers, [{ status: 'estimate', value: { choice: 'yes', probabilities: { yes: 0.75, no: 0.25 } } }]);
        assert.equal(Object.hasOwn(record, 'model'), false);
        assert.ok(fixture.batch.selected.every(function noModel(claim) {
          return !Object.hasOwn(claim, 'model');
        }));
      },
    }),

    //endregion
    //region Malformed transport values never leave partial usable answers.

    ...[
      undefined,
      42,
      '\uD800',
      '{',
      '{}',
      '[]',
      '[null,null]',
      '[[],[]]',
      '[{"id":"q1","status":"estimate","value":0.5},{"id":"q0","status":"estimate","value":0.5}]',
      '[{"id":"q0","status":"estimate","value":0.5},{"id":"q1","status":"estimate","value":2}]',
      '[{"id":"q0","status":"estimate","value":0.5},{"id":"q1","status":"estimate","value":0.5,"extra":true}]',
      '[{"id":"q0","status":"estimate","value":0.5},{"id":"q1","status":"unresolved","reason":""}]',
      '[{"id":"q0","status":"estimate","value":0.5},{"id":"q1","status":"unresolved","reason":"unknown","extra":true}]',
      '[{"id":"q0","status":"estimate","value":0.5},{"id":"q1","status":"other"}]',
      ' '.repeat(65_537),
      JSON.stringify([{ id: 'q0', status: 'estimate', value: 0.5 }, { id: 'q1', status: 'unresolved', reason: 'é'.repeat(33_000) }]),
    ].map(function malformedCase(answerText, index) {
      return it({
        name: `retains malformed response ${index} across every selected claim`,
        fn: async function rejectsMalformedResponse() {
          /** Each response has a fresh original batch so terminal reuse cannot mask validation. */
          const fixture = createSettlementFixture();
          /** A valid serving model must still be omitted when any answer is malformed. */
          const record = fixture.settle({ batch: fixture.handle, answerText, model: 'valid-model' });
          assert.equal(record.malformed, true);
          assert.equal(record.discarded, false);
          assert.ok(Error.isError(record.failure,));
          assert.deepEqual(record.answers, [{ status: 'malformed' }, { status: 'malformed' }]);
          assert.equal(Object.hasOwn(record, 'raw'), ((typeof answerText) === 'string') && (Buffer.byteLength(answerText) <= 65_536));
          assert.equal(Object.hasOwn(record, 'model'), false);
          assert.equal(fixture.batch.settled, true);
          for (const [answerIndex, claim] of fixture.batch.selected.entries()) {
            assert.equal(claim.answer, record.answers[answerIndex]);
            assert.equal(Object.hasOwn(claim, 'model'), false);
          }
          if (answerText === '{') assert.ok(record.failure instanceof SyntaxError);
        },
      });
    }),
    ...['', 1, null, '\uD800', 'a'.repeat(257), 'é'.repeat(129)].map(function malformedModel(model, index) {
      return it({
        name: `rejects malformed serving attribution ${index}`,
        fn: async function rejectsModelAttribution() {
          /** Valid answer text isolates model-attribution admission. */
          const fixture = createSettlementFixture();
          /** Retain the invalid attribution failure without publishing the model. */
          const record = fixture.settle({ batch: fixture.handle, answerText: validText, model });
          assert.equal(record.malformed, true);
          assert.equal(Object.hasOwn(record, 'model'), false);
          assert.ok(Error.isError(record.failure,));
          assert.equal(record.failure.message, 'Assessment model attribution is malformed');
        },
      });
    }),
    it({
      name: 'admits exact raw and model byte bounds and discards oversized raw text',
      fn: async function checksByteBounds() {
        /** JSON whitespace reaches the boundary without changing answer membership. */
        const fixture = createSettlementFixture();
        /** Multibyte attribution proves that the model bound counts UTF-8 bytes. */
        const model = 'é'.repeat(128);
        /** Exact raw boundary remains retained verbatim. */
        const raw = validText.padEnd(65_536);
        assert.equal(fixture.settle({ batch: fixture.handle, answerText: raw, model }).raw, raw);
        assert.equal(fixture.batch.record?.malformed, false);
        /** Oversized text still produces a terminal diagnostic without retained raw data. */
        const oversized = createSettlementFixture();
        assert.equal(oversized.settle({ batch: oversized.handle, answerText: `${raw} ` }).raw, undefined);
        assert.equal(oversized.batch.record?.malformed, true);
      },
    }),

    //endregion
    //region Original lifecycle failures discard the complete response and rethrow the same error.

    ...['initial-budget', 'current-binding', 'final-budget'].map(function lifecycleFailure(point) {
      return it({
        name: `discards every answer after ${point} failure`,
        fn: async function retainsOriginalFailure() {
          /** Error identity distinguishes original lifecycle failure from a replacement diagnostic. */
          const failure = new Error(point);
          /** Count the exact predecode and postdecode lifetime checks. */
          const checks = { count: 0 };
          /** Both owner callbacks throw only at the selected lifecycle boundary. */
          const fixture = createSettlementFixture({
            checkpoint() {
              checks.count += 1;
              if (((point === 'initial-budget') && (checks.count === 1)) || ((point === 'final-budget') && (checks.count === 2))) throw failure;
            },
            current() { if (point === 'current-binding') throw failure; },
          });
          assert.throws(function settleStaleBatch() {
            fixture.settle({ batch: fixture.handle, answerText: validText });
          }, function originalError(error) {
            return error === failure;
          });
          assert.equal(fixture.batch.record?.failure, failure);
          assert.equal(fixture.batch.record?.discarded, true);
          assert.equal(fixture.batch.record?.malformed, false);
          assert.equal(fixture.batch.record?.raw, validText);
          assert.equal(fixture.batch.settled, true);
          assert.ok(fixture.batch.record !== undefined);
          assert.deepEqual(fixture.batch.record.answers, [{ status: 'discarded' }, { status: 'discarded' }]);
          for (const [index, claim] of fixture.batch.selected.entries()) assert.equal(claim.answer, fixture.batch.record.answers[index]);
        },
      });
    }),
    it({
      name: 'rejects foreign batch handles before changing original claims',
      fn: async function rejectsForeignBatch() {
        /** A foreign handle must not settle the actual original batch. */
        const fixture = createSettlementFixture();
        assert.throws(function foreignBatch() {
          fixture.settle({ batch: {}, answerText: validText });
        }, function foreignError(error) {
          return (Error.isError(error,)) && (error.message === 'Foreign fixture batch');
        });
        assert.equal(fixture.batch.settled, false);
        assert.equal(fixture.batch.record, undefined);
        assert.ok(fixture.batch.selected.every(function untouched(claim) {
          return claim.answer === undefined;
        }));
      },
    }),

    //endregion
  ],
});
