import { createHash, } from 'node:crypto';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  preparationInputEntry,
  PreparationRootError,
} from '../dist/final/node/preparation-input-read.mjs';

const path = 'inputs.entries[0]';
function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
type EntryFixture = Omit<ReturnType<typeof preparationInputEntry>, 'archiveLines'> & {
  readonly archiveLines: { text: string; lineNumber: number }[];
};
function fixture(): EntryFixture {
  const sourceText = 'Cat source 😺';
  const archiveText = 'non\u2011binary cat\n(To-Do)\nTail';
  const targetText = 'non-binary cat\nTail';
  return {
    entryId: 'Cat', sourceText, archiveText, targetText,
    sourceHash: hash(sourceText), archiveHash: hash(archiveText), targetHash: hash(targetText),
    originalPolicy: { inherited: 'none', normalized: 'none', spans: [] },
    archiveLines: [{ text: 'non-binary cat', lineNumber: 1 }, { text: 'Tail', lineNumber: 3 }],
    sourceFindings: [{ kind: 'html-comment-skipped', startOffset: 0, endOffset: 1, detail: 'Retained observation' }],
    targetFindings: [{ kind: 'mdx-downgraded', startOffset: 0, endOffset: 1, detail: 'Retained parser reason' }],
    alignmentFindings: [{ kind: 'structure-mismatch', attachedTo: { kind: 'source-section', index: 9 }, detail: 'Unaligned sections are not necessarily represented by parents' }],
  };
}
function refused(value: unknown): PreparationRootError {
  try {
    preparationInputEntry({ value, path });
  }
  catch (error) {
    expect(error).toBeInstanceOf(PreparationRootError);
    if (!(error instanceof PreparationRootError)) throw error;
    expect(error.message).not.toContain('q7z9k2');
    return error;
  }
  expect(false).toBe(true);
  throw new Error('Unreachable after missing-refusal assertion');
}

