import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  preparationInputAlignmentAttachment,
  preparationInputAlignmentFinding,
  preparationInputArchiveLine,
  preparationInputOriginalPolicy,
  preparationInputOriginalSpan,
  preparationInputParseFinding,
  PreparationRootError,
} from '../dist/final/node/preparation-input-read.mjs';

const path = 'inputs.fixture';
const finding = { kind: 'html-comment-skipped', startOffset: 0, endOffset: 2, detail: 'Cat observation' };
const span = { startOffset: 0, endOffset: 2, note: 'Cat declaration' };
function refused(fn: () => unknown): void {
  try {
    fn();
  }
  catch (error) {
    expect(error).toBeInstanceOf(PreparationRootError);
    if (!(error instanceof PreparationRootError)) throw error;
    expect(error.message).not.toContain('q7z9k2');
    return;
  }
  expect(false).toBe(true);
}

await describe({ name: 'persisted policy and observation fields', children: [
  ...['html-comment-skipped', 'unterminated-html-comment', 'invisible-line-masked', 'mdx-downgraded'].map(kind => it({ name: `retains parser observation ${kind}`, fn: async () => {
    const value = { ...finding, kind };
    const result = preparationInputParseFinding({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
  } })),
  it({ name: 'rejects unknown parser kinds and invalid coordinates without exposing parser prose', fn: async () => {
    refused(() => preparationInputParseFinding({ value: { ...finding, kind: 'q7z9k2' }, path }));
    refused(() => preparationInputParseFinding({ value: { ...finding, startOffset: 3, detail: 'q7z9k2' }, path }));
    refused(() => preparationInputParseFinding({ value: { ...finding, endOffset: -1 }, path }));
    refused(() => preparationInputParseFinding({ value: { ...finding, trusted: true }, path }));
    const empty = { ...finding, startOffset: 0, endOffset: 0, detail: '' };
    expect(preparationInputParseFinding({ value: empty, path })).toEqual(empty);
  } }),
  ...Object.keys(finding).map(key => it({ name: `requires parser finding ${key}`, fn: async () => {
    const value = { ...finding };
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputParseFinding({ value, path }));
  } })),
  ...[{ kind: 'whole-document' }, { kind: 'source-section', index: 0 }, { kind: 'target-section', index: 2 }].map(value => it({ name: `keeps alignment attachment ${value.kind}`, fn: async () => {
    const result = preparationInputAlignmentAttachment({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    const observation = { kind: 'structure-mismatch', attachedTo: value, detail: 'Unaligned cat section' };
    expect(preparationInputAlignmentFinding({ value: observation, path })).toEqual(observation);
  } })),
  it({ name: 'rejects invented alignment domains and extra or missing section coordinates', fn: async () => {
    refused(() => preparationInputAlignmentAttachment({ value: { kind: 'pair', index: 1 }, path }));
    refused(() => preparationInputAlignmentAttachment({ value: { kind: 'whole-document', index: 0 }, path }));
    refused(() => preparationInputAlignmentAttachment({ value: { kind: 'source-section' }, path }));
    refused(() => preparationInputAlignmentAttachment({ value: { kind: 'target-section', index: -1 }, path }));
    refused(() => preparationInputAlignmentFinding({ value: { kind: 'sections-merged', attachedTo: { kind: 'whole-document' }, detail: 'q7z9k2' }, path }));
    refused(() => preparationInputAlignmentFinding({ value: { kind: 'structure-mismatch', attachedTo: { kind: 'whole-document' }, detail: 1 }, path }));
  } }),
  it({ name: 'retains declared spans including an end-of-document empty interval', fn: async () => {
    const result = preparationInputOriginalSpan({ value: span, path });
    expect(result).toEqual(span);
    expect(Object.isFrozen(result)).toBe(true);
    const empty = { ...span, startOffset: 2 };
    expect(preparationInputOriginalSpan({ value: empty, path })).toEqual(empty);
    refused(() => preparationInputOriginalSpan({ value: { ...span, startOffset: 3 }, path }));
    refused(() => preparationInputOriginalSpan({ value: { ...span, note: ' ' }, path }));
    refused(() => preparationInputOriginalSpan({ value: { ...span, authority: 'q7z9k2' }, path }));
  } }),
  ...Object.keys(span).map(key => it({ name: `requires original span ${key}`, fn: async () => {
    const value = { ...span };
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputOriginalSpan({ value, path }));
  } })),
  ...['none', 'spans', 'whole-page'].map(inherited => it({ name: `retains inherited ${inherited} independently of normalized classification`, fn: async () => {
    const value = { inherited, normalized: 'none', spans: [] };
    expect(preparationInputOriginalPolicy({ value, path })).toEqual(value);
  } })),
  it({ name: 'preserves normalized spans and keeps whole-page eligibility enforcement at the entry boundary', fn: async () => {
    const value = { inherited: 'none', normalized: 'spans', spans: [span] };
    const result = preparationInputOriginalPolicy({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.spans)).toBe(true);
    expect(Object.isFrozen(result.spans[0])).toBe(true);
    const whole = { inherited: 'none', normalized: 'whole-page', spans: [] };
    expect(preparationInputOriginalPolicy({ value: whole, path })).toEqual(whole);
  } }),
  it({ name: 'rejects inconsistent normalized span presence instead of reclassifying policy', fn: async () => {
    refused(() => preparationInputOriginalPolicy({ value: { inherited: 'none', normalized: 'spans', spans: [] }, path }));
    refused(() => preparationInputOriginalPolicy({ value: { inherited: 'none', normalized: 'none', spans: [span] }, path }));
    refused(() => preparationInputOriginalPolicy({ value: { inherited: 'none', normalized: 'whole-page', spans: [span] }, path }));
    refused(() => preparationInputOriginalPolicy({ value: { inherited: 'q7z9k2', normalized: 'none', spans: [] }, path }));
  } }),
  ...['text', 'lineNumber'].map(key => it({ name: `requires retained-line ${key}`, fn: async () => {
    const value = { text: 'Cat', lineNumber: 1 };
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputArchiveLine({ value, path }));
  } })),
  it({ name: 'keeps blank lines, lone CR and Unicode separators while refusing LF and zero origins', fn: async () => {
    for (const text of ['', '\r', '\u2028']) {
      const value = { text, lineNumber: 1 };
      const result = preparationInputArchiveLine({ value, path });
      expect(result).toEqual(value);
      expect(Object.isFrozen(result)).toBe(true);
    }
    refused(() => preparationInputArchiveLine({ value: { text: 'Cat\nTail', lineNumber: 1 }, path }));
    refused(() => preparationInputArchiveLine({ value: { text: 'Cat', lineNumber: 0 }, path }));
    refused(() => preparationInputArchiveLine({ value: { text: 'Cat', lineNumber: 1, note: 'q7z9k2' }, path }));
  } }),
] });
