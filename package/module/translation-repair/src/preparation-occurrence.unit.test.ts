import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  alignDocumentSections,
  hashContent,
  parseDocument,
  qualifyPreparedBlockPairing,
  readPreparationOccurrence,
} from '../dist/final/node/index.mjs';
import { receiptFailure, receiptFixture, } from './preparation-receipt.test-fixture.ts';

await describe({ name: readPreparationOccurrence.name, children: [
  ...[
    { name: 'ordinary native pairing', options: {} },
    { name: 'native fallback', options: { replies: ['{"pairs":[]}'] } },
    { name: 'heard wire with invalid semantic indexes', options: { replies: ['{"pairs":[{"source":-1,"target":0}]}'] } },
    { name: 'native schema loss', options: { replies: ['{"pairs":"invalid-shape"}'] } },
    { name: 'crossed definition findings and separation', options: {
      sourceText: '猫[^1]。\n\n[^1]: 一。\n\n[^2]: 二。',
      targetText: 'Cat[^2].\n\n[^1]: Two.\n\n[^2]: One.',
      replies: ['{"pairs":[{"source":0,"target":0},{"source":1,"target":2},{"source":2,"target":1}]}'],
    } },
    { name: 'unendorsed caption gap beside media', options: {
      sourceText: '猫睡了。\n\n<PhotoScroll photos={["photos/cat.webp"]} />',
      targetText: 'The cat slept.\n\nA caption.\n\n<PhotoScroll photos={["photos/cat.webp"]} />',
      replies: ['{"pairs":[{"source":0,"target":0},{"source":1,"target":2}]}'],
    } },
  ].map(({ name, options }) => it({ name: `reconstructs exact ${name} handoff from actual acquired outcomes`, fn: async () => {
    const f = await receiptFixture(options);
    const calls = f.calls.length;
    const result = readPreparationOccurrence({ ...f, l: f.input.l });
    expect(result.scope).toBe('receipt-bound-occurrence');
    expect(result.prepared).toEqual(f.prepared);
    expect(result.pair).toEqual(f.input.pair);
    expect(result.source.documentHash).toBe(f.expected.sourceHash);
    expect(result.target.documentHash).toBe(f.expected.targetHash);
    expect(f.calls).toHaveLength(calls);
    expect('qualification' in result).toBe(false);
  } })),
  it({ name: 'reconstructs deterministic transcript claims from current full-document containers', fn: async () => {
    const token = ['$', '{path}'].join('');
    const marker = `<PhotoScroll photos={['${token}/photos/letter.webp']} />`;
    const f = await receiptFixture({ sourceText: `About the cat.\n\n${marker}\n\nRemember the cat.`,
      targetText: `About the cat.\n\n${marker}\n\n<details>\n<summary>Letter</summary>\n> Translated letter.\n</details>\n\nRemember the cat.`,
      replies: ['{"pairs":[{"source":0,"target":0},{"source":1,"target":1},{"source":2,"target":4}]}'] });
    const result = readPreparationOccurrence({ ...f, l: f.input.l });
    expect(result.target.containers.length).toBeGreaterThan(0);
    expect(result.prepared.findings.some(finding => finding.startsWith('block-pairing media-adjacent'))).toBe(true);
    expect(result.prepared).toEqual(f.prepared);
    const qualified = qualifyPreparedBlockPairing({ pair: result.pair, pairIndex: result.expected.pairIndex, prepared: result.prepared,
      modelIds: result.expected.binding.modelIds, targetContainers: result.target.containers, l: f.input.l });
    if (qualified.kind !== 'queried') throw new Error('expected queried transcript ownership qualification');
    expect(qualified.relations.filter(relation => relation.authority === 'deterministic-media-adjacency')).toEqual([
      { source: 1, target: 2, authority: 'deterministic-media-adjacency' },
      { source: 1, target: 3, authority: 'deterministic-media-adjacency' },
    ]);
  } }),
  it({ name: 'keeps semantic qualification separate even after complete receipt reconstruction', fn: async () => {
    const f = await receiptFixture();
    const result = readPreparationOccurrence({ ...f, l: f.input.l });
    const qualified = qualifyPreparedBlockPairing({ pair: result.pair, pairIndex: result.expected.pairIndex,
      prepared: result.prepared, modelIds: result.expected.binding.modelIds, targetContainers: result.target.containers, l: f.input.l });
    expect(qualified.qualification).toBe('pairing-only');
    expect(qualified.kind).toBe('queried');
  } }),
  it({ name: 'uses registered section correspondence and retains its current alignment findings', fn: async () => {
    const f = await receiptFixture({ sourceText: '## 猫\n\n猫睡了。\n\n## 盒子\n\n盒子开了。',
      targetText: '## Box\n\nThe box opened.\n\n## Cat\n\nThe cat slept.', sectionPairing: [{ source: 0, target: 1 }] });
    expect(receiptFailure(() => readPreparationOccurrence({ ...f, l: f.input.l }))).toBe('no-refusal');
    const result = readPreparationOccurrence({ ...f, l: f.input.l });
    const alignment = alignDocumentSections({ source: result.source, target: result.target,
      ...((f.expected.sectionPairing === undefined) ? {} : { sectionPairing: f.expected.sectionPairing }) });
    expect(result.prepared).toEqual(f.prepared);
    expect(result.pair.target.sliceIndex).toBe(1);
    expect(result.alignmentFindings).toEqual(alignment.findings);
    expect(result.alignmentFindings.length).toBeGreaterThan(0);
    const { sectionPairing: _pairing, ...without } = f.expected;
    expect(receiptFailure(() => readPreparationOccurrence({ ...f, expected: without, l: f.input.l }))).toBe('parent');
    expect(receiptFailure(() => readPreparationOccurrence({ ...f, expected: { ...f.expected, sectionPairing: [] }, l: f.input.l }))).toBe('parent');
  } }),
  it({ name: 'refuses either current document mismatch before parsing or receipt inspection', fn: async () => {
    const f = await receiptFixture();
    expect(receiptFailure(() => readPreparationOccurrence({ ...f, sourceText: '<invalid', receipt: null, l: f.input.l }))).toBe('documents');
    expect(receiptFailure(() => readPreparationOccurrence({ ...f, targetText: '<invalid', receipt: null, l: f.input.l }))).toBe('documents');
  } }),
  it({ name: 'refuses local question changes even when the owner supplied the new document hash', fn: async () => {
    const f = await receiptFixture();
    const sourceText = f.sourceText.replace('猫', '狗');
    const targetText = f.targetText.replace('cat', 'dog');
    expect(receiptFailure(() => readPreparationOccurrence({ ...f, sourceText,
      expected: { ...f.expected, sourceHash: hashContent({ content: sourceText }) }, l: f.input.l }))).toBe('question');
    expect(receiptFailure(() => readPreparationOccurrence({ ...f, targetText,
      expected: { ...f.expected, targetHash: hashContent({ content: targetText }) }, l: f.input.l }))).toBe('question');
  } }),
  it({ name: 'rejects unsafe, absent and wrong side indexes independently', fn: async () => {
    const f = await receiptFixture();
    for (const field of ['pairIndex', 'sourceIndex', 'targetIndex']) {
      for (const index of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, 1]) {
        expect(receiptFailure(() => readPreparationOccurrence({ ...f, expected: { ...f.expected, [field]: index }, l: f.input.l }))).toBe('parent');
      }
    }
  } }),
  it({ name: 'does not manufacture question receipts for structural singleton or empty-side dispatch', fn: async () => {
    const f = await receiptFixture();
    for (const [sourceText, targetText] of [['猫。', 'Cat.'], ['', 'Cat.'], ['猫。', ''], ['', '']] as const) {
      const expected = { ...f.expected, sourceHash: hashContent({ content: sourceText }), targetHash: hashContent({ content: targetText }) };
      expect(receiptFailure(() => readPreparationOccurrence({ ...f, sourceText, targetText, expected, l: f.input.l }))).toBe('parent');
    }
  } }),
  it({ name: 'owns current documents and handoff so a consumer cannot change subsequent reconstruction', fn: async () => {
    const f = await receiptFixture();
    const input = { ...f, l: f.input.l };
    const originalExpected = structuredClone(f.expected);
    const baseline = readPreparationOccurrence(input);
    const first = readPreparationOccurrence(input);
    Object.defineProperty(first.target, 'nodes', { value: [] });
    Object.defineProperty(first.prepared, 'findings', { value: ['changed fixture output'] });
    Object.defineProperty(first.expected.binding, 'modelIds', { value: [] });
    expect(f.expected).toEqual(originalExpected);
    expect(readPreparationOccurrence(input)).toEqual(baseline);
    expect(first.pair).not.toBe(f.input.pair);
    expect(parseDocument({ text: f.targetText }).nodes).toEqual(baseline.target.nodes);
  } }),
] });