await describe({ name: 'complete persisted entry decoder', children: [
  it({ name: 'rebuilds complete entry data while keeping archive and normalized target independent', fn: async () => {
    const value = fixture();
    const result = preparationInputEntry({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.originalPolicy)).toBe(true);
    expect(Object.isFrozen(result.originalPolicy.spans)).toBe(true);
    expect(Object.isFrozen(result.archiveLines)).toBe(true);
    expect(Object.isFrozen(result.archiveLines[0])).toBe(true);
    expect(Object.isFrozen(result.sourceFindings)).toBe(true);
    expect(Object.isFrozen(result.sourceFindings[0])).toBe(true);
    expect(Object.isFrozen(result.targetFindings)).toBe(true);
    expect(Object.isFrozen(result.targetFindings[0])).toBe(true);
    expect(Object.isFrozen(result.alignmentFindings)).toBe(true);
    expect(Object.isFrozen(result.alignmentFindings[0]?.attachedTo)).toBe(true);
    value.archiveLines.splice(0);
    expect(result.archiveLines.length).toBe(2);
  } }),
  it({ name: 'accepts empty documents and represented blank lines without a positive text-size floor', fn: async () => {
    const value = { ...fixture(), sourceText: '', archiveText: '', targetText: '', sourceHash: hash(''), archiveHash: hash(''), targetHash: hash(''), archiveLines: [{ text: '', lineNumber: 1 }], sourceFindings: [], targetFindings: [], alignmentFindings: [] };
    expect(preparationInputEntry({ value, path })).toEqual(value);
    const removed = { ...value, archiveText: '(To-Do)', archiveHash: hash('(To-Do)'), archiveLines: [] };
    expect(preparationInputEntry({ value: removed, path })).toEqual(removed);
  } }),
  ...Object.keys(fixture()).map(key => it({ name: `requires complete-entry field ${key}`, fn: async () => {
    const value = fixture();
    Reflect.deleteProperty(value, key);
    refused(value);
  } })),
  ...['sourceHash', 'archiveHash', 'targetHash'].map(key => it({ name: `checks ${key} against its own represented text`, fn: async () => {
    expect(refused({ ...fixture(), [key]: 'f'.repeat(64) }).kind).toBe('input-relations');
  } })),
  ...['sourceText', 'archiveText', 'targetText'].map(key => it({ name: `refuses changed ${key} without its identity`, fn: async () => {
    refused({ ...fixture(), [key]: 'q7z9k2' });
  } })),
  it({ name: 'rejects unknown entry fields and invalid entry directory components', fn: async () => {
    refused({ ...fixture(), approval: true });
    refused({ ...fixture(), entryId: '../q7z9k2' });
  } }),
  ...['inherited', 'normalized'].map(key => it({ name: `rejects an eligible entry carrying ${key} whole-page exclusion`, fn: async () => {
    const value = fixture();
    refused({ ...value, originalPolicy: { ...value.originalPolicy, [key]: 'whole-page' } });
  } })),
  it({ name: 'bounds normalized protection spans against represented target text', fn: async () => {
    const value = fixture();
    const spans = [{ startOffset: 0, endOffset: 1, note: 'Cat declaration' }];
    const admitted = { ...value, originalPolicy: { inherited: 'none', normalized: 'spans', spans } };
    const result = preparationInputEntry({ value: admitted, path });
    expect(result).toEqual(admitted);
    expect(Object.isFrozen(result.originalPolicy.spans[0])).toBe(true);
    refused({ ...admitted, originalPolicy: { ...admitted.originalPolicy, spans: [{ ...spans[0], endOffset: value.targetText.length + 1 }] } });
  } }),
  it({ name: 'accepts a zero-width protection span at the complete target boundary', fn: async () => {
    const value = fixture();
    const spans = [{ startOffset: value.targetText.length, endOffset: value.targetText.length, note: 'Cat declaration' }];
    const candidate = { ...value, originalPolicy: { inherited: 'none', normalized: 'spans', spans } };
    expect(preparationInputEntry({ value: candidate, path })).toEqual(candidate);
  } }),
  it({ name: 'does not remove retained stub-looking text or reinterpret declaration prose', fn: async () => {
    const text = '(To-Do)';
    const candidate = { ...fixture(), archiveText: text, targetText: text, archiveHash: hash(text), targetHash: hash(text), archiveLines: [{ text, lineNumber: 1 }], originalPolicy: { inherited: 'none', normalized: 'spans', spans: [{ startOffset: 0, endOffset: text.length, note: 'Original language: English' }] } };
    expect(preparationInputEntry({ value: candidate, path })).toEqual(candidate);
  } }),
  it({ name: 'retains malformed MDX text with its explicit parser observation', fn: async () => {
    const sourceText = '<Cat photos=[';
    const candidate = { ...fixture(), sourceText, sourceHash: hash(sourceText), sourceFindings: [{ kind: 'mdx-downgraded', startOffset: 0, endOffset: sourceText.length, detail: 'Retained malformed MDX observation' }] };
    expect(preparationInputEntry({ value: candidate, path })).toEqual(candidate);
  } }),
  ...[
    { from: '\u2011', to: '-', name: 'nonbreaking hyphen' },
    { from: '\u00a0', to: ' ', name: 'nonbreaking space' },
    { from: '\u202f', to: ' ', name: 'narrow nonbreaking space' },
    { from: '\u00ad', to: '', name: 'soft hyphen' },
    { from: '\u200b', to: '', name: 'zero-width space' },
    { from: '\u2060', to: '', name: 'word joiner' },
    { from: '\ufeff', to: '', name: 'byte-order mark' },
  ].map(({ from, to, name }) => it({ name: `checks ${name} folding without shifting LF origins`, fn: async () => {
    const archiveText = `${from}\nCat${from}Tail\n${from}`;
    const targetText = `${to}\nCat${to}Tail\n${to}`;
    const archiveLines = [{ text: to, lineNumber: 1 }, { text: `Cat${to}Tail`, lineNumber: 2 }, { text: to, lineNumber: 3 }];
    const candidate = { ...fixture(), archiveText, targetText, archiveHash: hash(archiveText), targetHash: hash(targetText), archiveLines };
    expect(preparationInputEntry({ value: candidate, path })).toEqual(candidate);
  } })),
  it({ name: 'checks retained text against the declared folded archive origin', fn: async () => {
    const value = fixture();
    refused({ ...value, archiveLines: [{ text: 'non-binary cat', lineNumber: 2 }, { text: 'Tail', lineNumber: 3 }] });
    refused({ ...value, archiveLines: [{ text: 'non-binary cat', lineNumber: 1 }, { text: 'Tail', lineNumber: 99 }] });
  } }),
  it({ name: 'rejects repeated origins even when target text and target hash agree', fn: async () => {
    const value = fixture();
    const targetText = 'non-binary cat\nnon-binary cat';
    refused({ ...value, targetText, targetHash: hash(targetText), archiveLines: [{ text: 'non-binary cat', lineNumber: 1 }, { text: 'non-binary cat', lineNumber: 1 }] });
  } }),
  it({ name: 'rejects descending origins even when target text and target hash agree', fn: async () => {
    const value = fixture();
    const targetText = 'Tail\nnon-binary cat';
    refused({ ...value, targetText, targetHash: hash(targetText), archiveLines: [{ text: 'Tail', lineNumber: 3 }, { text: 'non-binary cat', lineNumber: 1 }] });
  } }),
  it({ name: 'checks retained-line reconstruction separately from target hashing', fn: async () => {
    const targetText = 'Different cat text';
    refused({ ...fixture(), targetText, targetHash: hash(targetText) });
  } }),
  ...['sourceFindings', 'targetFindings'].map(key => it({ name: `bounds ${key} in its own document domain`, fn: async () => {
    refused({ ...fixture(), [key]: [{ kind: 'html-comment-skipped', startOffset: 0, endOffset: 999, detail: 'q7z9k2' }] });
  } })),
] });
