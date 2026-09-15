import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  preparationInputEntryId,
  preparationInputExclusion,
  preparationInputRawDocument,
  preparationInputReference,
  preparationInputReferenceBinding,
  PreparationRootError,
} from '../dist/final/node/preparation-input-read.mjs';

const path = 'inputs.fixture';
const hash = 'a'.repeat(64);
const binding = { role: 'reading-note', consumer: 'Tabby' };
const reference = { path: '/never-open/cat-note.json', hash, bytes: 0, bindings: [binding] };
const raw = { relPath: 'people/Tabby/page.md', bytes: 6, rawHash: hash, decodedHash: 'b'.repeat(64), effectiveHash: 'b'.repeat(64), foldedCrLf: 0 };

function refused(fn: () => unknown): PreparationRootError {
  try {
    fn();
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

await describe({ name: 'persisted reference and eligibility evidence', children: [
  ...['Tabby', '猫'].map(value => it({ name: `reads entry component ${value}`, fn: async () => {
    expect(preparationInputEntryId({ value, path })).toBe(value);
  } })),
  ...['', '..', 'Cat/other', String.raw`Cat\other`, ' Cat', 'Cat\u007F'].map(value => it({ name: `refuses entry component ${JSON.stringify(value)}`, fn: async () => {
    expect(refused(() => preparationInputEntryId({ value, path })).kind).toBe('input-shape');
  } })),
  ...['policy-pool', 'reading-journal', 'prior-reading-journal', 'opaque-selection-support'].map(role => it({ name: `keeps ${role} attributed to selection`, fn: async () => {
    expect(preparationInputReferenceBinding({ value: { role, consumer: 'selection' }, path })).toEqual({ role, consumer: 'selection' });
    expect(refused(() => preparationInputReferenceBinding({ value: { role, consumer: 'Tabby' }, path })).kind).toBe('input-relations');
  } })),
  ...['reading-note', 'complete-entry-reading-frame'].map(role => it({ name: `retains ${role} consumer for later membership validation`, fn: async () => {
    const result = preparationInputReferenceBinding({ value: { role, consumer: 'Tabby' }, path });
    expect(result).toEqual({ role, consumer: 'Tabby' });
    expect(Object.isFrozen(result)).toBe(true);
  } })),
  it({ name: 'rejects unknown reference authority and missing attribution', fn: async () => {
    refused(() => preparationInputReferenceBinding({ value: { role: 'approved-writer', consumer: 'Tabby' }, path }));
    refused(() => preparationInputReferenceBinding({ value: { ...binding, consumer: '' }, path }));
    refused(() => preparationInputReferenceBinding({ value: { ...binding, permission: 'q7z9k2' }, path }));
    refused(() => preparationInputReferenceBinding({ value: { role: 'reading-note' }, path }));
  } }),
  it({ name: 'owns complete reference data without opening its locator', fn: async () => {
    const result = preparationInputReference({ value: reference, path });
    expect(result).toEqual(reference);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.bindings)).toBe(true);
    expect(Object.isFrozen(result.bindings[0])).toBe(true);
    const distinct = { ...reference, bindings: [binding, { role: 'complete-entry-reading-frame', consumer: 'Tabby' }] };
    expect(preparationInputReference({ value: distinct, path })).toEqual(distinct);
  } }),
  it({ name: 'refuses empty or duplicated role-consumer attribution', fn: async () => {
    expect(refused(() => preparationInputReference({ value: { ...reference, bindings: [] }, path })).kind).toBe('input-relations');
    expect(refused(() => preparationInputReference({ value: { ...reference, bindings: [binding, binding] }, path })).kind).toBe('input-relations');
  } }),
  ...Object.keys(reference).map(key => it({ name: `requires reference field ${key}`, fn: async () => {
    const value = { ...reference };
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputReference({ value, path }));
  } })),
  it({ name: 'preserves separate raw and decoded identities when no CRLF is folded', fn: async () => {
    const result = preparationInputRawDocument({ value: raw, path });
    expect(result).toEqual(raw);
    expect(result.rawHash === result.decodedHash).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
  } }),
  it({ name: 'retains explicit folded identities without inventing raw bytes', fn: async () => {
    const value = { ...raw, foldedCrLf: 3, effectiveHash: 'c'.repeat(64) };
    expect(preparationInputRawDocument({ value, path })).toEqual(value);
  } }),
  it({ name: 'checks represented folding extent and zero-fold identity consistency', fn: async () => {
    expect(refused(() => preparationInputRawDocument({ value: { ...raw, foldedCrLf: 4 }, path })).kind).toBe('input-relations');
    expect(refused(() => preparationInputRawDocument({ value: { ...raw, effectiveHash: 'c'.repeat(64) }, path })).kind).toBe('input-relations');
    refused(() => preparationInputRawDocument({ value: { ...raw, foldedCrLf: -1 }, path }));
    refused(() => preparationInputRawDocument({ value: { ...raw, rawHash: 'q7z9k2' }, path }));
    refused(() => preparationInputRawDocument({ value: { ...raw, relPath: '' }, path }));
  } }),
  ...Object.keys(raw).map(key => it({ name: `requires raw-document field ${key}`, fn: async () => {
    const value = { ...raw };
    Reflect.deleteProperty(value, key);
    refused(() => preparationInputRawDocument({ value, path }));
  } })),
  ...[
    { entryId: 'Tabby', kind: 'missing-corpus-side' },
    { entryId: 'Tabby', kind: 'production-whole-page-original', archiveHash: hash, noteHash: hash },
    { entryId: 'Tabby', kind: 'normalized-whole-page-original', archiveHash: hash, targetHash: hash, noteHash: hash },
  ].map(value => it({ name: `retains exact exclusion evidence ${value.kind}`, fn: async () => {
    const result = preparationInputExclusion({ value, path });
    expect(result).toEqual(value);
    expect(Object.isFrozen(result)).toBe(true);
    refused(() => preparationInputExclusion({ value: { ...value, invented: 'q7z9k2' }, path }));
    refused(() => preparationInputExclusion({ value: { ...value, entryId: '..' }, path }));
  } })),
  it({ name: 'refuses new exclusion kinds and incomplete declaration evidence', fn: async () => {
    refused(() => preparationInputExclusion({ value: [], path }));
    refused(() => preparationInputExclusion({ value: { entryId: 'Tabby', kind: 'new-exclusion' }, path }));
    refused(() => preparationInputExclusion({ value: { entryId: 'Tabby', kind: 'production-whole-page-original', archiveHash: hash }, path }));
    refused(() => preparationInputExclusion({ value: { entryId: 'Tabby', kind: 'normalized-whole-page-original', archiveHash: hash, noteHash: hash }, path }));
  } }),
] });
