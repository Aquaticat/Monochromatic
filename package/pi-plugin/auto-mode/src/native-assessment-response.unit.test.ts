/** Built attribution readers preserve answer text and reject unsafe response envelopes. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { readers, rejectAnswer } from './native-answer-fixture.ts';

//region Original answer bytes and bounded serving identity survive admission.
await describe({ name: '', children: [
  it({ name: 'preserves raw text including empty and ill-formed answers without attribution', fn: function rawAnswers() {
    for (const answerText of ['', '0.5', '\ud800', '{"quoted":"\\n"}']) {
      const result = readers.readAssessmentResponse(answerText);
      assert.deepEqual(result, { answerText });
      assert.equal(Object.isFrozen(result), true);
    }
  } }),
  it({ name: 'retains bounded attribution and freezes only its returned envelope', fn: function attributedAnswers() {
    for (const model of ['fixture', 'x'.repeat(256), '😀'.repeat(64)]) {
      const input = { answerText: '', model };
      const result = readers.readAssessmentResponse(input);
      assert.deepEqual(result, input);
      assert.notEqual(result, input);
      assert.equal(Object.isFrozen(result), true);
      assert.equal(Object.isFrozen(input), false);
    }
  } }),
  ...[
    { name: 'null', input: null },
    { name: 'numeric response', input: 0 },
    { name: 'array', input: [] },
    { name: 'missing attribution', input: { answerText: '0.5' } },
    { name: 'missing answer', input: { model: 'fixture' } },
    { name: 'extra key', input: { answerText: '0.5', model: 'fixture', extra: true } },
    { name: 'extra symbol', input: { answerText: '0.5', model: 'fixture', [Symbol('extra')]: true } },
    { name: 'non-plain prototype', input: Object.create({ answerText: '0.5', model: 'fixture' }) },
  ].map(function envelopeCase(testCase) {
    return it({ name: `rejects ${testCase.name}`, fn: function rejectEnvelope() {
      rejectAnswer({ operation: function read() { return readers.readAssessmentResponse(testCase.input); }, message: 'Assessment response requires answer text and its serving-model attribution' });
    } });
  }),
  ...[
    { name: 'non-text answer', input: { answerText: 0.5, model: 'fixture' } },
    { name: 'empty attribution', input: { answerText: '0.5', model: '' } },
    { name: 'non-text attribution', input: { answerText: '0.5', model: true } },
    { name: 'ill-formed attribution', input: { answerText: '0.5', model: '\ud800' } },
    { name: 'ASCII byte overflow', input: { answerText: '0.5', model: 'x'.repeat(257) } },
    { name: 'UTF-8 byte overflow', input: { answerText: '0.5', model: '😀'.repeat(65) } },
  ].map(function propertyCase(testCase) {
    return it({ name: `rejects ${testCase.name}`, fn: function rejectProperty() {
      rejectAnswer({ operation: function read() { return readers.readAssessmentResponse(testCase.input); }, message: 'Attributed assessment response requires bounded model text and data properties' });
    } });
  }),
  ...['answerText', 'model'].flatMap(function descriptorCases(property) {
    return ['accessor', 'hidden'].map(function descriptorCase(kind) {
      return it({ name: `rejects ${kind} ${property} without invoking accessors`, fn: function rejectDescriptor() {
        const reads: string[] = [];
        const input = { answerText: '0.5', model: 'fixture' };
        Object.defineProperty(input, property, kind === 'accessor' ? { enumerable: true, get() { reads.push(property); return 'fixture'; } } : { enumerable: false, value: 'fixture' });
        rejectAnswer({ operation: function read() { return readers.readAssessmentResponse(input); }, message: 'Attributed assessment response requires bounded model text and data properties' });
        assert.deepEqual(reads, []);
      } });
    });
  }),
  it({ name: 'narrows object and identifier text without admitting null or malformed labels', fn: function boundaryPredicates() {
    assert.equal(readers.object({}), true);
    assert.equal(readers.object([]), true);
    assert.equal(readers.object(null), false);
    assert.equal(readers.object('text'), false);
    assert.equal(readers.text('label'), true);
    assert.equal(readers.text(''), false);
    assert.equal(readers.text('\ud800'), false);
    assert.equal(readers.text(1), false);
  } }),
] });
//endregion
