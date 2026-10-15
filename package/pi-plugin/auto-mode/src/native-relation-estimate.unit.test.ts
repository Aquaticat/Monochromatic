/** Built estimates retain original distributions and fixed definition membership. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { readers, rejectAnswer } from './native-answer-fixture.ts';

//region Scalar bounds and original choice distributions have independent rejection boundaries.
await describe({ name: '', children: [
  it({ name: 'preserves scalar bounds and negative zero', fn: async function scalarValues() {
    for (const value of [0, -0, 0.5, 1]) {
      assert.equal(readers.readRelationEstimate({ definition: { type: 'noul', criteria: {} }, value }), value);
    }
  } }),
  ...[null, '0.5', Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.1, 1.1, {}, true].map(function scalarCase(value, index) {
    return it({ name: `rejects invalid scalar case ${index}`, fn: async function invalidScalar() {
      rejectAnswer({ operation: function read() {
        return readers.readRelationEstimate({ definition: { type: 'noul', criteria: {} }, value });
      }, message: 'Scalar answer must be a bounded numeric estimate' });
    } });
  }),
  it({ name: 'rejects unsupported fixed predicate types', fn: async function unsupportedDefinition() {
    rejectAnswer({ operation: function read() {
        return readers.readRelationEstimate({ definition: { type: 'other', criteria: {} }, value: 0.5 });
      }, message: 'Estimate definition type is unsupported' });
  } }),
  it({ name: 'retains original frozen choice and probability objects without normalization', fn: async function completeDistribution() {
    const definition = { type: 'choice', criteria: { yes: 'positive', no: 'negative' } };
    for (const probabilities of [{ yes: 1, no: 0 }, { yes: 0.5, no: 0.5 }, { yes: 0.5000005, no: 0.5 }]) {
      const original = { choice: 'yes', probabilities };
      const before = { ...probabilities };
      const result = readers.readRelationEstimate({ definition, value: original });
      assert.equal(result, original);
      assert.equal(Object.isFrozen(original), true);
      assert.equal(Object.isFrozen(probabilities), true);
      assert.deepEqual(probabilities, before);
    }
  } }),
  it({ name: 'captures definition and answer getters once', fn: async function captureOriginal() {
    const reads: string[] = [];
    const definition = { type: 'choice', criteria: { yes: 'positive', no: 'negative' } };
    const value = { choice: 'yes', probabilities: { yes: 1, no: 0 } };
    const result = readers.readRelationEstimate({ get definition() {
      reads.push('definition');
    return definition; }, get value() {
      reads.push('value');
    return value; } });
    assert.equal(result, value);
    assert.deepEqual(reads, ['definition', 'value']);
  } }),
  ...[
    { name: 'non-object', value: null },
    { name: 'array', value: [] },
    { name: 'missing probabilities', value: { choice: 'yes' } },
    { name: 'extra field', value: { choice: 'yes', probabilities: {}, extra: true } },
    { name: 'unknown option', value: { choice: 'other', probabilities: {} } },
    { name: 'ill-formed option', value: { choice: '\uD800', probabilities: {} } },
  ].map(function choiceCase(testCase) {
    return it({ name: `rejects ${testCase.name} choice`, fn: async function invalidChoice() {
      rejectAnswer({ operation: function read() {
        return readers.readRelationEstimate({ definition: { type: 'choice', criteria: { yes: 'positive', no: 'negative' } }, value: testCase.value });
      }, message: 'Choice answer must select an option from its original definition' });
    } });
  }),
  ...[null, [], { yes: 1 }, { yes: 1, other: 0 }, { yes: 1, no: 0, other: 0 }].map(function membershipCase(probabilities, index) {
    return it({ name: `rejects invalid probability membership ${index}`, fn: async function invalidMembership() {
      rejectAnswer({ operation: function read() {
        return readers.readRelationEstimate({ definition: { type: 'choice', criteria: { yes: 'positive', no: 'negative' } }, value: { choice: 'yes', probabilities } });
      }, message: 'Choice probabilities differ from the original option set' });
    } });
  }),
  ...['0.5', Number.NaN, Number.POSITIVE_INFINITY, -0.1, 1.1].map(function probabilityCase(probability, index) {
    return it({ name: `rejects invalid probability member ${index}`, fn: async function invalidProbability() {
      rejectAnswer({ operation: function read() {
        return readers.readRelationEstimate({ definition: { type: 'choice', criteria: { yes: 'positive', no: 'negative' } }, value: { choice: 'yes', probabilities: { yes: probability, no: 0.5 } } });
      }, message: 'Choice probabilities must be bounded numbers' });
    } });
  }),
  ...[{ yes: 0.2, no: 0.8 }, { yes: 0.6, no: 0.5 }, { yes: 0.500002, no: 0.5 }, { yes: 0.2, no: 0.2 }].map(function distributionCase(probabilities, index) {
    return it({ name: `rejects incomplete or unselected maximum distribution ${index}`, fn: async function invalidDistribution() {
      const value = { choice: 'yes', probabilities };
      rejectAnswer({ operation: function read() {
        return readers.readRelationEstimate({ definition: { type: 'choice', criteria: { yes: 'positive', no: 'negative' } }, value });
      }, message: 'Choice answer is not a complete distribution with a highest-probability selected option' });
      assert.equal(Object.isFrozen(value), false);
      assert.equal(Object.isFrozen(probabilities), false);
    } });
  }),
] });
//endregion
