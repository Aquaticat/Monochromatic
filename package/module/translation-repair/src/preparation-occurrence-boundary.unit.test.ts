import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  alignDocumentSections,
  blockPairingProtocol,
  blockPairingQuestion,
  hashContent,
  parseDocument,
  readPreparationOccurrence,
  readPreparationReceipt,
} from '../dist/final/node/index.mjs';
import { receiptFailure, receiptFixture, } from './preparation-receipt.test-fixture.ts';

const sourceText = 'Lead[^100].\n\n[^100]: Source note.\n\n## 猫\n\n猫睡了。';
const targetText = 'Lead[^2].\n\n[^2]: Archive note.\n\n## Cat\n\nThe cat slept.';
const f = await receiptFixture({ sourceText, targetText, pairIndex: 1 });

await describe({ name: 'receipt occurrence boundary witnesses', children: [
  it({ name: 'rejects valid wrong source document even though the registered local question still matches', fn: async () => {
    const changedSource = sourceText.replaceAll('[^100]', '[^2000]');
    const changedExpected = { ...f.expected, sourceHash: hashContent({ content: changedSource }) };
    const allowed = readPreparationOccurrence({ ...f, sourceText: changedSource, expected: changedExpected, l: f.input.l });
    expect(
      blockPairingProtocol(blockPairingQuestion({ pair: allowed.pair })),
    ).toEqual(f.receipt.question.protocol);
    expect(allowed.pair.source).not.toEqual(f.input.pair.source);
    expect(receiptFailure(() => readPreparationOccurrence({ ...f, sourceText: changedSource, l: f.input.l }))).toBe('documents');
  } }),
  it({ name: 'rejects valid wrong target document even though the registered local question still matches', fn: async () => {
    const changedTarget = targetText.replaceAll('[^2]', '[^2000]');
    const changedExpected = { ...f.expected, targetHash: hashContent({ content: changedTarget }) };
    const allowed = readPreparationOccurrence({ ...f, targetText: changedTarget, expected: changedExpected, l: f.input.l });
    expect(
      blockPairingProtocol(blockPairingQuestion({ pair: allowed.pair })),
    ).toEqual(f.receipt.question.protocol);
    expect(allowed.pair.target).not.toEqual(f.input.pair.target);
    expect(receiptFailure(() => readPreparationOccurrence({ ...f, targetText: changedTarget, l: f.input.l }))).toBe('documents');
  } }),
  it({ name: 'reinterprets the same payload under registered changed alignment rather than replaying old findings', fn: async () => {
    const sectionPairing = [{ source: 1, target: 1 }];
    const source = parseDocument({ text: sourceText });
    const target = parseDocument({ text: targetText });
    const alignment = alignDocumentSections({ source, target, sectionPairing });
    const pairIndex = alignment.pairs.findIndex(pair => (pair.source.sliceIndex === 1) && (pair.target.sliceIndex === 1));
    expect(pairIndex).toBeGreaterThanOrEqual(0);
    const current = await receiptFixture({ sourceText, targetText, sectionPairing, pairIndex });
    expect(current.receipt.question).toEqual(f.receipt.question);
    const expected = { ...current.expected, binding: f.expected.binding };
    const result = readPreparationOccurrence({ ...f, expected, l: f.input.l });
    const original = readPreparationOccurrence({ ...f, l: f.input.l });
    expect(result.prepared).toEqual(current.prepared);
    expect(result.alignmentFindings).toEqual(alignment.findings);
    expect(result.alignmentFindings).not.toEqual(original.alignmentFindings);
    expect(f.calls).toHaveLength(2);

    const originalExpected = structuredClone(expected);
    const baseline = readPreparationOccurrence({ ...f, expected, l: f.input.l });
    const [finding] = result.alignmentFindings;
    const [mapping] = result.expected.sectionPairing ?? [];
    if ((finding === undefined) || (mapping === undefined)) throw new Error('expected owned current alignment observations and registered correspondence');
    Object.defineProperty(finding, 'detail', { value: 'mutated returned observation' });
    Object.defineProperty(mapping, 'target', { value: 0 });
    expect(expected).toEqual(originalExpected);
    expect(readPreparationOccurrence({ ...f, expected, l: f.input.l })).toEqual(baseline);
  } }),
  it({ name: 'binds later explicitly mapped parents with distinct current target indexes', fn: async () => {
    const later = await receiptFixture({
      sourceText: '## 猫\n\n猫睡了。\n\n## 盒子\n\n盒子开了。\n\n## 食物\n\n饭好了。',
      targetText: '## Extra\n\nArchive only.\n\n## Cat\n\nThe cat slept.\n\n## Other\n\nArchive passage.\n\n## Box\n\nThe box opened.',
      sectionPairing: [{ source: 0, target: 1 }, { source: 1, target: 3 }], pairIndex: 1,
    });
    const result = readPreparationOccurrence({ ...later, l: later.input.l });
    expect(result.expected.pairIndex).toBe(1);
    expect(result.pair.source.sliceIndex).toBe(1);
    expect(result.pair.target.sliceIndex).toBe(3);
    expect(result.prepared).toEqual(later.prepared);
  } }),
  it({ name: 'accepts a later-seat-only sparse record rather than requiring an asked prefix', fn: async () => {
    const outcomes = f.receipt.outcomes.slice(1);
    expect(outcomes).toHaveLength(1);
    expect(readPreparationReceipt({ value: { ...f.receipt, outcomes }, binding: f.expected.binding, question: f.receipt.question, l: f.input.l })).toEqual(outcomes);
  } }),
] });
